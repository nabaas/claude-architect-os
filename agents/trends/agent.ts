/**
 * Trends Agent — Claude Architect OS
 * Monitors virality signals, Google Trends spikes, Amazon BSR, social momentum.
 * Feeds: Chain 1 (Signal→Profit), Chain 6 (Arbitrage), Chain 7 (Content→Revenue)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Trends Agent for CMNDCENTER — a virality and market momentum specialist.
You detect trends before they peak. You score momentum, predict ceiling, and identify the profit window.
Every trend: momentum score → peak estimate → content angle → product angle → time-to-act.
You operate at the intersection of social signals, search volume, and marketplace demand.`;

export interface TrendSignal {
  id: string;
  keyword: string;
  category: "ai-tool" | "marketplace" | "crypto" | "content" | "local" | "other";
  momentumScore: number; // 0-1 (how fast it's growing)
  peakEta: string; // estimated peak date
  contentAngle: string; // WAND content opportunity
  productAngle: string; // build/arbitrage opportunity
  chainId: number; // which CMNDCENTER chain this feeds
  actionWindow: "now" | "24h" | "week" | "monitor";
  confidence: number; // 0-1
  savedAt: string;
}

export async function analyzeTrends(
  topics: string[],
  region: string = "US"
): Promise<TrendSignal[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3072,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Analyze trend momentum for these topics in ${region}:
${topics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

For each topic, assess based on your knowledge of:
- Current AI tool adoption curves
- Marketplace arbitrage windows (eBay, Amazon, Facebook Marketplace)
- Crypto market cycles
- YouTube/TikTok content virality patterns
- Denver/local market demand signals

Output JSON array: [{
  "keyword": string,
  "category": "ai-tool|marketplace|crypto|content|local|other",
  "momentumScore": 0-1,
  "peakEta": "YYYY-MM-DD estimate",
  "contentAngle": "specific WAND content opportunity",
  "productAngle": "build or arbitrage opportunity",
  "chainId": 1|6|7,
  "actionWindow": "now|24h|week|monitor",
  "confidence": 0-1
}]`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const raw = JSON.parse(match[0]);
    const signals: TrendSignal[] = raw.map((r: Record<string, unknown>, i: number): TrendSignal => ({
      id: `trend-${Date.now()}-${i}`,
      keyword: String(r.keyword || topics[i] || ""),
      category: (["ai-tool", "marketplace", "crypto", "content", "local", "other"].includes(r.category as string)
        ? r.category : "other") as TrendSignal["category"],
      momentumScore: Math.min(Math.max(Number(r.momentumScore) || 0, 0), 1),
      peakEta: String(r.peakEta || ""),
      contentAngle: String(r.contentAngle || ""),
      productAngle: String(r.productAngle || ""),
      chainId: Number(r.chainId) || 1,
      actionWindow: (["now", "24h", "week", "monitor"].includes(r.actionWindow as string)
        ? r.actionWindow : "monitor") as TrendSignal["actionWindow"],
      confidence: Math.min(Math.max(Number(r.confidence) || 0, 0), 1),
      savedAt: new Date().toISOString(),
    }));

    // Queue high-momentum signals
    const urgent = signals.filter((s) => s.momentumScore > 0.7 && s.actionWindow !== "monitor");
    if (urgent.length > 0) {
      const queueDir = path.join(process.env.HOME!, ".amsa/linear-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(
        path.join(queueDir, `trends-${new Date().toISOString().split("T")[0]}.json`),
        JSON.stringify(urgent, null, 2)
      );
    }

    return signals;
  } catch { return []; }
}

export async function detectViralWindow(signal: TrendSignal): Promise<{
  buyIn: boolean;
  reason: string;
  estimatedReach: number;
  contentFormat: string;
}> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Evaluate viral window for trend: "${signal.keyword}"
Momentum: ${signal.momentumScore} | Category: ${signal.category} | Peak ETA: ${signal.peakEta}

Should we act NOW? Output JSON: {
  "buyIn": boolean,
  "reason": "one sentence",
  "estimatedReach": number (YouTube views potential),
  "contentFormat": "shorts|long-form|series|tutorial"
}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { buyIn: false, reason: "Analysis failed", estimatedReach: 0, contentFormat: "shorts" };
  } catch {
    return { buyIn: false, reason: "Analysis failed", estimatedReach: 0, contentFormat: "shorts" };
  }
}

export async function generateTrendBriefing(signals: TrendSignal[]): Promise<string> {
  if (signals.length === 0) return "No trends to report.";

  const top = signals.sort((a, b) => b.momentumScore - a.momentumScore).slice(0, 5);
  const lines = top.map((s) => `- ${s.keyword} [${(s.momentumScore * 100).toFixed(0)}% momentum, ${s.actionWindow}]: ${s.contentAngle}`);

  return `TRENDS BRIEFING — ${new Date().toLocaleDateString()}

TOP SIGNALS:
${lines.join("\n")}

CONTENT PIPELINE (WAND):
${top.filter((s) => s.chainId === 7).map((s) => `→ ${s.keyword}: ${s.contentAngle}`).join("\n") || "None above threshold"}

ARBITRAGE SIGNALS:
${top.filter((s) => s.chainId === 6).map((s) => `→ ${s.keyword}: ${s.productAngle}`).join("\n") || "None above threshold"}`;
}

if (require.main === module) {
  const topics = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ["AI video generation", "Amazon FBA arbitrage", "Bitcoin ETF flows", "AI coding tools", "Denver real estate"];

  analyzeTrends(topics).then(async (signals) => {
    console.log(`\n📈 Trends Agent: ${signals.length} signals analyzed\n`);
    signals.forEach((s) => {
      const icon = s.actionWindow === "now" ? "🔥" : s.actionWindow === "24h" ? "⚡" : "📡";
      console.log(`${icon} [${(s.momentumScore * 100).toFixed(0)}%] ${s.keyword}`);
      console.log(`   Content: ${s.contentAngle}`);
      console.log(`   Product: ${s.productAngle}\n`);
    });

    const briefing = await generateTrendBriefing(signals);
    console.log("\n" + briefing);
  });
}
