/**
 * system/pattern-engine.ts
 * Pattern Recognition Engine — Claude Architect OS v4.0
 *
 * Recognizes, extracts, compounds, and cascades patterns across all CMNDCENTER interactions.
 * Reads from and writes to:
 *   - ~/.amsa/memory/patterns.json  (local file, fast read)
 *   - ChromaDB at localhost:8000    (vector embeddings, semantic search)
 *
 * Core insight: (A → B) + (B → C) = (A → C)
 * The compound() function surfaces these transitive chains automatically.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Constants ──────────────────────────────────────────────────────────────

const PATTERNS_FILE = path.join(os.homedir(), ".amsa", "memory", "patterns.json");
const CHROMADB_BASE = "http://localhost:8000";
const CHROMADB_COLLECTION = "cmndcenter_patterns";
const CHROMADB_TIMEOUT_MS = 5000;
const MIN_SIMILARITY_THRESHOLD = 0.45;
const HIGH_CONFIDENCE_THRESHOLD = 0.75;

// Pattern categories mapped to chain triggers
const CATEGORY_CHAIN_MAP: Record<string, string[]> = {
  "solutions":        ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
  "prompts":          ["chain-2-knowledge-compound"],
  "tool_chains":      ["chain-2-knowledge-compound", "chain-3-auto-upgrade"],
  "failures":         ["chain-3-auto-upgrade"],
  "content_strategy": ["chain-7-content-revenue"],
  "market_signals":   ["chain-1-signal-profit", "chain-6-market-arbitrage"],
  "trade_patterns":   ["chain-1-signal-profit", "chain-6-market-arbitrage"],
  "architecture":     ["chain-4-repo-intelligence"],
  "automation":       ["chain-3-auto-upgrade"],
  "deploy":           ["chain-4-repo-intelligence"],
};

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface Pattern {
  /** Unique identifier, e.g. "pat_<timestamp>_<slug>" */
  id: string;
  /** Category for grouping: solutions | prompts | tool_chains | failures | content_strategy | market_signals | architecture | automation */
  category: string;
  /** Where this pattern came from: "session" | "upgrade_loop" | "graphrag" | "manual" */
  source: string;
  /** The pattern content — what was observed, learned, or synthesized */
  content: string;
  /** Short title for display */
  title: string;
  /** How many times this pattern has been observed or confirmed */
  frequency: number;
  /** ISO timestamp of last observation */
  lastSeen: string;
  /** ISO timestamp of first observation */
  firstSeen: string;
  /** Confidence score 0-1 (increases with frequency and successful use) */
  confidence: number;
  /** IDs of other patterns that this one triggers or is related to */
  chainLinks: string[];
  /** Optional: the action this pattern recommends when matched */
  suggestedAction?: string;
  /** Optional: which of the 7 CMNDCENTER chains this pattern belongs to */
  cmndChains?: string[];
}

export interface PatternMatch {
  pattern: Pattern;
  /** Cosine similarity score from ChromaDB (0-1) or keyword score (normalized) */
  similarity: number;
  /** What to do given this pattern match */
  actionRecommendation: string;
}

export interface CascadeLink {
  from: Pattern;
  to: Pattern;
  relationship: string;
  strength: number;
}

// ── ChromaDB HTTP Client ───────────────────────────────────────────────────

interface ChromaQueryResult {
  ids: string[][];
  documents: (string | null)[][];
  metadatas: (Record<string, unknown> | null)[][];
  distances: number[][];
}

/**
 * Fetches with a timeout so ChromaDB unavailability does not block operations.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = CHROMADB_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Checks if ChromaDB is reachable.
 */
async function isChromaDBReachable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${CHROMADB_BASE}/api/v1/heartbeat`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensures the CMNDCENTER patterns collection exists in ChromaDB.
 */
async function ensureCollection(): Promise<void> {
  try {
    await fetchWithTimeout(
      `${CHROMADB_BASE}/api/v1/collections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: CHROMADB_COLLECTION,
          metadata: { description: "CMNDCENTER pattern recognition store" },
        }),
      }
    );
    // 200 = created, 409 = already exists — both are acceptable
  } catch {
    // Non-fatal — fallback to file-only operation
  }
}

// ── File Operations ────────────────────────────────────────────────────────

/**
 * Loads all patterns from the local patterns.json file.
 * Returns empty array on missing or corrupted file.
 */
function loadPatternsFromFile(): Pattern[] {
  try {
    if (!fs.existsSync(PATTERNS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(PATTERNS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Pattern[];
  } catch {
    return [];
  }
}

/**
 * Writes the full patterns array to disk atomically (write to temp, then rename).
 */
function savePatternsToFile(patterns: Pattern[]): void {
  const dir = path.dirname(PATTERNS_FILE);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = PATTERNS_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(patterns, null, 2), "utf-8");
  fs.renameSync(tmp, PATTERNS_FILE);
}

// ── Simple Text Similarity (offline fallback) ──────────────────────────────

/**
 * Computes a simple normalized keyword overlap score between two strings.
 * Used when ChromaDB is unavailable.
 */
function keywordSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  // Jaccard similarity
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

// ── Pattern Engine Class ───────────────────────────────────────────────────

export class PatternEngine {
  private patterns: Pattern[] = [];
  private initialized = false;

  constructor() {
    this.load();
  }

  // ── Initialization ─────────────────────────────────────────────────────

  private load(): void {
    this.patterns = loadPatternsFromFile();
    this.initialized = true;
  }

  private reload(): void {
    this.patterns = loadPatternsFromFile();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Finds patterns that match the input string, ordered by similarity descending.
   * Tries ChromaDB first; falls back to local keyword matching.
   *
   * @param input   Natural language query or task description
   * @returns       Array of pattern matches with similarity scores and action recommendations
   */
  async recognize(input: string): Promise<PatternMatch[]> {
    this.reload();

    // Try ChromaDB semantic search first
    const chromaMatches = await this.embedAndSearch(input);
    if (chromaMatches.length > 0) {
      return chromaMatches;
    }

    // Fallback: keyword similarity over local patterns
    const matches: PatternMatch[] = this.patterns
      .map((p) => {
        const similarity = keywordSimilarity(input, p.content + " " + p.title);
        return {
          pattern: p,
          similarity,
          actionRecommendation: this.buildActionRecommendation(p, similarity),
        };
      })
      .filter((m) => m.similarity >= MIN_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    return matches;
  }

  /**
   * Extracts new patterns from a conversation (array of message strings).
   * Looks for: reusable solutions, effective techniques, failure modes, insights.
   *
   * @param conversation  Array of strings (alternating user/assistant messages or combined log)
   * @returns             Newly extracted patterns (not yet saved — caller must call savePattern())
   */
  async extract(conversation: string[]): Promise<Pattern[]> {
    const fullText = conversation.join("\n");
    const extracted: Pattern[] = [];

    // Pattern extraction heuristics — real extraction would use Claude,
    // but these rules work offline and provide deterministic behavior.
    const extractionRules: Array<{
      trigger: RegExp;
      category: string;
      titlePrefix: string;
    }> = [
      {
        trigger: /(?:solution|solved|fixed|resolved|the answer is|works by)/i,
        category: "solutions",
        titlePrefix: "Solution",
      },
      {
        trigger: /(?:effective prompt|system prompt|prompt that|caching|cache_control)/i,
        category: "prompts",
        titlePrefix: "Prompt technique",
      },
      {
        trigger: /(?:chain|pipeline|→|triggers|feeds into|connected|wired)/i,
        category: "tool_chains",
        titlePrefix: "Tool chain",
      },
      {
        trigger: /(?:failed|broken|error|bug|does not work|regression|issue)/i,
        category: "failures",
        titlePrefix: "Failure mode",
      },
      {
        trigger: /(?:content|youtube|video|viral|trending|adsense|views)/i,
        category: "content_strategy",
        titlePrefix: "Content pattern",
      },
      {
        trigger: /(?:signal|trade|arbitrage|price|buy|sell|market|opportunity)/i,
        category: "market_signals",
        titlePrefix: "Market signal",
      },
      {
        trigger: /(?:architecture|design pattern|component|interface|service)/i,
        category: "architecture",
        titlePrefix: "Architecture pattern",
      },
      {
        trigger: /(?:automate|automation|cron|trigger|schedule|webhook|n8n)/i,
        category: "automation",
        titlePrefix: "Automation pattern",
      },
    ];

    for (const rule of extractionRules) {
      if (rule.trigger.test(fullText)) {
        // Extract a representative snippet (~280 chars) around the match
        const match = fullText.match(rule.trigger);
        if (!match || match.index === undefined) continue;

        const start = Math.max(0, match.index - 80);
        const end = Math.min(fullText.length, match.index + 200);
        const snippet = fullText.slice(start, end).trim();

        if (snippet.length < 30) continue;  // Too short to be meaningful

        // Avoid near-duplicate patterns
        const isDuplicate = this.patterns.some(
          (p) => keywordSimilarity(p.content, snippet) > 0.85
        );
        if (isDuplicate) continue;

        const now = new Date().toISOString();
        const id = `pat_${Date.now()}_${rule.category.slice(0, 8)}`;

        extracted.push({
          id,
          category: rule.category,
          source: "session",
          content: snippet,
          title: `${rule.titlePrefix}: ${snippet.slice(0, 60).replace(/\n/g, " ")}...`,
          frequency: 1,
          lastSeen: now,
          firstSeen: now,
          confidence: 0.4,  // New patterns start with low confidence
          chainLinks: [],
          cmndChains: CATEGORY_CHAIN_MAP[rule.category] ?? ["chain-2-knowledge-compound"],
        });
      }
    }

    return extracted;
  }

  /**
   * Finds compound insights from a set of patterns using transitive chain logic:
   * (A → B) + (B → C) = (A → C)
   *
   * @param patterns  Patterns to analyze for compound relationships
   * @returns         Array of compound insight strings
   */
  async compound(patterns: Pattern[]): Promise<string[]> {
    if (patterns.length < 2) return [];

    const insights: string[] = [];
    const patternMap = new Map<string, Pattern>(patterns.map((p) => [p.id, p]));

    // Build the direct link graph: pattern A chains to pattern B
    const graph: Map<string, Set<string>> = new Map();
    for (const p of patterns) {
      if (!graph.has(p.id)) graph.set(p.id, new Set());
      for (const link of p.chainLinks) {
        if (patternMap.has(link)) {
          graph.get(p.id)!.add(link);
        }
      }
    }

    // BFS/DFS to find indirect chains: A → B → C implies A → C
    for (const startId of graph.keys()) {
      const visited = new Set<string>([startId]);
      const queue: Array<{ id: string; path: string[] }> = [{ id: startId, path: [startId] }];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = graph.get(current.id) ?? new Set<string>();

        for (const neighborId of neighbors) {
          if (visited.has(neighborId)) continue;
          visited.add(neighborId);

          const fullPath = [...current.path, neighborId];

          // A transitive chain of length >= 3 is a compound insight
          if (fullPath.length >= 3) {
            const pathPatterns = fullPath.map((id) => patternMap.get(id)!).filter(Boolean);
            const titles = pathPatterns.map((p) => p.title);
            const insight = `Compound chain: ${titles.join(" → ")} (transitive link: ${patternMap.get(startId)!.title} → ${patternMap.get(neighborId)!.title})`;
            insights.push(insight);
          }

          queue.push({ id: neighborId, path: fullPath });
        }
      }
    }

    // Also look for semantic similarity clusters that suggest compound relationships
    // even without explicit chainLinks
    for (let i = 0; i < patterns.length; i++) {
      for (let j = i + 1; j < patterns.length; j++) {
        const a = patterns[i];
        const b = patterns[j];
        if (a.chainLinks.includes(b.id) || b.chainLinks.includes(a.id)) continue; // already handled

        const sim = keywordSimilarity(a.content, b.content);
        if (sim > 0.6) {
          insights.push(
            `Implicit compound: "${a.title}" and "${b.title}" share ${Math.round(sim * 100)}% semantic overlap — consider linking as a unified pattern.`
          );
        }
      }
    }

    // Deduplicate
    return [...new Set(insights)].slice(0, 20);
  }

  /**
   * Suggests actions based on patterns matching the given context.
   * Returns prioritized action strings ordered by pattern confidence × similarity.
   *
   * @param context  Current situation or task description
   * @returns        Array of suggested action strings
   */
  async suggest(context: string): Promise<string[]> {
    const matches = await this.recognize(context);

    if (matches.length === 0) {
      return [
        "No pattern matches found — this may be a novel situation. Extract patterns after resolution.",
        "Consider running: patternEngine.extract([conversation]) to capture insights from this session.",
      ];
    }

    const suggestions: string[] = [];

    for (const match of matches.slice(0, 5)) {
      const { pattern, similarity, actionRecommendation } = match;
      const confidenceLabel = pattern.confidence >= 0.8 ? "HIGH CONFIDENCE" :
                              pattern.confidence >= 0.6 ? "medium confidence" : "low confidence";

      suggestions.push(
        `[${confidenceLabel}, ${Math.round(similarity * 100)}% match] ${actionRecommendation} (from: "${pattern.title}")`
      );
    }

    // If high-confidence match exists, surface the compound chain
    const highConf = matches.find((m) => m.similarity >= HIGH_CONFIDENCE_THRESHOLD);
    if (highConf && highConf.pattern.chainLinks.length > 0) {
      const linkedPatterns = highConf.pattern.chainLinks
        .map((id) => this.patterns.find((p) => p.id === id))
        .filter((p): p is Pattern => p !== undefined);

      if (linkedPatterns.length > 0) {
        suggestions.push(
          `Cascade opportunity: "${highConf.pattern.title}" chains to: ${linkedPatterns.map((p) => p.title).join(", ")} — execute all for maximum compound effect.`
        );
      }
    }

    return suggestions;
  }

  /**
   * Saves a pattern to both the local file and ChromaDB.
   * If the pattern already exists (same id), updates it — incrementing frequency and
   * adjusting confidence based on repeated observation.
   *
   * @param pattern  Pattern to save
   */
  savePattern(pattern: Pattern): void {
    this.reload();

    const existingIndex = this.patterns.findIndex((p) => p.id === pattern.id);

    if (existingIndex >= 0) {
      // Update existing: increment frequency, recalculate confidence, update lastSeen
      const existing = this.patterns[existingIndex];
      const newFrequency = existing.frequency + 1;
      // Confidence grows logarithmically with frequency, capped at 0.99
      const newConfidence = Math.min(0.99, 0.4 + 0.15 * Math.log2(newFrequency));

      this.patterns[existingIndex] = {
        ...existing,
        ...pattern,
        frequency: newFrequency,
        confidence: newConfidence,
        lastSeen: new Date().toISOString(),
      };
    } else {
      // New pattern
      this.patterns.push({
        ...pattern,
        firstSeen: pattern.firstSeen ?? new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      });
    }

    savePatternsToFile(this.patterns);

    // Async upsert to ChromaDB — do not await to keep savePattern() synchronous
    this.upsertToChromaDB(pattern).catch((err) => {
      console.warn("[pattern-engine] ChromaDB upsert failed (non-fatal):", err);
    });
  }

  /**
   * Builds a cascade chain starting from a seed pattern.
   * Follows chainLinks transitively, returning all reachable patterns in BFS order.
   * This surfaces the compound (A → B → C) chains for a given starting pattern.
   *
   * @param seed    The starting pattern
   * @returns       All patterns reachable from the seed via chainLinks
   */
  async buildCascade(seed: Pattern): Promise<Pattern[]> {
    this.reload();
    const patternMap = new Map<string, Pattern>(this.patterns.map((p) => [p.id, p]));
    const cascade: Pattern[] = [];
    const visited = new Set<string>([seed.id]);
    const queue: Pattern[] = [seed];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const linkId of current.chainLinks) {
        if (visited.has(linkId)) continue;
        visited.add(linkId);

        const linked = patternMap.get(linkId);
        if (linked) {
          cascade.push(linked);
          queue.push(linked);
        }
      }
    }

    // Also include patterns found via semantic similarity that share chainLinks with the seed
    const semanticNeighbors = this.patterns
      .filter((p) => !visited.has(p.id))
      .filter((p) => keywordSimilarity(p.content, seed.content) > 0.55)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    cascade.push(...semanticNeighbors);

    return cascade;
  }

  /**
   * Returns the top N patterns by confidence, optionally filtered by category.
   */
  getTopPatterns(n = 10, category?: string): Pattern[] {
    this.reload();
    const filtered = category
      ? this.patterns.filter((p) => p.category === category)
      : this.patterns;
    return filtered.sort((a, b) => b.confidence - a.confidence).slice(0, n);
  }

  /**
   * Returns all patterns, optionally filtered by category and minimum confidence.
   */
  getPatterns(options: { category?: string; minConfidence?: number } = {}): Pattern[] {
    this.reload();
    return this.patterns.filter((p) => {
      if (options.category && p.category !== options.category) return false;
      if (options.minConfidence !== undefined && p.confidence < options.minConfidence) return false;
      return true;
    });
  }

  /**
   * Links two patterns together bidirectionally.
   * This enables the cascade and compound logic to traverse the relationship.
   */
  linkPatterns(idA: string, idB: string): void {
    this.reload();

    const a = this.patterns.find((p) => p.id === idA);
    const b = this.patterns.find((p) => p.id === idB);

    if (!a || !b) {
      throw new Error(`[pattern-engine] Cannot link: one or both pattern IDs not found (${idA}, ${idB})`);
    }

    if (!a.chainLinks.includes(idB)) a.chainLinks.push(idB);
    if (!b.chainLinks.includes(idA)) b.chainLinks.push(idA);

    savePatternsToFile(this.patterns);
  }

  // ── Private: ChromaDB Integration ─────────────────────────────────────

  /**
   * Queries ChromaDB for patterns semantically similar to the input.
   * Returns empty array if ChromaDB is unreachable (graceful degradation).
   */
  private async embedAndSearch(text: string): Promise<PatternMatch[]> {
    const reachable = await isChromaDBReachable();
    if (!reachable) return [];

    try {
      await ensureCollection();

      // Use ChromaDB's built-in embedding for the query
      const queryPayload = {
        query_texts: [text],
        n_results: 10,
        include: ["documents", "metadatas", "distances"],
      };

      const res = await fetchWithTimeout(
        `${CHROMADB_BASE}/api/v1/collections/${CHROMADB_COLLECTION}/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryPayload),
        }
      );

      if (!res.ok) return [];

      const data = (await res.json()) as ChromaQueryResult;

      if (!data.ids?.[0]?.length) return [];

      const matches: PatternMatch[] = [];
      for (let i = 0; i < data.ids[0].length; i++) {
        const id = data.ids[0][i];
        const distance = data.distances[0][i];
        // ChromaDB returns L2 distance or cosine distance (0 = identical, 2 = opposite for cosine)
        const similarity = Math.max(0, 1 - distance / 2);

        if (similarity < MIN_SIMILARITY_THRESHOLD) continue;

        // Find the matching pattern in our local store
        const pattern = this.patterns.find((p) => p.id === id);
        if (!pattern) continue;

        matches.push({
          pattern,
          similarity,
          actionRecommendation: this.buildActionRecommendation(pattern, similarity),
        });
      }

      return matches;
    } catch {
      return [];
    }
  }

  /**
   * Upserts a pattern's content into ChromaDB.
   */
  private async upsertToChromaDB(pattern: Pattern): Promise<void> {
    const reachable = await isChromaDBReachable();
    if (!reachable) return;

    try {
      await ensureCollection();

      const upsertPayload = {
        ids: [pattern.id],
        documents: [pattern.content + " " + pattern.title],
        metadatas: [
          {
            category: pattern.category,
            source: pattern.source,
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            lastSeen: pattern.lastSeen,
          },
        ],
      };

      await fetchWithTimeout(
        `${CHROMADB_BASE}/api/v1/collections/${CHROMADB_COLLECTION}/upsert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(upsertPayload),
        }
      );
    } catch {
      // Non-fatal — local file is the source of truth
    }
  }

  // ── Private: Action Recommendation Builder ─────────────────────────────

  private buildActionRecommendation(pattern: Pattern, similarity: number): string {
    if (pattern.suggestedAction) {
      return pattern.suggestedAction;
    }

    const chainLabel = (pattern.cmndChains ?? []).slice(0, 1)
      .map((c) => c.replace("chain-", "Chain ").replace(/-/g, " "))
      .join("");

    if (similarity >= HIGH_CONFIDENCE_THRESHOLD) {
      return `HIGH MATCH: Reuse existing solution from "${pattern.title}" (confidence ${Math.round(pattern.confidence * 100)}%). ${chainLabel ? `Feeds into: ${chainLabel}.` : ""}`;
    }

    if (pattern.category === "failures") {
      return `AVOID: This matches a known failure pattern — "${pattern.title}". Root cause: ${pattern.content.slice(0, 100)}`;
    }

    if (pattern.category === "solutions") {
      return `Adapt solution: "${pattern.title}" — may partially apply to current context.`;
    }

    return `Consider pattern "${pattern.title}" — ${Math.round(similarity * 100)}% overlap with current task.`;
  }
}

// ── Singleton Export ───────────────────────────────────────────────────────

/**
 * Singleton instance of the pattern engine.
 * Import this throughout the system — do not instantiate PatternEngine directly.
 *
 * Usage:
 *   import { patternEngine } from "./pattern-engine";
 *   const matches = await patternEngine.recognize("build a REST API");
 *   patternEngine.savePattern(newPattern);
 */
export const patternEngine = new PatternEngine();
