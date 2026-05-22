/**
 * system/roi-brain.ts
 * ROI-First Decision Engine — Claude Architect OS v4.0
 *
 * Every decision is scored on: (leverage × speed × compound) / (effort × risk)
 * Only proceed with score >= 40. Score >= 80 gets immediate full resources.
 *
 * Writes high-ROI opportunities to ~/.amsa/linear-queue/roi-queue.json
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Constants ──────────────────────────────────────────────────────────────

const AMSA_LINEAR_QUEUE = path.join(os.homedir(), ".amsa", "linear-queue");
const ROI_QUEUE_PATH = path.join(AMSA_LINEAR_QUEUE, "roi-queue.json");
const ROI_THRESHOLD_IMMEDIATE = 80;
const ROI_THRESHOLD_STANDARD = 60;
const ROI_THRESHOLD_LOW = 40;

// The 7 chain IDs — every recommendation maps to one or more
export type ChainId =
  | "chain-1-signal-profit"
  | "chain-2-knowledge-compound"
  | "chain-3-auto-upgrade"
  | "chain-4-repo-intelligence"
  | "chain-5-voice-build"
  | "chain-6-market-arbitrage"
  | "chain-7-content-revenue";

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface ROIInput {
  /** Unique identifier for the task */
  id?: string;
  /** Human-readable task description */
  task: string;
  /** Additional context (code snippet, signal data, system state, etc.) */
  context?: string;
  /** How time-sensitive is this? 1=low, 2=medium, 3=high, 4=critical */
  urgency: 1 | 2 | 3 | 4;
  /**
   * Estimated hours to complete (used for effort normalization).
   * Be honest — underestimating inflates the score misleadingly.
   */
  estimatedHours: number;
  /** Which CMNDCENTER systems does this task affect? */
  systemsAffected: string[];
  /**
   * Optional override factors. If provided, these override the auto-computed values.
   * Use sparingly — let the engine compute factors from systemsAffected + context.
   */
  factorOverrides?: Partial<ROIFactors>;
}

export interface ROIFactors {
  /**
   * How many systems does this touch or improve? (1-10)
   * 1 = isolated change, 10 = touches everything
   */
  leverage: number;
  /**
   * How fast does it produce useful output? (1-5)
   * 1 = takes days, 2 = hours, 3 = 30min, 4 = 5min, 5 = instant/automated
   */
  speedMultiplier: number;
  /**
   * Does this improve future capability? (1-3)
   * 1 = one-time result, 2 = reusable artifact, 3 = self-improving system
   */
  compoundFactor: number;
  /**
   * Normalized effort (raw estimatedHours / 10, clamped to [0.1, 10])
   */
  effort: number;
  /**
   * Reversibility of this action. (1-5)
   * 1 = fully reversible (git revert), 5 = destructive/irreversible (delete prod data)
   */
  risk: number;
}

export interface ROIOutput {
  /** Computed score 0-100. Scores above 100 are clamped to 100. */
  score: number;
  /** Priority tier based on score */
  tier: "immediate" | "standard" | "low" | "decline";
  /** One-sentence recommendation */
  recommendation: string;
  /** The single highest-leverage action to take first */
  topLeveragePoint: string;
  /** Other tasks in the queue that this makes obsolete */
  deprecates: string[];
  /** Ordered steps to integrate this output into CMNDCENTER */
  integrationSteps: string[];
  /** How to safely undo this action */
  killSwitch: string;
  /** Which of the 7 chains does this task feed into? */
  chainTriggers: ChainId[];
  /** The factors used to compute the score */
  factors: ROIFactors;
  /** Original input for traceability */
  input: ROIInput;
  /** ISO timestamp of when this was scored */
  scoredAt: string;
}

export interface ROIQueueEntry {
  id: string;
  task: string;
  score: number;
  tier: string;
  chainTriggers: ChainId[];
  recommendation: string;
  topLeveragePoint: string;
  integrationSteps: string[];
  killSwitch: string;
  queuedAt: string;
}

// ── Factor Computation ─────────────────────────────────────────────────────

/**
 * Determines leverage based on how many known CMNDCENTER systems are affected.
 * More cross-system impact = higher leverage.
 */
function computeLeverage(systemsAffected: string[], task: string): number {
  // Well-known systems and their weights
  const SYSTEM_WEIGHTS: Record<string, number> = {
    "chromadb": 1.5,     // Affects all memory-dependent features
    "litellm": 1.8,      // Affects all LLM calls
    "patterns.json": 1.6,// Affects self-improvement loop
    "n8n": 1.2,
    "supabase": 1.0,
    "loki": 1.4,
    "amsa": 1.3,
    "chains": 2.0,       // Touching chains directly is high leverage
    "intellitradeX": 1.0,
    "wand": 1.0,
    "ollama": 1.0,
    "llamaindex": 1.2,
    "graphrag": 1.2,
    "neo4j": 1.0,
    "trigger-dev": 1.1,
    "aider": 0.8,
    "mem0": 1.0,
    "obsidian": 0.7,
    "anythingllm": 0.8,
  };

  let totalWeight = 0;
  const taskLower = task.toLowerCase();

  for (const system of systemsAffected) {
    const sysLower = system.toLowerCase();
    // Check if any known system key is a substring of the affected system name
    for (const [key, weight] of Object.entries(SYSTEM_WEIGHTS)) {
      if (sysLower.includes(key) || taskLower.includes(key)) {
        totalWeight += weight;
        break;
      }
    }
    // Fallback: each unlisted system adds 0.5
    totalWeight += 0.5;
  }

  // Normalize to 1-10 range (cap at 10)
  const raw = Math.min(totalWeight, 10);
  return Math.max(1, Math.round(raw));
}

/**
 * Determines speed multiplier based on urgency and task characteristics.
 */
function computeSpeedMultiplier(urgency: number, estimatedHours: number, task: string): number {
  const taskLower = task.toLowerCase();

  // Auto-executing tasks (cron, watcher, etc.) get highest speed
  if (
    taskLower.includes("automat") ||
    taskLower.includes("cron") ||
    taskLower.includes("trigger") ||
    taskLower.includes("webhook")
  ) {
    return 5;
  }

  // Script/CLI tasks that run instantly
  if (
    taskLower.includes("script") ||
    taskLower.includes("bash") ||
    taskLower.includes("shell") ||
    estimatedHours < 0.1
  ) {
    return 4;
  }

  // Urgency 4 = critical, boost speed rating
  if (urgency === 4) return Math.min(5, urgency + 1);

  // Map estimated hours to speed: faster = higher score
  if (estimatedHours <= 0.5) return 4;
  if (estimatedHours <= 2) return 3;
  if (estimatedHours <= 8) return 2;
  return 1;
}

/**
 * Determines compound factor based on task nature.
 * Self-improving systems score highest.
 */
function computeCompoundFactor(task: string, systemsAffected: string[]): number {
  const allText = (task + " " + systemsAffected.join(" ")).toLowerCase();

  // Self-improving patterns
  if (
    allText.includes("pattern") ||
    allText.includes("memory") ||
    allText.includes("learning") ||
    allText.includes("improve") ||
    allText.includes("upgrade") ||
    allText.includes("self") ||
    allText.includes("karpathy") ||
    allText.includes("compound")
  ) {
    return 3;
  }

  // Reusable artifacts (templates, configs, integrations)
  if (
    allText.includes("template") ||
    allText.includes("config") ||
    allText.includes("integration") ||
    allText.includes("library") ||
    allText.includes("utility") ||
    allText.includes("framework")
  ) {
    return 2;
  }

  // One-time output
  return 1;
}

/**
 * Determines risk based on action type and reversibility.
 */
function computeRisk(task: string, context?: string): number {
  const allText = (task + " " + (context ?? "")).toLowerCase();

  // Irreversible destructive actions
  if (
    allText.includes("delete") ||
    allText.includes("drop table") ||
    allText.includes("truncate") ||
    allText.includes("production") ||
    allText.includes("force push") ||
    allText.includes("rm -rf")
  ) {
    return 5;
  }

  // Significant risk (external API calls with side effects, trades)
  if (
    allText.includes("trade") ||
    allText.includes("execute order") ||
    allText.includes("payment") ||
    allText.includes("billing") ||
    allText.includes("deploy to production")
  ) {
    return 4;
  }

  // Moderate risk (modifying live config, DB migrations)
  if (
    allText.includes("migration") ||
    allText.includes("schema change") ||
    allText.includes("live config") ||
    allText.includes("environment variable")
  ) {
    return 3;
  }

  // Low risk (code changes, new files, new routes)
  if (
    allText.includes("create") ||
    allText.includes("add") ||
    allText.includes("implement") ||
    allText.includes("build")
  ) {
    return 2;
  }

  // Default: reversible
  return 1;
}

// ── Chain Trigger Mapping ──────────────────────────────────────────────────

/**
 * Determines which of the 7 chains this task feeds into.
 */
function detectChainTriggers(input: ROIInput): ChainId[] {
  const allText = (input.task + " " + (input.context ?? "") + " " + input.systemsAffected.join(" ")).toLowerCase();
  const chains: ChainId[] = [];

  if (
    allText.includes("signal") ||
    allText.includes("trade") ||
    allText.includes("intellitradeX") ||
    allText.includes("profit") ||
    allText.includes("opportunity") ||
    allText.includes("scout")
  ) {
    chains.push("chain-1-signal-profit");
  }

  if (
    allText.includes("pattern") ||
    allText.includes("memory") ||
    allText.includes("chromadb") ||
    allText.includes("llamaindex") ||
    allText.includes("knowledge") ||
    allText.includes("learn")
  ) {
    chains.push("chain-2-knowledge-compound");
  }

  if (
    allText.includes("upgrade") ||
    allText.includes("improve") ||
    allText.includes("launchagent") ||
    allText.includes("nightly") ||
    allText.includes("3am") ||
    allText.includes("karpathy")
  ) {
    chains.push("chain-3-auto-upgrade");
  }

  if (
    allText.includes("git push") ||
    allText.includes("github") ||
    allText.includes("ci") ||
    allText.includes("repo") ||
    allText.includes("commit") ||
    allText.includes("deploy")
  ) {
    chains.push("chain-4-repo-intelligence");
  }

  if (
    allText.includes("voice") ||
    allText.includes("airi") ||
    allText.includes("vtuber") ||
    allText.includes("whisper") ||
    allText.includes("speak")
  ) {
    chains.push("chain-5-voice-build");
  }

  if (
    allText.includes("arbitrage") ||
    allText.includes("ebay") ||
    allText.includes("amazon") ||
    allText.includes("market") ||
    allText.includes("neo4j") ||
    allText.includes("price delta")
  ) {
    chains.push("chain-6-market-arbitrage");
  }

  if (
    allText.includes("wand") ||
    allText.includes("youtube") ||
    allText.includes("content") ||
    allText.includes("video") ||
    allText.includes("adsense") ||
    allText.includes("trending")
  ) {
    chains.push("chain-7-content-revenue");
  }

  // If we cannot map to a specific chain, default to knowledge compounding
  // (because any task produces learnable patterns)
  if (chains.length === 0) {
    chains.push("chain-2-knowledge-compound");
  }

  return chains;
}

// ── Integration Steps Generator ────────────────────────────────────────────

/**
 * Generates integration steps based on chains triggered and systems affected.
 */
function generateIntegrationSteps(output: Omit<ROIOutput, "integrationSteps" | "deprecates" | "recommendation" | "killSwitch">): string[] {
  const steps: string[] = [];
  const chains = output.chainTriggers;
  const systems = output.input.systemsAffected.map((s) => s.toLowerCase());

  steps.push(`Execute task: "${output.input.task}"`);

  if (output.factors.compoundFactor >= 2) {
    steps.push("Save resulting patterns to ~/.amsa/memory/patterns.json via patternEngine.savePattern()");
    steps.push("Upsert patterns to ChromaDB at localhost:8000 for semantic retrieval");
  }

  if (chains.includes("chain-1-signal-profit") || chains.includes("chain-6-market-arbitrage")) {
    steps.push("Log opportunity to ~/.amsa/linear-queue/opportunities-<date>.json");
    steps.push("Send Telegram alert with signal details");
  }

  if (chains.includes("chain-4-repo-intelligence") || systems.some((s) => s.includes("github"))) {
    steps.push("Trigger n8n repo-monitor webhook after git push");
    steps.push("Index new code via LlamaIndex for future RAG queries");
  }

  if (chains.includes("chain-7-content-revenue")) {
    steps.push("Log content output to Supabase wand_videos table");
    steps.push("After 48h: check views/CTR → extract winning formula to patterns.json");
  }

  if (chains.includes("chain-3-auto-upgrade")) {
    steps.push("Verify upgrade-log.json updated in ~/.amsa/memory/");
    steps.push("Confirm Telegram upgrade notification was sent");
  }

  if (output.score >= ROI_THRESHOLD_IMMEDIATE) {
    steps.push("Write to roi-queue.json as high-priority item for immediate execution");
  }

  steps.push("Run gap-bridge.ts detectGaps() on all affected systems post-execution");

  return steps;
}

/**
 * Generates a kill switch description based on the task and risk level.
 */
function generateKillSwitch(input: ROIInput, risk: number): string {
  const taskLower = input.task.toLowerCase();

  if (taskLower.includes("trade") || taskLower.includes("intellitradeX")) {
    return "touch ~/CMNDCENTER/intellitradeX/.HALT — halts all trade execution immediately";
  }

  if (taskLower.includes("deploy") || taskLower.includes("github")) {
    return "git revert HEAD on the deployed repo; re-run deploy-to-github to push the revert";
  }

  if (taskLower.includes("n8n") || taskLower.includes("workflow") || taskLower.includes("automation")) {
    return "Disable the n8n workflow at localhost:5678 → toggle Active off";
  }

  if (taskLower.includes("launchagent") || taskLower.includes("cron")) {
    return "launchctl unload ~/Library/LaunchAgents/<plist-name>.plist";
  }

  if (taskLower.includes("database") || taskLower.includes("migration") || taskLower.includes("schema")) {
    return "Run the down migration: supabase db reset (dev) or apply rollback migration (prod)";
  }

  if (risk <= 2) {
    return "Delete the created file/function and restore from git: git checkout HEAD -- <file>";
  }

  if (risk === 3) {
    return "Restore previous config from git and restart the affected service";
  }

  return "git reset --hard HEAD~1 on the affected repository; restore service from last known-good state";
}

// ── Core Scoring Function ──────────────────────────────────────────────────

/**
 * Scores a task using the ROI formula:
 * ROI = (leverage × speedMultiplier × compoundFactor) / (effort × risk) × 10
 *
 * The × 10 normalizes the result toward a 0-100 scale given typical factor ranges.
 */
export function scoreROI(input: ROIInput): ROIOutput {
  const taskId = input.id ?? `roi_${Date.now()}`;

  // Compute factors (apply overrides if provided)
  const leverage = input.factorOverrides?.leverage ??
    computeLeverage(input.systemsAffected, input.task);

  const speedMultiplier = input.factorOverrides?.speedMultiplier ??
    computeSpeedMultiplier(input.urgency, input.estimatedHours, input.task);

  const compoundFactor = input.factorOverrides?.compoundFactor ??
    computeCompoundFactor(input.task, input.systemsAffected);

  const effort = input.factorOverrides?.effort ??
    Math.max(0.1, Math.min(10, input.estimatedHours / 10));

  const risk = input.factorOverrides?.risk ??
    computeRisk(input.task, input.context);

  const factors: ROIFactors = {
    leverage,
    speedMultiplier,
    compoundFactor,
    effort,
    risk,
  };

  // Core formula: (L × S × C) / (E × R) × 10 → normalized to 0-100
  const rawScore = (leverage * speedMultiplier * compoundFactor) / (effort * risk) * 10;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const tier: ROIOutput["tier"] =
    score >= ROI_THRESHOLD_IMMEDIATE ? "immediate" :
    score >= ROI_THRESHOLD_STANDARD  ? "standard"  :
    score >= ROI_THRESHOLD_LOW       ? "low"        :
    "decline";

  const chainTriggers = detectChainTriggers(input);

  const topLeveragePoint = generateTopLeveragePoint(input, factors, chainTriggers);

  const partialOutput = {
    score,
    tier,
    topLeveragePoint,
    chainTriggers,
    factors,
    input: { ...input, id: taskId },
    scoredAt: new Date().toISOString(),
  };

  const integrationSteps = generateIntegrationSteps(partialOutput);
  const killSwitch = generateKillSwitch(input, risk);
  const recommendation = generateRecommendation(score, tier, input, factors, chainTriggers);

  const output: ROIOutput = {
    ...partialOutput,
    recommendation,
    deprecates: [],  // Populated by rankTasks() when comparing against a queue
    integrationSteps,
    killSwitch,
  };

  // Persist high-ROI items to the queue automatically
  if (score >= ROI_THRESHOLD_STANDARD) {
    persistToQueue(output);
  }

  return output;
}

/**
 * Generates the single top-leverage action description.
 */
function generateTopLeveragePoint(
  input: ROIInput,
  factors: ROIFactors,
  chains: ChainId[]
): string {
  // The highest-weight chain determines the leverage point framing
  if (factors.compoundFactor === 3) {
    return `Extract and save resulting patterns to patterns.json — this feeds the self-improvement loop (Chain 3) and every future session`;
  }

  if (chains.includes("chain-1-signal-profit") || chains.includes("chain-6-market-arbitrage")) {
    return `Route signal through IntelliTradeX or Loki Mode immediately — highest time-value decay`;
  }

  if (chains.includes("chain-4-repo-intelligence") && factors.leverage >= 7) {
    return `Commit and push — triggers the full Repo Intelligence Loop: audit → fix → index → changelog`;
  }

  if (chains.includes("chain-7-content-revenue")) {
    return `Generate content now while trend is hot — 72h window for maximum CTR on YouTube`;
  }

  if (factors.leverage >= 8) {
    return `Start with the highest-leverage system: ${input.systemsAffected[0] ?? "primary system"} — improvements here cascade to all others`;
  }

  return `Complete the core implementation first; connect to ${chains[0]?.replace("chain-", "Chain ")} before moving to next task`;
}

/**
 * Generates the recommendation string.
 */
function generateRecommendation(
  score: number,
  tier: ROIOutput["tier"],
  input: ROIInput,
  factors: ROIFactors,
  chains: ChainId[]
): string {
  const chainLabels = chains.slice(0, 2).map((c) =>
    c.replace("chain-", "Chain ").replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  ).join(" + ");

  if (tier === "immediate") {
    return `EXECUTE NOW (score ${score}/100): "${input.task}" — feeds ${chainLabels}. Leverage=${factors.leverage}/10, Compound=${factors.compoundFactor}/3.`;
  }

  if (tier === "standard") {
    return `Execute with standard allocation (score ${score}/100): "${input.task}" — feeds ${chainLabels}.`;
  }

  if (tier === "low") {
    return `Low priority (score ${score}/100): execute only if no higher-score items in queue. Consider: ${generateHigherLeverageAlternative(input)}.`;
  }

  return `DECLINE (score ${score}/100): "${input.task}" has insufficient leverage. Suggested alternative: ${generateHigherLeverageAlternative(input)}.`;
}

/**
 * Suggests a higher-leverage alternative for low/decline scores.
 */
function generateHigherLeverageAlternative(input: ROIInput): string {
  const taskLower = input.task.toLowerCase();

  if (taskLower.includes("document") || taskLower.includes("readme")) {
    return "Auto-generate docs via technical-writer agent — same output, 10x less effort";
  }

  if (taskLower.includes("manual") || taskLower.includes("click") || taskLower.includes("copy-paste")) {
    return "Automate this via n8n workflow or Trigger.dev job — turns 1-time effort into recurring value";
  }

  if (taskLower.includes("check") || taskLower.includes("monitor")) {
    return "Wire a gap-bridge.ts health check — runs automatically every session";
  }

  return "Evaluate if this can feed into an existing chain rather than operating as a standalone task";
}

// ── Queue Persistence ──────────────────────────────────────────────────────

/**
 * Persists a high-ROI output to the linear queue file.
 * Creates the directory and file if they do not exist.
 */
function persistToQueue(output: ROIOutput): void {
  try {
    fs.mkdirSync(AMSA_LINEAR_QUEUE, { recursive: true });

    let queue: ROIQueueEntry[] = [];
    if (fs.existsSync(ROI_QUEUE_PATH)) {
      try {
        queue = JSON.parse(fs.readFileSync(ROI_QUEUE_PATH, "utf-8")) as ROIQueueEntry[];
      } catch {
        // Corrupted file — start fresh
        queue = [];
      }
    }

    const entry: ROIQueueEntry = {
      id: output.input.id ?? `roi_${Date.now()}`,
      task: output.input.task,
      score: output.score,
      tier: output.tier,
      chainTriggers: output.chainTriggers,
      recommendation: output.recommendation,
      topLeveragePoint: output.topLeveragePoint,
      integrationSteps: output.integrationSteps,
      killSwitch: output.killSwitch,
      queuedAt: new Date().toISOString(),
    };

    // Avoid duplicate entries by ID
    const exists = queue.findIndex((e) => e.id === entry.id);
    if (exists >= 0) {
      queue[exists] = entry;
    } else {
      queue.push(entry);
    }

    // Keep queue sorted by score desc, cap at 200 entries
    queue.sort((a, b) => b.score - a.score);
    if (queue.length > 200) {
      queue = queue.slice(0, 200);
    }

    fs.writeFileSync(ROI_QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
  } catch (err) {
    // Non-fatal — queue write failure should not block task execution
    console.error("[roi-brain] Failed to persist to queue:", err);
  }
}

// ── Batch Ranking ──────────────────────────────────────────────────────────

/**
 * Scores and ranks multiple tasks by ROI, highest first.
 * Also marks lower-priority tasks that are made obsolete by higher-priority ones.
 *
 * @param tasks  Array of ROI inputs to evaluate
 * @returns      ROI outputs sorted by score descending, with deprecates[] populated
 */
export function rankTasks(tasks: ROIInput[]): ROIOutput[] {
  const scored = tasks.map(scoreROI);
  scored.sort((a, b) => b.score - a.score);

  // Mark deprecations: if two tasks touch the same systems and have similar descriptions,
  // the lower-scored one is deprecated by the higher-scored one.
  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const high = scored[i];
      const low = scored[j];

      const highSystems = new Set(high.input.systemsAffected.map((s) => s.toLowerCase()));
      const lowSystems = low.input.systemsAffected.map((s) => s.toLowerCase());
      const sharedSystems = lowSystems.filter((s) => highSystems.has(s));

      // If >= 50% of systems overlap and high score is significantly better
      const overlapRatio = sharedSystems.length / Math.max(1, lowSystems.length);
      if (overlapRatio >= 0.5 && high.score - low.score >= 30) {
        if (!high.deprecates.includes(low.input.id ?? low.input.task)) {
          high.deprecates.push(low.input.id ?? low.input.task);
        }
      }
    }
  }

  return scored;
}

// ── Gap Bridge Integration ─────────────────────────────────────────────────

/**
 * Generates ROI-scored task inputs from a list of detected capability gaps.
 * The output feeds directly into rankTasks() for prioritized gap resolution.
 *
 * @param currentCapabilities  List of things the system can currently do
 * @param idealCapabilities    List of things the system should be able to do
 * @returns                    Array of ROI inputs representing gap-bridge tasks
 */
export function bridgeGaps(
  currentCapabilities: string[],
  idealCapabilities: string[]
): ROIInput[] {
  const currentSet = new Set(currentCapabilities.map((c) => c.toLowerCase().trim()));
  const gaps: ROIInput[] = [];

  for (const ideal of idealCapabilities) {
    const idealLower = ideal.toLowerCase().trim();

    // Check if this capability already exists
    const covered = [...currentSet].some(
      (c) => c.includes(idealLower) || idealLower.includes(c)
    );

    if (!covered) {
      // Infer systems affected from the capability description
      const systemsAffected = inferSystemsFromCapability(idealLower);

      gaps.push({
        id: `gap_${idealLower.replace(/\s+/g, "_").slice(0, 40)}_${Date.now()}`,
        task: `Bridge gap: implement "${ideal}"`,
        context: `Currently missing from system. Current capabilities include: ${currentCapabilities.slice(0, 5).join(", ")}`,
        urgency: inferUrgencyFromCapability(idealLower),
        estimatedHours: inferHoursFromCapability(idealLower),
        systemsAffected,
      });
    }
  }

  return gaps;
}

/**
 * Infers which systems a capability description touches.
 */
function inferSystemsFromCapability(capability: string): string[] {
  const systems: string[] = [];
  const SYSTEM_KEYWORDS: Record<string, string> = {
    "memory": "ChromaDB",
    "pattern": "patterns.json",
    "trade": "IntelliTradeX",
    "content": "WAND",
    "voice": "Open-LLM-VTuber",
    "search": "ChromaDB",
    "embed": "ChromaDB",
    "workflow": "n8n",
    "schedule": "Trigger.dev",
    "deploy": "GitHub",
    "model": "LiteLLM",
    "graph": "Neo4j",
    "rag": "LlamaIndex",
    "upgrade": "upgrade.sh",
    "agent": "Loki Mode",
    "index": "LlamaIndex",
    "data": "Supabase",
  };

  for (const [keyword, system] of Object.entries(SYSTEM_KEYWORDS)) {
    if (capability.includes(keyword)) {
      systems.push(system);
    }
  }

  return systems.length > 0 ? systems : ["claude-architect-os"];
}

/**
 * Infers urgency from capability description keywords.
 */
function inferUrgencyFromCapability(capability: string): 1 | 2 | 3 | 4 {
  if (
    capability.includes("security") ||
    capability.includes("down") ||
    capability.includes("broken") ||
    capability.includes("critical")
  ) return 4;

  if (
    capability.includes("revenue") ||
    capability.includes("trade") ||
    capability.includes("opportunity")
  ) return 3;

  if (capability.includes("improve") || capability.includes("upgrade")) return 2;

  return 1;
}

/**
 * Infers estimated hours from capability complexity.
 */
function inferHoursFromCapability(capability: string): number {
  if (capability.includes("integrate") || capability.includes("pipeline")) return 4;
  if (capability.includes("design") || capability.includes("architect")) return 3;
  if (capability.includes("config") || capability.includes("wire")) return 1;
  if (capability.includes("fix") || capability.includes("patch")) return 0.5;
  return 2;
}

// ── Exports ────────────────────────────────────────────────────────────────

export {
  ROI_THRESHOLD_IMMEDIATE,
  ROI_THRESHOLD_STANDARD,
  ROI_THRESHOLD_LOW,
  ROI_QUEUE_PATH,
  AMSA_LINEAR_QUEUE,
};
