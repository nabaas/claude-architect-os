/**
 * automations/pipelines/crypto-flow.ts
 * Unusual Crypto Flow Detector — Claude Architect OS v4.0
 *
 * Polls IntelliTradeX signals every 5 minutes via Trigger.dev.
 * Reads signal files from ~/CMNDCENTER/intellitradeX/signals/ (JSON).
 * Executes trade decisions via ~/CMNDCENTER/intellitradeX/execute.sh.
 * Logs to Supabase trade_signals table.
 * Sends spoken alerts via Desktop Avatar.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 *      OPEN_LLM_VTUBER_URL
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { DesktopAvatarAgent, TradeSignal } from "../../agents/desktop-avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowSignal {
  symbol: string;
  price: number;
  volume24h: number;
  volumeSpike: number;       // ratio: current / 7-day average (e.g. 3.5 = 3.5x)
  priceDeviation: number;    // normalized std devs from 7-day mean (0-5+)
  socialSentiment: number;   // -1.0 (bearish) to 1.0 (bullish)
  unusualScore: number;      // pre-computed composite 0-1
  timestamp?: string;
  exchange?: string;
  marketCap?: number;
  rsi?: number;              // RSI 0-100 if available
  macdSignal?: number;       // MACD signal line
}

export interface UnusualFlow {
  signal: FlowSignal;
  unusualScore: number;
  direction: "bullish" | "bearish" | "neutral";
  flags: string[];           // human-readable reason list
  detectedAt: string;
}

export interface TradeDecision {
  signal: FlowSignal;
  unusualFlow: UnusualFlow;
  action: "BUY" | "SELL" | "SHORT" | "HOLD";
  confidence: number;        // 0-1
  reasoning: string;
  positionSizeUsd: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  executedAt?: string;
  executionResult?: string;
  supabaseId?: string;
}

interface SupabaseTradeRow {
  symbol: string;
  action: string;
  price: number;
  volume_24h: number;
  volume_spike: number;
  price_deviation: number;
  social_sentiment: number;
  unusual_score: number;
  confidence: number;
  reasoning: string;
  position_size_usd: number;
  stop_loss_pct: number;
  take_profit_pct: number;
  flags: string[];
  detected_at: string;
  executed_at: string | null;
  execution_result: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIGNALS_DIR = path.join(
  os.homedir(),
  "CMNDCENTER",
  "intellitradeX",
  "signals"
);
const EXECUTE_SCRIPT = path.join(
  os.homedir(),
  "CMNDCENTER",
  "intellitradeX",
  "execute.sh"
);
const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const TRADE_LOG_PATH = path.join(MEMORY_DIR, "trade-decisions.json");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

// Thresholds
const VOLUME_SPIKE_THRESHOLD = 3.0;      // 3x 7-day average
const PRICE_DEVIATION_THRESHOLD = 2.0;   // 2 standard deviations
const UNUSUAL_SCORE_EXECUTE_THRESHOLD = 0.75;
const MAX_POSITION_SIZE_USD = 500;        // maximum per trade
const DEFAULT_STOP_LOSS_PCT = 5.0;
const DEFAULT_TAKE_PROFIT_PCT = 15.0;

// ─── Utility ──────────────────────────────────────────────────────────────────

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function appendTradeLog(decision: TradeDecision): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const log = readJsonFile<TradeDecision[]>(TRADE_LOG_PATH, []);
  log.push(decision);
  fs.writeFileSync(TRADE_LOG_PATH, JSON.stringify(log.slice(-1000), null, 2), "utf-8");
}

// ─── Step 1: Read Signal Files ────────────────────────────────────────────────

export function readSignalFiles(): FlowSignal[] {
  if (!fs.existsSync(SIGNALS_DIR)) {
    console.warn(`[CryptoFlow] Signals directory not found: ${SIGNALS_DIR}`);
    return [];
  }

  const files = fs
    .readdirSync(SIGNALS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => {
      // Sort newest first by mtime
      const aMtime = fs.statSync(path.join(SIGNALS_DIR, a)).mtimeMs;
      const bMtime = fs.statSync(path.join(SIGNALS_DIR, b)).mtimeMs;
      return bMtime - aMtime;
    })
    .slice(0, 50); // process at most 50 signal files

  const signals: FlowSignal[] = [];
  const cutoffMs = Date.now() - 60 * 60 * 1000; // only files from last hour

  for (const file of files) {
    const filePath = path.join(SIGNALS_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoffMs) continue; // stale signal

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as FlowSignal | FlowSignal[];

      if (Array.isArray(parsed)) {
        signals.push(...parsed);
      } else if (parsed.symbol) {
        signals.push(parsed);
      }
    } catch (err) {
      console.warn(
        `[CryptoFlow] Failed to parse signal file ${file}: ${(err as Error).message}`
      );
    }
  }

  // Deduplicate by symbol (keep most recent)
  const bySymbol = new Map<string, FlowSignal>();
  for (const sig of signals) {
    const existing = bySymbol.get(sig.symbol);
    if (!existing) {
      bySymbol.set(sig.symbol, sig);
    } else {
      // Keep the one with a newer timestamp if available
      const existingTs = existing.timestamp
        ? new Date(existing.timestamp).getTime()
        : 0;
      const newTs = sig.timestamp ? new Date(sig.timestamp).getTime() : 0;
      if (newTs > existingTs) bySymbol.set(sig.symbol, sig);
    }
  }

  return Array.from(bySymbol.values());
}

// ─── Step 2: Detect Unusual Flow ─────────────────────────────────────────────

/**
 * Calculate composite unusual score.
 * unusualScore = (volumeSpike_norm × 0.4) + (priceDeviation_norm × 0.4) + (sentimentFlip × 0.2)
 *
 * Flags volume spike > 3x, price deviation > 2 SD, sentiment flip.
 */
export function detectUnusualFlow(signals: FlowSignal[]): UnusualFlow[] {
  const unusual: UnusualFlow[] = [];

  for (const sig of signals) {
    const flags: string[] = [];

    // Volume spike check: normalize to 0-1 (3x = 0.5, 6x = 0.83, 10x = 1.0)
    const volumeSpikeNorm = Math.min(sig.volumeSpike / 10, 1.0);
    if (sig.volumeSpike > VOLUME_SPIKE_THRESHOLD) {
      flags.push(
        `Volume spike ${sig.volumeSpike.toFixed(1)}x (threshold: ${VOLUME_SPIKE_THRESHOLD}x)`
      );
    }

    // Price deviation check: normalize to 0-1 (2 SD = 0.4, 5 SD = 1.0)
    const priceDevNorm = Math.min(Math.abs(sig.priceDeviation) / 5, 1.0);
    if (Math.abs(sig.priceDeviation) > PRICE_DEVIATION_THRESHOLD) {
      flags.push(
        `Price deviation ${sig.priceDeviation.toFixed(2)}σ (threshold: ±${PRICE_DEVIATION_THRESHOLD}σ)`
      );
    }

    // Sentiment flip: score 0 if neutral, 1 if strong directional signal
    // |sentiment| > 0.6 treated as "flip" signal
    const sentimentFlip =
      Math.abs(sig.socialSentiment) > 0.6
        ? Math.abs(sig.socialSentiment)
        : 0;
    if (Math.abs(sig.socialSentiment) > 0.6) {
      const dir = sig.socialSentiment > 0 ? "bullish" : "bearish";
      flags.push(
        `Strong social sentiment ${dir} (${(sig.socialSentiment * 100).toFixed(0)}%)`
      );
    }

    // RSI extremes (if available)
    if (sig.rsi !== undefined) {
      if (sig.rsi < 25) flags.push(`RSI oversold (${sig.rsi.toFixed(0)})`);
      if (sig.rsi > 75) flags.push(`RSI overbought (${sig.rsi.toFixed(0)})`);
    }

    // Composite score
    const unusualScore =
      volumeSpikeNorm * 0.4 + priceDevNorm * 0.4 + sentimentFlip * 0.2;

    // Must have at least one flag to qualify
    if (flags.length === 0) continue;

    const direction: UnusualFlow["direction"] =
      sig.socialSentiment > 0.2
        ? "bullish"
        : sig.socialSentiment < -0.2
        ? "bearish"
        : "neutral";

    unusual.push({
      signal: sig,
      unusualScore,
      direction,
      flags,
      detectedAt: new Date().toISOString(),
    });
  }

  // Sort by unusual score descending
  return unusual.sort((a, b) => b.unusualScore - a.unusualScore);
}

// ─── Step 3: Execute Trade Decision ──────────────────────────────────────────

/**
 * Evaluate an unusual flow event and produce a trade decision.
 * Executes via IntelliTradeX if score exceeds threshold.
 */
export async function executeTradeDecision(
  flow: UnusualFlow
): Promise<TradeDecision> {
  const sig = flow.signal;
  const avatar = new DesktopAvatarAgent();

  // Determine action
  let action: TradeDecision["action"] = "HOLD";
  let confidence = 0;

  if (flow.unusualScore > UNUSUAL_SCORE_EXECUTE_THRESHOLD) {
    if (flow.direction === "bullish") {
      action = "BUY";
      confidence = Math.min(flow.unusualScore, 0.95);
    } else if (flow.direction === "bearish") {
      action = sig.price < 100 ? "SHORT" : "SELL"; // SHORT for altcoins, SELL for others
      confidence = Math.min(flow.unusualScore, 0.95);
    } else {
      // Neutral direction with high unusual score: use price deviation direction
      action = sig.priceDeviation > 0 ? "SELL" : "BUY";
      confidence = flow.unusualScore * 0.7; // reduced confidence for ambiguous signals
    }
  } else {
    // Below threshold — HOLD
    action = "HOLD";
    confidence = 1 - flow.unusualScore;
  }

  // Position sizing: scale with confidence, cap at MAX_POSITION_SIZE_USD
  const positionSizeUsd = Math.min(
    Math.floor(confidence * MAX_POSITION_SIZE_USD),
    MAX_POSITION_SIZE_USD
  );

  // Adjust stop loss tighter for low-confidence trades
  const stopLossPercent =
    confidence > 0.85
      ? DEFAULT_STOP_LOSS_PCT
      : confidence > 0.7
      ? DEFAULT_STOP_LOSS_PCT * 0.8
      : DEFAULT_STOP_LOSS_PCT * 0.6;

  const reasoning = buildTradeReasoning(flow, action, confidence);

  const decision: TradeDecision = {
    signal: sig,
    unusualFlow: flow,
    action,
    confidence,
    reasoning,
    positionSizeUsd,
    stopLossPercent,
    takeProfitPercent: DEFAULT_TAKE_PROFIT_PCT,
  };

  // Execute if not HOLD
  if (action !== "HOLD" && positionSizeUsd > 0) {
    console.log(
      `[CryptoFlow] Executing ${action} ${sig.symbol} — score: ${flow.unusualScore.toFixed(3)}, confidence: ${(confidence * 100).toFixed(0)}%`
    );

    decision.executedAt = new Date().toISOString();

    // Execute via IntelliTradeX shell script
    try {
      if (fs.existsSync(EXECUTE_SCRIPT)) {
        const execArgs = [
          `"${sig.symbol}"`,
          `"${action}"`,
          `"${positionSizeUsd}"`,
          `"${sig.price}"`,
          `"${stopLossPercent}"`,
          `"${DEFAULT_TAKE_PROFIT_PCT}"`,
        ].join(" ");

        const result = execSync(
          `bash "${EXECUTE_SCRIPT}" ${execArgs} 2>&1`,
          {
            timeout: 30_000,
            encoding: "utf-8",
          }
        );
        decision.executionResult = result.slice(0, 500);
        console.log(`[CryptoFlow] Execution result: ${decision.executionResult}`);
      } else {
        decision.executionResult = `SIMULATE: ${action} ${sig.symbol} at ${sig.price} qty=${positionSizeUsd}`;
        console.warn(
          `[CryptoFlow] execute.sh not found — simulating trade: ${decision.executionResult}`
        );
      }
    } catch (err) {
      decision.executionResult = `ERROR: ${(err as Error).message.slice(0, 300)}`;
      console.error(`[CryptoFlow] Trade execution error: ${decision.executionResult}`);
    }

    // Notify Desktop Avatar
    const tradeSignal: TradeSignal = {
      symbol: sig.symbol,
      side: action === "SHORT" ? "SHORT" : action === "BUY" ? "BUY" : "SELL",
      price: sig.price,
      quantity: positionSizeUsd / Math.max(sig.price, 0.0001),
      confidence,
      strategy: "unusual-flow-detection",
      exchange: (sig.exchange as TradeSignal["exchange"]) ?? "binance",
      unusualScore: flow.unusualScore,
      reasoning,
    };

    try {
      await avatar.notifyTrade(tradeSignal);
    } catch (err) {
      console.warn(
        `[CryptoFlow] Avatar notify error: ${(err as Error).message}`
      );
    }

    // Log to Supabase
    await logToSupabase(decision);

    // Telegram alert
    await telegramTradeAlert(decision);
  }

  // Always write to local log
  appendTradeLog(decision);

  return decision;
}

function buildTradeReasoning(
  flow: UnusualFlow,
  action: string,
  confidence: number
): string {
  const sig = flow.signal;
  const parts: string[] = [
    `${action} signal for ${sig.symbol}`,
    `Unusual score: ${(flow.unusualScore * 100).toFixed(0)}%`,
    `Direction: ${flow.direction}`,
    `Triggers: ${flow.flags.join("; ")}`,
    `Confidence: ${(confidence * 100).toFixed(0)}%`,
  ];

  if (sig.rsi !== undefined) parts.push(`RSI: ${sig.rsi.toFixed(0)}`);
  if (sig.macdSignal !== undefined)
    parts.push(`MACD: ${sig.macdSignal.toFixed(4)}`);

  return parts.join(" | ");
}

// ─── Supabase Logging ─────────────────────────────────────────────────────────

async function logToSupabase(decision: TradeDecision): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const sig = decision.signal;
  const row: SupabaseTradeRow = {
    symbol: sig.symbol,
    action: decision.action,
    price: sig.price,
    volume_24h: sig.volume24h,
    volume_spike: sig.volumeSpike,
    price_deviation: sig.priceDeviation,
    social_sentiment: sig.socialSentiment,
    unusual_score: decision.unusualFlow.unusualScore,
    confidence: decision.confidence,
    reasoning: decision.reasoning,
    position_size_usd: decision.positionSizeUsd,
    stop_loss_pct: decision.stopLossPercent,
    take_profit_pct: decision.takeProfitPercent,
    flags: decision.unusualFlow.flags,
    detected_at: decision.unusualFlow.detectedAt,
    executed_at: decision.executedAt ?? null,
    execution_result: decision.executionResult ?? null,
  };

  try {
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/trade_signals`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      },
      10_000
    );

    if (res.ok) {
      const inserted = (await res.json()) as Array<{ id?: string }>;
      if (inserted[0]?.id) decision.supabaseId = String(inserted[0].id);
    } else {
      console.warn(`[CryptoFlow] Supabase log failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[CryptoFlow] Supabase error: ${(err as Error).message}`);
  }
}

// ─── Telegram Alert ───────────────────────────────────────────────────────────

export async function telegramTradeAlert(
  decision: TradeDecision
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const sig = decision.signal;
  const flow = decision.unusualFlow;
  const scorePct = (flow.unusualScore * 100).toFixed(0);
  const confPct = (decision.confidence * 100).toFixed(0);
  const priceStr =
    sig.price < 1 ? sig.price.toFixed(6) : sig.price.toFixed(2);

  const flagLines = flow.flags.map((f) => `• ${f}`).join("\n");

  const text =
    `*UNUSUAL FLOW: ${sig.symbol}*\n` +
    `Score: *${scorePct}%* | Action: *${decision.action}* | Confidence: *${confPct}%*\n` +
    `Price: \`${priceStr}\` | Vol Spike: *${sig.volumeSpike.toFixed(1)}x*\n` +
    `Direction: ${flow.direction}\n\n` +
    `*Triggers:*\n${flagLines}\n\n` +
    (decision.action !== "HOLD"
      ? `Position: $${decision.positionSizeUsd} | SL: ${decision.stopLossPercent}% | TP: ${decision.takeProfitPercent}%\n`
      : "") +
    `_${new Date().toLocaleTimeString()}_`;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
      8_000
    );

    if (!res.ok) {
      console.warn(`[CryptoFlow] Telegram alert failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[CryptoFlow] Telegram error: ${(err as Error).message}`);
  }
}

// ─── Main Poll Runner ─────────────────────────────────────────────────────────

export interface CryptoFlowResult {
  signalsRead: number;
  unusualFlowsDetected: number;
  decisionsExecuted: number;
  decisionsHeld: number;
  decisions: TradeDecision[];
  errors: string[];
  ranAt: string;
}

export async function runCryptoFlowPipeline(): Promise<CryptoFlowResult> {
  const errors: string[] = [];
  const decisions: TradeDecision[] = [];

  console.log("[CryptoFlow] Starting flow detection scan...");

  // Read signals
  const signals = readSignalFiles();
  console.log(`[CryptoFlow] Read ${signals.length} signals from ${SIGNALS_DIR}`);

  if (signals.length === 0) {
    return {
      signalsRead: 0,
      unusualFlowsDetected: 0,
      decisionsExecuted: 0,
      decisionsHeld: 0,
      decisions: [],
      errors: ["No signals found in signals directory"],
      ranAt: new Date().toISOString(),
    };
  }

  // Detect unusual flows
  const unusualFlows = detectUnusualFlow(signals);
  console.log(`[CryptoFlow] Detected ${unusualFlows.length} unusual flows`);

  // Process top 5 unusual flows (avoid overtrading)
  const topFlows = unusualFlows.slice(0, 5);

  for (const flow of topFlows) {
    try {
      const decision = await executeTradeDecision(flow);
      decisions.push(decision);
    } catch (err) {
      const msg = `Decision error for ${flow.signal.symbol}: ${(err as Error).message}`;
      console.error(`[CryptoFlow] ${msg}`);
      errors.push(msg);
    }
  }

  const executed = decisions.filter((d) => d.action !== "HOLD").length;
  const held = decisions.filter((d) => d.action === "HOLD").length;

  console.log(
    `[CryptoFlow] Complete: ${executed} executed, ${held} held, ${errors.length} errors`
  );

  return {
    signalsRead: signals.length,
    unusualFlowsDetected: unusualFlows.length,
    decisionsExecuted: executed,
    decisionsHeld: held,
    decisions,
    errors,
    ranAt: new Date().toISOString(),
  };
}
