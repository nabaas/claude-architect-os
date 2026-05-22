/**
 * agents/desktop-avatar.ts
 * Desktop Avatar Agent — Claude Architect OS v4.0
 *
 * Delivers spoken briefings, trade alerts, build completions, and opportunity
 * notifications to the user via Open-LLM-VTuber (TTS) and Telegram.
 *
 * Reads: OPEN_LLM_VTUBER_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID from env.
 * Writes delivery log to: ~/.amsa/memory/avatar-deliveries.json
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarMessage {
  type: "recipe" | "pipeline" | "project" | "trade" | "alert" | "system";
  title: string;
  content: string;
  actions: string[];
  urgency: 1 | 2 | 3 | 4 | 5;
  chain: string;
}

export interface TradeSignal {
  symbol: string;
  side: "BUY" | "SELL" | "SHORT";
  price: number;
  quantity: number;
  confidence: number;
  strategy: string;
  exchange: "binance" | "alpaca" | "manual";
  unusualScore?: number;
  reasoning: string;
  executedAt?: string;
  pnlEstimate?: number;
}

export interface LokiBuild {
  requirement: string;
  type: "saas" | "api" | "cli" | "ai" | "data" | "full";
  phasesCompleted: number;
  totalPhases: number;
  deployUrl?: string;
  agentsUsed: number;
  durationMs: number;
  outputPath: string;
  success: boolean;
  highlights: string[];
}

export interface Opportunity {
  keyword: string;
  category: string;
  score: number;
  recommendedAction: string;
  requiredCapitalUsd: number;
  ttvDays: number;
  urgency: "immediate" | "this_week" | "this_month" | "low_priority";
}

interface DeliveryLogEntry {
  id: string;
  deliveredAt: string;
  type: AvatarMessage["type"];
  title: string;
  text: string;
  urgency: number;
  chain: string;
  channels: Array<"tts" | "telegram">;
  success: boolean;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_URL =
  process.env.OPEN_LLM_VTUBER_URL ?? "http://localhost:12393";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

const DELIVERY_LOG_PATH = path.join(
  os.homedir(),
  ".amsa",
  "memory",
  "avatar-deliveries.json"
);
const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const LINEAR_QUEUE_DIR = path.join(os.homedir(), ".amsa", "linear-queue");
const AUTOMATIONS_STATUS_PATH = path.join(
  os.homedir(),
  "CMNDCENTER",
  "repos",
  "claude-architect-os",
  "automations",
  "status.json"
);

// ─── Utility ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

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

function appendDeliveryLog(entry: DeliveryLogEntry): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const log = readJsonFile<DeliveryLogEntry[]>(DELIVERY_LOG_PATH, []);
  log.push(entry);
  // Keep last 500 deliveries
  const trimmed = log.slice(-500);
  fs.writeFileSync(DELIVERY_LOG_PATH, JSON.stringify(trimmed, null, 2), "utf-8");
}

/**
 * Convert urgency 1-5 to a human prefix for TTS pacing.
 */
function urgencyPrefix(urgency: number): string {
  if (urgency >= 5) return "URGENT ALERT. ";
  if (urgency >= 4) return "Important update. ";
  if (urgency >= 3) return "New notification. ";
  return "";
}

// ─── TTS Delivery ─────────────────────────────────────────────────────────────

/**
 * Send plain text to Open-LLM-VTuber for TTS playback.
 * POSTs to /api/speak endpoint.
 */
export async function sendToAvatar(text: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${AVATAR_URL}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Open-LLM-VTuber returned HTTP ${response.status}: ${await response.text()}`
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Telegram Delivery ────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return; // silently skip if not configured
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── DesktopAvatarAgent ───────────────────────────────────────────────────────

export class DesktopAvatarAgent {
  /**
   * Deliver a structured AvatarMessage via TTS and optionally Telegram.
   * Urgency 4-5 always sends both channels. Urgency 1-3 sends TTS only.
   */
  async deliverMessage(msg: AvatarMessage): Promise<void> {
    const spokenText = `${urgencyPrefix(msg.urgency)}${msg.title}. ${msg.content}`;
    const logEntry: DeliveryLogEntry = {
      id: generateId(),
      deliveredAt: new Date().toISOString(),
      type: msg.type,
      title: msg.title,
      text: spokenText,
      urgency: msg.urgency,
      chain: msg.chain,
      channels: [],
      success: false,
    };

    const errors: string[] = [];

    // TTS delivery
    try {
      await sendToAvatar(spokenText);
      logEntry.channels.push("tts");
    } catch (err) {
      errors.push(`TTS: ${(err as Error).message}`);
    }

    // Telegram for urgency 4-5 or explicit alert/trade types
    if (msg.urgency >= 4 || msg.type === "trade" || msg.type === "alert") {
      const actionsBlock =
        msg.actions.length > 0
          ? `\n\nActions:\n${msg.actions.map((a) => `• ${a}`).join("\n")}`
          : "";
      const telegramText = `*[${msg.type.toUpperCase()}]* ${msg.title}\n\n${msg.content}${actionsBlock}\n\n_Chain: ${msg.chain}_`;

      try {
        await sendTelegram(telegramText);
        logEntry.channels.push("telegram");
      } catch (err) {
        errors.push(`Telegram: ${(err as Error).message}`);
      }
    }

    logEntry.success = errors.length === 0;
    if (errors.length > 0) {
      logEntry.error = errors.join(" | ");
    }

    appendDeliveryLog(logEntry);
  }

  /**
   * Deliver the daily morning briefing.
   *
   * Sources:
   *   1. ~/.amsa/memory/karpathy_wrapup.json — prior session learnings
   *   2. ~/.amsa/linear-queue/latest.json — top opportunities
   *   3. ~/CMNDCENTER/repos/claude-architect-os/automations/status.json — pipeline status
   *
   * Formats a spoken briefing and sends to both TTS and Telegram.
   */
  async deliverDailyBriefing(): Promise<void> {
    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    // 1. Load Karpathy memory
    interface KarpathyWrapup {
      generated?: string;
      total_runs?: number;
      learnings?: string[];
      top_skills?: Array<[string, number]>;
    }
    const karpathy = readJsonFile<KarpathyWrapup>(
      path.join(MEMORY_DIR, "karpathy_wrapup.json"),
      {}
    );

    const recentLearnings = (karpathy.learnings ?? []).slice(-3);
    const topSkill = (karpathy.top_skills ?? [])[0];

    // 2. Load linear queue
    interface Opportunity {
      keyword?: string;
      score?: number;
      action_urgency?: string;
      recommended_action?: string;
      required_capital_usd?: number;
    }
    interface QueueReport {
      actionable_opportunities?: number;
      top_opportunities?: Opportunity[];
      summary?: {
        highest_score?: number;
        avg_score?: number;
      };
    }
    const queue = readJsonFile<QueueReport>(
      path.join(LINEAR_QUEUE_DIR, "latest.json"),
      {}
    );

    const topOpps = (queue.top_opportunities ?? []).slice(0, 3);
    const actionableCount = queue.actionable_opportunities ?? 0;

    // 3. Load automation status
    interface PipelineStatus {
      lastRun?: string;
      pipelinesRun?: number;
      warnings?: string[];
      errors?: string[];
    }
    interface AutomationsStatus {
      lastUpdated?: string;
      pipelines?: PipelineStatus;
      wand?: { videosQueued?: number };
      crypto?: { signalsProcessed?: number; tradesExecuted?: number };
    }
    const status = readJsonFile<AutomationsStatus>(
      AUTOMATIONS_STATUS_PATH,
      {}
    );

    // 4. Compose spoken briefing
    const lines: string[] = [];
    lines.push(`Good morning. Today is ${todayStr}.`);
    lines.push(`CMNDCENTER is online.`);

    // Session memory
    if (recentLearnings.length > 0) {
      lines.push(
        `From last session: ${recentLearnings[0].replace(/^(Win:|Successful [a-z]+ build:)\s*/i, "").trim()}.`
      );
    }
    if (topSkill) {
      lines.push(
        `Top skill: ${topSkill[0].replace(/_/g, " ")} at score ${topSkill[1].toFixed(2)}.`
      );
    }

    // Opportunities
    if (actionableCount > 0) {
      lines.push(
        `Today's scan found ${actionableCount} actionable opportunit${actionableCount === 1 ? "y" : "ies"}.`
      );
      const bestOpp = topOpps[0];
      if (bestOpp?.keyword) {
        const scorePercent = ((bestOpp.score ?? 0) * 100).toFixed(0);
        lines.push(
          `Top signal: ${bestOpp.keyword} scoring ${scorePercent}%. ${bestOpp.recommended_action ?? "Review linear queue."}`
        );
      }
    } else {
      lines.push("No high-score opportunities in queue. Running fresh scan.");
    }

    // Automation status
    if (status.wand?.videosQueued) {
      lines.push(
        `WAND has ${status.wand.videosQueued} video${status.wand.videosQueued === 1 ? "" : "s"} queued for today.`
      );
    }
    if (status.crypto?.tradesExecuted) {
      lines.push(
        `IntelliTradeX executed ${status.crypto.tradesExecuted} trade${status.crypto.tradesExecuted === 1 ? "" : "s"} overnight.`
      );
    }
    if (status.pipelines?.warnings && status.pipelines.warnings.length > 0) {
      lines.push(
        `Pipeline warning: ${status.pipelines.warnings[0]}.`
      );
    }

    lines.push("Ready for your commands.");

    const spokenBriefing = lines.join(" ");

    // Deliver TTS
    const ttsEntry: DeliveryLogEntry = {
      id: generateId(),
      deliveredAt: new Date().toISOString(),
      type: "system",
      title: "Daily Briefing",
      text: spokenBriefing,
      urgency: 3,
      chain: "daily-briefing",
      channels: [],
      success: false,
    };

    const errors: string[] = [];

    try {
      await sendToAvatar(spokenBriefing);
      ttsEntry.channels.push("tts");
    } catch (err) {
      errors.push(`TTS: ${(err as Error).message}`);
    }

    // Telegram briefing (formatted)
    const oppLines =
      topOpps.length > 0
        ? topOpps
            .map((o, i) => {
              const score = ((o.score ?? 0) * 100).toFixed(0);
              return `${i + 1}. *${o.keyword ?? "N/A"}* — ${score}% | $${o.required_capital_usd ?? "?"} | ${o.action_urgency ?? "review"}`;
            })
            .join("\n")
        : "No opportunities above threshold.";

    const telegramBriefing = [
      `*CMNDCENTER Daily Briefing — ${todayStr}*`,
      "",
      `*Opportunities (${actionableCount} actionable):*`,
      oppLines,
      "",
      status.wand?.videosQueued
        ? `*WAND:* ${status.wand.videosQueued} videos queued`
        : null,
      status.crypto?.tradesExecuted
        ? `*IntelliTradeX:* ${status.crypto.tradesExecuted} trades overnight`
        : null,
      "",
      recentLearnings.length > 0
        ? `*Last session:* ${recentLearnings[0].replace(/^(Win:|Successful [a-z]+ build:)\s*/i, "").trim()}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendTelegram(telegramBriefing);
      ttsEntry.channels.push("telegram");
    } catch (err) {
      errors.push(`Telegram: ${(err as Error).message}`);
    }

    ttsEntry.success = errors.length === 0;
    if (errors.length > 0) ttsEntry.error = errors.join(" | ");
    appendDeliveryLog(ttsEntry);
  }

  /**
   * Speak a trade execution event.
   */
  async notifyTrade(trade: TradeSignal): Promise<void> {
    const priceStr = trade.price.toFixed(trade.price < 1 ? 6 : 2);
    const confPct = (trade.confidence * 100).toFixed(0);
    const pnlNote =
      trade.pnlEstimate !== undefined
        ? ` Estimated P&L: ${trade.pnlEstimate >= 0 ? "+" : ""}${trade.pnlEstimate.toFixed(2)} dollars.`
        : "";

    const spokenText =
      `Trade executed. ${trade.side} ${trade.symbol} at ${priceStr}. ` +
      `Quantity: ${trade.quantity}. Confidence: ${confPct}%. ` +
      `Strategy: ${trade.strategy}. Exchange: ${trade.exchange}.${pnlNote}`;

    const unusualNote =
      trade.unusualScore !== undefined
        ? `\nUnusual Flow Score: ${(trade.unusualScore * 100).toFixed(0)}%`
        : "";

    const telegramText =
      `*TRADE EXECUTED*\n` +
      `${trade.side === "BUY" ? "BUY" : trade.side === "SELL" ? "SELL" : "SHORT"} *${trade.symbol}*\n` +
      `Price: \`${priceStr}\` | Qty: \`${trade.quantity}\`\n` +
      `Confidence: ${confPct}% | Exchange: ${trade.exchange}\n` +
      `Strategy: ${trade.strategy}` +
      unusualNote +
      (trade.pnlEstimate !== undefined
        ? `\nEst. P&L: ${trade.pnlEstimate >= 0 ? "+" : ""}${trade.pnlEstimate.toFixed(2)}`
        : "") +
      `\n\n_${trade.reasoning}_`;

    const entry: DeliveryLogEntry = {
      id: generateId(),
      deliveredAt: new Date().toISOString(),
      type: "trade",
      title: `${trade.side} ${trade.symbol}`,
      text: spokenText,
      urgency: 4,
      chain: "intellitradeX",
      channels: [],
      success: false,
    };

    const errors: string[] = [];

    try {
      await sendToAvatar(spokenText);
      entry.channels.push("tts");
    } catch (err) {
      errors.push(`TTS: ${(err as Error).message}`);
    }

    try {
      await sendTelegram(telegramText);
      entry.channels.push("telegram");
    } catch (err) {
      errors.push(`Telegram: ${(err as Error).message}`);
    }

    entry.success = errors.length === 0;
    if (errors.length > 0) entry.error = errors.join(" | ");
    appendDeliveryLog(entry);
  }

  /**
   * Speak a Loki build completion event.
   */
  async notifyBuild(build: LokiBuild): Promise<void> {
    const durationSec = (build.durationMs / 1000).toFixed(0);
    const statusWord = build.success ? "completed successfully" : "completed with errors";
    const deployNote = build.deployUrl
      ? ` Deployed to: ${build.deployUrl}.`
      : "";
    const highlightNote =
      build.highlights.length > 0
        ? ` Key results: ${build.highlights.slice(0, 2).join(". ")}.`
        : "";

    const spokenText =
      `Loki build ${statusWord}. ` +
      `Requirement: ${build.requirement}. ` +
      `${build.phasesCompleted} of ${build.totalPhases} phases completed. ` +
      `${build.agentsUsed} agents used in ${durationSec} seconds.` +
      deployNote +
      highlightNote;

    const telegramText =
      `*LOKI BUILD ${build.success ? "COMPLETE" : "DONE (WITH ERRORS)"}*\n` +
      `\`${build.requirement}\`\n\n` +
      `Type: ${build.type} | Phases: ${build.phasesCompleted}/${build.totalPhases}\n` +
      `Agents: ${build.agentsUsed} | Duration: ${durationSec}s\n` +
      (build.deployUrl ? `Deploy: ${build.deployUrl}\n` : "") +
      (build.highlights.length > 0
        ? `\n*Highlights:*\n${build.highlights.slice(0, 3).map((h) => `• ${h}`).join("\n")}`
        : "") +
      `\nOutput: \`${build.outputPath}\``;

    const entry: DeliveryLogEntry = {
      id: generateId(),
      deliveredAt: new Date().toISOString(),
      type: "project",
      title: `Loki Build: ${build.requirement.slice(0, 60)}`,
      text: spokenText,
      urgency: 3,
      chain: "loki-mode",
      channels: [],
      success: false,
    };

    const errors: string[] = [];

    try {
      await sendToAvatar(spokenText);
      entry.channels.push("tts");
    } catch (err) {
      errors.push(`TTS: ${(err as Error).message}`);
    }

    try {
      await sendTelegram(telegramText);
      entry.channels.push("telegram");
    } catch (err) {
      errors.push(`Telegram: ${(err as Error).message}`);
    }

    entry.success = errors.length === 0;
    if (errors.length > 0) entry.error = errors.join(" | ");
    appendDeliveryLog(entry);
  }

  /**
   * Speak a top opportunity notification.
   */
  async notifyOpportunity(opp: Opportunity): Promise<void> {
    const scorePct = (opp.score * 100).toFixed(0);
    const urgencyWord: Record<Opportunity["urgency"], string> = {
      immediate: "Act immediately.",
      this_week: "Priority this week.",
      this_month: "Schedule this month.",
      low_priority: "Low priority.",
    };

    const spokenText =
      `Opportunity detected: ${opp.keyword} in ${opp.category}. ` +
      `Score: ${scorePct}%. ` +
      `${urgencyWord[opp.urgency]} ` +
      `${opp.recommendedAction} ` +
      `Estimated capital: ${opp.requiredCapitalUsd} dollars. Time to value: ${opp.ttvDays} days.`;

    const telegramText =
      `*OPPORTUNITY ALERT*\n` +
      `*${opp.keyword}* (${opp.category})\n` +
      `Score: *${scorePct}%* | Urgency: ${opp.urgency}\n` +
      `Capital: $${opp.requiredCapitalUsd} | TTV: ${opp.ttvDays}d\n\n` +
      `${opp.recommendedAction}`;

    const urgencyLevel: AvatarMessage["urgency"] =
      opp.urgency === "immediate"
        ? 5
        : opp.urgency === "this_week"
        ? 4
        : opp.urgency === "this_month"
        ? 3
        : 2;

    const entry: DeliveryLogEntry = {
      id: generateId(),
      deliveredAt: new Date().toISOString(),
      type: "alert",
      title: `Opportunity: ${opp.keyword}`,
      text: spokenText,
      urgency: urgencyLevel,
      chain: "opportunity-scorer",
      channels: [],
      success: false,
    };

    const errors: string[] = [];

    try {
      await sendToAvatar(spokenText);
      entry.channels.push("tts");
    } catch (err) {
      errors.push(`TTS: ${(err as Error).message}`);
    }

    if (urgencyLevel >= 4) {
      try {
        await sendTelegram(telegramText);
        entry.channels.push("telegram");
      } catch (err) {
        errors.push(`Telegram: ${(err as Error).message}`);
      }
    }

    entry.success = errors.length === 0;
    if (errors.length > 0) entry.error = errors.join(" | ");
    appendDeliveryLog(entry);
  }
}
