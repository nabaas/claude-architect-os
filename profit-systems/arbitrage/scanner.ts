/**
 * Arbitrage Scanner — Claude Architect OS
 * Finds pricing gaps across eBay, Amazon, Facebook Marketplace (Denver local).
 * Chain 6: Market Arbitrage Profit System
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();
const QUEUE_DIR = path.join(process.env.HOME!, ".amsa/linear-queue");
const MEMORY_DIR = path.join(process.env.HOME!, ".amsa/memory");

export interface ArbitrageSignal {
  id: string;
  item: string;
  sourcePlatform: "ebay" | "facebook" | "craigslist" | "offerup";
  sourcePrice: number;
  targetPlatform: "amazon" | "ebay" | "local";
  targetPrice: number;
  marginPct: number;
  marginDollar: number;
  confidence: number;
  ttfDays: number; // time to flip
  location?: string;
  url?: string;
  scannedAt: string;
}

export interface ScanResult {
  signals: ArbitrageSignal[];
  topOpportunity: ArbitrageSignal | null;
  totalPotentialProfit: number;
  scanDuration: number;
}

// ─── Opportunity Scorer ───────────────────────────────────────────────────────

export function scoreArbitrage(signal: ArbitrageSignal): number {
  // Formula: (demand + compound + leverage) × ttv_inv × saturation_inv
  const demand = Math.min(signal.marginPct / 100, 1.0);
  const compound = signal.confidence;
  const leverage = Math.min(signal.marginDollar / 50, 1.0); // cap at $50 dollar margin
  const ttv_inv = 1 / (1 + Math.log(Math.max(signal.ttfDays, 1)));
  const saturation_inv = 0.8; // assume moderate competition

  return (demand + compound + leverage) * ttv_inv * saturation_inv;
}

// ─── AI-Powered Item Analysis ─────────────────────────────────────────────────

export async function analyzeArbitrageOpportunity(
  item: string,
  sourcePrice: number,
  sourcePlatform: string
): Promise<{ targetPrice: number; confidence: number; ttfDays: number; reasoning: string }> {
  const systemPrompt = `You are a marketplace arbitrage expert specializing in eBay, Amazon, and local Denver markets.
Analyze items for resale profit potential. Be precise and conservative in estimates.
Output only valid JSON matching the requested schema.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Item: "${item}" | Source: ${sourcePlatform} at $${sourcePrice}

Estimate:
1. Realistic resale price on Amazon/eBay (after fees ~15%)
2. Confidence this sells within 30 days (0-1)
3. Days to flip (typical)
4. One-sentence reasoning

Respond as JSON: {"targetPrice": number, "confidence": number, "ttfDays": number, "reasoning": string}`,
      },
    ],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { targetPrice: sourcePrice * 1.2, confidence: 0.5, ttfDays: 14, reasoning: "Default estimate" };
  } catch {
    return { targetPrice: sourcePrice * 1.2, confidence: 0.5, ttfDays: 14, reasoning: "Parse failed" };
  }
}

// ─── Scan from IntelliTradeX Signals ─────────────────────────────────────────

export async function scanFromSignalFiles(): Promise<ScanResult> {
  const start = Date.now();
  const signalsDir = path.join(process.env.HOME!, "CMNDCENTER/intellitradeX/signals");
  const signals: ArbitrageSignal[] = [];

  // Read any opportunity files from the queue
  const queueFiles = fs.existsSync(QUEUE_DIR)
    ? fs.readdirSync(QUEUE_DIR).filter((f) => f.startsWith("opportunities-") && f.endsWith(".json"))
    : [];

  for (const file of queueFiles.slice(-3)) { // last 3 days
    try {
      const data = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, file), "utf-8"));
      const opps = Array.isArray(data) ? data : data.opportunities || [];
      for (const opp of opps) {
        if (opp.sourcePrice && opp.item) {
          const analysis = await analyzeArbitrageOpportunity(opp.item, opp.sourcePrice, opp.sourcePlatform || "ebay");
          const margin = analysis.targetPrice - opp.sourcePrice;
          const marginPct = (margin / opp.sourcePrice) * 100;

          if (marginPct > 20) { // only flag >20% margin
            const signal: ArbitrageSignal = {
              id: `arb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              item: opp.item,
              sourcePlatform: opp.sourcePlatform || "ebay",
              sourcePrice: opp.sourcePrice,
              targetPlatform: "amazon",
              targetPrice: analysis.targetPrice,
              marginPct,
              marginDollar: margin,
              confidence: analysis.confidence,
              ttfDays: analysis.ttfDays,
              scannedAt: new Date().toISOString(),
            };
            signals.push(signal);
          }
        }
      }
    } catch { /* skip bad files */ }
  }

  // Sort by score
  signals.sort((a, b) => scoreArbitrage(b) - scoreArbitrage(a));

  const result: ScanResult = {
    signals: signals.slice(0, 20),
    topOpportunity: signals[0] || null,
    totalPotentialProfit: signals.slice(0, 5).reduce((sum, s) => sum + s.marginDollar, 0),
    scanDuration: Date.now() - start,
  };

  // Write to queue
  if (result.signals.length > 0) {
    const outFile = path.join(QUEUE_DIR, `arbitrage-${new Date().toISOString().split("T")[0]}.json`);
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(QUEUE_DIR, "latest-arbitrage.json"), JSON.stringify(result, null, 2));
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  scanFromSignalFiles().then((result) => {
    console.log(`✅ Scan complete: ${result.signals.length} opportunities`);
    if (result.topOpportunity) {
      const top = result.topOpportunity;
      console.log(`🏆 Top: ${top.item} | Buy $${top.sourcePrice} → Sell $${top.targetPrice} | ${top.marginPct.toFixed(1)}% margin`);
    }
    console.log(`💰 Total potential profit (top 5): $${result.totalPotentialProfit.toFixed(2)}`);
  });
}
