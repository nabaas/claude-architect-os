/**
 * middleware-router.ts
 * Routes tasks to the best AI model based on task type.
 * Claude handles coding, research, and long-context tasks.
 * Ollama handles fast/local tasks with sub-100ms cold start requirements.
 * Falls back to Claude if routing or Ollama execution fails.
 */

import { queryClaude } from "./claude-integration";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskType =
  | "coding"
  | "fast"
  | "research"
  | "local"
  | "long-context"
  | "analysis"
  | "creative";

export type ModelProvider = "claude" | "ollama";

export interface RoutingDecision {
  provider: ModelProvider;
  model: string;
  reason: string;
}

export interface RouterOptions {
  /** Override the Ollama model. Defaults to hermes3. */
  ollamaModel?: string;
  /** Ollama base URL. Defaults to http://localhost:11434 */
  ollamaBaseUrl?: string;
  /** Maximum tokens for the response */
  maxTokens?: number;
  /** System prompt override */
  systemPrompt?: string;
}

// ── Routing table ──────────────────────────────────────────────────────────

const ROUTING_TABLE: Record<TaskType, RoutingDecision> = {
  coding: {
    provider: "claude",
    model: "claude-sonnet-4-6",
    reason: "Claude has superior code generation and reasoning for complex code tasks",
  },
  fast: {
    provider: "ollama",
    model: "hermes3",
    reason: "Ollama runs locally for sub-second responses on simple tasks",
  },
  research: {
    provider: "claude",
    model: "claude-sonnet-4-6",
    reason: "Claude handles long research synthesis and multi-step reasoning",
  },
  local: {
    provider: "ollama",
    model: "gemma3:4b",
    reason: "Local model ensures no data leaves the machine for sensitive tasks",
  },
  "long-context": {
    provider: "claude",
    model: "claude-sonnet-4-6",
    reason: "Claude supports 200k token context for large document processing",
  },
  analysis: {
    provider: "claude",
    model: "claude-sonnet-4-6",
    reason: "Claude excels at deep analytical reasoning and structured output",
  },
  creative: {
    provider: "claude",
    model: "claude-sonnet-4-6",
    reason: "Claude handles creative writing and ideation with high quality",
  },
};

// ── Ollama client ──────────────────────────────────────────────────────────

async function queryOllama(
  prompt: string,
  model: string,
  baseUrl: string,
  systemPrompt?: string
): Promise<string> {
  const url = `${baseUrl}/api/generate`;

  const body = {
    model,
    prompt,
    stream: false,
    ...(systemPrompt ? { system: systemPrompt } : {}),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { response?: string; error?: string };

  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }

  return data.response ?? "";
}

async function isOllamaRunning(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ── Main router ────────────────────────────────────────────────────────────

/**
 * Routes a task to the best model and returns the response.
 * Falls back to Claude if the preferred provider is unavailable.
 *
 * @param task     The user task or prompt text
 * @param type     Task type key used to select provider
 * @param options  Optional overrides for model selection and prompting
 */
export async function routeTask(
  task: string,
  type: TaskType,
  options: RouterOptions = {}
): Promise<string> {
  const decision = ROUTING_TABLE[type];
  const ollamaBaseUrl = options.ollamaBaseUrl ?? "http://localhost:11434";
  const ollamaModel = options.ollamaModel ?? decision.model;

  if (decision.provider === "ollama") {
    const running = await isOllamaRunning(ollamaBaseUrl);

    if (running) {
      try {
        const result = await queryOllama(
          task,
          ollamaModel,
          ollamaBaseUrl,
          options.systemPrompt
        );
        return result;
      } catch (err) {
        console.warn(
          `[middleware-router] Ollama failed (${(err as Error).message}), falling back to Claude`
        );
      }
    } else {
      console.warn(
        `[middleware-router] Ollama not running at ${ollamaBaseUrl}, falling back to Claude`
      );
    }
  }

  // Claude path (direct or fallback)
  const claudeModel = decision.provider === "claude" ? decision.model : "claude-sonnet-4-6";

  return queryClaude(task, options.systemPrompt, claudeModel, {
    maxTokens: options.maxTokens,
    enableCaching: true,
  });
}

/**
 * Returns the routing decision for a task type without executing it.
 * Useful for UI display or pre-flight checks.
 */
export function getRoutingDecision(type: TaskType): RoutingDecision {
  return { ...ROUTING_TABLE[type] };
}

/**
 * Auto-detects the best TaskType from a natural language task string.
 * Uses keyword heuristics before calling the router.
 *
 * @param task  Natural language task description
 */
export function detectTaskType(task: string): TaskType {
  const t = task.toLowerCase();

  if (/\b(code|implement|function|class|bug|refactor|typescript|python|rust)\b/.test(t)) {
    return "coding";
  }
  if (/\b(research|survey|compare|explain|deep.?dive|literature)\b/.test(t)) {
    return "research";
  }
  if (/\b(summarize|analyze|analyse|breakdown|report|review)\b/.test(t)) {
    return "analysis";
  }
  if (/\b(quick|fast|simple|short|one.?liner|snippet|tldr)\b/.test(t)) {
    return "fast";
  }
  if (/\b(local|private|sensitive|offline|no.?internet)\b/.test(t)) {
    return "local";
  }
  if (task.length > 3000) {
    return "long-context";
  }
  if (/\b(write|story|creative|poem|name|brand|slogan)\b/.test(t)) {
    return "creative";
  }

  // Default to research for unknown tasks
  return "research";
}

/**
 * Convenience wrapper: auto-detects task type then routes.
 *
 * @param task     Natural language task
 * @param options  Optional router overrides
 */
export async function autoRoute(
  task: string,
  options: RouterOptions = {}
): Promise<{ result: string; decision: RoutingDecision }> {
  const type = detectTaskType(task);
  const decision = getRoutingDecision(type);
  const result = await routeTask(task, type, options);
  return { result, decision };
}
