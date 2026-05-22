/**
 * automations/pipelines/wand-daily.ts
 * WAND Daily Content Refresh Pipeline — Claude Architect OS v4.0
 *
 * Cron: 7:00 AM daily via Trigger.dev
 * Chain: YouTube Trends + Google Trends → Score → Claude (cached) → WAND queue →
 *        Open-LLM-VTuber narration → Telegram notification → Supabase → Memory
 *
 * Env: ANTHROPIC_API_KEY, YOUTUBE_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 *      SUPABASE_URL, SUPABASE_ANON_KEY, OPEN_LLM_VTUBER_URL
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoScript {
  title: string;
  titleVariants: [string, string, string]; // A/B test 3 options
  script: string;
  description: string;
  tags: string[];
  thumbnailPrompt: string;
  estimatedViews: number;
  adSenseROI: number; // estimated $ per 1000 views
  topic: string;
  targetAudience: string;
  format: "tutorial" | "news" | "review" | "story" | "list" | "deep-dive";
  hookLine: string; // first 5 seconds
  callToAction: string;
  generatedAt: string;
}

interface TrendingTopic {
  title: string;
  category: string;
  searchVolume: number;
  velocity: number; // growth rate 0-100
  youtubeVideos?: number;
  source: "youtube" | "google_trends" | "combined";
  region: string;
}

interface ScoredTopic {
  topic: TrendingTopic;
  opportunityScore: number;
  audienceSize: number;
  competitionLevel: "low" | "medium" | "high";
  contentAngle: string;
}

interface WANDQueueEntry {
  date: string;
  generatedAt: string;
  topics: ScoredTopic[];
  scripts: VideoScript[];
  pipelineVersion: string;
}

interface SupabaseWandRow {
  date: string;
  topic: string;
  title: string;
  tags: string[];
  estimated_views: number;
  adsense_roi: number;
  format: string;
  generated_at: string;
  script_preview: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WAND_DIR = path.join(os.homedir(), "CMNDCENTER", "WAND");
const WAND_QUEUE_DIR = path.join(WAND_DIR, "queue");
const MEMORY_DIR = path.join(os.homedir(), ".amsa", "memory");
const PATTERNS_PATH = path.join(MEMORY_DIR, "patterns.json");

const OPEN_LLM_VTUBER_URL =
  process.env.OPEN_LLM_VTUBER_URL ?? "http://localhost:12393";
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

// System prompt for content generation — cached across all calls in a session
const CONTENT_SYSTEM_PROMPT = `You are WAND, an expert YouTube content strategist and scriptwriter with deep knowledge of:
- YouTube algorithm optimization (CTR, watch time, retention patterns)
- Trending content formats that outperform channel averages
- Hook writing that captures attention in the first 5 seconds
- SEO-optimized titles and descriptions
- AdSense-maximizing content categories (finance, tech, AI, productivity, business)
- Target audience psychology and engagement patterns

Your scripts are engaging, informative, and optimized for both viewer retention and algorithmic distribution.
Always structure content with: strong hook → value delivery → retention loop → CTA.
Output pure JSON matching the VideoScript interface exactly.`;

// ─── Anthropic Client (lazy singleton with caching) ───────────────────────────

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

// ─── Step 1: Fetch Trending Topics ───────────────────────────────────────────

async function fetchYouTubeTrending(): Promise<TrendingTopic[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn("[WAND] YOUTUBE_API_KEY not set — using fallback topics");
    return getDefaultTopics();
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=US&key=${YOUTUBE_API_KEY}`;
    const res = await fetchWithTimeout(url, {}, 12_000);

    if (!res.ok) {
      console.warn(`[WAND] YouTube API error: ${res.status} — using fallback`);
      return getDefaultTopics();
    }

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          categoryId?: string;
          tags?: string[];
        };
        statistics?: {
          viewCount?: string;
        };
      }>;
    };

    return (data.items ?? []).slice(0, 10).map((item) => ({
      title: item.snippet?.title ?? "Unknown",
      category: mapYouTubeCategory(item.snippet?.categoryId ?? "0"),
      searchVolume: parseInt(item.statistics?.viewCount ?? "0", 10),
      velocity: Math.min(100, Math.floor(Math.random() * 40 + 60)),
      source: "youtube" as const,
      region: "US",
    }));
  } catch (err) {
    console.warn(`[WAND] YouTube fetch failed: ${(err as Error).message}`);
    return getDefaultTopics();
  }
}

async function fetchGoogleTrends(): Promise<TrendingTopic[]> {
  // Google Trends does not have a public API; use the unofficial endpoint
  try {
    const url =
      "https://trends.google.com/trends/hottrends/visualize/internal/data";
    const res = await fetchWithTimeout(url, {}, 10_000);
    if (!res.ok) return [];

    const text = await res.text();
    // Parse comma-separated trend titles from the response (format varies)
    const trendMatches = text.match(/"([^"]{10,80})"/g) ?? [];
    return trendMatches.slice(0, 8).map((raw) => ({
      title: raw.replace(/"/g, ""),
      category: "trending",
      searchVolume: 0,
      velocity: 75,
      source: "google_trends" as const,
      region: "US",
    }));
  } catch {
    return [];
  }
}

function mapYouTubeCategory(categoryId: string): string {
  const map: Record<string, string> = {
    "1": "Film & Animation",
    "2": "Autos & Vehicles",
    "10": "Music",
    "15": "Pets & Animals",
    "17": "Sports",
    "19": "Travel & Events",
    "20": "Gaming",
    "22": "People & Blogs",
    "23": "Comedy",
    "24": "Entertainment",
    "25": "News & Politics",
    "26": "Howto & Style",
    "27": "Education",
    "28": "Science & Technology",
    "29": "Nonprofits & Activism",
  };
  return map[categoryId] ?? "General";
}

function getDefaultTopics(): TrendingTopic[] {
  return [
    {
      title: "Claude AI automation for small business",
      category: "Technology",
      searchVolume: 50000,
      velocity: 82,
      source: "combined",
      region: "US",
    },
    {
      title: "AI side hustle making $5000 per month",
      category: "Finance",
      searchVolume: 120000,
      velocity: 90,
      source: "combined",
      region: "US",
    },
    {
      title: "Passive income with AI tools 2026",
      category: "Business",
      searchVolume: 80000,
      velocity: 85,
      source: "combined",
      region: "US",
    },
    {
      title: "Best AI coding assistant comparison",
      category: "Technology",
      searchVolume: 60000,
      velocity: 78,
      source: "combined",
      region: "US",
    },
    {
      title: "How I automated my business with AI agents",
      category: "Business",
      searchVolume: 45000,
      velocity: 88,
      source: "combined",
      region: "US",
    },
  ];
}

// ─── Step 2: Score Topics ─────────────────────────────────────────────────────

export async function scoreContentROI(topic: string): Promise<number> {
  // High-CPM categories get base boost
  const highCpmKeywords = [
    "finance",
    "ai",
    "investing",
    "business",
    "crypto",
    "make money",
    "passive income",
    "automation",
    "tutorial",
    "review",
    "vs",
    "best",
    "how to",
    "2026",
  ];

  const topicLower = topic.toLowerCase();
  let score = 0.4;

  for (const kw of highCpmKeywords) {
    if (topicLower.includes(kw)) {
      score += 0.06;
    }
  }

  // Freshness bonus for year references
  if (topicLower.includes("2026")) score += 0.05;

  // Cap at 1.0
  return Math.min(score, 1.0);
}

function scoreTopics(topics: TrendingTopic[]): ScoredTopic[] {
  return topics
    .map((topic) => {
      // Opportunity formula: (velocity × 0.4) + (adSense × 0.4) + (competition_inv × 0.2)
      const adSenseProxy = getAdSenseProxy(topic.category);
      const competitionScore = getCompetitionScore(topic.searchVolume);
      const opportunityScore =
        (topic.velocity / 100) * 0.4 +
        adSenseProxy * 0.4 +
        (1 - competitionScore) * 0.2;

      const contentAngle = deriveContentAngle(topic);

      return {
        topic,
        opportunityScore: Math.min(opportunityScore, 1.0),
        audienceSize: estimateAudienceSize(topic),
        competitionLevel:
          competitionScore < 0.4
            ? ("low" as const)
            : competitionScore < 0.7
            ? ("medium" as const)
            : ("high" as const),
        contentAngle,
      };
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function getAdSenseProxy(category: string): number {
  const cpmMap: Record<string, number> = {
    Finance: 0.95,
    Business: 0.90,
    Technology: 0.85,
    "Science & Technology": 0.85,
    "News & Politics": 0.80,
    Education: 0.75,
    "Howto & Style": 0.70,
    Entertainment: 0.55,
    Gaming: 0.50,
    Music: 0.45,
    Comedy: 0.45,
    "People & Blogs": 0.50,
    trending: 0.65,
    General: 0.55,
  };
  return cpmMap[category] ?? 0.55;
}

function getCompetitionScore(searchVolume: number): number {
  if (searchVolume > 1_000_000) return 0.9;
  if (searchVolume > 500_000) return 0.75;
  if (searchVolume > 100_000) return 0.60;
  if (searchVolume > 50_000) return 0.45;
  if (searchVolume > 10_000) return 0.30;
  return 0.20;
}

function estimateAudienceSize(topic: TrendingTopic): number {
  // Rough estimate based on search volume × velocity factor
  return Math.floor((topic.searchVolume || 10_000) * (topic.velocity / 100));
}

function deriveContentAngle(topic: TrendingTopic): string {
  const title = topic.title.toLowerCase();
  if (title.includes("how to") || title.includes("tutorial"))
    return "step-by-step tutorial";
  if (title.includes("vs") || title.includes("comparison"))
    return "head-to-head comparison";
  if (title.includes("review")) return "honest review";
  if (title.includes("make money") || title.includes("income"))
    return "income strategy breakdown";
  if (title.includes("ai") || title.includes("automation"))
    return "AI tool walkthrough";
  if (title.includes("best")) return "ranked list with reasoning";
  return "explainer with examples";
}

// ─── Step 3: Claude Content Generation ───────────────────────────────────────

export async function generateVideoScript(
  topic: string,
  targetAudience: string
): Promise<VideoScript> {
  const client = getAnthropicClient();

  const prompt = `Generate a complete YouTube video script for this topic: "${topic}"
Target audience: ${targetAudience}

Return a JSON object matching this exact TypeScript interface:
{
  title: string,                            // primary optimized title (max 70 chars)
  titleVariants: [string, string, string],  // 3 A/B title alternatives
  script: string,                           // full spoken script (800-1200 words)
  description: string,                     // YouTube description (300-500 chars)
  tags: string[],                          // 15-20 SEO tags
  thumbnailPrompt: string,                 // DALL-E/Midjourney prompt for thumbnail
  estimatedViews: number,                  // realistic estimate for first 30 days
  adSenseROI: number,                      // estimated $ per 1000 views (CPM)
  topic: string,                           // normalized topic name
  targetAudience: string,                  // target audience description
  format: "tutorial"|"news"|"review"|"story"|"list"|"deep-dive",
  hookLine: string,                        // first 5-second hook (1-2 sentences)
  callToAction: string,                    // end-of-video CTA
  generatedAt: string                      // ISO timestamp
}

Rules:
- Hook must create immediate curiosity or promise clear value
- Script must have: hook (5s) → problem/context (30s) → solution/content → summary → CTA
- Tags must be specific and high-CPM
- Title variants must test: curiosity vs. direct value vs. social proof angles
- adSenseROI should reflect category CPM rates accurately
Return only the JSON object, no markdown.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: CONTENT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // cache across all scripts in this run
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip markdown code fences if present
  const jsonText = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  try {
    const parsed = JSON.parse(jsonText) as VideoScript;
    parsed.generatedAt = new Date().toISOString();
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to parse Claude video script JSON: ${(err as Error).message}. Raw: ${jsonText.slice(0, 200)}`
    );
  }
}

// ─── Step 4: Save to WAND Queue ───────────────────────────────────────────────

function saveToWandQueue(scripts: VideoScript[], topics: ScoredTopic[]): string {
  fs.mkdirSync(WAND_QUEUE_DIR, { recursive: true });

  const date = todayDateStr();
  const entry: WANDQueueEntry = {
    date,
    generatedAt: new Date().toISOString(),
    topics,
    scripts,
    pipelineVersion: "4.0.0",
  };

  const filePath = path.join(WAND_QUEUE_DIR, `${date}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
  return filePath;
}

// ─── Step 5: Trigger Narration ────────────────────────────────────────────────

async function triggerNarration(scripts: VideoScript[]): Promise<void> {
  for (const script of scripts.slice(0, 3)) {
    // top 3 only
    try {
      const res = await fetchWithTimeout(
        `${OPEN_LLM_VTUBER_URL}/record`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: script.title,
            text: script.script,
            format: script.format,
            tags: script.tags.slice(0, 5),
          }),
        },
        30_000
      );

      if (!res.ok) {
        console.warn(
          `[WAND] Narration trigger failed for "${script.title}": HTTP ${res.status}`
        );
      }
    } catch (err) {
      console.warn(
        `[WAND] Narration trigger error for "${script.title}": ${(err as Error).message}`
      );
    }
  }
}

// ─── Step 6: Telegram Notification ───────────────────────────────────────────

export async function notifyContentReady(scripts: VideoScript[]): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const top3 = scripts.slice(0, 3);
  const lines = [
    `*WAND Daily Content Ready — ${todayDateStr()}*`,
    `Generated ${scripts.length} video scripts\n`,
    ...top3.map(
      (s, i) =>
        `*${i + 1}. ${s.title}*\n` +
        `Format: ${s.format} | Est. ${s.estimatedViews.toLocaleString()} views | $${s.adSenseROI}/1K\n` +
        `Hook: _${s.hookLine}_`
    ),
  ];

  const text = lines.join("\n");

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetchWithTimeout(
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

    if (!res.ok) {
      console.warn(`[WAND] Telegram notification failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[WAND] Telegram error: ${(err as Error).message}`);
  }
}

// ─── Step 7: Supabase Upsert ──────────────────────────────────────────────────

async function upsertToSupabase(scripts: VideoScript[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const rows: SupabaseWandRow[] = scripts.map((s) => ({
    date: todayDateStr(),
    topic: s.topic,
    title: s.title,
    tags: s.tags,
    estimated_views: s.estimatedViews,
    adsense_roi: s.adSenseROI,
    format: s.format,
    generated_at: s.generatedAt,
    script_preview: s.script.slice(0, 500),
  }));

  try {
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/wand_content`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(rows),
      },
      15_000
    );

    if (!res.ok) {
      console.warn(`[WAND] Supabase upsert failed: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[WAND] Supabase error: ${(err as Error).message}`);
  }
}

// ─── Step 8: Save Performance Patterns ───────────────────────────────────────

function saveContentPatterns(scripts: VideoScript[]): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  interface PatternEntry {
    timestamp: string;
    type: string;
    task: string;
    result_preview: string;
    metadata: {
      format: string;
      topic: string;
      estimatedViews: number;
      adSenseROI: number;
    };
  }

  const existing = readJsonFile<PatternEntry[]>(PATTERNS_PATH, []);

  const newPatterns: PatternEntry[] = scripts.map((s) => ({
    timestamp: new Date().toISOString(),
    type: "wand_content_generation",
    task: `Generated ${s.format} script for: ${s.topic}`,
    result_preview: `${s.title} | ~${s.estimatedViews} views | $${s.adSenseROI}/1K`,
    metadata: {
      format: s.format,
      topic: s.topic,
      estimatedViews: s.estimatedViews,
      adSenseROI: s.adSenseROI,
    },
  }));

  const merged = [...existing, ...newPatterns].slice(-500);
  fs.writeFileSync(PATTERNS_PATH, JSON.stringify(merged, null, 2), "utf-8");
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export interface WANDPipelineResult {
  date: string;
  topicsScanned: number;
  scriptsGenerated: number;
  queuePath: string;
  topScript: VideoScript | null;
  durationMs: number;
  errors: string[];
}

export async function runWandDailyPipeline(): Promise<WANDPipelineResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log("[WAND] Starting daily pipeline...");

  // Step 1: Fetch trending topics
  const [youtubeTrends, googleTrends] = await Promise.allSettled([
    fetchYouTubeTrending(),
    fetchGoogleTrends(),
  ]);

  const allTopics: TrendingTopic[] = [
    ...(youtubeTrends.status === "fulfilled" ? youtubeTrends.value : []),
    ...(googleTrends.status === "fulfilled" ? googleTrends.value : []),
  ];

  if (youtubeTrends.status === "rejected") {
    errors.push(`YouTube fetch: ${(youtubeTrends.reason as Error).message}`);
  }
  if (googleTrends.status === "rejected") {
    errors.push(`Google Trends: ${(googleTrends.reason as Error).message}`);
  }

  // Deduplicate by normalized title
  const seen = new Set<string>();
  const uniqueTopics = allTopics.filter((t) => {
    const key = t.title.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[WAND] Fetched ${uniqueTopics.length} unique topics`);

  // Step 2: Score topics
  const scoredTopics = scoreTopics(uniqueTopics).slice(0, 5); // top 5

  // Step 3: Generate scripts (parallel with rate limiting)
  const scripts: VideoScript[] = [];
  for (const scored of scoredTopics) {
    try {
      const script = await generateVideoScript(
        scored.topic.title,
        `${scored.contentAngle} audience interested in ${scored.topic.category}`
      );
      scripts.push(script);
      console.log(`[WAND] Generated script: "${script.title}"`);
    } catch (err) {
      const msg = `Script generation failed for "${scored.topic.title}": ${(err as Error).message}`;
      console.warn(`[WAND] ${msg}`);
      errors.push(msg);
    }
  }

  if (scripts.length === 0) {
    throw new Error("[WAND] No scripts generated — aborting pipeline");
  }

  // Step 4: Save to queue
  const queuePath = saveToWandQueue(scripts, scoredTopics);
  console.log(`[WAND] Queue saved: ${queuePath}`);

  // Steps 5-8: Execute in parallel (non-blocking failures)
  await Promise.allSettled([
    triggerNarration(scripts),
    notifyContentReady(scripts),
    upsertToSupabase(scripts),
    (async () => saveContentPatterns(scripts))(),
  ]);

  const durationMs = Date.now() - startTime;
  console.log(`[WAND] Pipeline complete in ${(durationMs / 1000).toFixed(1)}s`);

  return {
    date: todayDateStr(),
    topicsScanned: uniqueTopics.length,
    scriptsGenerated: scripts.length,
    queuePath,
    topScript: scripts[0] ?? null,
    durationMs,
    errors,
  };
}
