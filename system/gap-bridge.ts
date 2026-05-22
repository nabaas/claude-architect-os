/**
 * system/gap-bridge.ts
 * Autonomous Gap Detection and Bridge Engine — Claude Architect OS v4.0
 *
 * Detects disconnections between current system state and optimal state.
 * Auto-fixes what it can. Queues and alerts what it cannot.
 *
 * Runs as part of scripts/upgrade.sh (3am nightly) and can be triggered
 * via Raycast at any time.
 *
 * Service checks: Ollama, ChromaDB, Supabase, n8n, LiteLLM, Redis,
 *                 AnythingLLM, Neo4j, Trigger.dev, Open-LLM-VTuber,
 *                 AMSA memory files, pattern store, roi-queue, gaps file
 */

import { execSync, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

// ── Constants ──────────────────────────────────────────────────────────────

const HOME = os.homedir();
const CMNDCENTER = path.join(HOME, "CMNDCENTER");
const AMSA_MEMORY = path.join(HOME, ".amsa", "memory");
const AMSA_LINEAR_QUEUE = path.join(HOME, ".amsa", "linear-queue");
const GAPS_FILE = path.join(AMSA_LINEAR_QUEUE, "gaps.json");
const PATTERNS_FILE = path.join(AMSA_MEMORY, "patterns.json");
const UPGRADE_LOG = path.join(AMSA_MEMORY, "upgrade-log.json");
const HALT_FILE = path.join(CMNDCENTER, "intellitradeX", ".HALT");

const SERVICE_TIMEOUT_MS = 3000;

// ── Types ──────────────────────────────────────────────────────────────────

export type GapSeverity = "critical" | "high" | "medium" | "low";
export type GapStatus = "open" | "auto-fixed" | "queued" | "manual-required" | "resolved";

export interface Gap {
  /** Unique identifier */
  id: string;
  /** Human-readable description of the gap */
  description: string;
  severity: GapSeverity;
  /** Which of the 7 CMNDCENTER chains are broken or degraded by this gap */
  affectedChains: string[];
  /** Can this be fixed without human input? */
  autoFixable: boolean;
  /** Shell command or script path to auto-fix (only if autoFixable) */
  fixScript?: string;
  /** Current status */
  status: GapStatus;
  /** ISO timestamp when gap was detected */
  detectedAt: string;
  /** ISO timestamp when gap was fixed (if fixed) */
  fixedAt?: string;
  /** Error message if fix failed */
  fixError?: string;
}

export interface BridgeResult {
  gap: Gap;
  success: boolean;
  message: string;
  durationMs: number;
}

export interface ServiceHealth {
  name: string;
  url?: string;
  port?: number;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface HealthMatrix {
  /** ISO timestamp of check */
  checkedAt: string;
  /** Overall system health: ok | degraded | critical */
  overallStatus: "ok" | "degraded" | "critical";
  /** Number of healthy services */
  healthyCount: number;
  /** Number of unhealthy services */
  unhealthyCount: number;
  /** All service health results */
  services: ServiceHealth[];
  /** Detected gaps from this health check */
  gaps: Gap[];
  /** Summary message */
  summary: string;
}

export interface SystemState {
  /** ISO timestamp of state snapshot */
  timestamp: string;
  /** Running Docker containers (by name) */
  runningContainers: string[];
  /** Running processes (by name fragment) */
  runningProcesses: string[];
  /** Files known to exist */
  existingFiles: string[];
  /** Services confirmed reachable by HTTP */
  reachableServices: string[];
  /** Custom key-value state entries */
  extra?: Record<string, unknown>;
}

// ── System State Capture ───────────────────────────────────────────────────

/**
 * Captures a snapshot of the current system state.
 * All operations are wrapped in try/catch — partial state is better than no state.
 */
export async function captureSystemState(): Promise<SystemState> {
  const timestamp = new Date().toISOString();
  const state: SystemState = {
    timestamp,
    runningContainers: [],
    runningProcesses: [],
    existingFiles: [],
    reachableServices: [],
  };

  // Docker containers
  try {
    const output = execSync("docker ps --format '{{.Names}}' 2>/dev/null", { timeout: 5000 }).toString();
    state.runningContainers = output.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    // Docker may not be running
  }

  // Processes (macOS: ps aux)
  try {
    const output = execSync("ps aux 2>/dev/null | awk '{print $11}' | sort -u", { timeout: 5000 }).toString();
    state.runningProcesses = output.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    // Non-fatal
  }

  // File existence for critical CMNDCENTER files
  const criticalFiles = [
    PATTERNS_FILE,
    UPGRADE_LOG,
    GAPS_FILE,
    path.join(AMSA_MEMORY, "karpathy_wrapup.json"),
    path.join(HOME, "Library", "LaunchAgents", "com.cmndcenter.loki-improver.plist"),
    path.join(CMNDCENTER, "loki", "loki.sh"),
    path.join(CMNDCENTER, "repos", "claude-architect-os", "CLAUDE.md"),
    path.join(CMNDCENTER, "repos", "claude-architect-os", "system", "roi-brain.ts"),
    path.join(CMNDCENTER, "repos", "claude-architect-os", "system", "pattern-engine.ts"),
    path.join(CMNDCENTER, "repos", "claude-architect-os", "system", "gap-bridge.ts"),
    path.join(HOME, ".amsa", "linear-queue", "roi-queue.json"),
  ];

  for (const f of criticalFiles) {
    if (fs.existsSync(f)) {
      state.existingFiles.push(f);
    }
  }

  // HTTP reachability checks (non-blocking, quick timeout)
  const serviceEndpoints: Array<{ name: string; url: string }> = [
    { name: "chromadb", url: "http://localhost:8000/api/v1/heartbeat" },
    { name: "litellm", url: "http://localhost:4000/health" },
    { name: "supabase", url: "http://localhost:54321/rest/v1/" },
    { name: "n8n", url: "http://localhost:5678/healthz" },
    { name: "ollama", url: "http://localhost:11434/api/tags" },
    { name: "anythingllm", url: "http://localhost:3001/api/ping" },
    { name: "flowise", url: "http://localhost:3000/api/v1/ping" },
    { name: "neo4j", url: "http://localhost:7474" },
  ];

  await Promise.allSettled(
    serviceEndpoints.map(async ({ name, url }) => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) state.reachableServices.push(name);
      } catch {
        // Service unreachable — not added to reachableServices
      }
    })
  );

  return state;
}

// ── Gap Detection ──────────────────────────────────────────────────────────

/**
 * Detects gaps between current system state and the ideal CMNDCENTER operating state.
 * Returns all detected gaps sorted by severity.
 */
export function detectGaps(currentState: SystemState): Gap[] {
  const gaps: Gap[] = [];
  const now = new Date().toISOString();
  let gapIndex = 0;

  const gapId = () => `gap_${Date.now()}_${String(++gapIndex).padStart(3, "0")}`;

  // Helper: check if service is in running containers or reachable
  const serviceUp = (name: string): boolean =>
    currentState.reachableServices.includes(name) ||
    currentState.runningContainers.some((c) => c.toLowerCase().includes(name));

  // Helper: check if process is running
  const processUp = (fragment: string): boolean =>
    currentState.runningProcesses.some((p) => p.toLowerCase().includes(fragment));

  // ── Critical Service Gaps ────────────────────────────────────────────────

  if (!serviceUp("chromadb")) {
    gaps.push({
      id: gapId(),
      description: "ChromaDB is not running at localhost:8000 — pattern memory and vector search are disabled",
      severity: "critical",
      affectedChains: ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
      autoFixable: true,
      fixScript: "docker start chromadb 2>/dev/null || docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest",
      status: "open",
      detectedAt: now,
    });
  }

  if (!serviceUp("litellm")) {
    gaps.push({
      id: gapId(),
      description: "LiteLLM proxy is not running at localhost:4000 — all LLM routing is broken",
      severity: "critical",
      affectedChains: ["chain-1-signal-profit", "chain-2-knowledge-compound", "chain-3-auto-upgrade", "chain-4-repo-intelligence", "chain-5-voice-build", "chain-6-market-arbitrage", "chain-7-content-revenue"],
      autoFixable: true,
      fixScript: `cd "${CMNDCENTER}/repos/claude-architect-os" && litellm --config integrations/litellm/config.yaml --port 4000 &`,
      status: "open",
      detectedAt: now,
    });
  }

  if (!serviceUp("ollama") && !processUp("ollama")) {
    gaps.push({
      id: gapId(),
      description: "Ollama is not running at localhost:11434 — local model inference unavailable (hermes3, gemma3:4b, nomic-embed)",
      severity: "high",
      affectedChains: ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
      autoFixable: true,
      fixScript: "ollama serve &",
      status: "open",
      detectedAt: now,
    });
  }

  if (!serviceUp("supabase")) {
    gaps.push({
      id: gapId(),
      description: "Supabase is not running at localhost:54321 — session analytics, P&L tracking, and trade logging are offline",
      severity: "high",
      affectedChains: ["chain-1-signal-profit", "chain-4-repo-intelligence", "chain-6-market-arbitrage", "chain-7-content-revenue"],
      autoFixable: true,
      fixScript: `cd "${CMNDCENTER}" && supabase start`,
      status: "open",
      detectedAt: now,
    });
  }

  if (!serviceUp("n8n")) {
    gaps.push({
      id: gapId(),
      description: "n8n is not running at localhost:5678 — workflow automation and Telegram alerts are disabled",
      severity: "high",
      affectedChains: ["chain-1-signal-profit", "chain-4-repo-intelligence", "chain-6-market-arbitrage", "chain-7-content-revenue"],
      autoFixable: true,
      fixScript: "docker start n8n 2>/dev/null || docker run -d --name n8n -p 5678:5678 n8nio/n8n:latest",
      status: "open",
      detectedAt: now,
    });
  }

  // ── Medium-Priority Service Gaps ─────────────────────────────────────────

  if (!serviceUp("anythingllm")) {
    gaps.push({
      id: gapId(),
      description: "AnythingLLM is not running at localhost:3001 — local RAG browsing interface unavailable",
      severity: "medium",
      affectedChains: ["chain-2-knowledge-compound"],
      autoFixable: true,
      fixScript: "docker start anythingllm 2>/dev/null || docker run -d --name anythingllm -p 3001:3001 mintplexlabs/anythingllm:latest",
      status: "open",
      detectedAt: now,
    });
  }

  if (!serviceUp("neo4j")) {
    gaps.push({
      id: gapId(),
      description: "Neo4j is not running at localhost:7474 — knowledge graph and GraphRAG compound relationships unavailable",
      severity: "medium",
      affectedChains: ["chain-2-knowledge-compound", "chain-6-market-arbitrage"],
      autoFixable: true,
      fixScript: "docker start neo4j 2>/dev/null || docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:latest",
      status: "open",
      detectedAt: now,
    });
  }

  // ── Memory / File Gaps ───────────────────────────────────────────────────

  if (!currentState.existingFiles.includes(PATTERNS_FILE)) {
    gaps.push({
      id: gapId(),
      description: `patterns.json does not exist at ${PATTERNS_FILE} — pattern memory is empty, self-improvement loop is blind`,
      severity: "high",
      affectedChains: ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
      autoFixable: true,
      fixScript: `mkdir -p "${AMSA_MEMORY}" && echo "[]" > "${PATTERNS_FILE}"`,
      status: "open",
      detectedAt: now,
    });
  }

  if (!currentState.existingFiles.includes(UPGRADE_LOG)) {
    gaps.push({
      id: gapId(),
      description: `upgrade-log.json does not exist at ${UPGRADE_LOG} — auto-upgrade history is missing`,
      severity: "medium",
      affectedChains: ["chain-3-auto-upgrade"],
      autoFixable: true,
      fixScript: `mkdir -p "${AMSA_MEMORY}" && echo '{"runs":[],"lastRun":null}' > "${UPGRADE_LOG}"`,
      status: "open",
      detectedAt: now,
    });
  }

  const roiQueuePath = path.join(AMSA_LINEAR_QUEUE, "roi-queue.json");
  if (!currentState.existingFiles.includes(roiQueuePath) &&
      !fs.existsSync(roiQueuePath)) {
    gaps.push({
      id: gapId(),
      description: `roi-queue.json does not exist — high-ROI opportunities are not being tracked`,
      severity: "medium",
      affectedChains: ["chain-1-signal-profit", "chain-2-knowledge-compound"],
      autoFixable: true,
      fixScript: `mkdir -p "${AMSA_LINEAR_QUEUE}" && echo "[]" > "${roiQueuePath}"`,
      status: "open",
      detectedAt: now,
    });
  }

  // ── AMSA Memory Directories ──────────────────────────────────────────────

  const criticalDirs = [AMSA_MEMORY, AMSA_LINEAR_QUEUE];
  for (const dir of criticalDirs) {
    if (!fs.existsSync(dir)) {
      gaps.push({
        id: gapId(),
        description: `Critical directory missing: ${dir} — memory storage is non-functional`,
        severity: "critical",
        affectedChains: ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
        autoFixable: true,
        fixScript: `mkdir -p "${dir}"`,
        status: "open",
        detectedAt: now,
      });
    }
  }

  // ── LaunchAgent Gap ──────────────────────────────────────────────────────

  const launchAgentPath = path.join(HOME, "Library", "LaunchAgents", "com.cmndcenter.loki-improver.plist");
  if (!currentState.existingFiles.includes(launchAgentPath) && !fs.existsSync(launchAgentPath)) {
    gaps.push({
      id: gapId(),
      description: "Loki improver LaunchAgent is not installed — nightly auto-upgrade (Chain 3) will not fire at 3am",
      severity: "medium",
      affectedChains: ["chain-3-auto-upgrade"],
      autoFixable: false,
      status: "open",
      detectedAt: now,
    });
  }

  // ── Loki Mode Gap ────────────────────────────────────────────────────────

  const lokiSh = path.join(CMNDCENTER, "loki", "loki.sh");
  if (!fs.existsSync(lokiSh)) {
    gaps.push({
      id: gapId(),
      description: "loki.sh not found at ~/CMNDCENTER/loki/ — 37-agent autonomous build (Chains 1, 5) is broken",
      severity: "critical",
      affectedChains: ["chain-1-signal-profit", "chain-5-voice-build"],
      autoFixable: false,
      status: "open",
      detectedAt: now,
    });
  }

  // Sort by severity
  const severityOrder: Record<GapSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return gaps;
}

// ── Auto-Bridge ────────────────────────────────────────────────────────────

/**
 * Attempts to automatically fix a gap by executing its fixScript.
 * For non-autoFixable gaps, queues them and (optionally) sends a Telegram alert.
 *
 * @param gap  The gap to attempt to bridge
 * @returns    BridgeResult with success status and duration
 */
export async function autoBridge(gap: Gap): Promise<BridgeResult> {
  const start = Date.now();

  if (!gap.autoFixable || !gap.fixScript) {
    // Queue for manual resolution
    await persistGap({ ...gap, status: "manual-required" });

    // Attempt Telegram alert for critical/high gaps
    if (gap.severity === "critical" || gap.severity === "high") {
      await sendTelegramAlert(
        `[CMNDCENTER GAP] ${gap.severity.toUpperCase()}: ${gap.description}\nChains affected: ${gap.affectedChains.join(", ")}\nRequires manual fix.`
      );
    }

    return {
      gap: { ...gap, status: "manual-required" },
      success: false,
      message: `Gap requires manual intervention: ${gap.description}`,
      durationMs: Date.now() - start,
    };
  }

  try {
    await execAsync(gap.fixScript, { timeout: 30000 });

    const fixedGap: Gap = {
      ...gap,
      status: "auto-fixed",
      fixedAt: new Date().toISOString(),
    };

    await persistGap(fixedGap);

    return {
      gap: fixedGap,
      success: true,
      message: `Auto-fixed: ${gap.description}`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    const failedGap: Gap = {
      ...gap,
      status: "queued",
      fixError: errorMessage,
    };

    await persistGap(failedGap);

    // Alert on fix failure
    await sendTelegramAlert(
      `[CMNDCENTER] Auto-fix FAILED for: ${gap.description}\nError: ${errorMessage.slice(0, 200)}`
    );

    return {
      gap: failedGap,
      success: false,
      message: `Auto-fix failed: ${errorMessage}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Detects gaps in the current system state and attempts to auto-bridge all auto-fixable ones.
 * Returns a summary of results.
 */
export async function detectAndBridgeAll(): Promise<{
  totalGaps: number;
  autoFixed: number;
  manualRequired: number;
  failed: number;
  results: BridgeResult[];
}> {
  const state = await captureSystemState();
  const gaps = detectGaps(state);
  const results: BridgeResult[] = [];

  for (const gap of gaps) {
    const result = await autoBridge(gap);
    results.push(result);
  }

  const autoFixed = results.filter((r) => r.success).length;
  const manualRequired = results.filter((r) => r.gap.status === "manual-required").length;
  const failed = results.filter((r) => !r.success && r.gap.status !== "manual-required").length;

  return {
    totalGaps: gaps.length,
    autoFixed,
    manualRequired,
    failed,
    results,
  };
}

// ── Health Matrix ──────────────────────────────────────────────────────────

/**
 * Performs a comprehensive health check across all CMNDCENTER services.
 * Returns a unified HealthMatrix object.
 */
export async function healthMatrix(): Promise<HealthMatrix> {
  const checkedAt = new Date().toISOString();

  const SERVICES: Array<{ name: string; url: string; port: number }> = [
    { name: "Ollama",         url: "http://localhost:11434/api/tags",     port: 11434 },
    { name: "ChromaDB",       url: "http://localhost:8000/api/v1/heartbeat", port: 8000 },
    { name: "Supabase",       url: "http://localhost:54321/rest/v1/",     port: 54321 },
    { name: "n8n",            url: "http://localhost:5678/healthz",       port: 5678 },
    { name: "LiteLLM",        url: "http://localhost:4000/health",        port: 4000 },
    { name: "AnythingLLM",    url: "http://localhost:3001/api/ping",      port: 3001 },
    { name: "Neo4j",          url: "http://localhost:7474",               port: 7474 },
    { name: "Flowise",        url: "http://localhost:3000/api/v1/ping",   port: 3000 },
  ];

  // Check services in parallel
  const serviceResults = await Promise.all(
    SERVICES.map(async ({ name, url, port }): Promise<ServiceHealth> => {
      const t0 = Date.now();
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        const latencyMs = Date.now() - t0;
        return {
          name,
          url,
          port,
          healthy: res.ok,
          latencyMs,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        };
      } catch (err) {
        return {
          name,
          url,
          port,
          healthy: false,
          latencyMs: Date.now() - t0,
          error: err instanceof Error ? err.message.slice(0, 80) : "unreachable",
        };
      }
    })
  );

  // Add Redis (check via CLI since it has no HTTP API)
  const redisHealth = await checkRedis();
  serviceResults.push(redisHealth);

  // Add Ollama process check as a fallback (in case the HTTP check fails but the process is running)
  const ollamaHttp = serviceResults.find((s) => s.name === "Ollama");
  if (ollamaHttp && !ollamaHttp.healthy) {
    const processRunning = await isProcessRunning("ollama");
    if (processRunning) {
      ollamaHttp.error = "HTTP unreachable but process is running — may be starting up";
    }
  }

  const healthyCount = serviceResults.filter((s) => s.healthy).length;
  const unhealthyCount = serviceResults.length - healthyCount;
  const healthRatio = healthyCount / serviceResults.length;

  const overallStatus: HealthMatrix["overallStatus"] =
    healthRatio >= 0.85 ? "ok" :
    healthRatio >= 0.6  ? "degraded" :
    "critical";

  // Detect gaps from health results
  const state = await captureSystemState();
  const gaps = detectGaps(state);

  const summary = [
    `${healthyCount}/${serviceResults.length} services healthy`,
    unhealthyCount > 0
      ? `Unhealthy: ${serviceResults.filter((s) => !s.healthy).map((s) => s.name).join(", ")}`
      : "All services operational",
    gaps.length > 0
      ? `${gaps.length} gap(s) detected: ${gaps.filter((g) => g.severity === "critical").length} critical`
      : "No gaps detected",
  ].join(" | ");

  return {
    checkedAt,
    overallStatus,
    healthyCount,
    unhealthyCount,
    services: serviceResults,
    gaps,
    summary,
  };
}

// ── Gap Persistence ────────────────────────────────────────────────────────

/**
 * Persists a gap to the gaps.json queue file.
 * Updates if gap ID already exists.
 */
async function persistGap(gap: Gap): Promise<void> {
  try {
    fs.mkdirSync(AMSA_LINEAR_QUEUE, { recursive: true });

    let gaps: Gap[] = [];
    if (fs.existsSync(GAPS_FILE)) {
      try {
        gaps = JSON.parse(fs.readFileSync(GAPS_FILE, "utf-8")) as Gap[];
      } catch {
        gaps = [];
      }
    }

    const existingIndex = gaps.findIndex((g) => g.id === gap.id);
    if (existingIndex >= 0) {
      gaps[existingIndex] = gap;
    } else {
      gaps.push(gap);
    }

    // Keep only last 500 gaps, prioritize open ones
    gaps.sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    if (gaps.length > 500) gaps = gaps.slice(0, 500);

    const tmp = GAPS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(gaps, null, 2), "utf-8");
    fs.renameSync(tmp, GAPS_FILE);
  } catch (err) {
    console.error("[gap-bridge] Failed to persist gap:", err);
  }
}

/**
 * Loads all open gaps from the queue file.
 */
export function loadOpenGaps(): Gap[] {
  try {
    if (!fs.existsSync(GAPS_FILE)) return [];
    const gaps = JSON.parse(fs.readFileSync(GAPS_FILE, "utf-8")) as Gap[];
    return gaps.filter((g) => g.status === "open" || g.status === "queued");
  } catch {
    return [];
  }
}

/**
 * Marks a gap as resolved.
 */
export function resolveGap(gapId: string): void {
  try {
    if (!fs.existsSync(GAPS_FILE)) return;
    const gaps = JSON.parse(fs.readFileSync(GAPS_FILE, "utf-8")) as Gap[];
    const gap = gaps.find((g) => g.id === gapId);
    if (gap) {
      gap.status = "resolved";
      gap.fixedAt = new Date().toISOString();
      fs.writeFileSync(GAPS_FILE, JSON.stringify(gaps, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("[gap-bridge] Failed to resolve gap:", err);
  }
}

// ── Utility Checks ─────────────────────────────────────────────────────────

/**
 * Checks if a process name fragment is running on the system.
 */
async function isProcessRunning(fragment: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`pgrep -f "${fragment}" 2>/dev/null || echo ""`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Checks Redis health via redis-cli ping.
 */
async function checkRedis(): Promise<ServiceHealth> {
  const t0 = Date.now();
  try {
    const { stdout } = await execAsync("redis-cli ping 2>/dev/null");
    const healthy = stdout.trim() === "PONG";
    return {
      name: "Redis",
      port: 6379,
      healthy,
      latencyMs: Date.now() - t0,
      error: healthy ? undefined : "redis-cli ping did not return PONG",
    };
  } catch {
    // Try Docker fallback
    try {
      const { stdout } = await execAsync("docker exec redis redis-cli ping 2>/dev/null");
      const healthy = stdout.trim() === "PONG";
      return {
        name: "Redis",
        port: 6379,
        healthy,
        latencyMs: Date.now() - t0,
      };
    } catch {
      return {
        name: "Redis",
        port: 6379,
        healthy: false,
        latencyMs: Date.now() - t0,
        error: "redis-cli not found and docker exec failed",
      };
    }
  }
}

// ── Telegram Alert ─────────────────────────────────────────────────────────

/**
 * Sends a Telegram alert via n8n webhook (if configured) or direct Bot API.
 * Non-blocking — failures are logged but do not throw.
 */
async function sendTelegramAlert(message: string): Promise<void> {
  const N8N_TELEGRAM_WEBHOOK = process.env.N8N_TELEGRAM_WEBHOOK;
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (N8N_TELEGRAM_WEBHOOK) {
    try {
      await fetch(N8N_TELEGRAM_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, source: "gap-bridge", timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(5000),
      });
      return;
    } catch {
      // Fall through to direct API
    }
  }

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: `[claude-architect-os]\n${message}`,
            parse_mode: "HTML",
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
    } catch (err) {
      console.warn("[gap-bridge] Telegram alert failed (non-fatal):", err);
    }
  }
}

// ── Kill Switch Guard ──────────────────────────────────────────────────────

/**
 * Checks if the IntelliTradeX HALT file is present.
 * Returns true if trading is halted.
 */
export function isTradingHalted(): boolean {
  return fs.existsSync(HALT_FILE);
}

/**
 * Activates the IntelliTradeX kill switch by creating the HALT file.
 */
export function haltTrading(reason: string): void {
  const dir = path.dirname(HALT_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    HALT_FILE,
    JSON.stringify({ halted: true, reason, haltedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

/**
 * Resumes trading by removing the HALT file.
 */
export function resumeTrading(): void {
  if (fs.existsSync(HALT_FILE)) {
    fs.unlinkSync(HALT_FILE);
  }
}

// ── Exports ────────────────────────────────────────────────────────────────

export {
  CMNDCENTER,
  AMSA_MEMORY,
  AMSA_LINEAR_QUEUE,
  GAPS_FILE,
  PATTERNS_FILE,
  HOME,
};
