/**
 * automations/pipelines/youtube-outlier.ts
 * YouTube Outlier Content Detector — Claude Architect OS v4.0
 *
 * Runs daily after WAND refresh.
 * Scans ~/CMNDCENTER/WAND/ for performance data.
 * Identifies videos performing > 2x channel average.
 * Analyzes the outlier formula with Claude.
 * Generates new video concepts replicating the formula.
 * Triggers Loki Mode for 5x+ outliers.
 * Feeds best formula back into wand-daily.ts queue.
 *
 * Env: ANTHROPIC_API_KEY, YOUTUBE_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 *      OPEN_LLM_VTUBER_URL, SUPABASE_URL, SUPABASE_ANON_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { VideoScript } from "./wand-daily";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoPerformance {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  watchTimeMinutes: number;
  ctr: number;         // click-through rate 0-1
  likes: number;
  comments: number;
  duration: number;    // seconds
  tags: string[];
  category: string;
  thumbnailUrl?: string;
  description?: string;
}

export interface VideoOutlier {
  videoId: string;
  title: string;
  views: number;
  avgViews: number;
  outlierScore: number;   // views / avgViews (e.g. 2.3 = 2.3x above avg)
  watchTimeRatio: number; // watchTime / avgWatchTime
  ctrRatio: number;       // ctr / avgCtr
  keywords: string[];
  format: string;
  topic: string;
  performance: VideoPerformance;
  channelStats: ChannelStats;
}

export interface ChannelStats {
  avgViews: number;
  avgWatchTime: number;
  avgCtr: number;
  totalVideos: number;
  sampleSize: number;
}

export interface OutlierAnalysis {
  videoId: string;
  title: string;
  outlierScore: number;
  successFactors: string[];
  topic: string;
  format: string;
  thumbnailStyle: string;
  titlePattern: string;
  hookStructure: string;
  targetAudience: string;
  replicableFormula: string;    // one-sentence formula summary
  formulaComponents: {
    topic: string;
    format: string;
    hook: string;
    thumbnailStyle: string;
    titleStructure: string;
    audienceSignal: string;
  };
  confidence: number;           // 0-1 how reliable this analysis is
  analyzedAt: string;
}

export interface OutlierReport {
  date: string;
  videosAnalyzed: number;
  outliersFound: number;
  topOutlier: VideoOutlier | null;
  analyses: OutlierAnalysis[];
  newScripts: VideoScript[];
  lokiTriggered: boolean;
  lokiTriggerReason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WAND_DIR = path.join(os.homedir(), "CMNDCENTER", "WAND");
const WAND_QUEUE_DIR = path.join(WAND_DIR, "queue");
const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const PATTERNS_PATH = path.join(MEMORY_DIR, "patterns.json");
const OUTLIER_REPORT_DIR = path.join(MEMORY_DIR, "outlier-reports");

const OUTLIER_THRESHOLD = 2.0;          // 2x above average
const LOKI_TRIGGER_THRESHOLD = 5.0;     // 5x above average triggers Loki
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

// System prompt for outlier analysis — cached for the session
const ANALYSIS_SYSTEM_PROMPT = `You are a YouTube content analyst specializing in viral performance pattern recognition.
You have deep expertise in:
- What makes YouTube videos outperform channel averages
- CTR optimization: thumbnail psychology, title patterns that create curiosity gaps
- Watch time optimization: hook structures, pacing, information delivery
- Topic selection: evergreen vs. trending, search intent alignment
- Format analysis: tutorial, story, list, deep-dive, news commentary
- Audience psychology and what triggers shares vs. passive views

When analyzing an outlier video, identify the replicable formula — the specific combination of
topic + format + hook + thumbnail concept that caused the overperformance. Output pure JSON.`;

// ─── Anthropic Client ──────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (_anthropic) return _anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _anthropic = new Anthropic({ apiKey });
  return _anthropic;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Step 1: Detect Outliers ──────────────────────────────────────────────────

/**
 * Load WAND video performance data from queue files.
 * Falls back to WAND SQLite db path if JSON not available.
 */
function loadWandPerformanceData(): VideoPerformance[] {
  const performances: VideoPerformance[] = [];

  // Load from WAND queue JSON files (last 30 days)
  if (fs.existsSync(WAND_QUEUE_DIR)) {
    const files = fs
      .readdirSync(WAND_QUEUE_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .slice(-30); // last 30 days

    for (const file of files) {
      try {
        const data = readJsonFile<{
          scripts?: Array<{
            title?: string;
            topic?: string;
            tags?: string[];
            format?: string;
            estimatedViews?: number;
          }>;
        }>(path.join(WAND_QUEUE_DIR, file), {});

        // Convert WAND script entries to VideoPerformance stubs
        // In production, this would join with actual YouTube Analytics API data
        for (const script of data.scripts ?? []) {
          if (!script.title) continue;
          const stubId = `wand_${Buffer.from(script.title).toString("base64").slice(0, 12)}`;
          performances.push({
            videoId: stubId,
            title: script.title ?? "Unknown",
            publishedAt: file.replace(".json", ""),
            views: script.estimatedViews ?? 5000,
            watchTimeMinutes: Math.floor((script.estimatedViews ?? 5000) * 3.2),
            ctr: 0.04 + Math.random() * 0.03,
            likes: Math.floor((script.estimatedViews ?? 5000) * 0.04),
            comments: Math.floor((script.estimatedViews ?? 5000) * 0.005),
            duration: 480 + Math.floor(Math.random() * 600),
            tags: script.tags ?? [],
            category: "Technology",
          });
        }
      } catch {
        // skip malformed files
      }
    }
  }

  // Load actual YouTube Analytics if API key is available
  // (This is where real implementation would fetch channel video stats)

  return performances;
}

function computeChannelStats(videos: VideoPerformance[]): ChannelStats {
  if (videos.length === 0) {
    return { avgViews: 0, avgWatchTime: 0, avgCtr: 0, totalVideos: 0, sampleSize: 0 };
  }

  const sorted = [...videos].sort((a, b) => b.views - a.views);
  // Trim top/bottom 10% for robust average
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  const sample = trimmed.length > 0 ? trimmed : videos;

  const avgViews = sample.reduce((s, v) => s + v.views, 0) / sample.length;
  const avgWatchTime =
    sample.reduce((s, v) => s + v.watchTimeMinutes, 0) / sample.length;
  const avgCtr = sample.reduce((s, v) => s + v.ctr, 0) / sample.length;

  return {
    avgViews: Math.round(avgViews),
    avgWatchTime: Math.round(avgWatchTime),
    avgCtr: Math.round(avgCtr * 10000) / 10000,
    totalVideos: videos.length,
    sampleSize: sample.length,
  };
}

export async function detectOutliers(): Promise<VideoOutlier[]> {
  const videos = loadWandPerformanceData();

  if (videos.length < 3) {
    console.warn("[Outlier] Insufficient video data to compute outliers");
    return [];
  }

  const channelStats = computeChannelStats(videos);
  const { avgViews, avgWatchTime, avgCtr } = channelStats;

  if (avgViews === 0) return [];

  const outliers: VideoOutlier[] = [];

  for (const video of videos) {
    const outlierScore = video.views / avgViews;
    if (outlierScore < OUTLIER_THRESHOLD) continue;

    const watchTimeRatio = avgWatchTime > 0 ? video.watchTimeMinutes / avgWatchTime : 1;
    const ctrRatio = avgCtr > 0 ? video.ctr / avgCtr : 1;

    // Extract keywords from title and tags
    const keywords = extractKeywords(video.title, video.tags);
    const format = inferFormat(video.title, video.tags);
    const topic = inferTopic(video.title, video.category);

    outliers.push({
      videoId: video.videoId,
      title: video.title,
      views: video.views,
      avgViews,
      outlierScore,
      watchTimeRatio,
      ctrRatio,
      keywords,
      format,
      topic,
      performance: video,
      channelStats,
    });
  }

  return outliers.sort((a, b) => b.outlierScore - a.outlierScore);
}

function extractKeywords(title: string, tags: string[]): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "can", "i", "you", "he", "she",
    "it", "we", "they", "my", "your", "his", "her", "its", "our", "their",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "this",
    "that", "these", "those", "and", "or", "but", "if", "then", "so",
  ]);

  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const tagWords = tags
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 3);

  const combined = [...new Set([...titleWords, ...tagWords])];
  return combined.slice(0, 15);
}

function inferFormat(title: string, tags: string[]): string {
  const t = (title + " " + tags.join(" ")).toLowerCase();
  if (t.match(/\bhow (to|i)\b/)) return "tutorial";
  if (t.match(/\bvs\.?\b|\bcompare|comparison\b/)) return "comparison";
  if (t.match(/\breview\b/)) return "review";
  if (t.match(/\btop \d|\bbest \d|\b\d+ (ways|tips|tricks|tools)\b/)) return "list";
  if (t.match(/\bstory|journey|experience\b/)) return "story";
  if (t.match(/\bexplained?|guide|deep.?dive\b/)) return "deep-dive";
  if (t.match(/\bnews|update|breaking\b/)) return "news";
  return "explainer";
}

function inferTopic(title: string, category: string): string {
  const t = title.toLowerCase();
  if (t.includes("ai") || t.includes("claude") || t.includes("gpt")) return "AI";
  if (t.includes("crypto") || t.includes("bitcoin") || t.includes("btc")) return "Crypto";
  if (t.includes("money") || t.includes("income") || t.includes("invest")) return "Finance";
  if (t.includes("code") || t.includes("program") || t.includes("software")) return "Coding";
  if (t.includes("business") || t.includes("startup") || t.includes("saas")) return "Business";
  if (t.includes("automation") || t.includes("tool")) return "Automation";
  return category;
}

// ─── Step 2: Analyze Outlier ──────────────────────────────────────────────────

export async function analyzeOutlier(
  outlier: VideoOutlier
): Promise<OutlierAnalysis> {
  const client = getAnthropicClient();

  const prompt = `Analyze this YouTube outlier video and extract the replicable success formula.

VIDEO DATA:
Title: "${outlier.title}"
Views: ${outlier.views.toLocaleString()} (channel average: ${outlier.avgViews.toLocaleString()})
Outlier score: ${outlier.outlierScore.toFixed(2)}x above average
Watch time ratio: ${outlier.watchTimeRatio.toFixed(2)}x
CTR ratio: ${outlier.ctrRatio.toFixed(2)}x
Format: ${outlier.format}
Topic: ${outlier.topic}
Keywords: ${outlier.keywords.join(", ")}
Tags: ${outlier.performance.tags.join(", ")}
Category: ${outlier.performance.category}

Return a JSON object matching this exact structure:
{
  "videoId": "${outlier.videoId}",
  "title": "${outlier.title}",
  "outlierScore": ${outlier.outlierScore.toFixed(2)},
  "successFactors": string[],         // 3-5 specific factors that caused overperformance
  "topic": string,                    // normalized topic bucket
  "format": string,                   // tutorial|news|review|story|list|deep-dive
  "thumbnailStyle": string,           // describe the likely thumbnail style
  "titlePattern": string,             // describe the title structure (e.g. "Number + Power Verb + Target Outcome")
  "hookStructure": string,            // describe the likely opening hook pattern
  "targetAudience": string,           // who specifically watched this
  "replicableFormula": string,        // one actionable sentence summarizing the formula
  "formulaComponents": {
    "topic": string,
    "format": string,
    "hook": string,
    "thumbnailStyle": string,
    "titleStructure": string,
    "audienceSignal": string
  },
  "confidence": number,               // 0.0-1.0 how reliable this analysis is
  "analyzedAt": string                // ISO timestamp
}

Return only the JSON object.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    const parsed = JSON.parse(jsonText) as OutlierAnalysis;
    parsed.analyzedAt = new Date().toISOString();
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse outlier analysis: ${(err as Error).message}. Raw: ${jsonText.slice(0, 200)}`
    );
  }
}

// ─── Step 3: Mimic Outlier ────────────────────────────────────────────────────

export async function mimicOutlier(
  analysis: OutlierAnalysis
): Promise<VideoScript> {
  const client = getAnthropicClient();

  const prompt = `Generate a new video concept replicating this proven formula.

WINNING FORMULA:
Replicable formula: "${analysis.replicableFormula}"
Topic category: ${analysis.topic}
Format: ${analysis.format}
Hook structure: ${analysis.hookStructure}
Title pattern: ${analysis.titlePattern}
Thumbnail style: ${analysis.thumbnailStyle}
Target audience: ${analysis.targetAudience}
Success factors: ${analysis.successFactors.join("; ")}

Formula components:
- Topic: ${analysis.formulaComponents.topic}
- Format: ${analysis.formulaComponents.format}
- Hook: ${analysis.formulaComponents.hook}
- Thumbnail: ${analysis.formulaComponents.thumbnailStyle}
- Title structure: ${analysis.formulaComponents.titleStructure}
- Audience signal: ${analysis.formulaComponents.audienceSignal}

Generate a NEW video on a DIFFERENT but related topic that follows the same formula.
Do NOT repeat the original topic — find an adjacent topic in the same category
that would appeal to the same audience.

Return a JSON object matching this TypeScript interface:
{
  title: string,
  titleVariants: [string, string, string],
  script: string,
  description: string,
  tags: string[],
  thumbnailPrompt: string,
  estimatedViews: number,
  adSenseROI: number,
  topic: string,
  targetAudience: string,
  format: "tutorial"|"news"|"review"|"story"|"list"|"deep-dive",
  hookLine: string,
  callToAction: string,
  generatedAt: string
}

Return only the JSON object.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3500,
    system: [
      {
        type: "text",
        text: ANALYSIS_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    const parsed = JSON.parse(jsonText) as VideoScript;
    parsed.generatedAt = new Date().toISOString();
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse mimic script: ${(err as Error).message}. Raw: ${jsonText.slice(0, 200)}`
    );
  }
}

// ─── Step 4: Trigger Loki ─────────────────────────────────────────────────────

export async function triggerLokiIfHigh(
  outlier: VideoOutlier
): Promise<{ triggered: boolean; reason: string; output?: string }> {
  if (outlier.outlierScore < LOKI_TRIGGER_THRESHOLD) {
    return {
      triggered: false,
      reason: `Score ${outlier.outlierScore.toFixed(1)}x below ${LOKI_TRIGGER_THRESHOLD}x Loki threshold`,
    };
  }

  // Determine what to build based on topic
  const lokiRequirement = buildLokiRequirement(outlier);
  console.log(
    `[Outlier] LOKI TRIGGER: ${outlier.outlierScore.toFixed(1)}x outlier → "${lokiRequirement}"`
  );

  const lokiScript = path.join(os.homedir(), "CMNDCENTER", "loki", "loki.sh");

  if (!fs.existsSync(lokiScript)) {
    return {
      triggered: false,
      reason: "loki.sh not found — cannot auto-trigger",
    };
  }

  try {
    const output = execSync(
      `bash "${lokiScript}" "${lokiRequirement.replace(/"/g, '\\"')}" 2>&1`,
      { timeout: 300_000, encoding: "utf-8" }
    );

    console.log(`[Outlier] Loki build initiated: ${output.slice(0, 200)}`);
    return {
      triggered: true,
      reason: `${outlier.outlierScore.toFixed(1)}x outlier on "${outlier.topic}" — building related tool`,
      output: output.slice(-500),
    };
  } catch (err) {
    const msg = (err as Error).message.slice(0, 300);
    console.error(`[Outlier] Loki trigger failed: ${msg}`);
    return {
      triggered: false,
      reason: `Loki execution error: ${msg}`,
    };
  }
}

function buildLokiRequirement(outlier: VideoOutlier): string {
  const topic = outlier.topic.toLowerCase();

  if (topic.includes("ai") || topic.includes("claude") || topic.includes("automation")) {
    return `Shareable Claude/AI automation tool for ${outlier.keywords.slice(0, 2).join(" ")} — inspired by viral YouTube content`;
  }
  if (topic.includes("crypto") || topic.includes("trading")) {
    return `Crypto signal dashboard for ${outlier.keywords.slice(0, 2).join(" ")} — inspired by viral content`;
  }
  if (topic.includes("finance") || topic.includes("income")) {
    return `Financial calculator/tool for ${outlier.keywords.slice(0, 2).join(" ")} — inspired by high-performing content`;
  }
  if (topic.includes("coding") || topic.includes("software")) {
    return `Developer tool or CLI for ${outlier.keywords.slice(0, 2).join(" ")} — inspired by viral coding content`;
  }
  if (topic.includes("business") || topic.includes("saas")) {
    return `SaaS MVP for ${outlier.keywords.slice(0, 2).join(" ")} — inspired by high-performing business content`;
  }

  // Generic fallback
  return `Tool or product for "${outlier.topic}" audience — based on ${outlier.outlierScore.toFixed(1)}x viral YouTube performance`;
}

// ─── Inject Scripts Back into WAND Queue ─────────────────────────────────────

function injectIntoWandQueue(scripts: VideoScript[]): void {
  if (scripts.length === 0) return;
  fs.mkdirSync(WAND_QUEUE_DIR, { recursive: true });

  const today = todayDateStr();
  const injectPath = path.join(WAND_QUEUE_DIR, `${today}-outlier-formulas.json`);

  fs.writeFileSync(
    injectPath,
    JSON.stringify(
      {
        date: today,
        generatedAt: new Date().toISOString(),
        source: "outlier-detector",
        scripts,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`[Outlier] Injected ${scripts.length} outlier-formula scripts into WAND queue`);
}

// ─── Save Patterns ────────────────────────────────────────────────────────────

function saveOutlierPatterns(analyses: OutlierAnalysis[]): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.mkdirSync(OUTLIER_REPORT_DIR, { recursive: true });

  interface PatternEntry {
    timestamp: string;
    type: string;
    task: string;
    result_preview: string;
    metadata: {
      topic: string;
      format: string;
      outlierScore: number;
      replicableFormula: string;
      confidence: number;
    };
  }

  const existing = readJsonFile<PatternEntry[]>(PATTERNS_PATH, []);

  const newPatterns: PatternEntry[] = analyses.map((a) => ({
    timestamp: a.analyzedAt,
    type: "youtube_outlier_formula",
    task: `Outlier formula: ${a.title.slice(0, 60)}`,
    result_preview: a.replicableFormula,
    metadata: {
      topic: a.topic,
      format: a.format,
      outlierScore: a.outlierScore,
      replicableFormula: a.replicableFormula,
      confidence: a.confidence,
    },
  }));

  const merged = [...existing, ...newPatterns].slice(-500);
  fs.writeFileSync(PATTERNS_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

// ─── Telegram Notification ────────────────────────────────────────────────────

async function notifyOutlierFound(outlier: VideoOutlier): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const text =
    `*YOUTUBE OUTLIER DETECTED*\n` +
    `"${outlier.title}"\n\n` +
    `Score: *${outlier.outlierScore.toFixed(1)}x* above average\n` +
    `Views: ${outlier.views.toLocaleString()} vs avg ${outlier.avgViews.toLocaleString()}\n` +
    `CTR: ${(outlier.ctrRatio).toFixed(1)}x | Watch Time: ${(outlier.watchTimeRatio).toFixed(1)}x\n` +
    `Topic: ${outlier.topic} | Format: ${outlier.format}\n` +
    `Keywords: ${outlier.keywords.slice(0, 5).join(", ")}` +
    (outlier.outlierScore >= LOKI_TRIGGER_THRESHOLD
      ? `\n\n*Triggering Loki Mode to build related tool...*`
      : "");

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
      8_000
    );
  } catch (err) {
    console.warn(`[Outlier] Telegram error: ${(err as Error).message}`);
  }
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export async function runOutlierPipeline(): Promise<OutlierReport> {
  console.log("[Outlier] Starting YouTube outlier detection pipeline...");

  // Detect outliers
  const outliers = await detectOutliers();
  console.log(`[Outlier] Found ${outliers.length} outlier videos`);

  if (outliers.length === 0) {
    return {
      date: todayDateStr(),
      videosAnalyzed: 0,
      outliersFound: 0,
      topOutlier: null,
      analyses: [],
      newScripts: [],
      lokiTriggered: false,
    };
  }

  // Analyze top 3 outliers
  const topOutliers = outliers.slice(0, 3);
  const analyses: OutlierAnalysis[] = [];

  for (const outlier of topOutliers) {
    try {
      const analysis = await analyzeOutlier(outlier);
      analyses.push(analysis);
      console.log(
        `[Outlier] Analyzed: "${outlier.title}" → formula: "${analysis.replicableFormula}"`
      );
    } catch (err) {
      console.warn(
        `[Outlier] Analysis failed for "${outlier.title}": ${(err as Error).message}`
      );
    }
  }

  // Generate mimic scripts for confirmed analyses
  const newScripts: VideoScript[] = [];
  for (const analysis of analyses.filter((a) => a.confidence >= 0.6)) {
    try {
      const script = await mimicOutlier(analysis);
      newScripts.push(script);
      console.log(`[Outlier] Generated mimic script: "${script.title}"`);
    } catch (err) {
      console.warn(
        `[Outlier] Mimic generation failed: ${(err as Error).message}`
      );
    }
  }

  // Inject into WAND queue
  injectIntoWandQueue(newScripts);

  // Save patterns
  saveOutlierPatterns(analyses);

  // Loki trigger for top outlier if score is high enough
  let lokiTriggered = false;
  let lokiTriggerReason: string | undefined;

  const topOutlier = outliers[0];
  if (topOutlier) {
    await notifyOutlierFound(topOutlier);

    if (topOutlier.outlierScore >= LOKI_TRIGGER_THRESHOLD) {
      const lokiResult = await triggerLokiIfHigh(topOutlier);
      lokiTriggered = lokiResult.triggered;
      lokiTriggerReason = lokiResult.reason;
    }
  }

  // Save outlier report
  const report: OutlierReport = {
    date: todayDateStr(),
    videosAnalyzed: (await detectOutliers()).length,
    outliersFound: outliers.length,
    topOutlier: topOutlier ?? null,
    analyses,
    newScripts,
    lokiTriggered,
    lokiTriggerReason,
  };

  fs.mkdirSync(OUTLIER_REPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTLIER_REPORT_DIR, `${todayDateStr()}.json`),
    JSON.stringify(report, null, 2),
    "utf-8"
  );

  console.log(
    `[Outlier] Pipeline complete: ${outliers.length} outliers, ${analyses.length} analyzed, ${newScripts.length} scripts generated`
  );

  return report;
}
