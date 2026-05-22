/**
 * Session Hooks — Claude Architect OS
 * Wires into Claude Code SessionStart / SessionEnd / UserPromptSubmit hooks.
 * Configured via ~/.claude/settings.json hooks array.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const MEMORY_DIR = path.join(process.env.HOME!, ".amsa/memory");
const QUEUE_DIR = path.join(process.env.HOME!, ".amsa/linear-queue");
const CMNDCENTER = path.join(process.env.HOME!, "CMNDCENTER");

// ─── Session Start Hook ───────────────────────────────────────────────────────

export async function onSessionStart(): Promise<void> {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.mkdirSync(QUEUE_DIR, { recursive: true });

  const summary: string[] = [];

  // Load last session learnings
  const wrapupPath = path.join(MEMORY_DIR, "karpathy_wrapup.json");
  if (fs.existsSync(wrapupPath)) {
    try {
      const wrapup = JSON.parse(fs.readFileSync(wrapupPath, "utf-8"));
      if (wrapup.top_patterns?.length) {
        summary.push(`📚 Last session: ${wrapup.top_patterns.slice(0, 3).join(" | ")}`);
      }
    } catch { /* ignore */ }
  }

  // Load pending ROI queue
  const roiQueuePath = path.join(QUEUE_DIR, "roi-queue.json");
  if (fs.existsSync(roiQueuePath)) {
    try {
      const queue = JSON.parse(fs.readFileSync(roiQueuePath, "utf-8"));
      const high = (queue.items || []).filter((i: { score: number }) => i.score >= 80).slice(0, 3);
      if (high.length) {
        summary.push(`🎯 High-ROI queue: ${high.map((i: { task: string; score: number }) => `${i.task} (${i.score})`).join(", ")}`);
      }
    } catch { /* ignore */ }
  }

  // Check pending gaps
  const gapsPath = path.join(QUEUE_DIR, "gaps.json");
  if (fs.existsSync(gapsPath)) {
    try {
      const gaps = JSON.parse(fs.readFileSync(gapsPath, "utf-8"));
      const open = (gaps.gaps || gaps).filter((g: { status: string; severity: string }) => g.status !== "fixed" && g.severity === "high").length;
      if (open > 0) summary.push(`⚠️  ${open} unresolved high-severity gaps`);
    } catch { /* ignore */ }
  }

  // Log session start
  const logEntry = { event: "session_start", timestamp: new Date().toISOString(), summary };
  const logPath = path.join(MEMORY_DIR, "session-log.json");
  const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf-8")) : [];
  log.push(logEntry);
  fs.writeFileSync(logPath, JSON.stringify(log.slice(-100), null, 2));

  if (summary.length) {
    console.log("\n⚡ CMNDCENTER Session Start:");
    summary.forEach((s) => console.log(`  ${s}`));
    console.log("");
  }
}

// ─── Session End Hook ─────────────────────────────────────────────────────────

export async function onSessionEnd(sessionSummary?: string): Promise<void> {
  const wrapup = {
    timestamp: new Date().toISOString(),
    session_summary: sessionSummary || "Session completed",
    top_patterns: extractSessionPatterns(),
    roi_score: calculateSessionROI(),
    next_session_priorities: loadQueuePriorities(),
  };

  fs.writeFileSync(
    path.join(MEMORY_DIR, "karpathy_wrapup.json"),
    JSON.stringify(wrapup, null, 2)
  );

  // Append to upgrade log
  const upgradeLogPath = path.join(MEMORY_DIR, "upgrade-log.json");
  const upgradeLog = fs.existsSync(upgradeLogPath)
    ? JSON.parse(fs.readFileSync(upgradeLogPath, "utf-8"))
    : { runs: [] };
  upgradeLog.runs = [...(upgradeLog.runs || []), { step: "session_end", status: "completed", timestamp: wrapup.timestamp, roi: wrapup.roi_score }].slice(-200);
  fs.writeFileSync(upgradeLogPath, JSON.stringify(upgradeLog, null, 2));
}

// ─── UserPromptSubmit Hook ────────────────────────────────────────────────────

export function onPromptSubmit(prompt: string): void {
  // Detect Loki keywords → fire loki-trigger
  const lokiTriggers = /\b(loki|build me|create a|build an|make me|develop a|autonomous build)\b/i;
  if (lokiTriggers.test(prompt)) {
    try {
      execSync(`bash "${CMNDCENTER}/scripts/loki-trigger.sh"`, { timeout: 5000 });
    } catch { /* non-blocking */ }
  }

  // Log prompt metadata for pattern extraction
  const logPath = path.join(MEMORY_DIR, "prompt-log.json");
  const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf-8")) : [];
  log.push({ prompt: prompt.slice(0, 200), timestamp: new Date().toISOString() });
  fs.writeFileSync(logPath, JSON.stringify(log.slice(-500), null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSessionPatterns(): string[] {
  try {
    const patterns = JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, "patterns.json"), "utf-8"));
    return patterns.slice(-10).map((p: { task: string }) => p.task?.slice(0, 80) || "").filter(Boolean).slice(0, 5);
  } catch { return []; }
}

function calculateSessionROI(): number {
  // Placeholder — real impl checks what was shipped this session
  return 70;
}

function loadQueuePriorities(): string[] {
  try {
    const queue = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, "roi-queue.json"), "utf-8"));
    return (queue.items || []).slice(0, 3).map((i: { task: string }) => i.task);
  } catch { return []; }
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const event = process.argv[2];
  if (event === "start") onSessionStart().then(() => process.exit(0));
  else if (event === "end") onSessionEnd(process.argv.slice(3).join(" ")).then(() => process.exit(0));
  else if (event === "prompt") onPromptSubmit(process.argv.slice(3).join(" "));
}
