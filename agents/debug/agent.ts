/**
 * Debug Agent — Claude Architect OS
 * Isolates failures, traces bugs, proposes permanent fixes.
 * Uses root-cause-analyst pattern from 37-agent registry.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Debug Agent for CMNDCENTER — an adversarial root-cause analyst.
You do not patch symptoms. You find the permanent fix.
Always output: root cause → why it happened → permanent fix → prevention rule → pattern to save.`;

export async function debugIssue(issue: string, context?: string): Promise<{
  rootCause: string;
  whyItHappened: string;
  permanentFix: string;
  preventionRule: string;
  codefix?: string;
}> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Issue: ${issue}\n${context ? `Context:\n${context}` : ""}

Output JSON: {
  "rootCause": "...",
  "whyItHappened": "...",
  "permanentFix": "step-by-step fix",
  "preventionRule": "rule to prevent recurrence",
  "codefix": "code snippet if applicable"
}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { rootCause: "Unknown", whyItHappened: "Analysis failed", permanentFix: "Retry with more context", preventionRule: "Add logging" };
}

if (require.main === module) {
  const issue = process.argv.slice(2).join(" ");
  if (!issue) { console.log("Usage: ts-node agents/debug/agent.ts <issue description>"); process.exit(1); }
  debugIssue(issue).then((result) => {
    console.log("\n🔍 Debug Analysis:");
    console.log(`Root Cause: ${result.rootCause}`);
    console.log(`Why: ${result.whyItHappened}`);
    console.log(`Fix: ${result.permanentFix}`);
    console.log(`Prevention: ${result.preventionRule}`);
    if (result.codefix) console.log(`\nCode Fix:\n${result.codefix}`);
  });
}
