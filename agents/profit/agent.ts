/**
 * Profit Agent — Claude Architect OS
 * Finds monetization pathways, tracks margins, identifies scalable revenue systems.
 * Feeds: Chain 1, Chain 6, Chain 7
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Profit Agent for CMNDCENTER — a revenue optimization specialist.
You convert information asymmetry into monetizable opportunities.
Focus: arbitrage, AI leverage, automation, recurring revenue, scalable workflows.
Every output includes: revenue model, margin %, time-to-revenue, scalability score.`;

export interface ProfitOpportunity {
  id: string;
  name: string;
  revenueModel: "arbitrage" | "subscription" | "one-time" | "ad-revenue" | "service";
  estimatedMonthlyRevenue: number;
  marginPct: number;
  timeToRevenueDays: number;
  scalabilityScore: number; // 1-10
  requiredCapital: number;
  automationPotential: number; // 0-1
  firstStep: string;
  chain: number;
}

export async function findProfitOpportunities(context: string): Promise<ProfitOpportunity[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Find 3-5 profit opportunities from: "${context}"

For each opportunity, provide realistic estimates. Prioritize:
- High automation potential (reduce time investment)
- Low required capital
- Fast time-to-revenue
- Recurring/scalable revenue

JSON array: [{
  "name": string,
  "revenueModel": "arbitrage|subscription|one-time|ad-revenue|service",
  "estimatedMonthlyRevenue": number,
  "marginPct": number,
  "timeToRevenueDays": number,
  "scalabilityScore": 1-10,
  "requiredCapital": number,
  "automationPotential": 0-1,
  "firstStep": string,
  "chain": 1|6|7
}]`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const raw = JSON.parse(match[0]);
    const opportunities = raw.map((r: Record<string, unknown>, i: number): ProfitOpportunity => ({
      id: `profit-${Date.now()}-${i}`,
      name: String(r.name || "Unnamed"),
      revenueModel: (r.revenueModel as ProfitOpportunity["revenueModel"]) || "one-time",
      estimatedMonthlyRevenue: Number(r.estimatedMonthlyRevenue) || 0,
      marginPct: Number(r.marginPct) || 0,
      timeToRevenueDays: Number(r.timeToRevenueDays) || 30,
      scalabilityScore: Math.min(Math.max(Number(r.scalabilityScore) || 5, 1), 10),
      requiredCapital: Number(r.requiredCapital) || 0,
      automationPotential: Math.min(Math.max(Number(r.automationPotential) || 0.5, 0), 1),
      firstStep: String(r.firstStep || ""),
      chain: Number(r.chain) || 1,
    }));

    // Write high-value opportunities to queue
    const highValue = opportunities.filter(
      (o) => o.estimatedMonthlyRevenue > 500 || o.automationPotential > 0.8
    );
    if (highValue.length > 0) {
      const queueDir = path.join(process.env.HOME!, ".amsa/linear-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      const file = path.join(queueDir, `profit-${new Date().toISOString().split("T")[0]}.json`);
      fs.writeFileSync(file, JSON.stringify(highValue, null, 2));
    }

    return opportunities;
  } catch { return []; }
}

if (require.main === module) {
  const context = process.argv.slice(2).join(" ") || "AI automation tools and marketplace arbitrage";
  findProfitOpportunities(context).then((opps) => {
    console.log(`\n💰 Profit Agent found ${opps.length} opportunities:\n`);
    opps.forEach((o) => {
      console.log(`  ${o.name}`);
      console.log(`    Revenue: $${o.estimatedMonthlyRevenue}/mo | Margin: ${o.marginPct}% | TTR: ${o.timeToRevenueDays}d`);
      console.log(`    Automation: ${(o.automationPotential * 100).toFixed(0)}% | First step: ${o.firstStep}\n`);
    });
  });
}
