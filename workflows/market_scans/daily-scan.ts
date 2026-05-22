/**
 * Daily Market Scan Workflow — Claude Architect OS
 * Orchestrates: Scout → Arbitrage → Profit → Alert
 * Runs at 7:00 AM via Trigger.dev (defined in integrations/trigger-dev/triggers.ts)
 */

import { scout } from "../../agents/scout/agent";
import { scanFromSignalFiles } from "../../profit-systems/arbitrage/scanner";
import { findProfitOpportunities } from "../../agents/profit/agent";
import * as fs from "fs";
import * as path from "path";

const QUEUE_DIR = path.join(process.env.HOME!, ".amsa/linear-queue");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface DailyScanReport {
  date: string;
  scoutFindings: number;
  arbitrageSignals: number;
  profitOpportunities: number;
  topOpportunity: string;
  totalPotentialProfit: number;
  sentAt: string;
}

async function sendTelegram(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch { /* non-blocking */ }
}

export async function runDailyScan(): Promise<DailyScanReport> {
  console.log("📡 Daily market scan starting...");

  // Run all scans in parallel
  const [scoutResults, arbitrageResults, profitResults] = await Promise.allSettled([
    scout("trending products, AI tools, marketplace arbitrage, Denver local deals"),
    scanFromSignalFiles(),
    findProfitOpportunities("current market trends and AI automation opportunities"),
  ]);

  const scout_count = scoutResults.status === "fulfilled" ? scoutResults.value.length : 0;
  const arb_result = arbitrageResults.status === "fulfilled" ? arbitrageResults.value : null;
  const profit_count = profitResults.status === "fulfilled" ? profitResults.value.length : 0;

  // Determine top opportunity
  let topOpportunity = "No high-score opportunities found today";
  let totalProfit = 0;

  if (arb_result?.topOpportunity) {
    const top = arb_result.topOpportunity;
    topOpportunity = `${top.item}: Buy $${top.sourcePrice} → Sell $${top.targetPrice} (${top.marginPct.toFixed(1)}% margin)`;
    totalProfit = arb_result.totalPotentialProfit;
  } else if (scoutResults.status === "fulfilled" && scoutResults.value.length > 0) {
    const top = scoutResults.value[0];
    topOpportunity = `${top.title}: ${top.actionRequired}`;
  }

  const report: DailyScanReport = {
    date: new Date().toISOString().split("T")[0],
    scoutFindings: scout_count,
    arbitrageSignals: arb_result?.signals.length || 0,
    profitOpportunities: profit_count,
    topOpportunity,
    totalPotentialProfit: totalProfit,
    sentAt: new Date().toISOString(),
  };

  // Save report
  fs.mkdirSync(QUEUE_DIR, { recursive: true });
  fs.writeFileSync(path.join(QUEUE_DIR, `daily-scan-${report.date}.json`), JSON.stringify(report, null, 2));

  // Send Telegram alert
  const message = `*📡 CMNDCENTER Daily Scan — ${report.date}*

🔍 Scout findings: ${report.scoutFindings}
💱 Arbitrage signals: ${report.arbitrageSignals}
💰 Profit opportunities: ${report.profitOpportunities}

🏆 *Top:* ${report.topOpportunity}
💵 *Potential profit (top 5):* $${report.totalPotentialProfit.toFixed(2)}

Check: \`~/.amsa/linear-queue/\``;

  await sendTelegram(message);
  console.log(`✅ Daily scan complete: ${scout_count + (arb_result?.signals.length || 0) + profit_count} total findings`);

  return report;
}

if (require.main === module) {
  runDailyScan().then((report) => {
    console.log("\n📊 Daily Scan Report:");
    console.log(JSON.stringify(report, null, 2));
  });
}
