/**
 * Automation Agent — Claude Architect OS
 * Converts manual tasks into automated workflows. Wires n8n, Trigger.dev, crons.
 * Feeds: Chain 3 (Auto-Upgrade), Chain 5 (Voice-to-Build), Chain 7 (Content→Revenue)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const anthropic = new Anthropic();

const N8N_BASE = "http://localhost:5678";
const SYSTEM_PROMPT = `You are the Automation Agent for CMNDCENTER — a workflow automation specialist.
You convert manual tasks into autonomous workflows using n8n, Trigger.dev, cron, and shell scripts.
Every output: trigger definition → step sequence → error handling → monitoring → ROI of automation.
You eliminate human-in-the-loop steps. You wire outputs to next inputs automatically.`;

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: "cron" | "webhook" | "file-watch" | "event" | "manual";
  triggerConfig: Record<string, unknown>;
  steps: AutomationStep[];
  errorHandling: "retry" | "alert" | "fallback" | "skip";
  monitoringUrl?: string;
  estimatedTimeSavedHours: number;
  roiScore: number;
  platform: "n8n" | "trigger-dev" | "cron" | "shell";
}

export interface AutomationStep {
  order: number;
  name: string;
  tool: string;
  action: string;
  input: Record<string, unknown>;
  output: string;
  onFailure: string;
}

export async function designAutomation(
  task: string,
  frequency: string = "daily"
): Promise<AutomationWorkflow> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
    messages: [{
      role: "user",
      content: `Design an automation workflow for: "${task}"
Frequency: ${frequency}

Available tools: n8n, Trigger.dev, cron, shell scripts, Claude API, Telegram, Supabase, GitHub API.
CMNDCENTER services: Ollama:11434, ChromaDB:8000, Supabase:54321, n8n:5678.

Output JSON: {
  "name": string,
  "trigger": "cron|webhook|file-watch|event|manual",
  "triggerConfig": { "schedule": "cron expression if cron", "url": "if webhook" },
  "steps": [{
    "order": number,
    "name": string,
    "tool": string,
    "action": string,
    "input": {},
    "output": "what this step produces",
    "onFailure": "what to do if this step fails"
  }],
  "errorHandling": "retry|alert|fallback|skip",
  "estimatedTimeSavedHours": number,
  "roiScore": 0-100,
  "platform": "n8n|trigger-dev|cron|shell"
}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");

    const raw = JSON.parse(match[0]);
    return {
      id: `automation-${Date.now()}`,
      name: String(raw.name || task.slice(0, 50)),
      trigger: raw.trigger || "cron",
      triggerConfig: raw.triggerConfig || {},
      steps: Array.isArray(raw.steps) ? raw.steps : [],
      errorHandling: raw.errorHandling || "alert",
      estimatedTimeSavedHours: Number(raw.estimatedTimeSavedHours) || 1,
      roiScore: Number(raw.roiScore) || 50,
      platform: raw.platform || "n8n",
    };
  } catch {
    return {
      id: `automation-${Date.now()}`,
      name: task.slice(0, 50),
      trigger: "manual",
      triggerConfig: {},
      steps: [],
      errorHandling: "alert",
      estimatedTimeSavedHours: 0,
      roiScore: 0,
      platform: "shell",
    };
  }
}

export async function generateN8nWorkflow(workflow: AutomationWorkflow): Promise<Record<string, unknown>> {
  const nodes = workflow.steps.map((step, index) => ({
    id: `node-${index}`,
    name: step.name,
    type: step.tool.includes("http") ? "n8n-nodes-base.httpRequest" : "n8n-nodes-base.code",
    position: [index * 220, 240],
    parameters: {
      ...step.input,
      action: step.action,
    },
  }));

  return {
    name: workflow.name,
    nodes,
    connections: {},
    active: false,
    settings: { errorWorkflow: workflow.errorHandling === "alert" ? "alert-workflow" : "" },
  };
}

export async function triggerN8nWebhook(workflowName: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${N8N_BASE}/webhook/${workflowName.toLowerCase().replace(/\s+/g, "-")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch { return false; }
}

export async function detectManualTasks(sessionLog: string): Promise<string[]> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Identify repeating manual tasks in this session log that could be automated:

${sessionLog.slice(0, 2000)}

Output JSON array of task descriptions (max 5): ["task 1", "task 2", ...]`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

if (require.main === module) {
  const task = process.argv.slice(2).join(" ") || "daily market scan and opportunity alert";
  designAutomation(task).then((workflow) => {
    console.log(`\n⚡ Automation designed for: "${task}"`);
    console.log(`  Platform: ${workflow.platform} | Trigger: ${workflow.trigger}`);
    console.log(`  Steps: ${workflow.steps.length} | Time saved: ${workflow.estimatedTimeSavedHours}h/run`);
    console.log(`  ROI: ${workflow.roiScore}`);
    workflow.steps.forEach((s) => console.log(`    ${s.order}. [${s.tool}] ${s.name}: ${s.action}`));

    // Write to queue if high ROI
    if (workflow.roiScore >= 60) {
      const queueDir = path.join(process.env.HOME!, ".amsa/linear-queue");
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(
        path.join(queueDir, `automation-${Date.now()}.json`),
        JSON.stringify(workflow, null, 2)
      );
      console.log("  → Written to linear-queue (ROI >= 60)");
    }
  });
}
