/**
 * automations/pipelines/self-development.ts
 * Self-Development & Pattern Cascade Engine — Claude Architect OS v4.0
 *
 * Runs nightly at 2:55 AM (5 min before upgrade.sh).
 * Reads patterns from ~/.amsa/memory/patterns.json.
 * Applies compound inference: (A→B) + (B→C) = (A→C).
 * Generates agent prompt improvements using claude-opus-4-7.
 * Identifies capability gaps and generates new agent designs.
 * Sends top 3 improvements to Desktop Avatar (TTS).
 * Saves report to ~/.amsa/memory/self-dev-report-YYYY-MM-DD.json.
 *
 * Env: ANTHROPIC_API_KEY, OPEN_LLM_VTUBER_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { DesktopAvatarAgent } from "../../agents/desktop-avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pattern {
  timestamp: string;
  type: string;
  task: string;
  result_preview: string;
  metadata?: Record<string, unknown>;
}

interface CompoundPattern {
  chain: [string, string, string]; // A, B, C nodes
  inference: string;               // "A→C" derived rule
  confidence: number;
  supportingPatterns: number;      // count of patterns supporting this inference
  actionSuggestion: string;        // what to do with this compound insight
}

interface AgentImprovement {
  agentId: string;
  currentPromptSummary: string;
  proposedChange: string;
  rationale: string;
  expectedImpact: string;
  priority: "high" | "medium" | "low";
  patternsSupporting: string[];
}

interface CapabilityGap {
  gapId: string;
  description: string;
  evidencePatterns: string[];
  proposedSolution: string;     // agent or pipeline design
  buildComplexity: "low" | "medium" | "high";
  estimatedImpact: string;
  priorityScore: number;
}

export interface SelfDevReport {
  date: string;
  generatedAt: string;
  patternsAnalyzed: number;
  patternFound: CompoundPattern[];
  improvements: AgentImprovement[];
  newCapabilities: CapabilityGap[];
  qualityScore: number;           // 0-1 overall quality of this cycle
  nextCycleGoal: string;
  appliedAt?: string;             // set when improvements are actually applied
  agentsUpdated?: string[];
}

interface AgentRegistry {
  agents: Array<{
    id: string;
    name: string;
    system_prompt_path?: string;
    description?: string;
    default_model?: string;
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const PATTERNS_PATH = path.join(MEMORY_DIR, "patterns.json");
const AGENTS_REGISTRY_PATH = path.join(
  os.homedir(),
  "CMNDCENTER",
  "repos",
  "claude-architect-os",
  "agents",
  "registry.json"
);
const REPORTS_DIR = MEMORY_DIR;

// Use opus for the analysis (long-context reasoning needed)
const ANALYSIS_MODEL = "claude-opus-4-7";
const GENERATION_MODEL = "claude-opus-4-7";

// System prompt shared across all calls in this pipeline — cached
const SELF_DEV_SYSTEM_PROMPT = `You are the Self-Development Engine of CMNDCENTER, an autonomous AI command center.
Your role is to analyze patterns from prior AI agent sessions and improve the system.

Core responsibilities:
1. Pattern cascade inference: given patterns A→B and B→C, derive A→C compound rules
2. Agent prompt improvement: generate specific, targeted improvements to agent system prompts
3. Capability gap identification: find tasks the system attempts but cannot do well
4. Quality improvement: each improvement must have a measurable expected impact

Principles:
- Be specific and actionable. "Improve clarity" is not an improvement. "Add explicit error-handling instruction for JSON parsing failures" is.
- Rate each improvement by evidence strength. More supporting patterns = higher confidence.
- Compound patterns are the most valuable insights — they reveal non-obvious relationships.
- Capability gaps should translate directly into new agent specifications.
- Output pure JSON matching the exact interfaces specified.`;

// ─── Anthropic Client ──────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

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

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
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

function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID ?? "";
  if (!token || !chatId) return Promise.resolve();

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  return fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    },
    8_000
  ).then(() => undefined).catch(() => undefined);
}

// ─── Step 1: Load All Patterns ────────────────────────────────────────────────

export function loadAllPatterns(): Pattern[] {
  const patterns = readJsonFile<Pattern[]>(PATTERNS_PATH, []);
  console.log(`[SelfDev] Loaded ${patterns.length} patterns from ${PATTERNS_PATH}`);
  return patterns;
}

// ─── Step 2: Identify Patterns ────────────────────────────────────────────────

/**
 * Group raw patterns into semantic clusters.
 * Returns a summary of recurring themes and correlation pairs.
 */
export function identifyPatterns(
  patterns: Pattern[]
): Map<string, Pattern[]> {
  const clusters = new Map<string, Pattern[]>();

  for (const p of patterns) {
    const type = p.type ?? "unknown";
    if (!clusters.has(type)) clusters.set(type, []);
    clusters.get(type)!.push(p);
  }

  // Log cluster summary
  for (const [type, members] of clusters) {
    console.log(`[SelfDev] Pattern cluster "${type}": ${members.length} instances`);
  }

  return clusters;
}

// ─── Step 3: Find Compound Patterns ──────────────────────────────────────────

/**
 * Core compound pattern inference engine.
 *
 * Logic:
 * - Group patterns by type into nodes A, B, C
 * - Find cases where type A frequently precedes type B (within same session/day)
 * - Find cases where type B frequently precedes type C
 * - If (A→B) AND (B→C), infer (A→C) compound rule
 * - Confidence = min(support_AB, support_BC) / total_patterns
 */
export function findCompoundPatterns(
  clusters: Map<string, Pattern[]>
): CompoundPattern[] {
  const types = Array.from(clusters.keys());
  const compounds: CompoundPattern[] = [];

  // Build temporal adjacency: for each pattern, find what type follows within 30 minutes
  const allPatterns = Array.from(clusters.values()).flat();
  const sorted = [...allPatterns].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build A→B transition counts
  const transitions = new Map<string, Map<string, number>>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const currentType = current.type ?? "unknown";
    const nextType = next.type ?? "unknown";
    if (currentType === nextType) continue;

    // Only count transitions within 30 minutes
    const timeDiff =
      new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    if (timeDiff > 30 * 60 * 1000) continue;

    if (!transitions.has(currentType)) {
      transitions.set(currentType, new Map());
    }
    const fromMap = transitions.get(currentType)!;
    fromMap.set(nextType, (fromMap.get(nextType) ?? 0) + 1);
  }

  // Find (A→B) + (B→C) = (A→C) inferences
  const total = allPatterns.length;

  for (const typeA of types) {
    const fromA = transitions.get(typeA);
    if (!fromA) continue;

    for (const [typeB, countAB] of fromA) {
      const fromB = transitions.get(typeB);
      if (!fromB) continue;

      for (const [typeC, countBC] of fromB) {
        if (typeC === typeA) continue; // avoid circular

        const supportCount = Math.min(countAB, countBC);
        const confidence = total > 0 ? supportCount / total : 0;

        if (confidence < 0.05 || supportCount < 2) continue; // too weak

        const inference = `When "${typeA}" patterns occur, "${typeC}" outcomes become predictable (via "${typeB}" bridge)`;
        const actionSuggestion = deriveActionSuggestion(typeA, typeB, typeC);

        compounds.push({
          chain: [typeA, typeB, typeC],
          inference,
          confidence,
          supportingPatterns: supportCount,
          actionSuggestion,
        });
      }
    }
  }

  // Also run direct high-frequency correlations as compound patterns
  for (const [typeA, fromA] of transitions) {
    for (const [typeB, count] of fromA) {
      const confidence = total > 0 ? count / total : 0;
      if (confidence < 0.15) continue; // must be a strong direct link

      compounds.push({
        chain: [typeA, typeB, typeB], // A→B (direct, no C)
        inference: `"${typeA}" strongly predicts "${typeB}" — high co-occurrence`,
        confidence,
        supportingPatterns: count,
        actionSuggestion: deriveActionSuggestion(typeA, typeB, ""),
      });
    }
  }

  return compounds
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20); // top 20 compound patterns
}

function deriveActionSuggestion(a: string, b: string, c: string): string {
  const ab = `${a}→${b}`.toLowerCase();
  const abc = `${a}→${b}→${c}`.toLowerCase();

  // Common patterns in CMNDCENTER
  if (abc.includes("loki") && abc.includes("trade")) {
    return "Pre-cache trade signals before Loki builds complete for faster execution";
  }
  if (abc.includes("wand") && abc.includes("outlier")) {
    return "Run outlier detection immediately after WAND generation for faster feedback loop";
  }
  if (abc.includes("opportunity") && abc.includes("loki")) {
    return "Auto-trigger Loki builds for opportunities above 0.85 score threshold";
  }
  if (ab.includes("wand") && ab.includes("content")) {
    return "Schedule content narration immediately after WAND script generation";
  }
  if (ab.includes("trade") && ab.includes("pattern")) {
    return "Feed trade outcomes directly into pattern memory for learning";
  }

  if (c) {
    return `Create a direct pipeline: ${a} → ${b} → ${c} without manual intervention`;
  }
  return `Strengthen the ${a} → ${b} connection with explicit handoff logic`;
}

// ─── Step 4: Generate Improvements ───────────────────────────────────────────

export async function generateImprovements(
  compounds: CompoundPattern[],
  patterns: Pattern[]
): Promise<AgentImprovement[]> {
  const client = getAnthropicClient();

  // Summarize recent pattern activity for context
  const recentPatterns = patterns.slice(-50);
  const patternSummary = recentPatterns
    .map((p) => `[${p.type}] ${p.task}: ${p.result_preview.slice(0, 80)}`)
    .join("\n");

  const topCompounds = compounds.slice(0, 8);
  const compoundSummary = topCompounds
    .map(
      (c) =>
        `Chain: ${c.chain.join("→")} | Confidence: ${(c.confidence * 100).toFixed(0)}% | ${c.inference}`
    )
    .join("\n");

  const prompt = `Analyze these patterns and compound relationships from an autonomous AI command center.
Generate specific improvements to the AI agents running the system.

RECENT PATTERN ACTIVITY (last 50 events):
${patternSummary}

COMPOUND PATTERN INSIGHTS (derived via logical chaining):
${compoundSummary}

The agents available are:
- requirements-analyst, product-manager, market-researcher, ux-researcher
- system-architect, api-architect, database-architect, backend-architect
- python-expert, data-engineer, ml-engineer, integration-specialist, prompt-engineer
- code-reviewer, security-engineer, quality-engineer, test-architect, performance-engineer
- devops-architect, deployment-engineer
- monetization-strategist, content-strategist
- metrics-analyst, pm-agent, self-review, technical-writer, refactoring-expert

Generate an array of 5-8 agent improvements. Return JSON array of objects matching:
{
  "agentId": string,
  "currentPromptSummary": string,  // what the agent currently does (inferred)
  "proposedChange": string,        // specific change to their system prompt (50-150 chars)
  "rationale": string,             // why this change based on the patterns
  "expectedImpact": string,        // measurable outcome expected
  "priority": "high"|"medium"|"low",
  "patternsSupporting": string[]   // 1-3 pattern types that support this change
}

Focus on:
1. Improvements directly evidenced by compound patterns
2. Changes that reduce handoff friction between pipeline steps
3. Prompt additions that handle failure modes seen in patterns
4. Instructions that leverage successful compound chains

Return only the JSON array.`;

  const response = await client.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: SELF_DEV_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    return JSON.parse(jsonText) as AgentImprovement[];
  } catch (err) {
    console.error(`[SelfDev] Failed to parse improvements: ${(err as Error).message}`);
    return [];
  }
}

// ─── Step 5: Apply Improvements ──────────────────────────────────────────────

export async function applyImprovements(
  improvements: AgentImprovement[]
): Promise<string[]> {
  const appliedAgents: string[] = [];

  if (!fs.existsSync(AGENTS_REGISTRY_PATH)) {
    console.warn(`[SelfDev] Registry not found: ${AGENTS_REGISTRY_PATH}`);
    return appliedAgents;
  }

  const registry = readJsonFile<AgentRegistry>(AGENTS_REGISTRY_PATH, { agents: [] });

  // Only apply high-priority improvements automatically
  const highPriority = improvements.filter((i) => i.priority === "high");

  for (const improvement of highPriority) {
    const agent = registry.agents.find(
      (a) => a.id === improvement.agentId || a.name.toLowerCase().includes(improvement.agentId.toLowerCase())
    );

    if (!agent) {
      console.warn(`[SelfDev] Agent "${improvement.agentId}" not found in registry`);
      continue;
    }

    // If agent has a system_prompt_path, append the improvement as an addendum
    if (agent.system_prompt_path) {
      const promptPath = path.join(
        os.homedir(),
        "CMNDCENTER",
        "repos",
        "claude-architect-os",
        agent.system_prompt_path
      );

      if (fs.existsSync(promptPath)) {
        const existing = fs.readFileSync(promptPath, "utf-8");
        const addendum =
          `\n\n<!-- Self-Dev Update ${new Date().toISOString().slice(0, 10)} -->\n` +
          `<!-- Improvement: ${improvement.proposedChange} -->\n` +
          `<!-- Rationale: ${improvement.rationale} -->\n`;

        // Only append if this exact improvement hasn't been applied
        if (!existing.includes(improvement.proposedChange.slice(0, 50))) {
          fs.writeFileSync(promptPath, existing + addendum, "utf-8");
          console.log(`[SelfDev] Applied improvement to ${agent.id}: ${improvement.proposedChange}`);
          appliedAgents.push(agent.id);
        }
      }
    }

    // Update description in registry (non-destructive)
    if (agent.description && improvement.proposedChange) {
      const updatedNote = ` [+${new Date().toISOString().slice(0, 10)}: ${improvement.expectedImpact}]`;
      if (!agent.description.includes(updatedNote)) {
        agent.description += updatedNote;
      }
    }
  }

  // Save updated registry
  if (appliedAgents.length > 0) {
    fs.writeFileSync(
      AGENTS_REGISTRY_PATH,
      JSON.stringify(registry, null, 2),
      "utf-8"
    );
    console.log(`[SelfDev] Updated registry with ${appliedAgents.length} agent improvements`);
  }

  return appliedAgents;
}

// ─── Step 6: Find Capability Gaps ────────────────────────────────────────────

export async function findCapabilityGaps(
  patterns: Pattern[],
  compounds: CompoundPattern[]
): Promise<CapabilityGap[]> {
  const client = getAnthropicClient();

  // Identify failed or incomplete patterns
  const failurePatterns = patterns.filter(
    (p) =>
      p.result_preview.toLowerCase().includes("error") ||
      p.result_preview.toLowerCase().includes("fail") ||
      p.result_preview.toLowerCase().includes("not found") ||
      p.result_preview.toLowerCase().includes("timeout")
  );

  const gapSummary = failurePatterns.slice(-20)
    .map((p) => `[${p.type}] ${p.task}: ${p.result_preview.slice(0, 100)}`)
    .join("\n");

  const compoundGaps = compounds
    .filter((c) => c.confidence < 0.1 && c.supportingPatterns > 0)
    .map((c) => `Weak link: ${c.chain.join("→")} (${c.supportingPatterns} instances)`)
    .join("\n");

  const prompt = `Analyze these failure patterns and weak compound links from an AI command center.
Identify capability gaps — things the system attempts but cannot do well.

FAILURE PATTERNS (recent errors/failures):
${gapSummary || "No explicit failures found."}

WEAK COMPOUND CHAINS (links that exist but rarely complete):
${compoundGaps || "No weak chains identified."}

SYSTEM CONTEXT:
The system has 37 agents across 7 phases: Discover, Design, Build, Quality, Deploy, Monetize, Operate.
Key pipelines: WAND (YouTube content), IntelliTradeX (crypto), Loki Mode (product builds),
Desktop Avatar (notifications), Self-Development (this pipeline).

Generate 3-6 capability gaps. Return JSON array of objects matching:
{
  "gapId": string,               // kebab-case identifier
  "description": string,         // what the system cannot do well
  "evidencePatterns": string[],  // 2-4 pattern types that evidence this gap
  "proposedSolution": string,    // specific agent or pipeline to build (150-300 chars)
  "buildComplexity": "low"|"medium"|"high",
  "estimatedImpact": string,     // what improves if this gap is closed
  "priorityScore": number        // 0.0-1.0 priority
}

Focus on gaps that would compound value across multiple chains.
Return only the JSON array.`;

  const response = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 3000,
    system: [
      {
        type: "text",
        text: SELF_DEV_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    const gaps = JSON.parse(jsonText) as CapabilityGap[];
    return gaps.sort((a, b) => b.priorityScore - a.priorityScore);
  } catch (err) {
    console.error(`[SelfDev] Failed to parse capability gaps: ${(err as Error).message}`);
    return [];
  }
}

// ─── Step 7: Generate New Capabilities ───────────────────────────────────────

export async function generateNewCapabilities(
  gaps: CapabilityGap[]
): Promise<CapabilityGap[]> {
  if (gaps.length === 0) return [];

  const client = getAnthropicClient();

  // Enrich top 3 gaps with full specification
  const topGaps = gaps.slice(0, 3);
  const enriched: CapabilityGap[] = [];

  for (const gap of topGaps) {
    const prompt = `Generate a detailed implementation specification for this capability gap.

GAP: ${gap.description}
Evidence: ${gap.evidencePatterns.join(", ")}
Proposed solution: ${gap.proposedSolution}
Build complexity: ${gap.buildComplexity}
Expected impact: ${gap.estimatedImpact}

Expand the "proposedSolution" field with:
1. Specific agent name and phase assignment
2. Key input/output contract
3. Integration points with existing pipelines
4. First implementation step (< 1 day of work)

Return the same JSON object structure but with an enriched "proposedSolution" field (300-500 chars).
Return only the JSON object.`;

    try {
      const response = await client.messages.create({
        model: GENERATION_MODEL,
        max_tokens: 1500,
        system: [
          {
            type: "text",
            text: SELF_DEV_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      const rawText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      const enrichedGap = JSON.parse(jsonText) as CapabilityGap;
      enriched.push(enrichedGap);
    } catch {
      enriched.push(gap); // fallback to original
    }
  }

  return enriched;
}

// ─── Step 8: Write Report ─────────────────────────────────────────────────────

export function writeReport(report: SelfDevReport): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const filename = `self-dev-report-${report.date}.json`;
  const reportPath = path.join(REPORTS_DIR, filename);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

  // Also write a latest.json
  const latestPath = path.join(REPORTS_DIR, "self-dev-report-latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`[SelfDev] Report saved: ${reportPath}`);
  return reportPath;
}

// ─── Step 9: Speak Report ─────────────────────────────────────────────────────

export async function speakReport(report: SelfDevReport): Promise<void> {
  const avatar = new DesktopAvatarAgent();

  // Top 3 improvements summary
  const top3 = report.improvements
    .filter((i) => i.priority === "high")
    .slice(0, 3);

  if (top3.length === 0 && report.improvements.length > 0) {
    top3.push(...report.improvements.slice(0, 3));
  }

  const improvementLines =
    top3.length > 0
      ? top3
          .map((imp, i) => `${i + 1}. ${imp.agentId}: ${imp.proposedChange}`)
          .join(". ")
      : "No high-priority improvements identified.";

  const compoundHighlight =
    report.patternFound.length > 0
      ? `Top compound insight: ${report.patternFound[0].inference}.`
      : "";

  const spokenText =
    `Self-development cycle complete for ${report.date}. ` +
    `Analyzed ${report.patternsAnalyzed} patterns. ` +
    `Found ${report.patternFound.length} compound patterns. ` +
    `Quality score: ${(report.qualityScore * 100).toFixed(0)}%. ` +
    `${compoundHighlight} ` +
    `Top improvements: ${improvementLines}. ` +
    `Next cycle goal: ${report.nextCycleGoal}.`;

  try {
    await avatar.deliverMessage({
      type: "system",
      title: "Self-Development Cycle Complete",
      content: spokenText,
      actions: top3.map((i) => `Improve ${i.agentId}: ${i.proposedChange.slice(0, 60)}`),
      urgency: 2,
      chain: "self-development",
    });
  } catch (err) {
    console.warn(`[SelfDev] Avatar delivery failed: ${(err as Error).message}`);
  }

  // Also send Telegram summary
  const topGap = report.newCapabilities[0];
  const telegramText =
    `*Self-Dev Cycle — ${report.date}*\n\n` +
    `Patterns: ${report.patternsAnalyzed} | Quality: ${(report.qualityScore * 100).toFixed(0)}%\n` +
    `Compounds found: ${report.patternFound.length}\n` +
    `Improvements: ${report.improvements.length} | Agents updated: ${report.agentsUpdated?.length ?? 0}\n\n` +
    (top3.length > 0
      ? `*Top Improvements:*\n${top3.map((i, n) => `${n + 1}. _${i.agentId}_: ${i.proposedChange}`).join("\n")}\n\n`
      : "") +
    (topGap
      ? `*Priority Gap:* ${topGap.description}\n_Solution: ${topGap.proposedSolution.slice(0, 150)}_\n\n`
      : "") +
    `*Next goal:* ${report.nextCycleGoal}`;

  await sendTelegram(telegramText);
}

// ─── Quality Score ────────────────────────────────────────────────────────────

function computeQualityScore(
  patterns: Pattern[],
  compounds: CompoundPattern[],
  improvements: AgentImprovement[],
  gaps: CapabilityGap[]
): number {
  let score = 0.5; // baseline

  // More patterns = richer learning base
  if (patterns.length > 100) score += 0.1;
  if (patterns.length > 500) score += 0.1;

  // High-confidence compound patterns increase quality
  const strongCompounds = compounds.filter((c) => c.confidence > 0.2).length;
  score += Math.min(strongCompounds * 0.03, 0.15);

  // High-priority improvements ready
  const highPriority = improvements.filter((i) => i.priority === "high").length;
  score += Math.min(highPriority * 0.02, 0.10);

  // Gaps found = system is self-aware
  if (gaps.length > 0) score += 0.05;
  if (gaps.length >= 3) score += 0.05;

  // Failure patterns = learning opportunity (slight boost for having data)
  const failureRate =
    patterns.length > 0
      ? patterns.filter(
          (p) =>
            p.result_preview.toLowerCase().includes("error") ||
            p.result_preview.toLowerCase().includes("fail")
        ).length / patterns.length
      : 0;

  if (failureRate < 0.1) score += 0.05; // low failure rate = healthy system

  return Math.min(score, 1.0);
}

function deriveNextCycleGoal(
  improvements: AgentImprovement[],
  gaps: CapabilityGap[],
  compounds: CompoundPattern[]
): string {
  // Prioritize the highest-impact gap or improvement
  const topGap = gaps.find((g) => g.priorityScore > 0.7);
  if (topGap) {
    return `Close capability gap: ${topGap.description.slice(0, 100)}`;
  }

  const topImprovement = improvements.find((i) => i.priority === "high");
  if (topImprovement) {
    return `Apply and measure: ${topImprovement.expectedImpact.slice(0, 100)}`;
  }

  const topCompound = compounds[0];
  if (topCompound) {
    return `Automate compound chain: ${topCompound.chain.join("→")}`;
  }

  return "Increase pattern collection frequency for richer analysis";
}

// ─── Main Cycle ───────────────────────────────────────────────────────────────

export async function runSelfDevelopmentCycle(): Promise<SelfDevReport> {
  const startTime = Date.now();
  console.log("[SelfDev] Starting self-development cycle...");

  // Step 1: Load patterns
  const patterns = loadAllPatterns();

  // Step 2: Identify pattern clusters
  const clusters = identifyPatterns(patterns);

  // Step 3: Find compound patterns (deterministic, fast)
  const compounds = findCompoundPatterns(clusters);
  console.log(`[SelfDev] Found ${compounds.length} compound patterns`);

  // Steps 4-7: Claude analysis (parallel where possible)
  const [improvements, gaps] = await Promise.all([
    generateImprovements(compounds, patterns),
    findCapabilityGaps(patterns, compounds),
  ]);

  console.log(`[SelfDev] Generated ${improvements.length} improvements, ${gaps.length} gaps`);

  // Step 7: Enrich top capability gaps
  const enrichedGaps = await generateNewCapabilities(gaps);

  // Step 5: Apply improvements
  const agentsUpdated = await applyImprovements(improvements);
  console.log(`[SelfDev] Applied improvements to ${agentsUpdated.length} agents`);

  // Compute quality score
  const qualityScore = computeQualityScore(patterns, compounds, improvements, enrichedGaps);
  const nextCycleGoal = deriveNextCycleGoal(improvements, enrichedGaps, compounds);

  const report: SelfDevReport = {
    date: todayDateStr(),
    generatedAt: new Date().toISOString(),
    patternsAnalyzed: patterns.length,
    patternFound: compounds,
    improvements,
    newCapabilities: enrichedGaps,
    qualityScore,
    nextCycleGoal,
    appliedAt: agentsUpdated.length > 0 ? new Date().toISOString() : undefined,
    agentsUpdated,
  };

  // Step 8: Write report
  const reportPath = writeReport(report);

  // Step 9: Speak report
  await speakReport(report);

  const durationMs = Date.now() - startTime;
  console.log(
    `[SelfDev] Cycle complete in ${(durationMs / 1000).toFixed(1)}s. Quality: ${(qualityScore * 100).toFixed(0)}%. Report: ${reportPath}`
  );

  return report;
}
