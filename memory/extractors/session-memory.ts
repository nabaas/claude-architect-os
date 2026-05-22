// memory/extractors/session-memory.ts
// Session Memory Extractor — Claude Architect OS v4.0
// Extracts valuable patterns from Claude conversations, persists to ~/.amsa/memory/
// Integrates with ChromaDB (localhost:8000) for vector search

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  model?: string;
  tokens?: number;
}

export interface Pattern {
  id: string;
  session_id: string;
  domain: string;
  description: string;
  content: string;
  pattern_type:
    | "solution"
    | "failure"
    | "insight"
    | "decision"
    | "workflow"
    | "optimization";
  confidence: number;
  leverage_score: number;
  tags: string[];
  source_messages: number[];
  extracted_at: string;
  ttl_days: number | null;
}

export interface SessionMemory {
  session_id: string;
  started_at: string;
  ended_at: string;
  patterns: Pattern[];
  karpathy_wrapup: KarpathyWrapup;
  improvement_vectors: ImprovementVector[];
  stats: SessionStats;
}

export interface KarpathyWrapup {
  session_id: string;
  synthesized_at: string;
  top_wins: string[];
  top_failures: string[];
  top_insights: string[];
  recommended_promotions: string[];
  quality_score: number;
}

export interface ImprovementVector {
  domain: string;
  current_state: string;
  target_state: string;
  delta: string;
  priority: "high" | "medium" | "low";
  estimated_impact: number;
}

export interface SessionStats {
  message_count: number;
  pattern_count: number;
  high_confidence_patterns: number;
  domains_covered: string[];
  total_tokens: number;
  session_duration_minutes: number;
}

export interface ChromaDocument {
  id: string;
  document: string;
  metadata: Record<string, string | number | boolean>;
  embedding?: number[];
}

export interface ChromaQueryResult {
  ids: string[][];
  documents: string[][];
  metadatas: Record<string, string | number | boolean>[][];
  distances: number[][];
}

// ============================================================
// CONSTANTS
// ============================================================

const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const PATTERNS_FILE = path.join(MEMORY_DIR, "patterns.json");
const KARPATHY_FILE = path.join(MEMORY_DIR, "karpathy_wrapup.json");
const SESSIONS_DIR = path.join(MEMORY_DIR, "loki_runs");
const CHROMA_BASE_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const CHROMA_COLLECTION = "claude-architect-os-memory";
const MIN_CONFIDENCE_TO_SAVE = 0.4;
const MIN_CONFIDENCE_TO_PROMOTE = 0.75;
const MAX_PATTERNS_PER_SESSION = 20;
const PATTERN_TTL_DAYS = 90;

// Pattern extraction heuristics — signals in assistant messages
const SOLUTION_SIGNALS = [
  "here is",
  "here's",
  "this approach",
  "the solution",
  "use this",
  "implement",
  "```",
  "works by",
];
const FAILURE_SIGNALS = [
  "doesn't work",
  "avoid",
  "issue with",
  "problem is",
  "this fails",
  "not recommended",
  "gotcha",
  "caveat",
];
const INSIGHT_SIGNALS = [
  "the key insight",
  "importantly",
  "note that",
  "worth noting",
  "the reason",
  "this matters because",
  "the pattern here",
];
const DECISION_SIGNALS = [
  "chose",
  "decided",
  "going with",
  "instead of",
  "tradeoff",
  "because",
  "the reason we",
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  "profit-systems": [
    "revenue",
    "monetize",
    "stripe",
    "saas",
    "subscription",
    "pricing",
    "mrr",
    "ltv",
  ],
  flips: [
    "arbitrage",
    "flip",
    "resell",
    "margin",
    "sourcing",
    "ebay",
    "amazon",
    "profit",
  ],
  automation: [
    "automate",
    "n8n",
    "cron",
    "pipeline",
    "workflow",
    "script",
    "launchagent",
    "trigger",
  ],
  research: [
    "research",
    "analysis",
    "market",
    "trend",
    "synthesis",
    "signal",
    "intelligence",
  ],
  coding: [
    "function",
    "class",
    "api",
    "endpoint",
    "schema",
    "query",
    "typescript",
    "python",
  ],
  deployment: [
    "deploy",
    "docker",
    "ci/cd",
    "kubernetes",
    "production",
    "health check",
    "rollback",
  ],
  memory: [
    "memory",
    "context",
    "embedding",
    "vector",
    "chromadb",
    "supabase",
    "persist",
  ],
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateId(prefix: string = "pat"): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function detectDomain(text: string): string {
  const lower = text.toLowerCase();
  let bestDomain = "general";
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }
  return bestDomain;
}

function detectPatternType(
  text: string
): Pattern["pattern_type"] {
  const lower = text.toLowerCase();
  if (SOLUTION_SIGNALS.some((s) => lower.includes(s))) return "solution";
  if (FAILURE_SIGNALS.some((s) => lower.includes(s))) return "failure";
  if (INSIGHT_SIGNALS.some((s) => lower.includes(s))) return "insight";
  if (DECISION_SIGNALS.some((s) => lower.includes(s))) return "decision";
  if (lower.includes("workflow") || lower.includes("pipeline"))
    return "workflow";
  if (lower.includes("optimize") || lower.includes("faster") || lower.includes("improve"))
    return "optimization";
  return "insight";
}

function computeConfidence(
  message: Message,
  patternType: Pattern["pattern_type"]
): number {
  let score = 0.5;

  // Longer assistant messages tend to contain more deliberate content
  if (message.content.length > 500) score += 0.1;
  if (message.content.length > 2000) score += 0.1;

  // Code blocks are high-value (concrete solutions)
  const codeBlockCount = (message.content.match(/```/g) || []).length / 2;
  score += Math.min(codeBlockCount * 0.05, 0.15);

  // Type-based adjustments
  if (patternType === "solution") score += 0.1;
  if (patternType === "failure") score += 0.05; // failures are also valuable
  if (patternType === "decision") score += 0.05;

  // Specific structure signals
  if (message.content.includes("because")) score += 0.03;
  if (message.content.includes("therefore")) score += 0.03;
  if (/\d+\.\s/.test(message.content)) score += 0.05; // numbered lists = structured thinking

  return Math.min(Math.max(score, 0.0), 1.0);
}

function computeLeverageScore(
  content: string,
  domain: string
): number {
  let score = 0.5;
  const lower = content.toLowerCase();

  // High-leverage domains
  if (domain === "automation") score += 0.15;
  if (domain === "profit-systems") score += 0.12;

  // Scalability signals
  if (lower.includes("reusable") || lower.includes("template")) score += 0.1;
  if (lower.includes("pipeline") || lower.includes("framework")) score += 0.1;
  if (lower.includes("automat") || lower.includes("systematic")) score += 0.08;
  if (lower.includes("scale") || lower.includes("compound")) score += 0.08;

  // Decrementors
  if (lower.includes("one-time") || lower.includes("manual")) score -= 0.1;
  if (lower.includes("workaround") || lower.includes("hack")) score -= 0.05;

  return Math.min(Math.max(score, 0.0), 1.0);
}

function extractTags(content: string, domain: string): string[] {
  const tags: Set<string> = new Set([domain]);
  const lower = content.toLowerCase();

  // Technology tags
  const techKeywords = [
    "typescript", "python", "sql", "docker", "n8n", "supabase",
    "chromadb", "ollama", "stripe", "openai", "anthropic", "claude",
    "fastapi", "postgres", "redis", "vector", "embedding",
  ];
  techKeywords.forEach((kw) => {
    if (lower.includes(kw)) tags.add(kw);
  });

  // Concept tags
  const conceptKeywords = [
    "caching", "auth", "security", "testing", "deployment", "monitoring",
    "optimization", "refactoring", "api", "webhook", "cron", "automation",
  ];
  conceptKeywords.forEach((kw) => {
    if (lower.includes(kw)) tags.add(kw);
  });

  return Array.from(tags).slice(0, 10);
}

// ============================================================
// CORE FUNCTION: extractPatterns
// ============================================================

export function extractPatterns(conversation: Message[]): Pattern[] {
  const patterns: Pattern[] = [];
  const sessionId = generateId("ses");

  // Only process assistant messages — they contain the valuable outputs
  const assistantMessages = conversation.filter(
    (m, idx) => m.role === "assistant"
  );

  for (const [msgIdx, message] of assistantMessages.entries()) {
    // Skip very short messages (greetings, acks)
    if (message.content.trim().length < 100) continue;

    // Split long messages into logical segments (by double newline or heading)
    const segments = message.content
      .split(/\n{2,}|\n#{1,3}\s/)
      .filter((s) => s.trim().length > 80);

    for (const segment of segments) {
      const patternType = detectPatternType(segment);
      const domain = detectDomain(segment);
      const confidence = computeConfidence(message, patternType);
      const leverageScore = computeLeverageScore(segment, domain);

      // Skip low-confidence patterns
      if (confidence < MIN_CONFIDENCE_TO_SAVE) continue;

      const contentId = hashContent(segment);

      const pattern: Pattern = {
        id: `${contentId}_${generateId("p")}`,
        session_id: sessionId,
        domain,
        description: segment.substring(0, 150).replace(/\n/g, " ").trim(),
        content: segment.trim(),
        pattern_type: patternType,
        confidence,
        leverage_score: leverageScore,
        tags: extractTags(segment, domain),
        source_messages: [msgIdx],
        extracted_at: new Date().toISOString(),
        ttl_days: PATTERN_TTL_DAYS,
      };

      patterns.push(pattern);

      // Limit per session
      if (patterns.length >= MAX_PATTERNS_PER_SESSION) break;
    }

    if (patterns.length >= MAX_PATTERNS_PER_SESSION) break;
  }

  // Sort by combined score (confidence + leverage) descending
  return patterns.sort(
    (a, b) =>
      b.confidence + b.leverage_score - (a.confidence + a.leverage_score)
  );
}

// ============================================================
// CORE FUNCTION: saveSession
// ============================================================

export async function saveSession(patterns: Pattern[]): Promise<void> {
  ensureDirectoryExists(MEMORY_DIR);
  ensureDirectoryExists(SESSIONS_DIR);

  if (patterns.length === 0) return;

  const sessionId = patterns[0]?.session_id ?? generateId("ses");
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  ensureDirectoryExists(sessionDir);

  // 1. Load existing patterns
  let existingPatterns: Pattern[] = [];
  if (fs.existsSync(PATTERNS_FILE)) {
    try {
      const raw = fs.readFileSync(PATTERNS_FILE, "utf-8");
      existingPatterns = JSON.parse(raw) as Pattern[];
    } catch {
      existingPatterns = [];
    }
  }

  // 2. Deduplicate: skip patterns with matching content hash
  const existingHashes = new Set(
    existingPatterns.map((p) => hashContent(p.content))
  );
  const newPatterns = patterns.filter(
    (p) => !existingHashes.has(hashContent(p.content))
  );

  // 3. Merge and cap total stored patterns (keep highest-scoring 200)
  const merged = [...existingPatterns, ...newPatterns]
    .sort(
      (a, b) =>
        b.confidence + b.leverage_score - (a.confidence + a.leverage_score)
    )
    .slice(0, 200);

  // 4. Write patterns.json
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(merged, null, 2), "utf-8");

  // 5. Write session-specific archive
  const sessionMemory: SessionMemory = {
    session_id: sessionId,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    patterns: newPatterns,
    karpathy_wrapup: synthesizeKarpathyWrapup(patterns, sessionId),
    improvement_vectors: generateImprovementVectors(patterns),
    stats: {
      message_count: 0,
      pattern_count: newPatterns.length,
      high_confidence_patterns: newPatterns.filter((p) => p.confidence > 0.7)
        .length,
      domains_covered: [...new Set(newPatterns.map((p) => p.domain))],
      total_tokens: 0,
      session_duration_minutes: 0,
    },
  };

  fs.writeFileSync(
    path.join(sessionDir, "memory.json"),
    JSON.stringify(sessionMemory, null, 2),
    "utf-8"
  );

  // 6. Update karpathy wrapup
  fs.writeFileSync(
    KARPATHY_FILE,
    JSON.stringify(sessionMemory.karpathy_wrapup, null, 2),
    "utf-8"
  );

  // 7. Persist to ChromaDB (non-blocking, best-effort)
  await persistToChroma(newPatterns).catch((err) => {
    console.warn(
      `[session-memory] ChromaDB persist failed (non-fatal): ${err.message}`
    );
  });
}

// ============================================================
// CORE FUNCTION: loadContext
// ============================================================

export async function loadContext(query: string): Promise<string> {
  const results: Pattern[] = [];

  // 1. Try ChromaDB semantic search first (most relevant)
  try {
    const chromaResults = await queryChroma(query, 5);
    results.push(...chromaResults);
  } catch {
    // ChromaDB unavailable — fall back to file-based search
  }

  // 2. File-based keyword fallback
  if (results.length < 5 && fs.existsSync(PATTERNS_FILE)) {
    try {
      const raw = fs.readFileSync(PATTERNS_FILE, "utf-8");
      const allPatterns: Pattern[] = JSON.parse(raw);

      const queryTerms = query.toLowerCase().split(/\s+/);
      const scored = allPatterns
        .map((p) => {
          const text = (p.description + " " + p.tags.join(" ")).toLowerCase();
          const matches = queryTerms.filter((t) => text.includes(t)).length;
          const relevance = matches / queryTerms.length;
          return { pattern: p, relevance };
        })
        .filter((r) => r.relevance > 0.2)
        .sort(
          (a, b) =>
            b.relevance * b.pattern.confidence -
            a.relevance * a.pattern.confidence
        )
        .slice(0, 5 - results.length)
        .map((r) => r.pattern);

      results.push(...scored);
    } catch {
      /* ignore file errors */
    }
  }

  // 3. Load Karpathy wrapup insights
  let karpathyInsights = "";
  if (fs.existsSync(KARPATHY_FILE)) {
    try {
      const wrapup: KarpathyWrapup = JSON.parse(
        fs.readFileSync(KARPATHY_FILE, "utf-8")
      );
      karpathyInsights = `
<karpathy_insights session="${wrapup.session_id}" synthesized="${wrapup.synthesized_at}">
  <wins>${wrapup.top_wins.map((w, i) => `<win rank="${i + 1}">${w}</win>`).join("\n  ")}</wins>
  <failures>${wrapup.top_failures.map((f, i) => `<failure rank="${i + 1}">${f}</failure>`).join("\n  ")}</failures>
  <insights>${wrapup.top_insights.map((ins, i) => `<insight rank="${i + 1}">${ins}</insight>`).join("\n  ")}</insights>
</karpathy_insights>`;
    } catch {
      /* ignore */
    }
  }

  if (results.length === 0 && !karpathyInsights) {
    return "<memory>No prior patterns found for this query.</memory>";
  }

  // 4. Format results as XML memory block
  const patternsXml = results
    .map(
      (p) => `
  <pattern id="${p.id}" type="${p.pattern_type}" confidence="${p.confidence.toFixed(2)}" domain="${p.domain}" leverage="${p.leverage_score.toFixed(2)}">
    <description>${p.description}</description>
    <content>${p.content.slice(0, 800)}${p.content.length > 800 ? "..." : ""}</content>
    <tags>${p.tags.join(", ")}</tags>
  </pattern>`
    )
    .join("\n");

  return `<memory query="${query}" retrieved_at="${new Date().toISOString()}">
  <patterns count="${results.length}">
    ${patternsXml}
  </patterns>
  ${karpathyInsights}
</memory>`;
}

// ============================================================
// KARPATHY SYNTHESIS
// ============================================================

function synthesizeKarpathyWrapup(
  patterns: Pattern[],
  sessionId: string
): KarpathyWrapup {
  const solutions = patterns
    .filter((p) => p.pattern_type === "solution")
    .sort((a, b) => b.confidence - a.confidence);
  const failures = patterns
    .filter((p) => p.pattern_type === "failure")
    .sort((a, b) => b.confidence - a.confidence);
  const insights = patterns
    .filter(
      (p) =>
        p.pattern_type === "insight" ||
        p.pattern_type === "decision" ||
        p.pattern_type === "optimization"
    )
    .sort((a, b) => b.leverage_score - a.leverage_score);

  const promotionCandidates = patterns
    .filter((p) => p.confidence >= MIN_CONFIDENCE_TO_PROMOTE)
    .map((p) => `${p.pattern_type}:${p.domain}:${p.description.slice(0, 60)}`);

  const qualityScore =
    patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;

  return {
    session_id: sessionId,
    synthesized_at: new Date().toISOString(),
    top_wins: solutions.slice(0, 3).map((p) => p.description),
    top_failures: failures.slice(0, 3).map((p) => p.description),
    top_insights: insights.slice(0, 3).map((p) => p.description),
    recommended_promotions: promotionCandidates.slice(0, 5),
    quality_score: Math.round(qualityScore * 100) / 100,
  };
}

// ============================================================
// IMPROVEMENT VECTORS
// ============================================================

function generateImprovementVectors(patterns: Pattern[]): ImprovementVector[] {
  const vectors: ImprovementVector[] = [];

  // Group failures by domain
  const failuresByDomain = patterns
    .filter((p) => p.pattern_type === "failure")
    .reduce<Record<string, Pattern[]>>((acc, p) => {
      acc[p.domain] = acc[p.domain] ?? [];
      acc[p.domain].push(p);
      return acc;
    }, {});

  for (const [domain, failures] of Object.entries(failuresByDomain)) {
    vectors.push({
      domain,
      current_state: `${failures.length} failure pattern(s) detected`,
      target_state: "zero failures for this pattern type",
      delta: failures.map((f) => f.description).join("; "),
      priority: failures.length >= 2 ? "high" : "medium",
      estimated_impact: failures.length * 0.1,
    });
  }

  // High-leverage patterns worth reinforcing
  const highLeverage = patterns
    .filter((p) => p.leverage_score >= 0.8 && p.confidence >= 0.7)
    .slice(0, 3);

  for (const p of highLeverage) {
    vectors.push({
      domain: p.domain,
      current_state: "high-leverage pattern identified",
      target_state: "pattern standardized and promoted to superpowers",
      delta: p.description,
      priority: "high",
      estimated_impact: p.leverage_score,
    });
  }

  return vectors;
}

// ============================================================
// CHROMADB INTEGRATION
// ============================================================

async function persistToChroma(patterns: Pattern[]): Promise<void> {
  if (patterns.length === 0) return;

  // Ensure collection exists
  await fetchChroma(`/api/v1/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CHROMA_COLLECTION,
      metadata: { description: "Claude Architect OS session memory" },
    }),
  }).catch(() => {
    /* collection may already exist */
  });

  const collectionRes = await fetchChroma(
    `/api/v1/collections/${CHROMA_COLLECTION}`
  );
  const collection = (await collectionRes.json()) as { id: string };

  const docs: ChromaDocument[] = patterns.map((p) => ({
    id: p.id,
    document: `${p.description}\n\n${p.content.slice(0, 1000)}`,
    metadata: {
      session_id: p.session_id,
      domain: p.domain,
      pattern_type: p.pattern_type,
      confidence: p.confidence,
      leverage_score: p.leverage_score,
      tags: p.tags.join(","),
      extracted_at: p.extracted_at,
    },
  }));

  await fetchChroma(`/api/v1/collections/${collection.id}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids: docs.map((d) => d.id),
      documents: docs.map((d) => d.document),
      metadatas: docs.map((d) => d.metadata),
    }),
  });
}

async function queryChroma(query: string, nResults: number = 5): Promise<Pattern[]> {
  const collectionRes = await fetchChroma(
    `/api/v1/collections/${CHROMA_COLLECTION}`
  );
  const collection = (await collectionRes.json()) as { id: string };

  const res = await fetchChroma(
    `/api/v1/collections/${collection.id}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query_texts: [query],
        n_results: nResults,
        include: ["documents", "metadatas", "distances"],
      }),
    }
  );

  const result = (await res.json()) as ChromaQueryResult;

  if (!result.ids?.[0]) return [];

  return result.ids[0].map((id, idx) => {
    const meta = result.metadatas[0][idx];
    const document = result.documents[0][idx];
    const distance = result.distances[0][idx];
    const [description, ...contentParts] = document.split("\n\n");

    return {
      id,
      session_id: String(meta.session_id ?? ""),
      domain: String(meta.domain ?? "general"),
      description: description ?? "",
      content: contentParts.join("\n\n"),
      pattern_type: (meta.pattern_type as Pattern["pattern_type"]) ?? "insight",
      confidence: Number(meta.confidence ?? 0.5),
      leverage_score: Number(meta.leverage_score ?? 0.5),
      tags: String(meta.tags ?? "").split(",").filter(Boolean),
      source_messages: [],
      extracted_at: String(meta.extracted_at ?? new Date().toISOString()),
      ttl_days: PATTERN_TTL_DAYS,
      // Boost confidence for closer semantic matches
      ...(distance !== undefined && { confidence: 1 - distance }),
    } as Pattern;
  });
}

async function fetchChroma(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${CHROMA_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(
      `ChromaDB request failed: ${res.status} ${res.statusText} — ${url}`
    );
  }
  return res;
}

// ============================================================
// ADDITIONAL EXPORTS: Session lifecycle helpers
// ============================================================

export function loadAllPatterns(): Pattern[] {
  if (!fs.existsSync(PATTERNS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")) as Pattern[];
  } catch {
    return [];
  }
}

export function getHighLeveragePatterns(
  minLeverage: number = 0.7,
  minConfidence: number = 0.6
): Pattern[] {
  return loadAllPatterns().filter(
    (p) =>
      p.leverage_score >= minLeverage &&
      p.confidence >= minConfidence
  );
}

export function pruneExpiredPatterns(): number {
  if (!fs.existsSync(PATTERNS_FILE)) return 0;

  const patterns = loadAllPatterns();
  const now = Date.now();

  const active = patterns.filter((p) => {
    if (!p.ttl_days) return true; // permanent
    const extractedAt = new Date(p.extracted_at).getTime();
    const expiresAt = extractedAt + p.ttl_days * 24 * 60 * 60 * 1000;
    return now < expiresAt;
  });

  const pruned = patterns.length - active.length;
  if (pruned > 0) {
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(active, null, 2), "utf-8");
  }
  return pruned;
}

export function getMemoryStats(): {
  total_patterns: number;
  high_confidence: number;
  high_leverage: number;
  domains: Record<string, number>;
  oldest_pattern: string | null;
  newest_pattern: string | null;
} {
  const patterns = loadAllPatterns();

  const domainCounts: Record<string, number> = {};
  for (const p of patterns) {
    domainCounts[p.domain] = (domainCounts[p.domain] ?? 0) + 1;
  }

  const sorted = [...patterns].sort(
    (a, b) =>
      new Date(a.extracted_at).getTime() - new Date(b.extracted_at).getTime()
  );

  return {
    total_patterns: patterns.length,
    high_confidence: patterns.filter((p) => p.confidence >= 0.7).length,
    high_leverage: patterns.filter((p) => p.leverage_score >= 0.7).length,
    domains: domainCounts,
    oldest_pattern: sorted[0]?.extracted_at ?? null,
    newest_pattern: sorted[sorted.length - 1]?.extracted_at ?? null,
  };
}
