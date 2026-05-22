/**
 * Execution Router — Claude Architect OS
 * Central dispatch: classifies any request → routes to optimal tool/agent/chain.
 * This is the operative brain of the decision protocol defined in CLAUDE.md lines 7-10.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as path from "path";
import * as fs from "fs";

const anthropic = new Anthropic();

export type ExecutionRoute =
  | "loki"           // 37-agent full product build
  | "scout"          // opportunity scanning
  | "research"       // deep research / claude-opus
  | "code"           // coding task / claude-sonnet
  | "trade"          // IntelliTradeX execution
  | "content"        // WAND content pipeline
  | "deploy"         // GitHub deploy
  | "monitor"        // system health / gap-bridge
  | "memory"         // pattern save / context load
  | "automate"       // n8n workflow creation
  | "analyze"        // code/system analysis
  | "design"         // architecture/API design
  | "orchestrate";   // multi-agent coordination

export interface RouteDecision {
  route: ExecutionRoute;
  agent?: string;
  chain?: number;
  model: string;
  confidence: number;
  lokiArgs?: string;
  rationale: string;
  roiEstimate: number;
}

// ─── Keyword-based fast routing (no LLM needed) ──────────────────────────────

const FAST_ROUTES: Array<{ patterns: RegExp[]; route: ExecutionRoute; model: string; chain?: number }> = [
  { patterns: [/\bbuild\b.*\b(app|tool|api|service|bot|product|saas|cli)\b/i, /\bloki\b/i], route: "loki", model: "claude-sonnet-4-6", chain: 1 },
  { patterns: [/\b(opportunity|arbitrage|flip|scout|signal|profit)\b/i], route: "scout", model: "claude-sonnet-4-6", chain: 1 },
  { patterns: [/\b(trade|buy|sell|crypto|bitcoin|binance|alpaca)\b/i], route: "trade", model: "ollama/hermes3", chain: 6 },
  { patterns: [/\b(content|video|youtube|wand|script|thumbnail)\b/i], route: "content", model: "claude-sonnet-4-6", chain: 7 },
  { patterns: [/\b(deploy|push|github|release|publish)\b/i], route: "deploy", model: "claude-sonnet-4-6", chain: 4 },
  { patterns: [/\b(research|analyze|explain|deep.dive|investigate)\b/i], route: "research", model: "claude-opus-4-7", chain: 2 },
  { patterns: [/\b(fix|debug|bug|error|broken|failing)\b/i], route: "code", model: "claude-sonnet-4-6" },
  { patterns: [/\b(automate|workflow|trigger|n8n|webhook|schedule)\b/i], route: "automate", model: "claude-sonnet-4-6", chain: 1 },
  { patterns: [/\b(health|status|monitor|check|services|gap)\b/i], route: "monitor", model: "ollama/hermes3" },
  { patterns: [/\b(design|architect|schema|api|database|system)\b/i], route: "design", model: "claude-opus-4-7", chain: 2 },
  { patterns: [/\b(remember|memory|pattern|save|recall|context)\b/i], route: "memory", model: "ollama/hermes3", chain: 2 },
];

export function fastRoute(request: string): RouteDecision | null {
  for (const rule of FAST_ROUTES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(request)) {
        return {
          route: rule.route,
          model: rule.model,
          chain: rule.chain,
          confidence: 0.85,
          rationale: `Keyword match: ${pattern.source}`,
          roiEstimate: estimateROI(rule.route),
        };
      }
    }
  }
  return null;
}

// ─── LLM-powered routing for ambiguous requests ──────────────────────────────

export async function smartRoute(request: string): Promise<RouteDecision> {
  const fast = fastRoute(request);
  if (fast && fast.confidence >= 0.85) return fast;

  const systemPrompt = `You are the execution router for CMNDCENTER — an AI operating system.
Route requests to the optimal execution path. Respond only with valid JSON.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001", // cheapest model for routing
    max_tokens: 256,
    system: systemPrompt,
    messages: [{
      role: "user",
      content: `Route this request: "${request}"

Routes: loki|scout|research|code|trade|content|deploy|monitor|memory|automate|analyze|design|orchestrate
Models: claude-sonnet-4-6|claude-opus-4-7|ollama/hermes3|ollama/gemma3:4b
Chains: 1=Signal→Profit 2=Knowledge 3=Upgrade 4=RepoIntel 5=VoiceBuild 6=Arbitrage 7=Content

JSON: {"route": string, "model": string, "chain": number|null, "confidence": 0-1, "rationale": string, "roiEstimate": 0-100}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? { ...JSON.parse(match[0]) } : (fast || defaultRoute(request));
  } catch {
    return fast || defaultRoute(request);
  }
}

// ─── Route Executor ───────────────────────────────────────────────────────────

export async function executeRoute(decision: RouteDecision, request: string): Promise<string> {
  const { execSync } = require("child_process");
  const CMNDCENTER = process.env.HOME + "/CMNDCENTER";
  const CAO = CMNDCENTER + "/repos/claude-architect-os";

  switch (decision.route) {
    case "loki":
      try {
        return execSync(`bash "${CMNDCENTER}/loki/loki.sh" "${request.replace(/"/g, '\\"')}" 2>&1`, { timeout: 300000 }).toString();
      } catch (e: any) { return `Loki triggered: ${e.message}`; }

    case "monitor":
      try {
        return execSync(`node -e "const {healthMatrix} = require('${CAO}/system/gap-bridge'); healthMatrix().then(h => console.log(JSON.stringify(h, null, 2)))"`, { timeout: 30000 }).toString();
      } catch { return "Health check: run system/gap-bridge.ts healthMatrix() manually"; }

    case "trade":
      return `IntelliTradeX route triggered. Signal: "${request}". Check ~/.amsa/linear-queue/ for execution log.`;

    case "content":
      try {
        execSync(`curl -s -X POST http://localhost:5678/webhook/wand-trigger -H "Content-Type: application/json" -d '{"topic": "${request}"}'`);
        return `WAND content pipeline triggered for: "${request}"`;
      } catch { return "WAND trigger: POST to n8n localhost:5678/webhook/wand-trigger manually"; }

    default:
      return `Routed to ${decision.route} | Model: ${decision.model} | ROI: ${decision.roiEstimate}/100\nRequest ready for ${decision.route} handler.`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateROI(route: ExecutionRoute): number {
  const baseROI: Record<ExecutionRoute, number> = {
    loki: 85, scout: 90, trade: 80, content: 75, deploy: 70,
    research: 65, code: 60, automate: 80, monitor: 50,
    memory: 70, analyze: 60, design: 70, orchestrate: 85,
  };
  return baseROI[route] ?? 50;
}

function defaultRoute(request: string): RouteDecision {
  return { route: "code", model: "claude-sonnet-4-6", confidence: 0.5, rationale: "Default fallback", roiEstimate: 50 };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const request = process.argv.slice(2).join(" ");
  if (!request) { console.log("Usage: ts-node execution/router.ts <request>"); process.exit(1); }

  smartRoute(request).then(async (decision) => {
    console.log(`\n🔀 Route: ${decision.route.toUpperCase()} | Model: ${decision.model} | ROI: ${decision.roiEstimate}/100`);
    console.log(`   Chain: ${decision.chain ? `C${decision.chain}` : "none"} | Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    console.log(`   Rationale: ${decision.rationale}\n`);
    const result = await executeRoute(decision, request);
    console.log(result);
  });
}
