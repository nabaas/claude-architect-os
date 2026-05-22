/**
 * Scout Agent — Claude Architect OS
 * Scans trends, finds opportunities, identifies arbitrage.
 * Feeds: Chain 1 (Signal→Profit), Chain 6 (Arbitrage)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();
const QUEUE_DIR = path.join(process.env.HOME!, ".amsa/linear-queue");

export interface ScoutFinding {
  id: string;
  type: "arbitrage" | "trend" | "demand_gap" | "viral_product";
  title: string;
  description: string;
  score: number; // 0-1 using (demand+compound+leverage)×ttv_inv×sat_inv
  actionRequired: string;
  chain: 1 | 6;
  data: Record<string, unknown>;
  foundAt: string;
}

const SYSTEM_PROMPT = `You are the Scout Agent for CMNDCENTER — an autonomous opportunity detector.
You find high-ROI opportunities across markets, trends, and arbitrage gaps.
Score every finding using: (demand + compound + leverage) × ttv_inv × saturation_inv
Output structured JSON only. Be conservative and precise.`;

export async function scout(query: string): Promise<ScoutFinding[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Scout for opportunities: "${query}"

Find 3-5 actionable opportunities. For each:
- type: arbitrage|trend|demand_gap|viral_product
- title: concise name
- description: what the opportunity is
- score: 0-1 using the formula
- actionRequired: first concrete step
- chain: 1 (profit signal) or 6 (arbitrage)

JSON array only.`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const raw = JSON.parse(match[0]);
    const findings: ScoutFinding[] = raw.map((r: Record<string, unknown>, i: number) => ({
      id: `scout-${Date.now()}-${i}`,
      type: r.type || "trend",
      title: r.title || "Unnamed",
      description: r.description || "",
      score: Math.min(Math.max(Number(r.score) || 0.5, 0), 1),
      actionRequired: r.actionRequired || "",
      chain: Number(r.chain) === 6 ? 6 : 1,
      data: r,
      foundAt: new Date().toISOString(),
    }));

    // Save to queue
    const filtered = findings.filter((f) => f.score >= 0.6);
    if (filtered.length > 0) {
      const date = new Date().toISOString().split("T")[0];
      const outPath = path.join(QUEUE_DIR, `scout-${date}.json`);
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
      const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf-8")) : [];
      fs.writeFileSync(outPath, JSON.stringify([...existing, ...filtered], null, 2));
      fs.writeFileSync(path.join(QUEUE_DIR, "latest.json"), JSON.stringify(filtered, null, 2));
    }

    return findings;
  } catch { return []; }
}

if (require.main === module) {
  const query = process.argv.slice(2).join(" ") || "AI tools and marketplace opportunities";
  scout(query).then((findings) => {
    console.log(`\n🔍 Scout found ${findings.length} opportunities:`);
    findings.forEach((f) => console.log(`  [${f.score.toFixed(2)}] ${f.title}: ${f.actionRequired}`));
  });
}
