/**
 * cmndcenter-bridge.ts
 * Bridge between the Raycast extension and the ~/CMNDCENTER AMSA system.
 * Reads/writes ~/.amsa/memory/, executes CMNDCENTER bash scripts,
 * and checks installed tool health.
 */

import { execFile, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

// ── Path constants ─────────────────────────────────────────────────────────

const HOME = os.homedir();
const AMSA_MEMORY_DIR = path.join(HOME, ".amsa", "memory");
const CMND_DIR = path.join(HOME, "CMNDCENTER");
const LOKI_SH = path.join(CMND_DIR, "loki", "loki.sh");
const LOKI_PY = path.join(CMND_DIR, "loki", "loki_engine.py");
const MEMORY_SYNC_SH = path.join(CMND_DIR, "scripts", "memory-sync.sh");

// ── Types ──────────────────────────────────────────────────────────────────

export interface AMSAStatus {
  running: boolean;
  memoryPath: string;
  lastWrapup: string | null;
  activeRuns: number;
  patterns: number;
  lastUpdated: string | null;
}

export interface SystemStatus {
  tools: ToolStatus[];
  checkedAt: string;
  healthyCount: number;
  totalCount: number;
}

export interface ToolStatus {
  name: string;
  version: string | null;
  available: boolean;
  path: string | null;
  role: string;
}

export interface LokiRunResult {
  pid: string;
  logFile: string;
  requirement: string;
  startedAt: string;
  status: "started" | "error";
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdirAsync(dirPath, { recursive: true });
  } catch {
    // directory already exists
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFileAsync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: object): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFileAsync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function commandExists(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`command -v ${cmd} 2>/dev/null || which ${cmd} 2>/dev/null`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function getVersion(cmd: string, flag = "--version"): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, [flag], {
      timeout: 5000,
    });
    const output = (stdout + stderr).trim();
    // Extract semver-like string
    const match = output.match(/\d+\.\d+[\.\d]*/);
    return match ? match[0] : output.split("\n")[0].trim() || null;
  } catch {
    return null;
  }
}

// ── getAMSAStatus ──────────────────────────────────────────────────────────

/**
 * Returns current AMSA memory system status.
 */
export async function getAMSAStatus(): Promise<AMSAStatus> {
  const wrapupFile = path.join(AMSA_MEMORY_DIR, "karpathy_wrapup.json");
  const patternsFile = path.join(AMSA_MEMORY_DIR, "loki_patterns.json");
  const runsDir = path.join(AMSA_MEMORY_DIR, "loki_runs");

  let lastWrapup: string | null = null;
  let patterns = 0;
  let activeRuns = 0;
  let lastUpdated: string | null = null;

  // Check wrapup file
  const wrapupData = await readJsonFile<{ created_at?: string; sessions?: unknown[] }>(
    wrapupFile
  );
  if (wrapupData) {
    lastWrapup = wrapupData.created_at ?? null;
  }

  // Count patterns
  const patternsData = await readJsonFile<{ patterns?: unknown[] }>(patternsFile);
  if (patternsData?.patterns) {
    patterns = Array.isArray(patternsData.patterns) ? patternsData.patterns.length : 0;
  }

  // Count active runs
  try {
    const entries = fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : [];
    activeRuns = entries.filter((e) => e.endsWith(".json")).length;

    if (entries.length > 0) {
      const latest = entries.sort().pop();
      if (latest) {
        const stat = fs.statSync(path.join(runsDir, latest));
        lastUpdated = stat.mtime.toISOString();
      }
    }
  } catch {
    activeRuns = 0;
  }

  return {
    running: fs.existsSync(AMSA_MEMORY_DIR),
    memoryPath: AMSA_MEMORY_DIR,
    lastWrapup,
    activeRuns,
    patterns,
    lastUpdated,
  };
}

// ── triggerLoki ────────────────────────────────────────────────────────────

/**
 * Triggers a Loki Mode build asynchronously.
 * Spawns the loki.sh script in the background.
 *
 * @param requirement  Natural language product requirement
 */
export async function triggerLoki(requirement: string): Promise<string> {
  if (!fs.existsSync(LOKI_SH)) {
    throw new Error(`Loki script not found at ${LOKI_SH}`);
  }

  const logFile = path.join(CMND_DIR, "logs", `loki_${Date.now()}.log`);
  await ensureDir(path.join(CMND_DIR, "logs"));

  // Spawn detached so it survives the extension process
  const child = require("child_process").spawn(
    "bash",
    [LOKI_SH, requirement],
    {
      detached: true,
      stdio: ["ignore", fs.openSync(logFile, "w"), fs.openSync(logFile, "a")],
      env: {
        ...process.env,
        PATH: `/Users/nadirabaas/.local/bin:/Users/nadirabaas/.nvm/versions/node/v26.1.0/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
      },
    }
  );

  child.unref();

  const result: LokiRunResult = {
    pid: String(child.pid ?? "unknown"),
    logFile,
    requirement,
    startedAt: new Date().toISOString(),
    status: "started",
  };

  // Write run record to AMSA memory
  const runFile = path.join(
    AMSA_MEMORY_DIR,
    "loki_runs",
    `run_${Date.now()}.json`
  );
  await writeJsonFile(runFile, result);

  return `Loki Mode started (PID ${result.pid}). Log: ${logFile}`;
}

// ── syncMemory ─────────────────────────────────────────────────────────────

/**
 * Writes arbitrary data to AMSA memory, merging with existing working memory.
 *
 * @param data  Key/value data to persist in working memory
 */
export async function syncMemory(data: object): Promise<void> {
  await ensureDir(AMSA_MEMORY_DIR);

  const workingFile = path.join(AMSA_MEMORY_DIR, "working.json");
  const existing =
    (await readJsonFile<Record<string, unknown>>(workingFile)) ?? {};

  const merged = {
    ...existing,
    ...data,
    _lastSync: new Date().toISOString(),
    _source: "claude-architect-os-raycast",
  };

  await writeJsonFile(workingFile, merged);
}

// ── readMemory ─────────────────────────────────────────────────────────────

/**
 * Reads a named memory file from AMSA memory directory.
 *
 * @param filename  Filename within ~/.amsa/memory/ (e.g. "working.json")
 */
export async function readMemory<T = unknown>(filename: string): Promise<T | null> {
  const filePath = path.join(AMSA_MEMORY_DIR, filename);
  return readJsonFile<T>(filePath);
}

// ── getSystemStatus ────────────────────────────────────────────────────────

const TOOL_CHECKS: Array<{
  name: string;
  cmd: string;
  versionFlag?: string;
  role: string;
}> = [
  { name: "Claude Code", cmd: "claude", versionFlag: "--version", role: "Primary AI brain" },
  { name: "Ollama", cmd: "ollama", versionFlag: "--version", role: "Local models" },
  { name: "Python 3", cmd: "python3", versionFlag: "--version", role: "Loki engine runtime" },
  { name: "Node.js", cmd: "node", versionFlag: "--version", role: "Raycast extension runtime" },
  { name: "Git", cmd: "git", versionFlag: "--version", role: "Version control" },
  { name: "Repomix", cmd: "repomix", versionFlag: "--version", role: "Context compression" },
  { name: "OpenCode", cmd: `${HOME}/bin/opencode`, versionFlag: "--version", role: "Multi-model fallback" },
  { name: "Aider", cmd: "aider", versionFlag: "--version", role: "Git-native AI commits" },
  { name: "GitHub CLI", cmd: "gh", versionFlag: "--version", role: "GitHub integration" },
];

/**
 * Checks availability and version of all CMNDCENTER tools.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const results: ToolStatus[] = await Promise.all(
    TOOL_CHECKS.map(async ({ name, cmd, versionFlag, role }) => {
      const binPath = await commandExists(cmd);
      const available = binPath !== null;
      const version = available ? await getVersion(cmd, versionFlag) : null;

      return {
        name,
        version,
        available,
        path: binPath,
        role,
      };
    })
  );

  // Also check Loki script
  const lokiAvailable = fs.existsSync(LOKI_SH);
  results.push({
    name: "Loki Mode",
    version: lokiAvailable ? "1.0" : null,
    available: lokiAvailable,
    path: lokiAvailable ? LOKI_SH : null,
    role: "37-agent autonomous product builder",
  });

  const healthyCount = results.filter((r) => r.available).length;

  return {
    tools: results,
    checkedAt: new Date().toISOString(),
    healthyCount,
    totalCount: results.length,
  };
}

// ── runScript ──────────────────────────────────────────────────────────────

/**
 * Executes a CMNDCENTER bash script with optional arguments.
 * Returns combined stdout + stderr.
 *
 * @param scriptName  Filename under ~/CMNDCENTER/scripts/ or ~/CMNDCENTER/raycast-scripts/
 * @param args        Optional argument array
 * @param timeout     Max execution time in ms (default 30s)
 */
export async function runScript(
  scriptName: string,
  args: string[] = [],
  timeout = 30_000
): Promise<string> {
  const searchPaths = [
    path.join(CMND_DIR, "scripts", scriptName),
    path.join(CMND_DIR, "raycast-scripts", scriptName),
    path.join(CMND_DIR, scriptName),
  ];

  let scriptPath: string | null = null;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      scriptPath = p;
      break;
    }
  }

  if (!scriptPath) {
    throw new Error(`Script not found: ${scriptName} (searched ${searchPaths.join(", ")})`);
  }

  const { stdout, stderr } = await execFileAsync("bash", [scriptPath, ...args], {
    timeout,
    env: {
      ...process.env,
      PATH: `/Users/nadirabaas/.local/bin:/Users/nadirabaas/.nvm/versions/node/v26.1.0/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ""}`,
    },
  });

  return (stdout + stderr).trim();
}
