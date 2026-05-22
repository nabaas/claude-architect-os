/**
 * Memory Agent — Claude Architect OS
 * Stores successful patterns, retrieves context, updates embeddings.
 * Feeds: Chain 2 (Knowledge Compounding), Chain 3 (Auto-Upgrade)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();
const MEMORY_DIR = path.join(process.env.HOME!, ".amsa/memory");
const PATTERNS_FILE = path.join(MEMORY_DIR, "patterns.json");
const CHROMA_URL = "http://localhost:8000";

export interface Memory {
  id: string;
  content: string;
  type: "solution" | "prompt" | "tool_chain" | "failure" | "market_signal" | "architecture";
  confidence: number;
  useCount: number;
  chainLinks: string[];
  savedAt: string;
}

// ─── Store a memory ───────────────────────────────────────────────────────────

export function store(content: string, type: Memory["type"], confidence = 0.8): string {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const patterns: Memory[] = fs.existsSync(PATTERNS_FILE)
    ? JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8"))
    : [];

  const memory: Memory = {
    id: `mem-${Date.now()}`,
    content: content.slice(0, 1000),
    type,
    confidence,
    useCount: 0,
    chainLinks: [],
    savedAt: new Date().toISOString(),
  };

  patterns.push(memory);
  fs.writeFileSync(PATTERNS_FILE, JSON.stringify(patterns.slice(-200), null, 2));

  // Async ChromaDB upsert (fire and forget)
  fetch(`${CHROMA_URL}/api/v1/collections/claude-architect-os/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids: [memory.id],
      documents: [memory.content],
      metadatas: [{ type: memory.type, confidence: memory.confidence, savedAt: memory.savedAt }],
    }),
  }).catch(() => { /* ChromaDB may not be running */ });

  return memory.id;
}

// ─── Retrieve relevant memories ───────────────────────────────────────────────

export async function retrieve(query: string, limit = 5): Promise<Memory[]> {
  // Try ChromaDB first
  try {
    const res = await fetch(`${CHROMA_URL}/api/v1/collections/claude-architect-os/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query_texts: [query], n_results: limit }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const ids: string[] = data.ids?.[0] || [];
      if (ids.length > 0) {
        const all = fs.existsSync(PATTERNS_FILE) ? JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")) : [];
        return all.filter((m: Memory) => ids.includes(m.id));
      }
    }
  } catch { /* fall through to local search */ }

  // Fallback: keyword search in patterns.json
  const patterns: Memory[] = fs.existsSync(PATTERNS_FILE) ? JSON.parse(fs.readFileSync(PATTERNS_FILE, "utf-8")) : [];
  const words = query.toLowerCase().split(/\s+/);
  return patterns
    .filter((m) => words.some((w) => m.content.toLowerCase().includes(w)))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

// ─── Build context block for injection ───────────────────────────────────────

export async function buildContext(query: string): Promise<string> {
  const memories = await retrieve(query);
  if (memories.length === 0) return "";
  const lines = memories.map((m) => `- [${m.type}] ${m.content.slice(0, 150)}`).join("\n");
  return `<prior_context>\n${lines}\n</prior_context>`;
}

// ─── Extract and store from Claude conversation ───────────────────────────────

export async function extractAndStore(conversation: string): Promise<number> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Extract 1-3 high-value patterns from this conversation worth remembering:

${conversation.slice(0, 2000)}

Output JSON array: [{"content": "pattern description", "type": "solution|prompt|tool_chain|failure|market_signal|architecture", "confidence": 0-1}]`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return 0;
    const patterns = JSON.parse(match[0]);
    patterns.forEach((p: { content: string; type: Memory["type"]; confidence: number }) =>
      store(p.content, p.type, p.confidence)
    );
    return patterns.length;
  } catch { return 0; }
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === "store") store(process.argv.slice(3).join(" "), "solution");
  else if (cmd === "retrieve") retrieve(process.argv.slice(3).join(" ")).then((m) => m.forEach((r) => console.log(`[${r.type}] ${r.content}`)));
  else if (cmd === "context") buildContext(process.argv.slice(3).join(" ")).then(console.log);
}
