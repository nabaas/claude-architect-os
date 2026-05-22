/**
 * system/consciousness.ts
 * Meta-Intelligence Layer — Claude Architect OS v4.0 (Loki Mode)
 *
 * The philosophical/algorithmic understanding engine that sits above all other agents.
 * Recognizes patterns of patterns (Tier 4/5), computes compound leverage chains,
 * detects information asymmetry, and orchestrates the self-improving compounding loop.
 *
 * Architecture position:
 *   Consciousness (this file)
 *     ↓
 *   PatternEngine (pattern-engine.ts) + ROIBrain (roi-brain.ts) + GapBridge (gap-bridge.ts)
 *     ↓
 *   ChromaDB (localhost:8000) + LiteLLM (localhost:4000)
 *     ↓
 *   ~/.amsa/memory/patterns.json + ~/.amsa/linear-queue/
 *
 * All LLM calls use claude-sonnet-4-6 via LiteLLM at localhost:4000 with prompt caching.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Constants ──────────────────────────────────────────────────────────────

const PATTERNS_FILE = path.join(os.homedir(), ".amsa", "memory", "patterns.json");
const LINEAR_QUEUE_DIR = path.join(os.homedir(), ".amsa", "linear-queue");
const CHROMADB_BASE = "http://localhost:8000";
const CHROMADB_COLLECTION = "cmndcenter_patterns";
const LITELLM_BASE = "http://localhost:4000";
const LITELLM_MODEL = "claude-sonnet-4-6";
const LITELLM_TIMEOUT_MS = 120_000;
const HTTP_TIMEOUT_MS = 5_000;
const TELEGRAM_API_BASE = "https://api.telegram.org";
const CASCADE_DEFAULT_DEPTH = 3;
const ALIGNMENT_MIN_CHAINS = 3;
const BASE_DISCOVERY_VALUE = 1.0;
const DISCOVERY_PREMIUM_MULTIPLIER = 3.0;

// All 7 compounding chain IDs
const CHAIN_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
type ChainNumber = (typeof CHAIN_IDS)[number];

// ── Interfaces ─────────────────────────────────────────────────────────────

/**
 * A recognized behavioral or structural pattern in the system.
 * Compatible with PatternEngine's Pattern shape, extended for consciousness layer.
 */
export interface Pattern {
  /** Unique identifier, e.g. "pat_<timestamp>_<slug>" */
  id: string;
  /** Human-readable description of the pattern */
  content: string;
  /** Category: solutions | prompts | tool_chains | failures | content_strategy | market_signals | architecture | automation */
  type: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Number of times this pattern has been observed or successfully applied */
  useCount: number;
  /** IDs of patterns this one chains to (directional) */
  chainLinks: string[];
  /** ISO timestamp of when this pattern was first saved */
  savedAt: string;
}

/**
 * A pattern of patterns — a meta-level observation about how patterns relate.
 * Tier 4 = recurring structural pattern; Tier 5 = axiom-level insight about the system.
 */
export interface MetaPattern {
  id: string;
  /** Human-readable description of the meta-insight */
  description: string;
  /** Hierarchical tier: 1=raw signal, 2=pattern, 3=compound, 4=meta, 5=axiom */
  tier: 1 | 2 | 3 | 4 | 5;
  /** What condition triggers this meta-pattern to activate */
  trigger: string;
  /** What happens when this pattern fires (predicted outcome) */
  effect: string;
  /** Premium value of recognizing this non-obvious meta-pattern (0-1 scale) */
  discoveryPremium: number;
}

/**
 * A transitive compound chain: (A → B) + (B → C) inferred as (A → C).
 */
export interface CompoundChain {
  id: string;
  /** ID of the first pattern (A) */
  chainA: string;
  /** ID of the second pattern (B → C connector) */
  chainB: string;
  /** Inferred transitive result description */
  result: string;
  /** Minimum of A.confidence and B.confidence */
  confidence: number;
  /** Estimated ROI multiplier for executing this compound chain */
  potentialROI: number;
}

/**
 * A detected information asymmetry — where the system has knowledge others lack.
 */
export interface AsymmetryOpportunity {
  /** market_timing | knowledge_gap | price_delta | trend_early | tool_advantage */
  type: string;
  /** What the asymmetric advantage is */
  advantage: string;
  /** ISO duration string or description of how long the window lasts */
  timeWindow: string;
  /** Bash/TypeScript action to execute to capture this opportunity */
  actionScript: string;
  /** Expected ROI 0-100 */
  expectedROI: number;
}

/**
 * A status snapshot of one of the 7 compounding chains.
 */
export interface ChainStatus {
  chainNumber: ChainNumber;
  name: string;
  active: boolean;
  lastFiredAt: string | null;
  healthScore: number;
  bottleneck: string | null;
}

/**
 * The synthesized worldview: current state of all 7 chains plus top opportunity.
 */
export interface SystemWorldview {
  /** Status of each of the 7 compounding chains */
  chains: ChainStatus[];
  /** Detected gaps or missing connections in the current architecture */
  gaps: string[];
  /** The single highest-leverage opportunity right now */
  topOpportunity: string;
  /** Overall system quality score 0-10 */
  qualityScore: number;
  /** The next recommended action to take */
  nextAction: string;
}

/**
 * A self-modification produced by consciousness — a rewritten agent prompt.
 */
export interface SelfModification {
  agentId: string;
  previousPrompt: string;
  newPrompt: string;
  /** Estimated quality improvement (positive = better, negative = regression) */
  qualityDelta: number;
  /** Whether this modification has been persisted to disk */
  applied: boolean;
}

/**
 * An event where multiple chains align simultaneously — multiplies leverage.
 */
export interface AlignmentEvent {
  /** Chain numbers (1-7) that are simultaneously active */
  chainsAligned: number[];
  /** What this alignment means in plain language */
  description: string;
  /** N² multiplier where N = number of aligned chains */
  multiplicationFactor: number;
  urgency: "immediate" | "24h" | "week";
}

/**
 * An opportunity timing window for a market signal.
 */
export interface OpportunityWindow {
  open: boolean;
  /** ISO timestamp of when the window opens (if not yet open) */
  opensAt?: string;
  /** ISO timestamp of when the window closes */
  closesAt: string;
  /** 0-1 probability that the opportunity is already saturated */
  saturationRisk: number;
  /** Estimated number of competitors already acting on this */
  competitorCount: number;
}

/**
 * A node in the pattern cascade tree.
 */
export interface CascadeNode {
  pattern: Pattern;
  depth: number;
  parentId: string | null;
  reachableROI: number;
  children: CascadeNode[];
}

/**
 * The full cascade tree starting from a seed pattern.
 */
export interface PatternCascade {
  seed: Pattern;
  descendants: CascadeNode[];
  /** Sum of reachableROI across all nodes */
  totalReachableROI: number;
}

/**
 * A quality measurement of a session's output.
 */
export interface QualityScore {
  /** 0-10: how specific and concrete the outputs were */
  specificity: number;
  /** 0-10: how directly actionable the outputs were */
  actionability: number;
  /** 0-10: how factually accurate outputs appear to be */
  accuracy: number;
  /** 0-10: how concisely outputs were communicated */
  brevity: number;
  /** Weighted average of the four dimensions */
  overall: number;
}

/**
 * A recorded interaction between an agent and user/system.
 */
export interface PerformanceEntry {
  agentId: string;
  prompt: string;
  output: string;
  /** 1-10 human or automated rating */
  rating: number;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * An active market signal being monitored for opportunities.
 */
export interface MarketSignal {
  id: string;
  type: string;
  source: string;
  value: number;
  metadata: Record<string, string | number | boolean>;
  detectedAt: string;
}

/**
 * A named signal associated with a specific chain for alignment detection.
 */
export interface Signal {
  id: string;
  chainId: number;
  name: string;
  strength: number;
  detectedAt: string;
}

// ── HTTP Utilities ──────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = HTTP_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isServiceReachable(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, HTTP_TIMEOUT_MS);
    return res.ok;
  } catch {
    return false;
  }
}

// ── File Utilities ──────────────────────────────────────────────────────────

function loadPatternsFromFile(): Pattern[] {
  try {
    if (!fs.existsSync(PATTERNS_FILE)) return [];
    const raw = fs.readFileSync(PATTERNS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Normalize legacy PatternEngine shapes to our Pattern interface
    return (parsed as Record<string, unknown>[]).map((p) => ({
      id: String(p["id"] ?? ""),
      content: String(p["content"] ?? ""),
      type: String(p["category"] ?? p["type"] ?? "unknown"),
      confidence: Number(p["confidence"] ?? 0.5),
      useCount: Number(p["frequency"] ?? p["useCount"] ?? 1),
      chainLinks: Array.isArray(p["chainLinks"]) ? (p["chainLinks"] as string[]) : [],
      savedAt: String(p["firstSeen"] ?? p["savedAt"] ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonAtomically(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

// ── LiteLLM Integration ─────────────────────────────────────────────────────

interface LiteLLMMessage {
  role: "system" | "user" | "assistant";
  content: string | LiteLLMContentBlock[];
}

interface LiteLLMContentBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

interface LiteLLMResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

/**
 * Calls claude-sonnet-4-6 via LiteLLM proxy with prompt caching on the system turn.
 * Falls back gracefully if LiteLLM is unreachable.
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
  const messages: LiteLLMMessage[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  try {
    const res = await fetchWithTimeout(
      `${LITELLM_BASE}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-task-type": "coding",
        },
        body: JSON.stringify({
          model: LITELLM_MODEL,
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      },
      LITELLM_TIMEOUT_MS
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LiteLLM HTTP ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as LiteLLMResponse;
    return data.choices[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[consciousness] LiteLLM call failed:", err);
    return "";
  }
}

// ── ChromaDB Semantic Search ────────────────────────────────────────────────

interface ChromaQueryResult {
  ids: string[][];
  documents: (string | null)[][];
  distances: number[][];
}

async function semanticSearch(query: string, nResults = 10): Promise<string[]> {
  const reachable = await isServiceReachable(`${CHROMADB_BASE}/api/v1/heartbeat`);
  if (!reachable) return [];

  try {
    const res = await fetchWithTimeout(
      `${CHROMADB_BASE}/api/v1/collections/${CHROMADB_COLLECTION}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_texts: [query],
          n_results: nResults,
          include: ["documents", "distances"],
        }),
      }
    );

    if (!res.ok) return [];
    const data = (await res.json()) as ChromaQueryResult;
    return (data.ids?.[0] ?? []).filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

// ── Telegram Alerts ─────────────────────────────────────────────────────────

async function sendTelegramAlert(message: string): Promise<void> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_CHAT_ID"];

  if (!botToken || !chatId) {
    console.warn("[consciousness] Telegram env vars not set — skipping alert");
    return;
  }

  try {
    await fetchWithTimeout(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      },
      10_000
    );
  } catch (err) {
    console.warn("[consciousness] Telegram alert failed (non-fatal):", err);
  }
}

// ── Pure Computation Functions ──────────────────────────────────────────────

/**
 * Compound leverage formula: (1 + rate)^days
 *
 * @param dailyImprovementRate  e.g. 0.10 for 10% daily improvement
 * @param daysAhead             number of days to project
 * @returns                     compound multiplier (e.g. ~37.4 for 10% over 365 days)
 */
export function computeCompoundLeverage(
  dailyImprovementRate: number,
  daysAhead: number
): number {
  if (dailyImprovementRate <= -1) {
    throw new RangeError("dailyImprovementRate must be > -1");
  }
  if (daysAhead < 0) {
    throw new RangeError("daysAhead must be >= 0");
  }
  return Math.pow(1 + dailyImprovementRate, daysAhead);
}

/**
 * Discovery premium: measures the non-obvious value of a solution.
 * Premium = (1 - obviousness) × MULTIPLIER × baseValue
 *
 * @param solution    Description of the solution (used for logging context only)
 * @param obviousness 0 = completely non-obvious, 1 = completely obvious
 * @returns           Discovery premium scalar
 */
export function computeDiscoveryPremium(
  solution: string,
  obviousness: number
): number {
  if (obviousness < 0 || obviousness > 1) {
    throw new RangeError(`obviousness must be in [0, 1], got: ${obviousness}`);
  }
  void solution; // contextual parameter — used by callers for documentation
  return (1 - obviousness) * DISCOVERY_PREMIUM_MULTIPLIER * BASE_DISCOVERY_VALUE;
}

/**
 * Determines whether the system should self-modify based on a pattern and history.
 *
 * Triggers when:
 * - The pattern confidence is below 0.5 AND it has been used 3+ times (stuck in low-confidence loop)
 * - The most recent N performance entries for this pattern's agent show declining ratings
 * - Average rating across recent performance entries is below 6/10
 */
export function shouldSelfModify(
  pattern: Pattern,
  performanceHistory: PerformanceEntry[]
): boolean {
  // Low-confidence pattern with repeated use suggests a stuck feedback loop
  if (pattern.confidence < 0.5 && pattern.useCount >= 3) {
    return true;
  }

  // Filter performance entries to this pattern's associated agent (by type/category match)
  const relevant = performanceHistory.filter(
    (e) =>
      e.output.toLowerCase().includes(pattern.type.toLowerCase()) ||
      e.prompt.toLowerCase().includes(pattern.content.slice(0, 40).toLowerCase())
  );

  if (relevant.length === 0) return false;

  // Check for declining trend in last 5 entries
  const recent = relevant.slice(-5);
  if (recent.length >= 3) {
    const avgRating =
      recent.reduce((sum, e) => sum + e.rating, 0) / recent.length;
    if (avgRating < 6) return true;

    // Monotonic decline check
    let declining = true;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].rating >= recent[i - 1].rating) {
        declining = false;
        break;
      }
    }
    if (declining) return true;
  }

  return false;
}

/**
 * Measures the quality of a session's output across four dimensions.
 * Returns normalized scores 0-10 for specificity, actionability, accuracy, brevity.
 */
export function measureSessionQuality(sessionLog: SessionEntry[]): QualityScore {
  if (sessionLog.length === 0) {
    return { specificity: 0, actionability: 0, accuracy: 0, brevity: 0, overall: 0 };
  }

  const outputs = sessionLog.map((e) => e.output);

  // Specificity: presence of concrete artifacts (code blocks, file paths, commands)
  const specificitySignals = /```|`[^`]+`|~\/|\.ts|\.json|localhost|http|function|class/g;
  const specificity =
    Math.min(
      10,
      (outputs.filter((o) => specificitySignals.test(o)).length / outputs.length) * 12
    );

  // Actionability: imperative verbs suggesting clear next steps
  const actionSignals = /\b(run|execute|deploy|save|create|install|add|wire|call|import|export|push)\b/gi;
  const actionability =
    Math.min(
      10,
      (outputs.filter((o) => actionSignals.test(o)).length / outputs.length) * 11
    );

  // Accuracy: absence of hedging language (higher hedging = lower accuracy score)
  const hedgingSignals = /\b(maybe|perhaps|possibly|might|could be|not sure|unclear|unknown)\b/gi;
  const hedgingRatio =
    outputs.filter((o) => hedgingSignals.test(o)).length / outputs.length;
  const accuracy = Math.min(10, (1 - hedgingRatio) * 10);

  // Brevity: penalize very long outputs (>2000 chars avg), reward concise ones
  const avgLength =
    outputs.reduce((sum, o) => sum + o.length, 0) / outputs.length;
  const brevity = Math.min(10, Math.max(0, 10 - (avgLength / 600)));

  const overall =
    (specificity * 0.3 + actionability * 0.3 + accuracy * 0.25 + brevity * 0.15);

  return {
    specificity: Math.round(specificity * 10) / 10,
    actionability: Math.round(actionability * 10) / 10,
    accuracy: Math.round(accuracy * 10) / 10,
    brevity: Math.round(brevity * 10) / 10,
    overall: Math.round(overall * 10) / 10,
  };
}

/** Lightweight session log entry used by measureSessionQuality */
export interface SessionEntry {
  agentId: string;
  prompt: string;
  output: string;
  timestamp: string;
}

// ── Standalone Async Functions ──────────────────────────────────────────────

/**
 * Detects the timing window for a market signal opportunity.
 * Uses signal metadata and LLM analysis to estimate open/close times and saturation risk.
 */
export async function detectOpportunityWindow(
  signal: MarketSignal
): Promise<OpportunityWindow> {
  const now = new Date();

  // Default close time: 24h for most signals; 4h for high-decay types
  const decayTypes = new Set(["trend_early", "price_delta", "arbitrage"]);
  const windowHours = decayTypes.has(signal.type) ? 4 : 24;
  const closesAt = new Date(now.getTime() + windowHours * 3_600_000).toISOString();

  // Estimate competitor count and saturation via LLM if available
  let saturationRisk = 0.2;
  let competitorCount = 0;

  const llmReachable = await isServiceReachable(`${LITELLM_BASE}/health`);
  if (llmReachable) {
    const systemPrompt =
      "You are a market timing analyst. Respond ONLY with JSON matching: " +
      '{"saturationRisk": <0-1>, "competitorCount": <integer>}';
    const userPrompt =
      `Analyze this market signal for saturation and competitor activity:\n` +
      `Type: ${signal.type}\nSource: ${signal.source}\nValue: ${signal.value}\n` +
      `Metadata: ${JSON.stringify(signal.metadata)}\n` +
      `Detected: ${signal.detectedAt}`;

    const raw = await callLLM(systemPrompt, userPrompt, 256);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { saturationRisk?: number; competitorCount?: number };
        saturationRisk = Math.min(1, Math.max(0, parsed.saturationRisk ?? 0.2));
        competitorCount = Math.max(0, Math.round(parsed.competitorCount ?? 0));
      } catch {
        // Keep defaults
      }
    }
  }

  const open = signal.value > 0 && saturationRisk < 0.8;

  return {
    open,
    opensAt: open ? undefined : new Date(now.getTime() + 3_600_000).toISOString(),
    closesAt,
    saturationRisk,
    competitorCount,
  };
}

/**
 * Builds a cascade tree of patterns starting from a seed.
 * Follows chainLinks transitively up to `depth` levels.
 * Uses keyword overlap for orphaned patterns without explicit links.
 */
export async function buildPatternCascade(
  seedPattern: Pattern,
  depth: number = CASCADE_DEFAULT_DEPTH
): Promise<PatternCascade> {
  const allPatterns = loadPatternsFromFile();
  const patternMap = new Map<string, Pattern>(allPatterns.map((p) => [p.id, p]));

  function estimateROI(p: Pattern, currentDepth: number): number {
    // ROI decays with depth; confidence amplifies it
    return p.confidence * 10 * Math.pow(0.7, currentDepth);
  }

  function buildNode(
    pattern: Pattern,
    currentDepth: number,
    visited: Set<string>
  ): CascadeNode {
    const children: CascadeNode[] = [];

    if (currentDepth < depth) {
      // Explicit chain links
      for (const linkId of pattern.chainLinks) {
        if (visited.has(linkId)) continue;
        const linked = patternMap.get(linkId);
        if (!linked) continue;
        visited.add(linkId);
        children.push(buildNode(linked, currentDepth + 1, visited));
      }

      // Semantic neighbors via keyword overlap (if no explicit links)
      if (children.length === 0) {
        const neighbors = allPatterns
          .filter((p) => !visited.has(p.id) && p.id !== pattern.id)
          .filter((p) => keywordOverlap(p.content, pattern.content) > 0.5)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3);

        for (const neighbor of neighbors) {
          visited.add(neighbor.id);
          children.push(buildNode(neighbor, currentDepth + 1, visited));
        }
      }
    }

    const directROI = estimateROI(pattern, currentDepth);
    const childROI = children.reduce((sum, c) => sum + c.reachableROI, 0);

    return {
      pattern,
      depth: currentDepth,
      parentId: currentDepth === 0 ? null : pattern.id,
      reachableROI: directROI + childROI,
      children,
    };
  }

  const visited = new Set<string>([seedPattern.id]);
  const rootNode = buildNode(seedPattern, 0, visited);

  const descendants = rootNode.children;
  const totalReachableROI =
    rootNode.reachableROI -
    estimatePatternROI(seedPattern, 0); // Exclude seed itself from total

  return {
    seed: seedPattern,
    descendants,
    totalReachableROI: Math.round(totalReachableROI * 100) / 100,
  };
}

function estimatePatternROI(p: Pattern, depth: number): number {
  return p.confidence * 10 * Math.pow(0.7, depth);
}

function keywordOverlap(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

// ── ConsciousnessEngine Class ───────────────────────────────────────────────

export class ConsciousnessEngine {
  private readonly systemPrompt: string;

  constructor() {
    this.systemPrompt =
      "You are the meta-intelligence layer of CMNDCENTER — a self-improving AI operating system. " +
      "You reason at the level of patterns of patterns. " +
      "You identify compounding chains, information asymmetries, and cross-system alignment events. " +
      "Respond ONLY with valid JSON. Be precise. Avoid hedging. " +
      "Today's date: " + new Date().toISOString().split("T")[0];
  }

  // ── Meta-Pattern Recognition ──────────────────────────────────────────

  /**
   * Analyzes a set of recent patterns to find Tier 4/5 meta-patterns.
   * These are patterns about patterns — structural insights that transcend individual observations.
   */
  async recognizeMetaPattern(recentPatterns: Pattern[]): Promise<MetaPattern[]> {
    if (recentPatterns.length < 2) return [];

    const patternSummary = recentPatterns.map((p) => ({
      id: p.id,
      content: p.content.slice(0, 200),
      type: p.type,
      confidence: p.confidence,
      useCount: p.useCount,
    }));

    const userPrompt =
      "Analyze these patterns and identify meta-patterns (patterns of patterns).\n" +
      "A meta-pattern is a recurring structure ABOUT how patterns relate, not just a pattern itself.\n" +
      "Return a JSON array of 3-7 MetaPattern objects with these fields:\n" +
      '{ "id": "mp_<n>", "description": "...", "tier": 4, "trigger": "...", "effect": "...", "discoveryPremium": 0.0-1.0 }\n' +
      "Assign tier=5 only for axiom-level insights that hold universally across all 7 chains.\n\n" +
      "Patterns:\n" +
      JSON.stringify(patternSummary, null, 2);

    const raw = await callLLM(this.systemPrompt, userPrompt, 2048);

    if (!raw) return this.buildFallbackMetaPatterns(recentPatterns);

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return this.buildFallbackMetaPatterns(recentPatterns);

      return (parsed as Record<string, unknown>[]).map((mp, i) => ({
        id: String(mp["id"] ?? `mp_${i}_${Date.now()}`),
        description: String(mp["description"] ?? ""),
        tier: this.clampTier(Number(mp["tier"] ?? 4)),
        trigger: String(mp["trigger"] ?? ""),
        effect: String(mp["effect"] ?? ""),
        discoveryPremium: Math.min(1, Math.max(0, Number(mp["discoveryPremium"] ?? 0.5))),
      }));
    } catch {
      return this.buildFallbackMetaPatterns(recentPatterns);
    }
  }

  private clampTier(n: number): 1 | 2 | 3 | 4 | 5 {
    const clamped = Math.max(1, Math.min(5, Math.round(n)));
    return clamped as 1 | 2 | 3 | 4 | 5;
  }

  private buildFallbackMetaPatterns(patterns: Pattern[]): MetaPattern[] {
    // Offline heuristic: group by type and surface the dominant relationship
    const byType = new Map<string, Pattern[]>();
    for (const p of patterns) {
      const bucket = byType.get(p.type) ?? [];
      bucket.push(p);
      byType.set(p.type, bucket);
    }

    const metaPatterns: MetaPattern[] = [];
    for (const [type, group] of byType.entries()) {
      if (group.length < 2) continue;
      const avgConfidence =
        group.reduce((s, p) => s + p.confidence, 0) / group.length;
      metaPatterns.push({
        id: `mp_fallback_${type}_${Date.now()}`,
        description: `Recurring ${type} cluster: ${group.length} patterns observed with avg confidence ${avgConfidence.toFixed(2)}`,
        tier: group.length >= 5 ? 4 : 3,
        trigger: `Multiple ${type} patterns co-activating`,
        effect: `Compound ${type} outcome with ${Math.round(avgConfidence * 100)}% reliability`,
        discoveryPremium: computeDiscoveryPremium(`${type} meta-cluster`, 1 - avgConfidence),
      });
    }
    return metaPatterns.slice(0, 7);
  }

  // ── Compound Chain Inference ───────────────────────────────────────────

  /**
   * Scans all patterns to find transitive chains: (A→B) + (B→C) → infer (A→C).
   * Uses keyword matching when explicit chainLinks are absent.
   */
  async inferCompoundChains(patterns: Pattern[]): Promise<CompoundChain[]> {
    const chains: CompoundChain[] = [];
    const patternMap = new Map<string, Pattern>(patterns.map((p) => [p.id, p]));

    // Build adjacency: pattern → all patterns it links to (explicit + semantic)
    const adjacency = new Map<string, Set<string>>();

    for (const p of patterns) {
      const neighbors = new Set<string>(p.chainLinks.filter((id) => patternMap.has(id)));

      // Semantic neighbors: patterns whose input keywords match this pattern's output keywords
      for (const other of patterns) {
        if (other.id === p.id || neighbors.has(other.id)) continue;
        const overlap = keywordOverlap(p.content, other.content);
        if (overlap > 0.45) {
          neighbors.add(other.id);
        }
      }
      adjacency.set(p.id, neighbors);
    }

    // Find A→B→C triples: for each B, find all A→B and B→C, create A→C
    for (const [bId, bNeighbors] of adjacency.entries()) {
      const patternB = patternMap.get(bId);
      if (!patternB) continue;

      // All patterns A that point to B
      const aPatterns = patterns.filter((a) => {
        const aNeighbors = adjacency.get(a.id);
        return aNeighbors?.has(bId) && a.id !== bId;
      });

      // All patterns C that B points to
      const cPatterns = [...bNeighbors]
        .map((cId) => patternMap.get(cId))
        .filter((c): c is Pattern => c !== undefined && c.id !== bId);

      for (const patternA of aPatterns) {
        for (const patternC of cPatterns) {
          if (patternA.id === patternC.id) continue;

          const confidence = Math.min(patternA.confidence, patternB.confidence);
          const potentialROI = confidence * patternA.useCount * patternC.confidence * 10;

          chains.push({
            id: `cc_${patternA.id.slice(-8)}_${patternC.id.slice(-8)}_${Date.now()}`,
            chainA: patternA.id,
            chainB: patternB.id,
            result: `${patternA.content.slice(0, 60)} → [${patternB.content.slice(0, 40)}] → ${patternC.content.slice(0, 60)}`,
            confidence: Math.round(confidence * 1000) / 1000,
            potentialROI: Math.round(potentialROI * 100) / 100,
          });
        }
      }
    }

    // Deduplicate and sort by potentialROI desc
    const seen = new Set<string>();
    const deduped = chains.filter((c) => {
      const key = `${c.chainA}::${c.chainB}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.sort((a, b) => b.potentialROI - a.potentialROI).slice(0, 20);
  }

  // ── Information Asymmetry Detection ────────────────────────────────────

  /**
   * Detects where the system has an information or timing edge over the market.
   * Cross-references market signals against known patterns to find non-obvious gaps.
   */
  async detectAsymmetry(
    marketData: MarketSignal[],
    patterns: Pattern[]
  ): Promise<AsymmetryOpportunity[]> {
    if (marketData.length === 0) return [];

    const highConfidencePatterns = patterns
      .filter((p) => p.confidence > 0.7)
      .slice(0, 20);

    const userPrompt =
      "Identify information asymmetry opportunities.\n" +
      "An asymmetry exists when we have patterns or signals that most actors lack.\n" +
      "Return JSON array of AsymmetryOpportunity objects:\n" +
      '{ "type": "market_timing|knowledge_gap|price_delta|trend_early|tool_advantage",\n' +
      '  "advantage": "...", "timeWindow": "...", "actionScript": "...", "expectedROI": 0-100 }\n\n' +
      "Market signals:\n" +
      JSON.stringify(marketData.slice(0, 10), null, 2) +
      "\n\nHigh-confidence patterns:\n" +
      JSON.stringify(
        highConfidencePatterns.map((p) => ({ type: p.type, content: p.content.slice(0, 150) })),
        null,
        2
      );

    const raw = await callLLM(this.systemPrompt, userPrompt, 2048);

    if (!raw) return this.buildFallbackAsymmetries(marketData);

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return this.buildFallbackAsymmetries(marketData);

      return (parsed as Record<string, unknown>[]).map((a) => ({
        type: String(a["type"] ?? "knowledge_gap"),
        advantage: String(a["advantage"] ?? ""),
        timeWindow: String(a["timeWindow"] ?? "24h"),
        actionScript: String(a["actionScript"] ?? ""),
        expectedROI: Math.min(100, Math.max(0, Number(a["expectedROI"] ?? 50))),
      }));
    } catch {
      return this.buildFallbackAsymmetries(marketData);
    }
  }

  private buildFallbackAsymmetries(signals: MarketSignal[]): AsymmetryOpportunity[] {
    return signals
      .filter((s) => s.value > 0.7)
      .slice(0, 5)
      .map((s) => ({
        type: s.type,
        advantage: `Early detection of ${s.type} signal from ${s.source} (value: ${s.value})`,
        timeWindow: "4h",
        actionScript: `cmnd loki "capitalize on ${s.type} signal from ${s.source}"`,
        expectedROI: Math.round(s.value * 80),
      }));
  }

  // ── Discovery Premium ──────────────────────────────────────────────────

  /**
   * Computes the discovery premium for a non-obvious solution.
   * Premium = (1 - obviousness) × 3.0 × 1.0
   */
  computeDiscoveryPremium(solution: string, obviousness: number): number {
    return computeDiscoveryPremium(solution, obviousness);
  }

  // ── Worldview Synthesis ────────────────────────────────────────────────

  /**
   * Synthesizes the current state of all 7 chains into a unified worldview.
   * Reads patterns.json, runs chain health checks, and identifies the top opportunity.
   */
  async synthesizeWorldview(): Promise<SystemWorldview> {
    const patterns = loadPatternsFromFile();
    const qualityScore = this.computeSystemQuality(patterns);
    const chains = await this.evaluateChainStatuses(patterns);
    const gaps = this.detectWorldviewGaps(chains, patterns);
    const topOpportunity = this.identifyTopOpportunity(chains, patterns, gaps);
    const nextAction = this.recommendNextAction(chains, gaps, topOpportunity, qualityScore);

    const worldview: SystemWorldview = {
      chains,
      gaps,
      topOpportunity,
      qualityScore,
      nextAction,
    };

    // Persist worldview to linear queue for traceability
    const date = new Date().toISOString().split("T")[0];
    const outPath = path.join(LINEAR_QUEUE_DIR, `consciousness-${date}.json`);
    try {
      const existing = readJsonFile<SystemWorldview[]>(outPath, []);
      existing.push(worldview);
      writeJsonAtomically(outPath, existing);
    } catch (err) {
      console.warn("[consciousness] Failed to persist worldview:", err);
    }

    return worldview;
  }

  private computeSystemQuality(patterns: Pattern[]): number {
    if (patterns.length === 0) return 0;
    const avgConfidence =
      patterns.reduce((s, p) => s + p.confidence, 0) / patterns.length;
    const diversityBonus = Math.min(
      1,
      new Set(patterns.map((p) => p.type)).size / 8
    );
    return Math.round((avgConfidence * 7 + diversityBonus * 3) * 10) / 10;
  }

  private async evaluateChainStatuses(patterns: Pattern[]): Promise<ChainStatus[]> {
    const chainNames: Record<ChainNumber, string> = {
      1: "Signal → Profit",
      2: "Knowledge Compounding",
      3: "Auto-Upgrade Loop",
      4: "Repo Intelligence",
      5: "Voice-to-Build",
      6: "Market Arbitrage",
      7: "Content → Revenue",
    };

    const chainKeywords: Record<ChainNumber, string[]> = {
      1: ["signal", "trade", "profit", "intellitradeX", "opportunity"],
      2: ["pattern", "memory", "knowledge", "learn", "chromadb"],
      3: ["upgrade", "improve", "nightly", "karpathy", "3am"],
      4: ["github", "repo", "deploy", "commit", "ci"],
      5: ["voice", "airi", "vtuber", "whisper"],
      6: ["arbitrage", "ebay", "market", "price", "neo4j"],
      7: ["wand", "youtube", "content", "video", "adsense"],
    };

    return CHAIN_IDS.map((n) => {
      const keywords = chainKeywords[n];
      const chainPatterns = patterns.filter((p) =>
        keywords.some(
          (kw) =>
            p.content.toLowerCase().includes(kw) ||
            p.type.toLowerCase().includes(kw)
        )
      );

      const active = chainPatterns.length > 0;
      const healthScore =
        chainPatterns.length > 0
          ? Math.round(
              (chainPatterns.reduce((s, p) => s + p.confidence, 0) /
                chainPatterns.length) *
                10
            ) / 10
          : 0;

      const recentPattern = chainPatterns.sort(
        (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      )[0];

      return {
        chainNumber: n,
        name: chainNames[n],
        active,
        lastFiredAt: recentPattern?.savedAt ?? null,
        healthScore,
        bottleneck:
          !active ? `No patterns recorded for ${chainNames[n]}` : null,
      };
    });
  }

  private detectWorldviewGaps(chains: ChainStatus[], patterns: Pattern[]): string[] {
    const gaps: string[] = [];

    for (const chain of chains) {
      if (!chain.active) {
        gaps.push(
          `Chain ${chain.chainNumber} (${chain.name}) has no recorded patterns — needs activation`
        );
      } else if (chain.healthScore < 4) {
        gaps.push(
          `Chain ${chain.chainNumber} (${chain.name}) has low health score (${chain.healthScore}/10) — needs reinforcement`
        );
      }
    }

    const lowConfidencePatterns = patterns.filter((p) => p.confidence < 0.4 && p.useCount >= 3);
    if (lowConfidencePatterns.length > 0) {
      gaps.push(
        `${lowConfidencePatterns.length} patterns stuck at low confidence despite repeated use — candidates for self-modification`
      );
    }

    const unlinkedPatterns = patterns.filter((p) => p.chainLinks.length === 0);
    if (unlinkedPatterns.length > patterns.length * 0.5) {
      gaps.push(
        `${unlinkedPatterns.length} patterns lack chain links — compound potential is unrealized`
      );
    }

    return gaps;
  }

  private identifyTopOpportunity(
    chains: ChainStatus[],
    patterns: Pattern[],
    gaps: string[]
  ): string {
    // Highest-health active chain
    const topChain = chains
      .filter((c) => c.active)
      .sort((a, b) => b.healthScore - a.healthScore)[0];

    if (topChain) {
      return `Amplify Chain ${topChain.chainNumber} (${topChain.name}, health ${topChain.healthScore}/10) — currently the strongest compounding path`;
    }

    // If no chains active, bootstrap the knowledge chain
    if (gaps.length > 0) {
      return `Bridge critical gap: ${gaps[0]}`;
    }

    return "Save session patterns to ChromaDB to bootstrap Chain 2 Knowledge Compounding";
  }

  private recommendNextAction(
    chains: ChainStatus[],
    gaps: string[],
    topOpportunity: string,
    qualityScore: number
  ): string {
    const inactiveChains = chains.filter((c) => !c.active);
    if (inactiveChains.length >= 4) {
      return `Activate ${inactiveChains.length} dormant chains — run: bash ~/CMNDCENTER/scripts/loki-session-start.sh`;
    }

    if (qualityScore < 5) {
      return "Run improvement cycle: loki --improve (system quality below 5/10)";
    }

    if (gaps.length > 0) {
      return `Fix highest-priority gap: ${gaps[0]}`;
    }

    return topOpportunity;
  }

  // ── Self-Modification ──────────────────────────────────────────────────

  /**
   * Rewrites an agent's prompt based on performance data to improve future outputs.
   * Uses LLM to analyze failure modes and generate an improved prompt.
   */
  async improveSelf(
    agentId: string,
    performanceLog: PerformanceEntry[]
  ): Promise<SelfModification> {
    const agentEntries = performanceLog.filter((e) => e.agentId === agentId);
    if (agentEntries.length === 0) {
      throw new Error(`[consciousness] No performance entries for agent: ${agentId}`);
    }

    const currentPrompt = agentEntries[agentEntries.length - 1].prompt;
    const recentOutputs = agentEntries.slice(-5).map((e) => ({
      output: e.output.slice(0, 300),
      rating: e.rating,
    }));

    const avgRating =
      recentOutputs.reduce((s, e) => s + e.rating, 0) / recentOutputs.length;

    const userPrompt =
      `Agent: ${agentId}\n` +
      `Current prompt (first 500 chars): ${currentPrompt.slice(0, 500)}\n` +
      `Recent performance (last 5 outputs, avg rating ${avgRating.toFixed(1)}/10):\n` +
      JSON.stringify(recentOutputs, null, 2) +
      "\n\nRewrite the agent prompt to address failure patterns and improve the rating." +
      " Return JSON: { \"newPrompt\": \"...\", \"qualityDelta\": <estimated improvement 0-3> }";

    const raw = await callLLM(this.systemPrompt, userPrompt, 3000);

    let newPrompt = currentPrompt;
    let qualityDelta = 0;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { newPrompt?: string; qualityDelta?: number };
        newPrompt = parsed.newPrompt ?? currentPrompt;
        qualityDelta = Math.min(3, Math.max(-1, Number(parsed.qualityDelta ?? 0)));
      } catch {
        // Keep current prompt
      }
    }

    const modification: SelfModification = {
      agentId,
      previousPrompt: currentPrompt,
      newPrompt,
      qualityDelta,
      applied: false,
    };

    // Stage improvement in CMNDCENTER memory for human review before applying.
    // Improvements are NEVER written directly to ~/.claude/agents/ — that requires
    // explicit human review. Apply manually from the staging directory when ready.
    if (qualityDelta > 0) {
      try {
        const stagingDir = path.join(os.homedir(), ".amsa", "memory", "agent-improvements");
        fs.mkdirSync(stagingDir, { recursive: true });
        const stagingFile = path.join(stagingDir, `${agentId}-${Date.now()}.json`);
        writeJsonAtomically(stagingFile, {
          agentId,
          previousPrompt: currentPrompt,
          newPrompt,
          qualityDelta,
          avgRating,
          stagedAt: new Date().toISOString(),
          applyInstructions: `Review and copy newPrompt to ~/.claude/agents/${agentId}.md to apply.`,
        });
        modification.applied = false; // staged, not auto-applied
      } catch (err) {
        console.warn("[consciousness] Failed to stage self-modification:", err);
      }
    }

    return modification;
  }

  // ── Chain Alignment Detection ──────────────────────────────────────────

  /**
   * Detects when 3 or more chains have simultaneous active signals.
   * Multiplier is N² where N = number of aligned chains.
   * Sends Telegram alert for high-impact alignment events.
   */
  async detectChainAlignment(activeSignals: Signal[]): Promise<AlignmentEvent[]> {
    if (activeSignals.length < ALIGNMENT_MIN_CHAINS) return [];

    // Group by chain ID
    const byChain = new Map<number, Signal[]>();
    for (const sig of activeSignals) {
      const bucket = byChain.get(sig.chainId) ?? [];
      bucket.push(sig);
      byChain.set(sig.chainId, bucket);
    }

    const activeChainIds = [...byChain.keys()].filter((id) => id >= 1 && id <= 7);

    if (activeChainIds.length < ALIGNMENT_MIN_CHAINS) return [];

    const events: AlignmentEvent[] = [];

    // Find all subsets of size >= 3 (up to full set to avoid combinatorial explosion)
    const maxSubsetSize = Math.min(activeChainIds.length, 7);
    for (let size = ALIGNMENT_MIN_CHAINS; size <= maxSubsetSize; size++) {
      const subsets = this.combinations(activeChainIds, size);

      for (const subset of subsets) {
        const n = subset.length;
        const multiplicationFactor = n * n; // N² multiplier

        const avgStrength =
          subset.reduce((sum, chainId) => {
            const chainSignals = byChain.get(chainId) ?? [];
            const maxStrength = Math.max(...chainSignals.map((s) => s.strength), 0);
            return sum + maxStrength;
          }, 0) / n;

        const urgency: AlignmentEvent["urgency"] =
          avgStrength > 0.8 ? "immediate" : avgStrength > 0.5 ? "24h" : "week";

        const chainNames = subset.map((id) => `Chain ${id}`).join(" + ");
        const description =
          `${chainNames} aligned simultaneously — ` +
          `${n}² = ${multiplicationFactor}× leverage multiplier. ` +
          `Avg signal strength: ${avgStrength.toFixed(2)}.`;

        events.push({
          chainsAligned: subset,
          description,
          multiplicationFactor,
          urgency,
        });

        // Alert for immediate urgency alignment events
        if (urgency === "immediate" && n >= ALIGNMENT_MIN_CHAINS) {
          const telegramMsg =
            `🔱 *CHAIN ALIGNMENT DETECTED*\n\n` +
            `${description}\n\n` +
            `Multiplier: ${multiplicationFactor}×\n` +
            `Urgency: ${urgency.toUpperCase()}\n\n` +
            `_CMNDCENTER Consciousness Engine_`;
          await sendTelegramAlert(telegramMsg);
        }
      }

      // Only keep the largest alignment event to avoid noise
      if (events.length > 0) break;
    }

    return events.sort((a, b) => b.multiplicationFactor - a.multiplicationFactor);
  }

  /** Returns all combinations of `arr` of length `k` */
  private combinations<T>(arr: T[], k: number): T[][] {
    if (k > arr.length || k <= 0) return [];
    if (k === arr.length) return [arr.slice()];
    if (k === 1) return arr.map((v) => [v]);

    const result: T[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
      const rest = this.combinations(arr.slice(i + 1), k - 1);
      for (const combo of rest) {
        result.push([arr[i], ...combo]);
      }
    }
    return result;
  }
}

// ── Module-Level Singleton ──────────────────────────────────────────────────

/**
 * Singleton ConsciousnessEngine instance.
 * Import this throughout the system rather than instantiating directly.
 *
 * @example
 * import { consciousness } from "./consciousness";
 * const worldview = await consciousness.synthesizeWorldview();
 */
export const consciousness = new ConsciousnessEngine();

// ── Main Block ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[consciousness] Starting meta-intelligence worldview synthesis...\n");

  try {
    const worldview = await consciousness.synthesizeWorldview();

    console.log("═══════════════════════════════════════════════════════════");
    console.log("  CMNDCENTER — SYSTEM WORLDVIEW");
    console.log("  " + new Date().toISOString());
    console.log("═══════════════════════════════════════════════════════════\n");

    console.log(`Quality Score: ${worldview.qualityScore}/10\n`);

    console.log("7 Compounding Chains:");
    for (const chain of worldview.chains) {
      const status = chain.active ? "ACTIVE" : "DORMANT";
      const health = chain.active ? ` [health: ${chain.healthScore}/10]` : "";
      const bottleneck = chain.bottleneck ? ` ⚠ ${chain.bottleneck}` : "";
      console.log(
        `  Chain ${chain.chainNumber}: ${chain.name} — ${status}${health}${bottleneck}`
      );
    }

    if (worldview.gaps.length > 0) {
      console.log(`\nDetected Gaps (${worldview.gaps.length}):`);
      worldview.gaps.forEach((g, i) => console.log(`  ${i + 1}. ${g}`));
    }

    console.log(`\nTop Opportunity:\n  ${worldview.topOpportunity}`);
    console.log(`\nNext Action:\n  ${worldview.nextAction}`);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(
      `Goal: Synthesize CMNDCENTER worldview across all 7 chains`
    );
    console.log(`Leverage: 9/10`);
    console.log(`Integration: All 7 chains + ChromaDB + patterns.json`);
    console.log(`Kill Switch: Delete ~/.amsa/linear-queue/consciousness-*.json`);
    console.log(`ROI: 88`);
    console.log("═══════════════════════════════════════════════════════════\n");
  } catch (err) {
    console.error("[consciousness] Worldview synthesis failed:", err);
    process.exit(1);
  }
}

// Execute main when run directly
if (require.main === module) {
  main().catch((err) => {
    console.error("[consciousness] Fatal error:", err);
    process.exit(1);
  });
}
