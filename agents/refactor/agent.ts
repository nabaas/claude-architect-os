/**
 * Refactor Agent — Claude Architect OS
 * Modularizes architecture, reduces complexity, extracts reusable patterns.
 * Feeds: Chain 2 (Knowledge Compounding), Chain 3 (Auto-Upgrade)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Refactor Agent for CMNDCENTER — a code quality and architecture specialist.
You reduce complexity, extract patterns, eliminate duplication, and harden interfaces.
Every refactor: before complexity → after complexity → extracted patterns → ROI of change.
Priority order: (1) extract reusable utilities, (2) remove duplication, (3) improve naming, (4) reduce nesting.`;

export interface RefactorResult {
  id: string;
  file: string;
  originalComplexity: number;
  refactoredComplexity: number;
  extractedPatterns: string[];
  changes: RefactorChange[];
  roiScore: number;
  patternToSave?: string;
}

export interface RefactorChange {
  type: "extract" | "rename" | "simplify" | "deduplicate" | "decompose";
  description: string;
  before: string;
  after: string;
}

export async function analyzeAndRefactor(
  code: string,
  filePath: string,
  context?: string
): Promise<RefactorResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Analyze and refactor this code from: ${filePath}
${context ? `\nContext: ${context}` : ""}

\`\`\`typescript
${code.slice(0, 3000)}
\`\`\`

Output JSON: {
  "originalComplexity": 1-10,
  "refactoredComplexity": 1-10,
  "extractedPatterns": ["pattern descriptions"],
  "changes": [{
    "type": "extract|rename|simplify|deduplicate|decompose",
    "description": "what changed and why",
    "before": "original code snippet",
    "after": "improved code snippet"
  }],
  "roiScore": 0-100,
  "patternToSave": "reusable pattern description if found"
}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    const raw = JSON.parse(match[0]);
    const result: RefactorResult = {
      id: `refactor-${Date.now()}`,
      file: filePath,
      originalComplexity: Number(raw.originalComplexity) || 5,
      refactoredComplexity: Number(raw.refactoredComplexity) || 3,
      extractedPatterns: Array.isArray(raw.extractedPatterns) ? raw.extractedPatterns : [],
      changes: Array.isArray(raw.changes) ? raw.changes : [],
      roiScore: Number(raw.roiScore) || 50,
      patternToSave: raw.patternToSave,
    };

    // Save high-ROI refactor patterns
    if (result.patternToSave && result.roiScore >= 60) {
      const patternFile = path.join(process.env.HOME!, ".amsa/memory/patterns.json");
      const patterns = fs.existsSync(patternFile) ? JSON.parse(fs.readFileSync(patternFile, "utf-8")) : [];
      patterns.push({
        id: `pat-${Date.now()}`,
        content: result.patternToSave,
        type: "architecture",
        confidence: result.roiScore / 100,
        useCount: 0,
        chainLinks: ["chain-2", "chain-3"],
        savedAt: new Date().toISOString(),
      });
      fs.mkdirSync(path.dirname(patternFile), { recursive: true });
      fs.writeFileSync(patternFile, JSON.stringify(patterns.slice(-200), null, 2));
    }

    return result;
  } catch {
    return {
      id: `refactor-${Date.now()}`,
      file: filePath,
      originalComplexity: 5,
      refactoredComplexity: 5,
      extractedPatterns: [],
      changes: [],
      roiScore: 0,
    };
  }
}

export async function extractSharedUtility(
  codeSnippets: string[],
  utilityName: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Extract a shared utility function called "${utilityName}" from these code snippets:

${codeSnippets.map((s, i) => `// Snippet ${i + 1}:\n${s.slice(0, 500)}`).join("\n\n")}

Output: a clean, reusable TypeScript utility function with proper typing.
The function should handle edge cases and be drop-in replaceable for all snippets.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const codeMatch = text.match(/```typescript\n([\s\S]*?)```/) || text.match(/```\n([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : text.trim();
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) { console.log("Usage: ts-node agents/refactor/agent.ts <file-path>"); process.exit(1); }
  const code = fs.readFileSync(filePath, "utf-8");
  analyzeAndRefactor(code, filePath).then((result) => {
    console.log(`\n🔧 Refactor Analysis for ${result.file}:`);
    console.log(`  Complexity: ${result.originalComplexity} → ${result.refactoredComplexity}`);
    console.log(`  ROI: ${result.roiScore}`);
    console.log(`  Changes: ${result.changes.length}`);
    result.changes.forEach((c) => console.log(`    [${c.type}] ${c.description}`));
    if (result.patternToSave) console.log(`  Pattern saved: ${result.patternToSave}`);
  });
}
