/**
 * pipeline-engine.ts
 * Automation pipeline runner for Claude Architect OS.
 * Defines pipelines as ordered steps that can be shell commands,
 * Claude queries, or arbitrary async functions.
 * Includes pre-built pipelines for common CMNDCENTER workflows.
 */

import { queryClaude } from "./claude-integration";
import { execFile } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as path from "path";

const execFileAsync = promisify(execFile);

const HOME = os.homedir();
const CMND_DIR = path.join(HOME, "CMNDCENTER");

// ── Types ──────────────────────────────────────────────────────────────────

export type StepType = "shell" | "claude" | "function";

export interface ShellStep {
  type: "shell";
  name: string;
  command: string;
  args?: string[];
  timeout?: number;
  /** If set, captures output as this variable name for template substitution in later steps */
  captureAs?: string;
  /** If true, step failure does not abort the pipeline */
  optional?: boolean;
}

export interface ClaudeStep {
  type: "claude";
  name: string;
  prompt: string | ((context: PipelineContext) => string);
  systemPrompt?: string;
  model?: string;
  captureAs?: string;
  optional?: boolean;
}

export interface FunctionStep {
  type: "function";
  name: string;
  fn: (context: PipelineContext) => Promise<string>;
  captureAs?: string;
  optional?: boolean;
}

export type PipelineStep = ShellStep | ClaudeStep | FunctionStep;

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  /** Called on each step completion with current context */
  onStepComplete?: (step: PipelineStep, output: string, context: PipelineContext) => void;
}

export interface StepResult {
  stepName: string;
  type: StepType;
  output: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export interface PipelineResult {
  pipelineId: string;
  pipelineName: string;
  success: boolean;
  steps: StepResult[];
  context: PipelineContext;
  totalDurationMs: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface PipelineContext {
  /** Accumulated output variables from captureAs steps */
  vars: Record<string, string>;
  /** Index of the current step (0-based) */
  stepIndex: number;
  /** Collected step results so far */
  results: StepResult[];
}

// ── Template substitution ──────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Step executors ─────────────────────────────────────────────────────────

async function executeShellStep(
  step: ShellStep,
  context: PipelineContext
): Promise<string> {
  const cmd = interpolate(step.command, context.vars);
  const args = (step.args ?? []).map((a) => interpolate(a, context.vars));
  const timeout = step.timeout ?? 30_000;

  const env = {
    ...process.env,
    PATH: `/Users/nadirabaas/.local/bin:/Users/nadirabaas/.nvm/versions/node/v26.1.0/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
  };

  const { stdout, stderr } = await execFileAsync(cmd, args, { timeout, env });
  return (stdout + stderr).trim();
}

async function executeClaudeStep(
  step: ClaudeStep,
  context: PipelineContext
): Promise<string> {
  const rawPrompt =
    typeof step.prompt === "function" ? step.prompt(context) : step.prompt;

  const prompt = interpolate(rawPrompt, context.vars);
  const systemPrompt = step.systemPrompt
    ? interpolate(step.systemPrompt, context.vars)
    : undefined;

  return queryClaude(prompt, systemPrompt, step.model, { enableCaching: true });
}

async function executeFunctionStep(
  step: FunctionStep,
  context: PipelineContext
): Promise<string> {
  return step.fn(context);
}

// ── Pipeline executor ──────────────────────────────────────────────────────

/**
 * Executes a pipeline sequentially, collecting results and context.
 * On step failure: if step.optional is true, records error and continues.
 * Otherwise, aborts and returns partial results with success=false.
 */
export async function executePipeline(pipeline: Pipeline): Promise<PipelineResult> {
  const startedAt = new Date().toISOString();
  const pipelineStart = Date.now();

  const context: PipelineContext = {
    vars: {},
    stepIndex: 0,
    results: [],
  };

  let pipelineSuccess = true;
  let pipelineError: string | undefined;

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    context.stepIndex = i;

    const stepStart = Date.now();
    let output = "";
    let success = true;
    let stepError: string | undefined;

    try {
      switch (step.type) {
        case "shell":
          output = await executeShellStep(step, context);
          break;
        case "claude":
          output = await executeClaudeStep(step, context);
          break;
        case "function":
          output = await executeFunctionStep(step, context);
          break;
      }

      // Store captured output in context vars
      if (step.captureAs) {
        context.vars[step.captureAs] = output;
      }
    } catch (err) {
      success = false;
      stepError = (err as Error).message;
      output = "";

      if (!step.optional) {
        pipelineSuccess = false;
        pipelineError = `Step "${step.name}" failed: ${stepError}`;

        const stepResult: StepResult = {
          stepName: step.name,
          type: step.type,
          output,
          success,
          error: stepError,
          durationMs: Date.now() - stepStart,
        };

        context.results.push(stepResult);
        pipeline.onStepComplete?.(step, output, context);
        break;
      }
    }

    const stepResult: StepResult = {
      stepName: step.name,
      type: step.type,
      output,
      success,
      error: stepError,
      durationMs: Date.now() - stepStart,
    };

    context.results.push(stepResult);
    pipeline.onStepComplete?.(step, output, context);
  }

  return {
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    success: pipelineSuccess,
    steps: context.results,
    context,
    totalDurationMs: Date.now() - pipelineStart,
    startedAt,
    completedAt: new Date().toISOString(),
    error: pipelineError,
  };
}

// ── Pre-built pipelines ────────────────────────────────────────────────────

/**
 * Signal-to-Build: reads power orchestrate signals → triggers Loki build.
 */
export const SIGNAL_TO_BUILD_PIPELINE: Pipeline = {
  id: "signal-to-build",
  name: "Signal to Build",
  description: "Reads market/crypto signals from Power Orchestrate and triggers a Loki build",
  steps: [
    {
      type: "shell",
      name: "Read latest signals",
      command: "python3",
      args: [path.join(CMND_DIR, "scripts", "power_orchestrate.py"), "--signals-only"],
      timeout: 15_000,
      captureAs: "signals",
      optional: true,
    },
    {
      type: "claude",
      name: "Synthesize signal into product requirement",
      prompt: (ctx) =>
        `You are a product strategist. Given these market signals:\n\n${ctx.vars.signals ?? "(no signals)"}\n\nGenerate a single, specific product requirement that could capitalize on the top signal. Format: one sentence, actionable, technical.`,
      captureAs: "requirement",
    },
    {
      type: "shell",
      name: "Trigger Loki build",
      command: "bash",
      args: [path.join(CMND_DIR, "loki", "loki.sh"), "{{requirement}}"],
      timeout: 10_000,
      captureAs: "lokiOutput",
      optional: true,
    },
    {
      type: "function",
      name: "Record pipeline run",
      fn: async (ctx) => {
        const record = {
          signals: ctx.vars.signals,
          requirement: ctx.vars.requirement,
          lokiOutput: ctx.vars.lokiOutput,
          timestamp: new Date().toISOString(),
        };
        return JSON.stringify(record, null, 2);
      },
      captureAs: "record",
    },
  ],
};

/**
 * Repo Analysis: indexes a repo with repomix → deep Claude analysis.
 */
export const REPO_ANALYSIS_PIPELINE: Pipeline = {
  id: "repo-analysis",
  name: "Repo Analysis",
  description: "Compresses repo with Repomix then performs deep architectural analysis via Claude",
  steps: [
    {
      type: "shell",
      name: "Compress repo with Repomix",
      command: "repomix",
      args: ["--output", "/tmp/repo-context.txt"],
      timeout: 60_000,
      captureAs: "repomixOutput",
      optional: false,
    },
    {
      type: "function",
      name: "Read compressed context",
      fn: async () => {
        const { readFile } = await import("fs/promises");
        try {
          const content = await readFile("/tmp/repo-context.txt", "utf-8");
          // Truncate to 50k chars to stay within token limits
          return content.slice(0, 50_000);
        } catch {
          return "(could not read repomix output)";
        }
      },
      captureAs: "repoContext",
    },
    {
      type: "claude",
      name: "Architecture analysis",
      systemPrompt:
        "You are a senior software architect. Analyze the provided codebase and produce: 1) Architecture summary, 2) Key patterns used, 3) Potential technical debt, 4) Top 3 improvement recommendations.",
      prompt: (ctx) =>
        `Analyze this codebase:\n\n${ctx.vars.repoContext ?? "(empty)"}`,
      captureAs: "analysis",
    },
    {
      type: "claude",
      name: "ROI scoring",
      prompt: (ctx) =>
        `Based on this architecture analysis:\n\n${ctx.vars.analysis ?? ""}\n\nScore the codebase ROI potential (1-10) for: monetization, maintainability, scalability, and market fit. Provide one sentence justification for each score.`,
      captureAs: "roiScore",
    },
  ],
};

/**
 * Market Scan: runs trend scout → formats insights → stores to memory.
 */
export const MARKET_SCAN_PIPELINE: Pipeline = {
  id: "market-scan",
  name: "Market Scan",
  description: "Runs trend scouting scripts and synthesizes market intelligence into memory",
  steps: [
    {
      type: "shell",
      name: "Run trend scout",
      command: "python3",
      args: [
        path.join(CMND_DIR, "scripts", "trend_scout_24h.py"),
        "--output",
        "json",
      ],
      timeout: 30_000,
      captureAs: "trends",
      optional: true,
    },
    {
      type: "claude",
      name: "Synthesize market signals",
      prompt: (ctx) =>
        `You are a market intelligence analyst. Here are raw trend signals from the last 24 hours:\n\n${ctx.vars.trends ?? "(no trend data)"}\n\nExtract: 1) Top 3 opportunities, 2) Threats to monitor, 3) Recommended immediate actions. Be specific and actionable.`,
      captureAs: "marketIntel",
    },
    {
      type: "function",
      name: "Save to AMSA memory",
      fn: async (ctx) => {
        const memFile = path.join(HOME, ".amsa", "memory", "market_intel.json");
        const { writeFile, mkdir } = await import("fs/promises");
        const dir = path.dirname(memFile);
        try {
          await mkdir(dir, { recursive: true });
          await writeFile(
            memFile,
            JSON.stringify(
              {
                summary: ctx.vars.marketIntel,
                rawTrends: ctx.vars.trends,
                savedAt: new Date().toISOString(),
              },
              null,
              2
            )
          );
          return `Market intel saved to ${memFile}`;
        } catch (err) {
          return `Warning: could not save intel — ${(err as Error).message}`;
        }
      },
      captureAs: "saveResult",
    },
  ],
};

/**
 * Memory Sync: runs AMSA memory sync script → verifies memory state.
 */
export const MEMORY_SYNC_PIPELINE: Pipeline = {
  id: "memory-sync",
  name: "Memory Sync",
  description: "Syncs AMSA session memory using Karpathy wrap-up and working memory consolidation",
  steps: [
    {
      type: "shell",
      name: "Run memory sync script",
      command: "bash",
      args: [path.join(CMND_DIR, "scripts", "memory-sync.sh")],
      timeout: 15_000,
      captureAs: "syncOutput",
      optional: true,
    },
    {
      type: "function",
      name: "Verify memory files",
      fn: async () => {
        const { access } = await import("fs/promises");
        const memFiles = [
          "working.json",
          "episodic.json",
          "karpathy_wrapup.json",
        ].map((f) => path.join(HOME, ".amsa", "memory", f));

        const checks = await Promise.all(
          memFiles.map(async (f) => {
            try {
              await access(f);
              return `${path.basename(f)}: OK`;
            } catch {
              return `${path.basename(f)}: MISSING`;
            }
          })
        );

        return checks.join("\n");
      },
      captureAs: "memoryStatus",
    },
    {
      type: "function",
      name: "Generate session digest",
      fn: async (ctx) => {
        return [
          `Memory sync completed at ${new Date().toLocaleString()}`,
          `Sync output: ${ctx.vars.syncOutput ?? "(no output)"}`,
          `Memory files:\n${ctx.vars.memoryStatus ?? "unknown"}`,
        ].join("\n\n");
      },
      captureAs: "digest",
    },
  ],
};

// ── Pipeline registry ──────────────────────────────────────────────────────

const PIPELINE_REGISTRY: Record<string, Pipeline> = {
  "signal-to-build": SIGNAL_TO_BUILD_PIPELINE,
  "repo-analysis": REPO_ANALYSIS_PIPELINE,
  "market-scan": MARKET_SCAN_PIPELINE,
  "memory-sync": MEMORY_SYNC_PIPELINE,
};

/**
 * Returns a pre-built pipeline by ID.
 * Returns undefined if not found.
 */
export function getPipeline(id: string): Pipeline | undefined {
  return PIPELINE_REGISTRY[id];
}

/**
 * Returns all registered pipeline IDs and names.
 */
export function listPipelines(): Array<{ id: string; name: string; description: string }> {
  return Object.values(PIPELINE_REGISTRY).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}

/**
 * Executes a pre-built pipeline by ID.
 * Throws if pipeline ID is not registered.
 */
export async function runBuiltinPipeline(
  id: string,
  onStepComplete?: Pipeline["onStepComplete"]
): Promise<PipelineResult> {
  const pipeline = getPipeline(id);
  if (!pipeline) {
    throw new Error(
      `Pipeline "${id}" not found. Available: ${Object.keys(PIPELINE_REGISTRY).join(", ")}`
    );
  }

  const withCallback: Pipeline = onStepComplete
    ? { ...pipeline, onStepComplete }
    : pipeline;

  return executePipeline(withCallback);
}
