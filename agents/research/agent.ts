/**
 * Research Agent — Claude Architect OS
 * Multi-source intelligence gathering, synthesis, and actionable briefings.
 * Uses claude-opus-4-7 for deep analysis. Feeds: Chain 1, Chain 2, Chain 4.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Research Agent for CMNDCENTER — a multi-source intelligence specialist.
You synthesize information from diverse sources into actionable briefings.
Every output: key findings → opportunity score → recommended action → time sensitivity.
You filter signal from noise. You surface asymmetric information advantages.`;

export interface ResearchFinding {
  id: string;
  topic: string;
  summary: string;
  keyInsights: string[];
  opportunityScore: number; // 0-1
  actionRequired: string;
  timeSensitivity: "immediate" | "24h" | "week" | "evergreen";
  sources: string[];
  chainRelevance: number[]; // which chains (1-7) this finding feeds
  savedAt: string;
}

export async function research(
  query: string,
  depth: "quick" | "standard" | "deep" = "standard"
): Promise<ResearchFinding[]> {
  const model = depth === "deep" ? "claude-opus-4-7" : "claude-sonnet-4-6";
  const maxTokens = depth === "deep" ? 4096 : 2048;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Research query: "${query}"
Depth: ${depth}

Synthesize findings from your training knowledge. Identify:
- Market signals and asymmetric opportunities
- Technical capabilities that could be leveraged
- Gaps in current tools/solutions
- Time-sensitive information

Output JSON array: [{
  "topic": string,
  "summary": "2-3 sentence synthesis",
  "keyInsights": ["3-5 actionable insights"],
  "opportunityScore": 0-1,
  "actionRequired": "specific next action",
  "timeSensitivity": "immediate|24h|week|evergreen",
  "sources": ["source types/categories consulted"],
  "chainRelevance": [1,2,3,4,5,6,7] (which CMNDCENTER chains this feeds)
}]`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const raw = JSON.parse(match[0]);
    const findings: ResearchFinding[] = raw.map((r: Record<string, unknown>, i: number): ResearchFinding => ({
      id: `research-${Date.now()}-${i}`,
      topic: String(r.topic || query),
      summary: String(r.summary || ""),
      keyInsights: Array.isArray(r.keyInsights) ? r.keyInsights.map(String) : [],
      opportunityScore: Math.min(Math.max(Number(r.opportunityScore) || 0, 0), 1),
      actionRequired: String(r.actionRequired || ""),
      timeSensitivity: (["immediate", "24h", "week", "evergreen"].includes(r.timeSensitivity as string)
        ? r.timeSensitivity : "week") as ResearchFinding["timeSensitivity"],
      sources: Array.isArray(r.sources) ? r.sources.map(String) : [],
      chainRelevance: Array.isArray(r.chainRelevance) ? r.chainRelevance.map(Number) : [],
      savedAt: new Date().toISOString(),
    }));

    // Save high-value findings to queue
    const highValue = findings.filter((f) => f.opportunityScore > 0.6);
    if (highValue.length > 0) {
      const queueDir = path.join(process.env.HOME!, ".amsa/linear-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      const file = path.join(queueDir, `research-${new Date().toISOString().split("T")[0]}.json`);
      fs.writeFileSync(file, JSON.stringify(highValue, null, 2));
    }

    return findings;
  } catch { return []; }
}

export async function synthesizeResearch(findings: ResearchFinding[]): Promise<string> {
  if (findings.length === 0) return "No findings to synthesize.";

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Synthesize these ${findings.length} research findings into a 3-paragraph executive briefing.
Lead with the highest-opportunity finding. Close with the single most important action.

Findings: ${JSON.stringify(findings.map((f) => ({ topic: f.topic, summary: f.summary, score: f.opportunityScore, action: f.actionRequired })))}`,
    }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "Synthesis failed.";
}

if (require.main === module) {
  const query = process.argv.slice(2).join(" ") || "AI automation tools and arbitrage opportunities";
  const depth = (process.env.DEPTH as "quick" | "standard" | "deep") || "standard";
  research(query, depth).then(async (findings) => {
    console.log(`\n🔬 Research Agent: ${findings.length} findings for "${query}":\n`);
    findings.forEach((f) => {
      console.log(`  [${(f.opportunityScore * 100).toFixed(0)}%] ${f.topic}`);
      console.log(`    ${f.summary.slice(0, 100)}`);
      console.log(`    Action: ${f.actionRequired}\n`);
    });
    if (findings.length > 1) {
      const briefing = await synthesizeResearch(findings);
      console.log("\n📋 Executive Briefing:\n" + briefing);
    }
  });
}
