// market-intelligence/signals/opportunity-scorer.ts
// Opportunity Scoring Engine — Claude Architect OS v4.0
//
// Formula: score = (demand × compound_factor × leverage_multiplier) / (ttv × saturation)
// Normalized to 0.0–1.0 range. Threshold for actionable opportunities: 0.72
//
// Data sources: Amazon trends, TikTok virality, eBay comps, local market pricing
// Output: Daily ranked report to ~/.amsa/linear-queue/

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

// ============================================================
// INTERFACES
// ============================================================

export interface MarketSignal {
  id: string;
  source: "amazon" | "tiktok" | "ebay" | "google_trends" | "reddit" | "manual" | "local_pricing";
  signal_type:
    | "trending"
    | "price_gap"
    | "demand_spike"
    | "viral"
    | "arbitrage"
    | "seasonal"
    | "emerging";
  keyword: string;
  category: string;
  raw_data: Record<string, unknown>;
  // Source-specific fields
  amazon?: {
    bsr_rank?: number;           // Best Seller Rank — lower is better
    bsr_category?: string;
    review_count?: number;
    avg_rating?: number;
    price_usd?: number;
    monthly_sales_est?: number;
    trend_30d?: number;          // percent change over 30 days
  };
  tiktok?: {
    hashtag_views?: number;
    video_count?: number;
    velocity_7d?: number;        // percent growth over 7 days
    engagement_rate?: number;
    avg_shares?: number;
  };
  ebay?: {
    sold_count_30d?: number;
    avg_sold_price_usd?: number;
    active_listings?: number;
    sell_through_rate?: number;  // sold / (sold + active)
    price_trend_30d?: number;    // percent change
  };
  google_trends?: {
    interest_score?: number;     // 0-100
    trend_direction?: "up" | "flat" | "down";
    related_queries?: string[];
    breakout?: boolean;          // sudden spike (>5000% growth)
  };
  local_pricing?: {
    local_buy_price_usd?: number;
    online_sell_price_usd?: number;
    sourcing_location?: string;
    availability?: "abundant" | "moderate" | "scarce";
  };
  fetched_at: string;
  confidence: number;            // 0.0–1.0, based on data quality
}

export interface TrendData {
  keyword: string;
  platforms: Array<{
    platform: string;
    velocity: number;            // normalized 0.0–1.0
    volume: number;              // absolute volume
    trend_direction: "up" | "flat" | "down";
    data_age_hours: number;
  }>;
  cross_platform_score: number; // average velocity across platforms
  breakout: boolean;
  fetched_at: string;
}

export interface OpportunityScore {
  opportunity_id: string;
  signal_id: string;
  keyword: string;
  category: string;
  opportunity_type: "flip" | "saas" | "arbitrage" | "affiliate" | "content" | "service";

  // Formula components (each 0.0–1.0)
  demand_score: number;
  compound_factor: number;       // how much does value compound over time?
  leverage_multiplier: number;   // how much leverage does this offer?
  ttv_normalized: number;        // time-to-value, normalized (higher = faster)
  saturation_inverse: number;    // 1 - saturation (higher = less saturated)

  // Final computed score
  raw_score: number;             // before normalization
  score: number;                 // 0.0–1.0 normalized

  // Human-readable estimates
  ttv_days: number;
  expected_return_multiplier: number;
  required_capital_usd: number;
  required_effort_hours: number;
  confidence: number;

  // Action guidance
  recommended_action: string;
  action_urgency: "immediate" | "this_week" | "this_month" | "low_priority";
  key_risks: string[];
  key_advantages: string[];

  scored_at: string;
  expires_at: string;            // when this score should be re-computed
}

export interface DailyReport {
  report_id: string;
  generated_at: string;
  date: string;
  total_signals_processed: number;
  opportunities_found: number;
  actionable_opportunities: number;  // score >= threshold
  top_opportunities: OpportunityScore[];
  summary: {
    by_category: Record<string, number>;
    by_type: Record<string, number>;
    avg_score: number;
    highest_score: number;
    total_capital_required_usd: number;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

const SCORE_THRESHOLD = 0.72;          // minimum score to be considered actionable
const LINEAR_QUEUE_DIR = path.join(os.homedir(), ".amsa", "linear-queue");
const SIGNAL_CACHE_DIR = path.join(os.homedir(), ".amsa", "memory", "trend-cache");

// Category-specific scoring parameters
const CATEGORY_PARAMS: Record<string, {
  compound_base: number;
  leverage_base: number;
  ttv_base_days: number;
  saturation_adjustment: number;
}> = {
  electronics:     { compound_base: 0.6, leverage_base: 0.7, ttv_base_days: 7,   saturation_adjustment: -0.15 },
  collectibles:    { compound_base: 0.8, leverage_base: 0.9, ttv_base_days: 14,  saturation_adjustment: -0.05 },
  clothing:        { compound_base: 0.5, leverage_base: 0.6, ttv_base_days: 10,  saturation_adjustment: -0.20 },
  books:           { compound_base: 0.7, leverage_base: 0.8, ttv_base_days: 5,   saturation_adjustment: 0.10  },
  toys:            { compound_base: 0.9, leverage_base: 0.8, ttv_base_days: 30,  saturation_adjustment: -0.10 },
  home_garden:     { compound_base: 0.6, leverage_base: 0.7, ttv_base_days: 14,  saturation_adjustment: -0.05 },
  health_beauty:   { compound_base: 0.7, leverage_base: 0.8, ttv_base_days: 7,   saturation_adjustment: -0.15 },
  software:        { compound_base: 1.0, leverage_base: 1.0, ttv_base_days: 90,  saturation_adjustment: 0.05  },
  digital_content: { compound_base: 0.9, leverage_base: 1.0, ttv_base_days: 30,  saturation_adjustment: 0.10  },
  services:        { compound_base: 0.8, leverage_base: 0.9, ttv_base_days: 14,  saturation_adjustment: 0.00  },
  default:         { compound_base: 0.6, leverage_base: 0.7, ttv_base_days: 14,  saturation_adjustment: 0.00  },
};

// ============================================================
// CORE SCORING FUNCTIONS
// ============================================================

/**
 * Compute demand score (0.0–1.0) from a market signal.
 * Higher demand_score = stronger, clearer demand signal.
 */
function computeDemandScore(signal: MarketSignal): number {
  let score = 0.5;  // baseline

  if (signal.amazon) {
    const a = signal.amazon;
    // BSR rank: <1000 in major category = very high demand
    if (a.bsr_rank !== undefined) {
      if (a.bsr_rank < 100)    score += 0.30;
      else if (a.bsr_rank < 1000)  score += 0.20;
      else if (a.bsr_rank < 5000)  score += 0.10;
      else if (a.bsr_rank > 100000) score -= 0.20;
    }
    // 30-day trend
    if (a.trend_30d !== undefined) {
      if (a.trend_30d > 50)    score += 0.15;
      else if (a.trend_30d > 20)   score += 0.10;
      else if (a.trend_30d < -20)  score -= 0.15;
    }
    // Monthly sales estimate
    if (a.monthly_sales_est !== undefined) {
      if (a.monthly_sales_est > 1000) score += 0.10;
      else if (a.monthly_sales_est > 300) score += 0.05;
    }
    // High review count with decent rating = proven demand
    if (a.review_count && a.avg_rating) {
      if (a.review_count > 500 && a.avg_rating >= 4.0) score += 0.05;
    }
  }

  if (signal.tiktok) {
    const t = signal.tiktok;
    // TikTok virality is the strongest demand signal for consumer goods
    if (t.velocity_7d !== undefined) {
      if (t.velocity_7d > 200)  score += 0.20;
      else if (t.velocity_7d > 100) score += 0.15;
      else if (t.velocity_7d > 50)  score += 0.10;
    }
    if (t.hashtag_views !== undefined) {
      if (t.hashtag_views > 100_000_000) score += 0.10;
      else if (t.hashtag_views > 10_000_000)  score += 0.05;
    }
  }

  if (signal.google_trends) {
    const g = signal.google_trends;
    if (g.interest_score !== undefined) {
      score += (g.interest_score / 100) * 0.15;
    }
    if (g.breakout) score += 0.15;
    if (g.trend_direction === "up")   score += 0.05;
    if (g.trend_direction === "down") score -= 0.10;
  }

  if (signal.ebay) {
    const e = signal.ebay;
    if (e.sell_through_rate !== undefined) {
      // >50% sell-through = strong demand
      if (e.sell_through_rate > 0.7)  score += 0.10;
      else if (e.sell_through_rate > 0.5) score += 0.05;
      else if (e.sell_through_rate < 0.2) score -= 0.10;
    }
  }

  return clamp(score, 0.0, 1.0);
}

/**
 * Compute compound factor (0.0–1.0).
 * How much does the value of this opportunity grow over time?
 * Recurring revenue, network effects, and brand moats score highest.
 */
function computeCompoundFactor(signal: MarketSignal): number {
  const categoryKey = (signal.category || "default").toLowerCase().replace(/[^a-z_]/g, "_");
  const params = CATEGORY_PARAMS[categoryKey] ?? CATEGORY_PARAMS.default;
  let score = params.compound_base;

  // Adjust based on opportunity characteristics
  if (signal.signal_type === "trending")  score += 0.05;  // trends compound while hot
  if (signal.signal_type === "viral")     score += 0.10;  // viral = accelerating demand
  if (signal.signal_type === "seasonal")  score -= 0.10;  // seasonal = time-limited

  // Software and digital content have the highest compound potential
  if (["software", "digital_content", "saas"].includes(categoryKey)) {
    score = Math.min(score + 0.15, 1.0);
  }

  // Physical arbitrage: moderate compound (limited by inventory)
  if (signal.signal_type === "arbitrage" || signal.signal_type === "price_gap") {
    score = Math.min(score, 0.70);
  }

  return clamp(score, 0.0, 1.0);
}

/**
 * Compute leverage multiplier (0.0–1.0).
 * How much output does this opportunity produce per unit of input?
 * Automation, scalability, and reusability are key.
 */
function computeLeverageMultiplier(signal: MarketSignal): number {
  const categoryKey = (signal.category || "default").toLowerCase().replace(/[^a-z_]/g, "_");
  const params = CATEGORY_PARAMS[categoryKey] ?? CATEGORY_PARAMS.default;
  let score = params.leverage_base;

  // Price gap signals: leverage depends on margin size
  if (signal.signal_type === "price_gap" && signal.local_pricing) {
    const buy = signal.local_pricing.local_buy_price_usd ?? 0;
    const sell = signal.local_pricing.online_sell_price_usd ?? 0;
    if (buy > 0 && sell > buy) {
      const margin = (sell - buy) / buy;
      if (margin > 1.0)  score += 0.20;   // >100% margin
      else if (margin > 0.5) score += 0.10; // >50% margin
      else if (margin > 0.3) score += 0.05; // >30% margin
      else if (margin < 0.1) score -= 0.20; // <10% margin (barely worth it)
    }
  }

  // Arbitrage on eBay: leverage = sell-through × margin
  if (signal.ebay && signal.signal_type === "arbitrage") {
    const str = signal.ebay.sell_through_rate ?? 0.3;
    score += str * 0.15;
  }

  // Digital/software: maximum leverage (zero marginal cost)
  if (["software", "digital_content"].includes(categoryKey)) {
    score = Math.max(score, 0.90);
  }

  return clamp(score, 0.0, 1.0);
}

/**
 * Estimate time-to-value in days and return a normalized 0.0–1.0 score.
 * Higher score = faster time to value (better).
 * The normalization uses: ttv_normalized = 1 / (1 + log(ttv_days))
 */
function computeTTVNormalized(signal: MarketSignal): {
  ttv_days: number;
  ttv_normalized: number;
} {
  const categoryKey = (signal.category || "default").toLowerCase().replace(/[^a-z_]/g, "_");
  const params = CATEGORY_PARAMS[categoryKey] ?? CATEGORY_PARAMS.default;
  let ttv_days = params.ttv_base_days;

  // Adjustments based on signal characteristics
  if (signal.signal_type === "price_gap" || signal.signal_type === "arbitrage") {
    ttv_days = 3;  // very fast — buy and resell
  }
  if (signal.signal_type === "viral") {
    ttv_days = Math.max(1, ttv_days * 0.5);  // viral = act fast
  }
  if (signal.signal_type === "seasonal") {
    ttv_days = Math.max(1, ttv_days * 0.3);  // seasonal = short window
  }
  if (categoryKey === "software") {
    ttv_days = 90;  // software takes longer but compounds more
  }

  // Normalized: 1 / (1 + ln(ttv_days))
  // 1 day → 1.0, 7 days → 0.59, 30 days → 0.29, 90 days → 0.22
  const ttv_normalized = 1 / (1 + Math.log(Math.max(ttv_days, 1)));

  return { ttv_days, ttv_normalized };
}

/**
 * Estimate market saturation and return inverse (1 - saturation).
 * Higher saturation_inverse = less competition = better.
 */
function computeSaturationInverse(signal: MarketSignal): number {
  const categoryKey = (signal.category || "default").toLowerCase().replace(/[^a-z_]/g, "_");
  const params = CATEGORY_PARAMS[categoryKey] ?? CATEGORY_PARAMS.default;
  let saturation = 0.5 + params.saturation_adjustment; // start from category baseline

  if (signal.ebay) {
    const e = signal.ebay;
    // More active listings = more competition = higher saturation
    if (e.active_listings !== undefined) {
      if (e.active_listings > 5000) saturation += 0.20;
      else if (e.active_listings > 1000) saturation += 0.10;
      else if (e.active_listings < 100) saturation -= 0.15;
    }
    // Low sell-through = oversupplied market
    if (e.sell_through_rate !== undefined && e.sell_through_rate < 0.2) {
      saturation += 0.20;
    }
  }

  if (signal.google_trends?.breakout) {
    saturation -= 0.15; // breakout trends are often unsaturated early
  }

  if (signal.amazon) {
    const a = signal.amazon;
    // Very high review counts = mature, potentially saturated market
    if (a.review_count && a.review_count > 10000) saturation += 0.10;
  }

  const saturation_clamped = clamp(saturation, 0.0, 1.0);
  return clamp(1.0 - saturation_clamped, 0.05, 1.0); // never fully zero
}

/**
 * Main scoring function.
 * Formula: score = (demand × compound × leverage × ttv_normalized × saturation_inverse)
 * Normalized against a theoretical maximum of ~0.7–0.9 to produce a 0.0–1.0 output.
 */
export function scoreOpportunity(signal: MarketSignal): OpportunityScore {
  const opportunityId = `opp_${signal.id}_${Date.now().toString(36)}`;

  // Compute all components
  const demand_score      = computeDemandScore(signal);
  const compound_factor   = computeCompoundFactor(signal);
  const leverage_mult     = computeLeverageMultiplier(signal);
  const { ttv_days, ttv_normalized } = computeTTVNormalized(signal);
  const saturation_inv    = computeSaturationInverse(signal);

  // Apply formula
  const raw_score = demand_score * compound_factor * leverage_mult * ttv_normalized * saturation_inv;

  // Normalize: the theoretical maximum of the product is ~1.0 but realistically ~0.5–0.7
  // We scale by 1.8 to map realistic high scores to the 0.8–1.0 range
  const score = clamp(raw_score * 1.8, 0.0, 1.0);

  // Derive opportunity type
  const opportunity_type = deriveOpportunityType(signal);

  // Estimate financial parameters
  const { required_capital_usd, expected_return_multiplier, required_effort_hours } =
    estimateFinancials(signal, score);

  // Action urgency
  const action_urgency = deriveUrgency(signal, score);

  // Generate recommended action
  const recommended_action = generateRecommendedAction(signal, score, opportunity_type);

  // Key risks and advantages
  const key_risks      = identifyRisks(signal, score);
  const key_advantages = identifyAdvantages(signal, score, demand_score, compound_factor);

  // Score expires based on signal type and TTL
  const ttl_hours = signal.signal_type === "viral" ? 24 : signal.signal_type === "trending" ? 48 : 168;
  const expires_at = new Date(Date.now() + ttl_hours * 3600 * 1000).toISOString();

  return {
    opportunity_id: opportunityId,
    signal_id: signal.id,
    keyword: signal.keyword,
    category: signal.category,
    opportunity_type,
    demand_score,
    compound_factor,
    leverage_multiplier: leverage_mult,
    ttv_normalized,
    saturation_inverse: saturation_inv,
    raw_score,
    score,
    ttv_days,
    expected_return_multiplier,
    required_capital_usd,
    required_effort_hours,
    confidence: signal.confidence,
    recommended_action,
    action_urgency,
    key_risks,
    key_advantages,
    scored_at: new Date().toISOString(),
    expires_at,
  };
}

/**
 * Rank an array of signals by their opportunity scores, highest first.
 * Filters out signals with confidence < 0.3 before scoring.
 */
export function rankOpportunities(signals: MarketSignal[]): OpportunityScore[] {
  // Filter low-confidence signals
  const qualifiedSignals = signals.filter((s) => s.confidence >= 0.3);

  // Score all
  const scored = qualifiedSignals.map((s) => scoreOpportunity(s));

  // Sort by score descending, then by ttv_days ascending (prefer faster)
  return scored.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
    return a.ttv_days - b.ttv_days;
  });
}

/**
 * Filter scored opportunities by minimum score threshold.
 * Default threshold is the global SCORE_THRESHOLD (0.72).
 */
export function filterByThreshold(
  scores: OpportunityScore[],
  min_score: number = SCORE_THRESHOLD
): OpportunityScore[] {
  return scores.filter((s) => s.score >= min_score);
}

// ============================================================
// REPORT GENERATION
// ============================================================

/**
 * Generate a daily opportunity report and write to ~/.amsa/linear-queue/
 * Returns the report object.
 */
export async function generateDailyReport(
  signals: MarketSignal[]
): Promise<DailyReport> {
  const reportId = `report_${new Date().toISOString().slice(0, 10)}_${crypto.randomBytes(3).toString("hex")}`;
  const generatedAt = new Date().toISOString();
  const date = generatedAt.slice(0, 10);

  // Score and rank all signals
  const allScored = rankOpportunities(signals);
  const actionable = filterByThreshold(allScored, SCORE_THRESHOLD);

  // Build summary statistics
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const opp of actionable) {
    byCategory[opp.category] = (byCategory[opp.category] ?? 0) + 1;
    byType[opp.opportunity_type] = (byType[opp.opportunity_type] ?? 0) + 1;
  }

  const avgScore =
    actionable.length > 0
      ? actionable.reduce((sum, o) => sum + o.score, 0) / actionable.length
      : 0;

  const highestScore = actionable[0]?.score ?? 0;

  const totalCapital = actionable.reduce(
    (sum, o) => sum + (o.required_capital_usd ?? 0),
    0
  );

  const report: DailyReport = {
    report_id: reportId,
    generated_at: generatedAt,
    date,
    total_signals_processed: signals.length,
    opportunities_found: allScored.length,
    actionable_opportunities: actionable.length,
    top_opportunities: actionable.slice(0, 20), // top 20
    summary: {
      by_category: byCategory,
      by_type: byType,
      avg_score: Math.round(avgScore * 1000) / 1000,
      highest_score: Math.round(highestScore * 1000) / 1000,
      total_capital_required_usd: Math.round(totalCapital * 100) / 100,
    },
  };

  // Write to linear-queue
  await writeReportToQueue(report);

  return report;
}

async function writeReportToQueue(report: DailyReport): Promise<void> {
  fs.mkdirSync(LINEAR_QUEUE_DIR, { recursive: true });

  const filename = `opportunities_${report.date}.json`;
  const filepath = path.join(LINEAR_QUEUE_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");

  // Also write a latest.json for easy access
  const latestPath = path.join(LINEAR_QUEUE_DIR, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), "utf-8");

  // Append top opportunities to the queue (FIFO)
  const queuePath = path.join(LINEAR_QUEUE_DIR, "queue.json");
  let queue: OpportunityScore[] = [];
  if (fs.existsSync(queuePath)) {
    try {
      queue = JSON.parse(fs.readFileSync(queuePath, "utf-8")) as OpportunityScore[];
    } catch {
      queue = [];
    }
  }

  // Add new opportunities, avoid duplicates by keyword
  const existingKeywords = new Set(queue.map((q) => q.keyword));
  const newOpps = report.top_opportunities.filter(
    (o) => !existingKeywords.has(o.keyword)
  );
  queue = [...newOpps, ...queue].slice(0, 100); // keep most recent 100
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function deriveOpportunityType(
  signal: MarketSignal
): OpportunityScore["opportunity_type"] {
  if (signal.signal_type === "price_gap" || signal.signal_type === "arbitrage") {
    return "arbitrage";
  }
  if (signal.signal_type === "viral" || signal.signal_type === "trending") {
    const cat = signal.category.toLowerCase();
    if (cat.includes("software") || cat.includes("digital")) return "saas";
    if (cat.includes("content")) return "content";
    return "flip";
  }
  if (signal.category.toLowerCase().includes("service")) return "service";
  if (signal.category.toLowerCase().includes("affiliate")) return "affiliate";
  return "flip";
}

function deriveUrgency(
  signal: MarketSignal,
  score: number
): OpportunityScore["action_urgency"] {
  if (signal.signal_type === "viral" && score >= 0.80) return "immediate";
  if (signal.signal_type === "trending" && score >= 0.75) return "this_week";
  if (signal.signal_type === "price_gap") return "this_week";
  if (score >= 0.85) return "this_week";
  if (score >= 0.72) return "this_month";
  return "low_priority";
}

function generateRecommendedAction(
  signal: MarketSignal,
  score: number,
  type: OpportunityScore["opportunity_type"]
): string {
  const keyword = signal.keyword;

  if (type === "arbitrage" && signal.local_pricing) {
    const buy = signal.local_pricing.local_buy_price_usd ?? 0;
    const sell = signal.local_pricing.online_sell_price_usd ?? 0;
    return `Source "${keyword}" locally at ~$${buy.toFixed(0)} and list on eBay/Amazon at ~$${sell.toFixed(0)}. Target 3–5 units to test. List within 24h of sourcing.`;
  }

  if (type === "flip" && signal.signal_type === "viral") {
    return `"${keyword}" is trending on TikTok. Source 10–20 units immediately, list on Amazon/eBay at current market rate. Window: 72 hours before saturation.`;
  }

  if (type === "flip" && signal.amazon) {
    const bsr = signal.amazon.bsr_rank;
    return `"${keyword}" has BSR ${bsr ?? "N/A"} — strong sell-through. Source wholesale, list on Amazon FBA. Research 3 competing ASINs first.`;
  }

  if (type === "saas") {
    return `Build a lightweight SaaS/tool for "${keyword}" demand. Validate with a landing page first (< 1 week). Target ${Math.round(score * 100)}% opportunity score means strong market pull.`;
  }

  if (type === "content") {
    return `Create content around "${keyword}". High-velocity trend with monetization via affiliate links, sponsorships, or digital products. Publish within 48h.`;
  }

  return `Research "${keyword}" further. Score ${(score * 100).toFixed(0)}%. Validate demand with a small test before committing capital.`;
}

function identifyRisks(
  signal: MarketSignal,
  score: number
): string[] {
  const risks: string[] = [];

  if (signal.signal_type === "viral") {
    risks.push("Viral trends can collapse within days — time-to-market is critical");
  }
  if (signal.signal_type === "seasonal") {
    risks.push("Seasonal demand window may be narrow — price rapidly after peak");
  }
  if (signal.ebay?.active_listings && signal.ebay.active_listings > 1000) {
    risks.push(`High competition on eBay (${signal.ebay.active_listings} active listings)`);
  }
  if (signal.amazon?.bsr_rank && signal.amazon.bsr_rank > 50000) {
    risks.push("Relatively high Amazon BSR — slow-moving inventory risk");
  }
  if (signal.confidence < 0.5) {
    risks.push("Low data confidence — validate manually before committing capital");
  }
  if (score < 0.75 && score >= 0.72) {
    risks.push("Near-threshold score — monitor for 24–48h to confirm trend continuation");
  }

  return risks.slice(0, 4);
}

function identifyAdvantages(
  signal: MarketSignal,
  score: number,
  demand: number,
  compound: number
): string[] {
  const advantages: string[] = [];

  if (demand >= 0.8) {
    advantages.push("Strong, multi-platform demand confirmation");
  }
  if (compound >= 0.8) {
    advantages.push("High compound value — opportunity improves over time");
  }
  if (signal.google_trends?.breakout) {
    advantages.push("Google Trends breakout — early-mover window is open");
  }
  if (signal.ebay?.sell_through_rate && signal.ebay.sell_through_rate > 0.6) {
    advantages.push(`High eBay sell-through rate (${(signal.ebay.sell_through_rate * 100).toFixed(0)}%)`);
  }
  if (signal.tiktok?.velocity_7d && signal.tiktok.velocity_7d > 100) {
    advantages.push(`TikTok velocity +${signal.tiktok.velocity_7d.toFixed(0)}% in 7 days`);
  }
  if (score >= 0.85) {
    advantages.push("Top-tier opportunity score — high priority for immediate action");
  }

  return advantages.slice(0, 4);
}

function estimateFinancials(
  signal: MarketSignal,
  score: number
): {
  required_capital_usd: number;
  expected_return_multiplier: number;
  required_effort_hours: number;
} {
  // Base capital requirement by category
  let capital = 200;
  let returnMult = 1.5;
  let effort = 4;

  if (signal.local_pricing) {
    const buy = signal.local_pricing.local_buy_price_usd ?? 50;
    const sell = signal.local_pricing.online_sell_price_usd ?? 100;
    capital = buy * 5;  // 5 units to start
    returnMult = sell / buy;
    effort = 3;
  } else if (signal.amazon?.price_usd) {
    capital = signal.amazon.price_usd * 10;
    returnMult = Math.max(1.3, score * 2.5);
    effort = 5;
  } else if (signal.category.toLowerCase().includes("software")) {
    capital = 500;  // dev time / tools
    returnMult = Math.max(3, score * 5);
    effort = 80;
  }

  // Score adjusts return expectation
  returnMult = returnMult * (1 + (score - 0.5) * 0.5);

  return {
    required_capital_usd: Math.round(capital * 100) / 100,
    expected_return_multiplier: Math.round(returnMult * 100) / 100,
    required_effort_hours: effort,
  };
}

// ============================================================
// SIGNAL CACHING
// ============================================================

export function cacheSignal(signal: MarketSignal): void {
  fs.mkdirSync(SIGNAL_CACHE_DIR, { recursive: true });
  const key = `${signal.source}_${signal.keyword.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  const filepath = path.join(SIGNAL_CACHE_DIR, `${key}.json`);
  fs.writeFileSync(filepath, JSON.stringify(signal, null, 2), "utf-8");
}

export function loadCachedSignals(maxAgeHours: number = 48): MarketSignal[] {
  if (!fs.existsSync(SIGNAL_CACHE_DIR)) return [];

  const files = fs.readdirSync(SIGNAL_CACHE_DIR).filter((f) => f.endsWith(".json"));
  const cutoff = Date.now() - maxAgeHours * 3600 * 1000;
  const signals: MarketSignal[] = [];

  for (const file of files) {
    try {
      const filepath = path.join(SIGNAL_CACHE_DIR, file);
      const stat = fs.statSync(filepath);
      if (stat.mtimeMs < cutoff) continue;  // too old

      const signal = JSON.parse(fs.readFileSync(filepath, "utf-8")) as MarketSignal;
      signals.push(signal);
    } catch {
      // skip malformed cache files
    }
  }

  return signals;
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export function getScoreThreshold(): number {
  return SCORE_THRESHOLD;
}

export function describeScore(score: number): string {
  if (score >= 0.90) return "Exceptional — act immediately";
  if (score >= 0.80) return "Strong — high priority this week";
  if (score >= 0.72) return "Actionable — schedule for this week/month";
  if (score >= 0.60) return "Moderate — monitor and re-score in 48h";
  if (score >= 0.40) return "Weak — not worth pursuing currently";
  return "Very low — discard";
}

export function formatScore(opp: OpportunityScore): string {
  return [
    `${opp.keyword} (${opp.category})`,
    `Score:    ${(opp.score * 100).toFixed(1)}%  [${describeScore(opp.score)}]`,
    `Demand:   ${(opp.demand_score * 100).toFixed(0)}%  | Compound: ${(opp.compound_factor * 100).toFixed(0)}%  | Leverage: ${(opp.leverage_multiplier * 100).toFixed(0)}%`,
    `TTV:      ${opp.ttv_days} days | Return: ${opp.expected_return_multiplier.toFixed(1)}x | Capital: $${opp.required_capital_usd}`,
    `Urgency:  ${opp.action_urgency}`,
    `Action:   ${opp.recommended_action}`,
  ].join("\n");
}
