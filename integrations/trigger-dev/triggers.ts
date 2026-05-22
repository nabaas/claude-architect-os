/**
 * Trigger.dev — Claude Architect OS Background Jobs
 * Scheduled and event-driven tasks that run in the background.
 * Docs: trigger.dev
 */

import { client } from "@trigger.dev/sdk";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Daily Opportunity Scan (7:00 AM) ────────────────────────────────────────

client.defineJob({
  id: "daily-opportunity-scan",
  name: "Daily Market Opportunity Scan",
  version: "1.0.0",
  trigger: client.defineCronTrigger({ cron: "0 7 * * *" }),
  run: async (payload, io, ctx) => {
    await io.logger.info("Starting daily opportunity scan...");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: "You are a market intelligence agent. Identify top 5 arbitrage opportunities scoring >0.7 using (demand+compound+leverage)×ttv_inv×saturation_inv. Output JSON array.",
      messages: [{ role: "user", content: "Analyze current market for arbitrage opportunities in electronics, collectibles, and trending consumer goods." }],
    });

    const opportunities = JSON.parse(response.content[0].type === "text" ? response.content[0].text : "[]");

    // Write to AMSA queue
    const queuePath = path.join(process.env.HOME!, ".amsa/linear-queue", `opportunities-${new Date().toISOString().split("T")[0]}.json`);
    fs.mkdirSync(path.dirname(queuePath), { recursive: true });
    fs.writeFileSync(queuePath, JSON.stringify({ opportunities, scanned_at: new Date().toISOString() }, null, 2));

    await io.logger.info(`Found ${opportunities.length} opportunities`);
    return { count: opportunities.length, opportunities };
  },
});

// ─── System Health Check (Every 30 min) ──────────────────────────────────────

client.defineJob({
  id: "system-health-check",
  name: "CMNDCENTER Health Monitor",
  version: "1.0.0",
  trigger: client.defineCronTrigger({ cron: "*/30 * * * *" }),
  run: async (payload, io, ctx) => {
    const services = [
      { name: "Ollama", url: "http://localhost:11434/api/tags" },
      { name: "ChromaDB", url: "http://localhost:8000/api/v1/heartbeat" },
      { name: "n8n", url: "http://localhost:5678/healthz" },
      { name: "LiteLLM", url: "http://localhost:4000/health" },
    ];

    const results = await Promise.allSettled(
      services.map(async (svc) => {
        const res = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
        return { name: svc.name, status: res.ok ? "up" : "down", code: res.status };
      })
    );

    const health = results.map((r, i) =>
      r.status === "fulfilled" ? r.value : { name: services[i].name, status: "down", error: r.reason?.message }
    );

    const allUp = health.every((h) => h.status === "up");
    if (!allUp) {
      await io.logger.warn("Services down", { health });
    }

    return { healthy: allUp, services: health };
  },
});

// ─── Memory Sync (Every 6 hours) ─────────────────────────────────────────────

client.defineJob({
  id: "memory-sync",
  name: "Memory Pattern Sync to ChromaDB",
  version: "1.0.0",
  trigger: client.defineCronTrigger({ cron: "0 */6 * * *" }),
  run: async (payload, io, ctx) => {
    const patternsPath = path.join(process.env.HOME!, ".amsa/memory/patterns.json");
    if (!fs.existsSync(patternsPath)) {
      await io.logger.info("No patterns file found, skipping sync");
      return { synced: 0 };
    }

    const patterns = JSON.parse(fs.readFileSync(patternsPath, "utf-8"));
    const recent = patterns.slice(-20); // last 20 patterns

    // Upsert to ChromaDB
    const chromaRes = await fetch("http://localhost:8000/api/v1/collections/claude-architect-os/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: recent.map((_: unknown, i: number) => `pattern-sync-${Date.now()}-${i}`),
        documents: recent.map((p: { task: string; result_preview: string }) => `${p.task}: ${p.result_preview}`),
        metadatas: recent.map((p: { type: string; timestamp: string }) => ({ type: p.type, ts: p.timestamp })),
      }),
    });

    await io.logger.info(`Synced ${recent.length} patterns`, { ok: chromaRes.ok });
    return { synced: recent.length };
  },
});

// ─── Loki Build Trigger (on webhook) ─────────────────────────────────────────

client.defineJob({
  id: "loki-build-trigger",
  name: "Loki Mode Build on Demand",
  version: "1.0.0",
  trigger: client.defineHttpTrigger({ path: "/loki-build" }),
  run: async (payload: { requirement: string }, io, ctx) => {
    await io.logger.info(`Triggering Loki build: ${payload.requirement}`);

    const { execSync } = require("child_process");
    const output = execSync(`bash ~/CMNDCENTER/loki/loki.sh "${payload.requirement}" 2>&1`).toString();

    await io.logger.info("Loki build complete", { output: output.slice(-500) });
    return { success: true, output_preview: output.slice(-500) };
  },
});
