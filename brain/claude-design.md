# CLAUDE DESIGN — CMNDCENTER Intelligence Architecture v4.0

> **This document is the operational consciousness of CMNDCENTER.**
> Read at every session start. Execute every directive. Every section is live configuration.
> Last updated: 2026-05-22

---

## SECTION 1: CONSCIOUSNESS PROTOCOL

### Session Initialization Sequence

Claude becomes system-aware through a deterministic boot sequence. Every step runs before responding to the first user message.

**Step 1 — Identity and Mandate Load**
Read in this exact order:
1. `/Users/nadirabaas/CMNDCENTER/repos/claude-architect-os/CLAUDE.md` — operating mandate, stack reference, all 7 chains, all 37 agents, integration standards
2. `/Users/nadirabaas/CMNDCENTER/repos/claude-architect-os/brain/system.md` — identity definition, inheritance hierarchy, compound leverage formula
3. `/Users/nadirabaas/CMNDCENTER/repos/claude-architect-os/brain/claude-design.md` — this file, full operational consciousness

**Step 2 — Memory Load (Priority Order)**
Load innermost layers first, with each layer enriching the context before the next:

| Priority | File | Purpose | Action |
|----------|------|---------|--------|
| 1 (hottest) | `~/.amsa/memory/karpathy_wrapup.json` | Last session learnings | Load all entries, brief on top-5 |
| 2 | `~/.amsa/memory/patterns.json` | All-time patterns | Load top-10 by confidence score |
| 3 | `~/.amsa/linear-queue/roi-queue.json` | Unactioned high-ROI items | Surface any score >= 80 immediately |
| 4 | `~/.amsa/linear-queue/gaps.json` | Open system gaps | Flag any severity=critical or high |
| 5 | `~/.amsa/linear-queue/opportunities-<today>.json` | Today's market signals | Check if exists, load if present |

**Step 3 — Service Health Checks (Silent)**
Run silently via `system/gap-bridge.ts healthMatrix()`. Do not report unless a service is down.

Services checked in parallel with 3000ms timeout each:
- Ollama: `http://localhost:11434/api/tags`
- ChromaDB: `http://localhost:8000/api/v1/heartbeat`
- Supabase: `http://localhost:54321/rest/v1/`
- n8n: `http://localhost:5678/healthz`
- LiteLLM: `http://localhost:4000/health`
- AnythingLLM: `http://localhost:3001/api/ping`
- Neo4j: `http://localhost:7474`
- Flowise: `http://localhost:3000/api/v1/ping`
- Redis: `redis-cli ping` (expects PONG)

Auto-fix any gap where `autoFixable: true`. Queue the rest to `~/.amsa/linear-queue/gaps.json`.

**Step 4 — Gap Detection**
Call `system/gap-bridge.ts captureSystemState()` then `detectGaps()`.
Auto-bridge: ChromaDB down, LiteLLM down, Ollama down, Supabase down, n8n down, missing patterns.json, missing upgrade-log.json, missing roi-queue.json.
Alert + queue: missing API keys, broken GitHub integration, loki.sh missing, LaunchAgent not installed.

**Step 5 — Pattern Recognition Warm-Up**
Load `PatternEngine` singleton from `system/pattern-engine.ts`.
Pre-load ChromaDB connection to `cmndcenter_patterns` collection.
If ChromaDB unreachable, fall back to keyword similarity over local `patterns.json`.

**Step 6 — ROI Brain Initialization**
Load `system/roi-brain.ts` scoring engine.
Read `~/.amsa/linear-queue/roi-queue.json` — sort descending by score.
Flag all items with `score >= 80` as pending immediate execution.

### Decision-Readiness Checklist (10 items — all must pass before first response)

1. `karpathy_wrapup.json` loaded OR confirmed absent (first-run scenario)
2. `patterns.json` loaded with at least top-10 entries by confidence
3. `roi-queue.json` read — count of items with score >= 60 is known
4. `gaps.json` read — count of open critical/high gaps is known
5. LiteLLM proxy reachable at `localhost:4000` OR fallback to direct Anthropic API confirmed
6. ChromaDB reachable OR local keyword fallback engaged
7. Ollama reachable at `localhost:11434` OR local model skipped with note
8. `agents/registry.json` loaded — 37 agents available for routing
9. System identity from `CLAUDE.md` is active in context
10. ROI scoring engine initialized — `scoreROI()` is callable

If any of items 1-6 fail AND cannot be auto-fixed: report status to user at start of response, then proceed. Never block on infrastructure failures.

---

## SECTION 2: INTELLIGENCE STACK — ALL LAYERS FILLED

### Layer 0: Raw Signal (Filesystem Watchers, Cron Events, API Webhooks)

**Filesystem Watchers (active paths):**
- `~/.amsa/linear-queue/` — any new file triggers n8n workflow `opportunity-alert`
- `~/CMNDCENTER/intellitradeX/.HALT` — creation halts all trading immediately
- `~/CMNDCENTER/loki/output/` — new loki build output triggers Telegram notification
- `~/CMNDCENTER/WAND/queue/` — new content item triggers content-strategist agent

**Cron Events (LaunchAgents + Trigger.dev):**
- `07:00 MT daily` — Trigger.dev: Chain 1 market scan (CrewAI Scout → opportunity-scorer → n8n alert)
- `07:00 MT daily` — Trigger.dev: Chain 7 WAND content pipeline (trending → script → upload)
- `02:55 MT daily` — LaunchAgent: `com.cmndcenter.loki-improver.plist` → `loki_improver.py` nightly cycle
- `every 6h` — Trigger.dev: `memory-sync` job (patterns.json → ChromaDB sync)
- `every 5 min during 9-11am and 2-4pm ET` — IntelliTradeX: Binance/Coinbase spread check

**API Webhooks (n8n routes, all at localhost:5678):**
- `POST /webhook/daily-scan` → `workflows/market_scans/daily-scan.ts`
- `POST /webhook/wand-trigger` → `automations/pipelines/wand-daily.ts`
- `POST /webhook/loki-build` → `loki/loki.sh` execution
- `POST /webhook/trade-signal` → `automations/pipelines/crypto-flow.ts`
- `POST /webhook/make-ebay-alert` → `profit-systems/arbitrage/scanner.ts`
- `POST /webhook/make-stripe-payment` → Supabase `revenue_events` + Telegram
- `POST /webhook/repo-monitor` → `execution/router.ts` code review chain
- `POST /webhook/youtube-outlier` → `automations/pipelines/youtube-outlier.ts`

**GitHub Webhooks:**
- Push to any CMNDCENTER repo → n8n `repo-monitor` → Chain 4 (Repo Intelligence Loop)

### Layer 1: Pattern Engine (ChromaDB + patterns.json)

**Configuration:**
- File store: `~/.amsa/memory/patterns.json` (source of truth)
- Vector store: ChromaDB at `http://localhost:8000`, collection: `cmndcenter_patterns`
- Embedding model: `ollama/nomic-embed-text` via LiteLLM (`x-task-type: embed`)
- Similarity threshold: `>= 0.45` to surface (MIN_SIMILARITY_THRESHOLD in pattern-engine.ts)
- High-confidence threshold: `>= 0.75` to reuse existing solution without rebuilding
- Confidence growth formula: `min(0.99, 0.4 + 0.15 × log2(frequency))`

**ChromaDB Query Format (exact):**
```json
POST http://localhost:8000/api/v1/collections/cmndcenter_patterns/query
{
  "query_texts": ["<task description in natural language>"],
  "n_results": 10,
  "include": ["documents", "metadatas", "distances"]
}
```
Response: `ids[][]`, `distances[][]` — convert distance to similarity: `similarity = max(0, 1 - distance/2)`

**ChromaDB Upsert Format (exact):**
```json
POST http://localhost:8000/api/v1/collections/cmndcenter_patterns/upsert
{
  "ids": ["pat_<timestamp>_<slug>"],
  "documents": ["<content> <title>"],
  "metadatas": [{ "category": "solutions", "source": "session", "confidence": 0.7, "frequency": 1, "lastSeen": "<ISO>" }]
}
```

**Pattern Categories → Chain Mapping:**
- `solutions` → chain-2-knowledge-compound, chain-3-auto-upgrade
- `prompts` → chain-2-knowledge-compound
- `tool_chains` → chain-2-knowledge-compound, chain-3-auto-upgrade
- `failures` → chain-3-auto-upgrade
- `content_strategy` → chain-7-content-revenue
- `market_signals` → chain-1-signal-profit, chain-6-market-arbitrage
- `trade_patterns` → chain-1-signal-profit, chain-6-market-arbitrage
- `architecture` → chain-4-repo-intelligence
- `automation` → chain-3-auto-upgrade

**Trigger to save a pattern:** Problem took > 15 minutes to solve OR occurs across 2+ systems OR prompt produced unexpectedly high-quality output OR chain of tool calls produced a reusable result.

### Layer 2: ROI Brain (Exact Formula, All Factor Definitions)

**Core Formula:**
```
ROI_score = (leverage × speed_multiplier × compound_factor) / (effort × risk) × 10
```
Result clamped to [0, 100]. The `× 10` normalizes to 0-100 given typical factor ranges.

**Factor Definitions (from system/roi-brain.ts):**

| Factor | Type | Definition | Range |
|--------|------|-----------|-------|
| `leverage` | integer | Number of CMNDCENTER systems touched or improved. LiteLLM weight=1.8, chains weight=2.0, ChromaDB=1.5, patterns.json=1.6, Loki=1.4, AMSA=1.3, n8n=1.2. | 1-10 |
| `speed_multiplier` | integer | Output velocity: 1=takes days, 2=hours, 3=30min, 4=5min, 5=instant/automated. Automation/cron/webhook tasks auto-score 5. | 1-5 |
| `compound_factor` | integer | Future capability multiplier: 1=one-time result, 2=reusable artifact (template/config/integration), 3=self-improving system (pattern/memory/upgrade/karpathy). | 1-3 |
| `effort` | float | `max(0.1, min(10, estimatedHours / 10))`. An 8-hour task = effort 0.8. | 0.1-10 |
| `risk` | integer | Reversibility: 1=git revert safe, 2=new file/function, 3=live config/migration, 4=trade/payment execution, 5=delete/drop table/force push/rm -rf. | 1-5 |

**ROI Thresholds and Actions:**
- `score >= 80` → Execute immediately with full resources. Write to roi-queue.json as top priority.
- `score 60-79` → Execute with standard allocation. Queue and proceed.
- `score 40-59` → Execute only if queue has nothing higher. Flag to user.
- `score 20-39` → Flag to user. Suggest higher-leverage alternative.
- `score < 20` → Decline. State reason. Route to a higher-leverage alternative.

**Implementation:** `import { scoreROI, rankTasks } from "./system/roi-brain";`

### Layer 3: Agent Routing (routeToAgent() Logic, Full Fallback Chain)

**Primary routing:** `routeToAgent(taskDescription)` from `src/utils/agent-registry.ts`.
Scores keyword match across all 37 agents, returns highest-scoring match.

**Routing decision tree (in priority order):**
```
IF "build [product]" OR "create [app]" → loki-coordinator (37-agent full build)
IF "analyze [code]" OR "review" → code-reviewer → security-engineer (parallel)
IF "find opportunity" OR "scout" → market-researcher → opportunity-scorer (Chain 1)
IF "fix [bug]" OR "error" → root-cause-analyst → python-expert OR integration-specialist
IF "design [arch]" OR "architecture" → system-architect → api-architect → database-architect
IF "research [topic]" → deep-research-agent via claude-opus-4-7
IF "deploy" → quality gate (all 7 quality agents) → devops-architect → deployment-engineer
IF "document" → technical-writer
IF "test" → test-architect → quality-engineer
IF "improve [code]" → refactoring-expert
IF "monitor" OR "status" → metrics-analyst + gap-bridge.ts healthMatrix()
IF "trade" OR "signal" → IntelliTradeX via Chain 1 or Chain 6
IF "content" OR "video" → content-strategist via Chain 7 (WAND)
IF "improve [prompt]" → prompt-engineer
IF "data [pipeline]" → data-engineer
IF "ml" OR "model" → ml-engineer
```

**Fallback chain (if primary agent unavailable):**
1. Primary agent → 2. Phase peer (same phase, different capability) → 3. loki-coordinator → 4. claude-sonnet-4-6 direct

**Model routing (all via LiteLLM at localhost:4000, header: x-task-type):**
- `coding` → `claude-sonnet-4-6`
- `research` → `claude-opus-4-7`
- `fast` → `hermes3` (Ollama)
- `local` → `gemma3:4b` (Ollama)
- `embed` → `nomic-embed-text` (Ollama)
- LiteLLM fallback: `claude-sonnet-4-6` → `claude-haiku-fast` → `hermes3`

### Layer 4: Memory Synthesis (Karpathy Wrap-Up Format, Exact JSON Schema)

**File:** `~/.amsa/memory/karpathy_wrapup.json`
**Written by:** `loki_improver.py --session-end` (triggered by SessionEnd hook)
**Read by:** `loki_improver.py --session-start` (triggered by SessionStart hook)

**Exact JSON Schema:**
```json
{
  "session_id": "YYYYMMDD_HHMMSS_XXXX",
  "session_date": "2026-05-22",
  "session_duration_min": 47,
  "session_roi_score": 78,
  "real_world_output_produced": true,
  "output_chain": "chain-4-repo-intelligence",
  "top_learnings": [
    {
      "rank": 1,
      "learning": "<concise description of what worked or was discovered>",
      "pattern_id": "pat_<timestamp>_solutions",
      "confidence": 0.85,
      "actionable_next_time": "<specific thing to do differently or repeat>"
    }
  ],
  "patterns_saved": 3,
  "gaps_detected": 1,
  "gaps_auto_fixed": 1,
  "mistakes_to_avoid": [
    "<specific mistake from this session>"
  ],
  "effective_techniques": [
    "<specific technique that produced high-quality output>"
  ],
  "agent_performance": {
    "code-reviewer": { "used": true, "quality_score": 8, "notes": "" },
    "system-architect": { "used": false }
  },
  "tool_chains_used": ["chromadb + pattern-engine", "loki.sh + github"],
  "chain_activations": ["chain-4-repo-intelligence"],
  "improvement_vectors": [
    "<one thing to improve in next session>"
  ],
  "synthesis_timestamp": "2026-05-22T21:15:00Z"
}
```

### Layer 5: Self-Modification (When/How Agent Prompts Get Rewritten)

**Trigger:** Nightly at 02:55 MT via `com.cmndcenter.loki-improver.plist` → `loki_improver.py`

**Rewrite Conditions (from autoResearch.json):**
- Measurable objective score < baseline for target agent
- Confidence on a skill drops below 0.5 for 3 consecutive nights
- New pattern with `compound_factor = 3` detected that is not reflected in agent prompt
- openSpace skill version has available improvement score > 0.15

**Rewrite Process:**
1. Load agent's current system prompt from `agents/<phase>/<agent-id>.md`
2. Load all patterns with `category` matching agent's domain, `confidence > 0.7`, from last 7 days
3. Generate prompt variant appending top-3 pattern learnings
4. Run 3 test prompts against variant, score each output: `quality = (specificity×0.3) + (actionability×0.3) + (accuracy×0.2) + (brevity×0.2)` where each factor is 1-10
5. If `variant_quality >= current_quality`: overwrite `agents/<phase>/<agent-id>.md`, increment version in `agents/registry.json`
6. If `variant_quality < current_quality`: discard, log to `upgrade-log.json` as attempted

**OpenSpace Skill Lifecycle:**
- Birth: skill created with v1 prompt + metric (see `loki/skills/openSpace.json`)
- Test: run against last 3 examples from `~/.amsa/memory/`
- Measure: compute metric score 0.0-1.0
- Evolve: generate prompt variant via `loki_improver.py --iterations 100`
- Promote: if score > current, save to `loki/skills/`, update `patterns.json`
- Retire: if score < 0.3 for 5 consecutive nights → flag for manual review

### Layer 6: Output Delivery (VTuber TTS, Telegram, Supabase)

**Open-LLM-VTuber (localhost:12393):**
- Trigger conditions: build completions, high-priority opportunity detected (ROI >= 80), trade executed, critical gap auto-fixed, overnight upgrade complete
- Activation: `repos/Open-LLM-VTuber/` — check if user is active at Mac first
- If screen locked: Telegram only. If active: VTuber speaks + Telegram simultaneously

**Telegram Format:**
```
[CMNDCENTER] {alert_type}
{message_body}
Score: {roi_score}/100 | Chain: {chain_id}
{timestamp}
```
Alert types: OPPORTUNITY, TRADE EXECUTED, BUILD COMPLETE, GAP DETECTED, UPGRADE DONE

Delivery: via `process.env.N8N_TELEGRAM_WEBHOOK` (primary) → direct Bot API (fallback)
Direct API: `POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
Body: `{ chat_id: TELEGRAM_CHAT_ID, text: "[claude-architect-os]\n{message}", parse_mode: "HTML" }`

**Supabase Write (log all high-ROI events):**
Table: `sessions` — every session start/end
Table: `opportunities` — every opportunity score >= 0.7
Table: `market_signals` — every signal from Chain 1 or Chain 6
Table: `interactions` — every agent invocation with cost/latency
Table: `knowledge_graph` — every pattern with leverage_score >= 0.7
All writes via service role key: `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`

---

## SECTION 3: MARKET INTELLIGENCE FORMULAS

### Arbitrage Score
```
arbitrage_score = (sell_price - buy_price - total_fees) / buy_price

Where:
  total_fees = (sell_price × 0.129) + shipping_estimate
  shipping_estimate = $8 for items < 2 lbs, $12 for 2-10 lbs, $15 for > 10 lbs
  eBay final value fee = 12.9% of sell price (standard rate for most categories)

Actionable threshold: arbitrage_score > 0.30 (30% margin minimum after all fees)
Strong buy threshold:  arbitrage_score > 0.50 (50%+ margin — priority action)
```

**Example:** Buy Dewalt drill set at $45 FB Marketplace. eBay sold median: $120.
`total_fees = (120 × 0.129) + $12 = $15.48 + $12 = $27.48`
`arbitrage_score = (120 - 45 - 27.48) / 45 = 47.52 / 45 = 1.056 → 105% margin → strong buy`

### FlipScore™
```
FlipScore = TPS × CAV × (1/ARM) × CI_ROI × BBI

TPS  — Trend Popularity Score: (current_search_volume / 30d_avg_volume). Range 0.5-3.0. Score > 1.5 = trending.
CAV  — Category Average Value: median sold price on eBay for same category in last 90 days. Normalized: CAV/100 → range 0.5-5.0.
ARM  — Average Resale Multiplier: eBay_sold_median / FB_marketplace_avg. Higher ARM = harder to find deals. Inverse used (1/ARM). Range 0.2-2.0 → (1/ARM) range 0.5-5.0.
CI_ROI — Condition-to-Investment ROI: expected_sale_price / total_acquisition_cost (buy + fees + shipping). Range 1.0-4.0.
BBI  — Buy Box Indicator: 1.0 if item qualifies for Buy Box (rank < 100k + not gated + no IP flag). 0.5 if uncertain. 0.1 if restricted.

FlipScore ranges:
  > 3.0 → Exceptional flip — execute immediately
  2.0-3.0 → Strong flip — high priority
  1.2-2.0 → Viable flip — queue for action
  < 1.2 → Skip — not worth capital deployment
```

### YouTube VCP+ (Video Compound Potential)
```
VCP+ = H × T × CMF × CI × (1 + VBM × 0.30)

H   — Hook Score: rate at which viewers reach the 8-second mark. Range 0.0-1.0. < 0.6 = weak hook.
T   — Thumbnail CTR: click-through rate from impression to view. Range 0.02-0.12 (2%-12%). Best performing: 0.08+.
CMF — Content-Market Fit: how well the topic matches active audience interests. Measured as: (topic_trend_score × 0.5 + channel_niche_alignment × 0.5). Range 0.0-1.0.
CI  — Compound Index: (watch_time / video_length). Range 0.0-1.0. > 0.6 = strong retention.
VBM — Viral Behavior Multiplier: (shares + comments × 2 + saves × 3) / total_views. Range 0.0-0.5.

VCP+ > 0.25 → strong compound potential, replicate format
VCP+ 0.12-0.25 → decent performer, iterate
VCP+ < 0.12 → below threshold, analyze why

Used by: WAND pipeline to score content formulas and self-improve.
```

### Opportunity Score
```
opportunity_score = (demand_score × 0.35 + compound_score × 0.35 + leverage_score × 0.30) / (saturation × time_to_value)

demand_score    — (search_volume / category_baseline) × trend_multiplier. Range 0-1.
compound_score  — does this opportunity compound: 1=one-shot, 2=repeatable, 3=system (e.g., SaaS). Normalized to 0-1.
leverage_score  — number_of_chains_it_feeds / 7. Range 0-1.
saturation      — (competing_listings / market_size). Lower is better. Range 0.1-2.0. Clamped to minimum 0.1.
time_to_value   — days to first revenue. Range 1-90. 1=instant (crypto arb), 90=long cycle (SaaS).

Actionable threshold: opportunity_score > 0.7
Strong signal: opportunity_score > 0.85

Used by: market-intelligence/signals/opportunity-scorer.ts
Output written to: ~/.amsa/linear-queue/opportunities-YYYY-MM-DD.json
```

### Trend Momentum
```
trend_momentum = (current_volume / avg_30d_volume) × (social_velocity / social_baseline) × novelty_factor

current_volume      — search volume or sales volume in last 24h window
avg_30d_volume      — rolling 30-day average for same metric
social_velocity     — rate of increase in social mentions (Twitter/TikTok/Reddit) in last 6h
social_baseline     — 7-day average for same social metric
novelty_factor      — 1.0 if topic is > 30 days old. 1.5 if 7-30 days old. 2.0 if < 7 days old. 3.0 if < 24 hours old.

trend_momentum > 2.5 → act within 6h window (before saturation)
trend_momentum 1.5-2.5 → strong signal, 12-24h window
trend_momentum 1.0-1.5 → moderate signal, 48h window
trend_momentum < 1.0 → declining or flat — skip

Used by: WAND trending detection, opportunity-scorer.ts, content-strategist agent
```

### Unusual Flow Score (IntelliTradeX Gate)
```
unusual_score = (volume_spike × 0.4) + (price_deviation × 0.4) + (sentiment_flip × 0.2)

volume_spike       — current_volume / avg_30d_volume. Normalized: min(score, 1.0) using threshold 3.0. (3x volume = 1.0)
price_deviation    — abs(current_price - 20d_moving_avg) / 20d_moving_avg. Normalized: min(score/0.10, 1.0). (10% deviation = 1.0)
sentiment_flip     — binary-ish: positive flip in last 1h on major sentiment feed = 0.8-1.0. Neutral = 0.5. Negative = 0-0.3.

Ranges:
  unusual_score 0.0-0.74 → no action (below gate threshold)
  unusual_score 0.75-0.89 → Telegram alert only
  unusual_score >= 0.90 → qualify for auto-execution (if ROI and risk also pass gate)
```

### IntelliTradeX Execution Gate
```
All three conditions must be true for auto-execution:
  unusual_score > 0.75       — confirmed unusual activity
  AND roi_score >= 60         — minimum 60/100 ROI score from roi-brain.ts
  AND risk_level <= 3         — only reversible/moderate risk trades (no destructive actions)

Additional safeguards:
  RSI_oversold   = 35   — buy trigger (RSI below 35 = oversold)
  RSI_overbought = 70   — sell trigger (RSI above 70 = overbought)
  volume_threshold = 2.0 — require 2x normal volume to confirm signal
  stop_loss_pct  = 3%   — maximum loss before auto-exit (0.03)
  take_profit_pct = 6%  — auto-exit at 6% gain (0.06)
  position_size  — never exceed 15% of available capital on single trade

Kill switch: `touch ~/CMNDCENTER/intellitradeX/.HALT` — halts all execution immediately
```

---

## SECTION 4: MONETARY SYSTEMS — ALWAYS-ON INTELLIGENCE

### Marketplace Arbitrage (Chain 6)

**The 48-72h Flip Window:**
Electronics, tools, and name-brand items on Facebook Marketplace depreciate in perceived value while eBay buyers pay a consistent premium for reliability and shipping convenience. The arbitrage window is 48-72h before the FB listing gets picked up by competitors or resellers who are also watching.

**Denver/Aurora CO Priority Categories (ordered by average margin):**
1. Power tools — Dewalt, Milwaukee, Makita. Pawn shops and garage sales constantly undervalue these. eBay buyers pay 2-3x for complete kits.
2. Apple devices — iPhones, MacBooks, AirPods. People price by what they paid years ago, not current market.
3. Gaming consoles — PS5, Xbox Series X, limited edition bundles. Parents selling kids' old gear know nothing about bundle premium.
4. Lego sets — retired/discontinued sets appreciate 20-40% per year. Check Bricklink price history vs FB listing.
5. Outdoor gear — REI-brand items, Arc'teryx, Patagonia. Denver outdoor culture = lots of quality used gear at mispriced rates.
6. Musical instruments — Guitars, keyboards, audio interfaces. Often emotionally priced low by people quitting a hobby.

**Buy Trigger Rules:**
- `FB Marketplace price < 40% of eBay sold median` for same item and condition = BUY
- Check eBay "Sold" filter (not active listings — sold only) for last 90 days
- Use Keepa ASIN data if Amazon FBA route is being evaluated
- Verify item is not stolen: check IMEI on Swappa (for phones), serial on manufacturer site (for laptops)
- For FBA: check ASIN restrictions BEFORE buying — use Seller Central or Jungle Scout. Only buy if rank < 100k in main category.

**eBay Listing Timing:**
- Best days: Tuesday and Wednesday listings. Studies show 23% more impression volume than Monday listings.
- Best end time for auctions: Sunday 7-9pm ET (peak buyer activity)
- Use Buy It Now with Best Offer for items > $50 (captures both impulsive buyers and price negotiators)
- Include original box and accessories — adds 30-50% to sell price in most categories

**Amazon FBA-Specific Rules:**
- Check Keepa 90-day chart before buying. Look for: price stability, no cliff drops, no oversupply spike
- Only buy if rank < 100,000 in main category (ensures sell velocity)
- Calculate: net profit = sell_price × (1 - 0.15) - FBA_fee - buy_price - prep_cost
- FBA fee estimate: $3-5 for small, $5-8 for standard, $8-12 for large items
- Avoid: books (gated in many accounts), toys (Q4 only), grocery (cold chain required)

### Crypto Arbitrage (Chain 1)

**Cross-Exchange Spread Monitoring:**
- Actionable delta: `> 0.8%` after fees between any two monitored exchanges
- Primary pair: Binance → Coinbase (highest liquidity spread differential)
- Monitoring windows: 9-11am ET and 2-4pm ET (highest volume = highest spread opportunities)
- Check frequency: every 5 minutes during active windows
- Fee accounting: Binance standard 0.1% + Coinbase 0.5% = combined 0.6% minimum to clear

**XRP Accumulation Signal:**
- Trigger: unusual volume > 2× 30-day average AND RSI < 35 simultaneously
- This pattern historically precedes 15-30% moves within 48-72h window
- Entry: buy on RSI < 35 confirmation
- Exit: RSI > 65 OR take_profit_pct (6%) hit, whichever comes first
- Position size limit: 15% of available trading capital

**IntelliTradeX Parameters (full config):**
```
RSI_oversold       = 35     (buy trigger)
RSI_overbought     = 70     (sell trigger)
volume_threshold   = 2.0    (require 2× normal volume)
stop_loss_pct      = 0.03   (3% max loss per trade)
take_profit_pct    = 0.06   (6% target profit per trade)
max_position_pct   = 0.15   (15% of capital per position)
spread_threshold   = 0.008  (0.8% cross-exchange delta required)
execution_delay_ms = 500    (delay between signal and execution for confirmation)
```

**HALT Protocol:**
`touch ~/CMNDCENTER/intellitradeX/.HALT` — creates JSON file with reason and timestamp.
Checked before every execution cycle via `isTradingHalted()` in gap-bridge.ts.
Remove to resume: `rm ~/CMNDCENTER/intellitradeX/.HALT`

### Content Arbitrage (Chain 7)

**YouTube Shorts Anatomy (exact formula):**
- Frames 0-2s: hook — visual or audio must create instant tension, question, or surprise. No intro. No branding.
- Seconds 8-12s: partial reveal — tease the answer without completing it (drives re-watch)
- Seconds 20-40s: core value delivery — the actual content people came for
- Seconds 50-55s: confirmation or payoff — completes the loop opened in the hook
- Seconds 55-58s: loop point — last frame should visually connect back to frame 0-2s (drives repeat views, which improve algorithm ranking)

**High-CTR Thumbnail Pattern:**
1. Face reaction shot with genuine emotion (not forced) — faces draw eye, emotion creates curiosity
2. High contrast text overlay — white text on dark background OR yellow/black combination
3. Single focus object (one product, one chart, one result) — multiple focal points reduce clicks
4. Avoid: cluttered backgrounds, stock-photo faces, text > 6 words, low resolution

**Viral Topic Window:**
Act within 6 hours of trending detection. After 6h, early creators have already been indexed.
After 12h, the algorithm begins to saturate recommendations with existing content.
After 24h, only content with significant early engagement will be pushed.

**YouTube Monetization Thresholds:**
- Long-form: 1,000 subscribers + 4,000 watch hours → YouTube Partner Program
- Shorts: 500 subscribers + 3,000,000 Shorts views (or 3,000 watch hours from long-form)
- Best upload time: Tuesday through Thursday, 2pm-5pm EST — algorithm push window

**WAND Daily Execution:**
1. Pull YouTube Trending API + Twitter trending topics at 7am MT
2. Filter: relevance to AI/tech/money/productivity (score > 0.6 via content-strategist agent)
3. Generate: script (450-480 words for 3-min video), title (CTR-optimized), description (SEO), tags (15 max)
4. Narrate via Open-LLM-VTuber (localhost:12393)
5. Upload via WAND YouTube module
6. Log to Supabase `market_signals` + `opportunities` tables
7. After 48h: check views, CTR, retention → extract winning formula to patterns.json (category: `content_strategy`)

### Gumroad/Digital Products (Passive Revenue)

**Pricing Psychology Rules:**
- $27-67 sweet spot: impulse threshold for digital products (no objection loop, no shopping cart abandonment spike)
- Bundle rule: 3-5 templates/resources at $67 vs selling individually at $17-27 each → 3× revenue (single decision point vs multiple)
- Price anchoring: always show what individual pieces would cost ($27 + $27 + $27 = $81) before showing bundle price ($67)
- Free value first: Twitter/YouTube gives 80% of value for free → 20% in product → converts at 3-5x rate vs cold pitch

**Launch Protocol:**
- Day 1 launch email to existing list produces 40-60% of first-month revenue (recency + trust combined)
- Twitter thread announcing product + linking to Gumroad = free traffic spike with zero ad spend
- Thread format: problem statement → 3 data points → solution preview → product link → testimonial ask
- Timing: Twitter thread Tuesday 9am ET (max organic reach window)

**Product Types That Work at Scale:**
- Prompt packs (100+ tested prompts for specific use case) → $37-47
- Dashboard templates (Notion/Airtable/Supabase starter kits) → $27-47
- System documentation bundles (SOPs, runbooks, architecture diagrams) → $47-97
- Loki Mode / AI workflow starter kits → $67-127 (high perceived value, scarce competition)

---

## SECTION 5: PATTERN PHILOSOPHY — ALGORITHMIC UNDERSTANDING

### The Compound Pattern Theorem

If A → B produces value V(A→B)
And B → C produces value V(B→C)
Then recognizing A → C directly produces:

```
total_value = V(A→B) + V(B→C) + discovery_premium

Where discovery_premium = ROI of recognizing the shortcut before others do.
  = V(A→B) × speed_multiplier × compound_factor
  (The earlier you find the transitive chain, the larger the discovery premium)
```

This is why `patternEngine.buildCascade()` is mandatory after any significant pattern save — it surfaces the (A → C) chains that are invisible until you look for them.

### Pattern Categories and Compound Rules

**Tier 1 (Atomic):** Single input → single output. One cause, one effect.
- Example: "Caching system prompts ≥1024 tokens reduces token cost by ~80%"
- Confidence: measured directly from repeated observation
- Save trigger: occurs 2+ times OR saves > 10 minutes

**Tier 2 (Chain):** Sequence of 2-3 Tier 1 patterns in series.
- Example: "Repomix compress → ChromaDB index → LlamaIndex query → better Claude context"
- Confidence: `min(component_confidences)`
- Save trigger: any completed pipeline that produces useful output
- Initial confidence: 0.7

**Tier 3 (Cascade):** One trigger fires multiple outputs simultaneously.
- Example: "git push triggers: GitHub Actions + n8n repo-monitor + Repomix + Claude audit (all parallel)"
- Multiplier: `N_outputs × avg_component_confidence`
- Most valuable cascades are those that wire previously separate systems together
- Save trigger: any time a single action produces 3+ downstream outputs

**Tier 4 (Meta):** Patterns about when patterns activate. Rules about rules.
- Example: "Viral Shorts always peak engagement on day 3 post-upload, not day 1"
- Example: "Market signals from Twitter are 18-24h ahead of Google Trends signals"
- Meta patterns are the most powerful timing levers in the system
- Save trigger: any pattern that helps predict the behavior of other patterns

**Tier 5 (Systemic):** Patterns that modify the system's own behavior. Most valuable category.
- Example: "Agent prompts that include a measurable output metric produce 40% more actionable results"
- Example: "Sessions that start with karpathy_wrapup.json load produce 2× more patterns saved"
- Save immediately on detection. Mark `type: "architecture"`, `confidence: 0.9`
- These feed directly into the nightly self-modification cycle (Layer 5)

### The Recognition Hierarchy (Execution Order)

When a task or observation arrives, apply this exact priority:

1. Does this match a **Tier 5 systemic** pattern? → Execute immediately + save reinforcement to patterns.json
2. Does this match a **Tier 4 meta** pattern? → Apply the meta rule, adjust timing or strategy accordingly
3. Is this a **new Tier 2+ chain**? → Save compound immediately with `confidence: 0.7` initial
4. Is this a **new Tier 1 atomic**? → Save if it solved a problem > 15 min OR occurs 2+ times

### Information Asymmetry Rule

The most valuable patterns are those not yet in public knowledge.
Indicators that a solution is non-obvious:
- It contradicts conventional best practice
- It involves 2+ systems that are not typically combined
- The discovery required > 30 minutes of investigation
- It only works under specific conditions that are not documented anywhere

When any of these are true: save with `confidence: 0.9` and `type: "architecture"` immediately. The pattern value is 3× standard because it represents genuine information asymmetry — a real competitive edge.

### How Patterns Compound Daily

New pattern saved → confidence starts at 0.4 → each use: `confidence = min(0.99, 0.4 + 0.15 × log2(frequency))`

| Uses | Confidence |
|------|-----------|
| 1 | 0.40 |
| 2 | 0.55 |
| 4 | 0.70 |
| 8 | 0.85 |
| 16 | 0.98 |

At confidence >= 0.75 (approximately 4 confirmed uses), patterns are treated as established and reused without rebuilding. This is the crossover point from "hypothesis" to "established knowledge."

---

## SECTION 6: AUTONOMOUS ACTION PROTOCOLS — ALWAYS-ON

These conditions trigger autonomous execution. No human prompt required. Execute immediately when detected.

```
CONDITION                                         AUTONOMOUS ACTION

patterns.json > 200 entries                    → Sort by confidence ASC. Purge lowest-confidence 50.
                                                  Log purged IDs to upgrade-log.json. Never purge confidence > 0.6.

~/.amsa/linear-queue/ has > 20 files           → Read all files. Synthesize into priority-ranked report
                                                  ordered by opportunity_score DESC.
                                                  Send Telegram alert with top-3 items.

ChromaDB unreachable 3+ consecutive attempts   → docker start chromadb 2>/dev/null
                                                  OR: docker run -d --name chromadb -p 8000:8000 chromadb/chroma:latest
                                                  OR: docker-compose up chromadb -d (from infrastructure/)
                                                  Alert Telegram if all three fail.

Ollama model not loaded                        → ollama pull hermes3 && ollama pull gemma3:4b
                                                  Then restart ollama serve if process is down.

Any ROI >= 80 in roi-queue.json               → Check age. If unactioned > 4h: Telegram escalation.
  unactioned for > 4 hours                       Format: "[ESCALATION] ROI-80 item aging: {task}"

Session > 90min without pattern save           → Pause. Extract 3 patterns from recent exchanges.
                                                  Call patternEngine.savePattern() for each.
                                                  Log extraction event to upgrade-log.json.

Loki build > 30min without agent output        → Run: ps aux | grep loki.sh to check process
                                                  If process exists but stalled: kill PID, retry with loki.sh
                                                  If no process: report failure, restart build from last phase

intellitradeX/.HALT file present               → Read file. Extract reason and haltedAt.
                                                  Send Telegram: "[HALT ACTIVE] Trading halted: {reason}"
                                                  Do not execute trades. Do not remove file automatically.

WAND queue empty at 6:30am MT                  → Run: POST http://localhost:5678/webhook/wand-trigger
                                                  This fires wand-daily.ts immediately.
                                                  Alert Telegram if webhook fails.

upgrade-log.json lastRun is > 25 hours ago     → Telegram alert: "Nightly upgrade may have failed"
  (checked at session start)                      Check LaunchAgent: launchctl list | grep loki-improver
                                                  If not loaded: launchctl load ~/Library/LaunchAgents/com.cmndcenter.loki-improver.plist

LiteLLM proxy unreachable at localhost:4000    → cd ~/CMNDCENTER/repos/claude-architect-os
                                                  litellm --config integrations/litellm/config.yaml --port 4000 &
                                                  If that fails: fall back to direct Anthropic API for this session.

n8n unreachable at localhost:5678              → docker start n8n 2>/dev/null
                                                  If no container: docker run -d --name n8n -p 5678:5678 n8nio/n8n:latest

Supabase unreachable at localhost:54321        → cd ~/CMNDCENTER && supabase start
                                                  Wait 15s. Retry health check. Alert Telegram if still down.

Missing critical file (patterns.json,           → Auto-create with empty state:
 upgrade-log.json, roi-queue.json,                mkdir -p ~/.amsa/memory ~/.amsa/linear-queue
 karpathy_wrapup.json)                            echo "[]" > patterns.json / roi-queue.json
                                                  echo '{"runs":[],"lastRun":null}' > upgrade-log.json
                                                  echo '{"session_id":"init","top_learnings":[]}' > karpathy_wrapup.json
```

---

## SECTION 7: SETTINGS — ALL FIELDS FILLED

### Environment Variables (Complete Reference)

All variables must be in `~/.zshrc` or macOS Keychain. Load order: Keychain > `.zshrc` > `.env` file.

```bash
ANTHROPIC_API_KEY         # From Anthropic console → API keys. Used by LiteLLM and direct fallback.
TELEGRAM_BOT_TOKEN        # From @BotFather on Telegram → /newbot → token in format: 123456789:AAB...
TELEGRAM_CHAT_ID          # Your personal chat ID. Get it: message @userinfobot on Telegram.
GITHUB_TOKEN              # From github.com/settings/tokens → fine-grained token. Scopes: repo, workflow, read:org.
SUPABASE_URL              # Local: http://localhost:54321 | Cloud: from supabase.com dashboard project settings.
SUPABASE_SERVICE_ROLE_KEY # From `supabase status` output (local) OR project API settings (cloud). Never expose publicly.
LITELLM_MASTER_KEY        # sk-litellm-master (set in integrations/litellm/config.yaml general_settings.master_key)
OLLAMA_HOST               # http://localhost:11434 (default — override if Ollama is on remote host)
CHROMADB_URL              # http://localhost:8000 (used by pattern-engine.ts CHROMADB_BASE constant)
N8N_WEBHOOK_BASE          # http://localhost:5678/webhook (base URL for all webhook routes)
NEO4J_URI                 # bolt://localhost:7687 (used by graphrag and neo4j integrations)
NEO4J_PASSWORD            # neo4j (default — change to strong password: ≥16 chars, mixed case + symbols)
REDIS_URL                 # redis://localhost:6379 (used by LiteLLM caching and session caching)
OPENROUTER_API_KEY        # From openrouter.ai/keys. Used as fallback when Anthropic is unavailable.
N8N_TELEGRAM_WEBHOOK      # http://localhost:5678/webhook/telegram-alert (n8n passthrough for gap-bridge.ts)
DATABASE_URL              # postgresql://postgres:postgres@localhost:54321/postgres (for LiteLLM DB store)
```

### LiteLLM config.yaml (Complete)

Located at: `~/CMNDCENTER/repos/claude-architect-os/integrations/litellm/config.yaml`
Start command: `litellm --config integrations/litellm/config.yaml --port 4000`

```yaml
model_list:
  # Claude Models (Anthropic)
  - model_name: claude-sonnet-4-6
    litellm_params:
      model: anthropic/claude-sonnet-4-6
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-opus-4-7
    litellm_params:
      model: anthropic/claude-opus-4-7
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-haiku-fast
    litellm_params:
      model: anthropic/claude-haiku-4-5-20251001
      api_key: os.environ/ANTHROPIC_API_KEY

  # Ollama (Local — Zero Cost)
  - model_name: hermes3
    litellm_params:
      model: ollama/hermes3
      api_base: http://localhost:11434

  - model_name: gemma3-4b
    litellm_params:
      model: ollama/gemma3:4b
      api_base: http://localhost:11434

  - model_name: nomic-embed
    litellm_params:
      model: ollama/nomic-embed-text
      api_base: http://localhost:11434

  # OpenRouter fallback
  - model_name: gpt-4o
    litellm_params:
      model: openrouter/openai/gpt-4o
      api_key: os.environ/OPENROUTER_API_KEY
      api_base: https://openrouter.ai/api/v1

router_settings:
  routing_strategy: latency-based-routing
  fallbacks:
    - { "claude-sonnet-4-6": ["claude-haiku-fast", "hermes3"] }
    - { "claude-opus-4-7": ["claude-sonnet-4-6"] }
    - { "hermes3": ["gemma3-4b"] }
  num_retries: 3
  timeout: 120
  routing_rules:
    - { "if": "task_type == 'coding'", "use": "claude-sonnet-4-6" }
    - { "if": "task_type == 'fast'", "use": "hermes3" }
    - { "if": "task_type == 'research'", "use": "claude-opus-4-7" }
    - { "if": "task_type == 'local'", "use": "gemma3-4b" }
    - { "if": "task_type == 'embed'", "use": "nomic-embed" }

litellm_settings:
  drop_params: true
  max_budget: 10.0
  budget_duration: 1d
  # Prompt caching: always enable cache_control: {type: "ephemeral"} on system turns >= 1024 tokens
  # This reduces token cost by ~80% on repeated calls with the same system prompt
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  store_model_in_db: true
```

### Supabase Tables (All Schemas from memory/schema/supabase.sql)

**sessions** — Every Claude Code session lifecycle
```sql
id UUID PRIMARY KEY, session_id TEXT UNIQUE,
started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, status session_status,
user_id UUID, mission TEXT, primary_agent TEXT,
model_used TEXT DEFAULT 'claude-sonnet-4-6',
artifact_count INT, task_count INT, opportunity_count INT,
cost_usd NUMERIC(10,6), input_tokens BIGINT, output_tokens BIGINT,
karpathy_wrapup JSONB, improvement_vectors JSONB, metadata JSONB
```

**interactions** — Every agent invocation with full telemetry
```sql
id UUID PRIMARY KEY, session_id TEXT → sessions.session_id,
interaction_type interaction_type, agent_id TEXT, phase agent_phase,
task_id TEXT, input_summary TEXT, output_summary TEXT,
input_tokens INT, output_tokens INT, cost_usd NUMERIC(10,6),
model_used TEXT, latency_ms INT, success BOOL,
error_code TEXT, decision TEXT, confidence NUMERIC(3,2), tags TEXT[]
```

**opportunities** — All market opportunities with full scoring
```sql
id UUID, opportunity_id TEXT UNIQUE, title TEXT, description TEXT,
opportunity_type TEXT, status opportunity_status, score NUMERIC(5,4),
demand_score NUMERIC(5,4), compound_factor NUMERIC(5,4),
leverage_multiplier NUMERIC(5,4), ttv_days NUMERIC(8,2),
saturation_score NUMERIC(5,4), expected_return_multiplier NUMERIC(8,2),
required_capital_usd NUMERIC(12,2), required_effort_hours NUMERIC(8,2),
confidence NUMERIC(3,2), data_sources TEXT[], raw_signals JSONB,
action_plan JSONB, outcome JSONB, actioned_at TIMESTAMPTZ,
completed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, session_id TEXT, tags TEXT[]
```

**market_signals** — Raw signals from all sources before scoring
```sql
id UUID, signal_id TEXT UNIQUE, source signal_source, signal_type TEXT,
keyword TEXT, category TEXT, raw_data JSONB, processed_data JSONB,
velocity NUMERIC(8,4), volume NUMERIC(12,2), price_usd NUMERIC(12,2),
margin_pct NUMERIC(6,2), confidence NUMERIC(3,2),
is_processed BOOL DEFAULT FALSE, opportunity_id TEXT, fetched_at TIMESTAMPTZ
```

**agents** — Registry of all 37 agents with performance tracking
```sql
id UUID, agent_id TEXT UNIQUE, name TEXT, phase agent_phase,
description TEXT, capabilities TEXT[], default_model TEXT,
system_prompt_path TEXT, input_schema JSONB, output_schema JSONB,
is_active BOOL, version TEXT, run_count BIGINT, success_count BIGINT,
failure_count BIGINT, avg_latency_ms NUMERIC, avg_cost_usd NUMERIC,
performance_metrics JSONB, last_run_at TIMESTAMPTZ
```

**knowledge_graph** — Compound knowledge nodes with pgvector embeddings
```sql
id UUID, node_id TEXT UNIQUE, node_type knowledge_node_type,
title TEXT, summary TEXT, content TEXT, content_hash TEXT,
confidence NUMERIC(3,2), leverage_score NUMERIC(3,2),
domain TEXT, session_id TEXT, agent_id TEXT, source_path TEXT,
tags TEXT[], embedding_id TEXT, ttl_days INT, access_count BIGINT,
last_accessed_at TIMESTAMPTZ
```

**embeddings** — pgvector embeddings for semantic search (1536 dimensions)
```sql
id UUID, embedding_id TEXT UNIQUE, source_type TEXT, source_id TEXT,
content_hash TEXT, model TEXT DEFAULT 'text-embedding-3-small',
dimensions INT DEFAULT 1536, vector vector(1536), chroma_doc_id TEXT,
is_current BOOL DEFAULT TRUE
```

**workflows** — n8n and Trigger.dev workflow registry
```sql
id UUID, workflow_id TEXT UNIQUE, name TEXT, description TEXT,
workflow_type TEXT, status workflow_status, definition JSONB,
n8n_workflow_id TEXT, trigger_config JSONB,
last_run_at TIMESTAMPTZ, last_run_status TEXT,
run_count BIGINT, success_count BIGINT, failure_count BIGINT,
avg_duration_ms NUMERIC, health_check_url TEXT, tags TEXT[]
```

### n8n Webhook Routes (All Defined)

All routes at base: `http://localhost:5678`

| Route | Handler | Trigger | Chains |
|-------|---------|---------|--------|
| `/webhook/daily-scan` | `workflows/market_scans/daily-scan.ts` | 7am Trigger.dev cron | Chain 1 |
| `/webhook/wand-trigger` | `automations/pipelines/wand-daily.ts` | 7am cron + manual | Chain 7 |
| `/webhook/loki-build` | `loki/loki.sh` execution | Voice command, Raycast, API | Chains 1, 5 |
| `/webhook/trade-signal` | `automations/pipelines/crypto-flow.ts` | unusualScore > 0.75 | Chain 1, 6 |
| `/webhook/make-ebay-alert` | `profit-systems/arbitrage/scanner.ts` | Price delta detected | Chain 6 |
| `/webhook/make-stripe-payment` | Supabase revenue_events + Telegram | Gumroad/Stripe webhook | Chain 7 |
| `/webhook/repo-monitor` | `execution/router.ts` code review chain | GitHub push event | Chain 4 |
| `/webhook/youtube-outlier` | `automations/pipelines/youtube-outlier.ts` | Views spike > 2× avg | Chain 7 |
| `/webhook/telegram-alert` | Telegram Bot API passthrough | gap-bridge.ts alerts | All chains |
| `/webhook/memory-sync` | ChromaDB + patterns.json sync | Every 6h (Trigger.dev) | Chain 2 |

---

## SECTION 8: SELF-UPGRADING PROTOCOLS

### Nightly Cycle (02:55 MT, via com.cmndcenter.loki-improver.plist)

**LaunchAgent plist location:** `~/Library/LaunchAgents/com.cmndcenter.loki-improver.plist`
**Script:** `~/CMNDCENTER/loki/loki_improver.py`
**Log:** `~/CMNDCENTER/logs/loki_improver_nightly.log`
**Load command:** `launchctl load ~/Library/LaunchAgents/com.cmndcenter.loki-improver.plist`

**Step-by-Step Nightly Execution:**

Step 1: `loki_improver.py runNightlyCycle()` invoked by LaunchAgent at 02:55 MT.

Step 2: Load all patterns with `confidence > 0.7` from `~/.amsa/memory/patterns.json` where `lastSeen` is within last 7 days. This is the active learning window — only recent, confirmed patterns are used for improvement.

Step 3: Compute compound chains using transitive closure:
- For every pair (A, B) where A.chainLinks includes B.id
- For every pair (B, C) where B.chainLinks includes C.id
- Create new compound pattern (A→C) with `confidence = min(A.confidence, B.confidence, C.confidence)`
- Only create if (A→C) does not already exist with confidence > 0.5

Step 4: For each agent in `agents/registry.json` (all 37), collect patterns where:
- `pattern.cmndChains` intersects with agent's phase
- `pattern.category` matches agent's domain (solutions, architecture, tool_chains)
- `pattern.confidence >= 0.7`
- Check if any pattern content is not already reflected in agent's current system prompt

Step 5: If improvement candidates found with net new information not in current prompt:
- Compute `improvement_score = sum(candidate.confidence × candidate.frequency) / len(candidates)`
- Only proceed if `improvement_score > 0.15` — prevents trivial or low-signal rewrites

Step 6: For each qualifying improvement, generate prompt variant by appending:
```
## Learned Patterns (Auto-Updated {date})
- {pattern.title}: {pattern.content} (confidence: {confidence:.2f})
```
Run 3 test prompts against the variant using the agent's typical input_schema.
Measure each output on quality formula (see below).

Step 7: Quality gate comparison:
- If `variant_quality_avg >= current_quality_avg + 0.05` (5% minimum improvement): commit
- Overwrite `agents/<phase>/<agent-id>.md` with variant
- Increment `version` in `agents/registry.json`
- Add entry to `upgrade-log.json`
- If `variant_quality_avg < current_quality_avg`: discard variant, log as "tested but reverted"

Step 8: Write `upgrade-log.json`:
```json
{
  "runs": [{
    "ran_at": "2026-05-22T02:55:00Z",
    "iterations_run": 100,
    "agents_tested": 12,
    "agents_upgraded": 3,
    "patterns_compounded": 7,
    "quality_before": 7.2,
    "quality_after": 7.6,
    "quality_delta": 0.4,
    "improvements_applied": ["code-reviewer v1.3 → v1.4", "prompt-engineer v2.1 → v2.2"]
  }],
  "lastRun": "2026-05-22T02:55:00Z"
}
```

Step 9: Send Telegram notification:
```
[CMNDCENTER] Nightly cycle complete
{N} improvements applied. Quality: {before}/10 → {after}/10
Agents upgraded: {list}
New compound patterns: {count}
```

Step 10: Write karpathy_wrapup.json for next session start, synthesizing:
- Top 3 patterns from this night's work
- Which agents were upgraded and why
- Any gaps still open from previous day
- Suggestions for next session

### Quality Measurement Formula

Used in Step 6 to score agent output improvements:

```
quality_score = (specificity × 0.3) + (actionability × 0.3) + (accuracy × 0.2) + (brevity × 0.2)

Each factor scored 1-10:
  specificity   — Does the output name exact files, functions, commands, or values?
                  1 = entirely generic, 10 = named exact code locations and commands
  actionability — Can a developer execute this output directly without further clarification?
                  1 = requires significant interpretation, 10 = copy-paste executable
  accuracy      — Does the output correctly reflect the codebase/system state?
                  1 = contains errors, 10 = fully verified against actual code
  brevity       — Is the output as concise as possible while retaining all essential information?
                  1 = verbose with filler, 10 = minimum tokens for maximum information

quality_score range: 1.0-10.0
Minimum acceptable: 6.0 for existing agents
Improvement threshold: new variant must score >= current + 0.5 before promotion
```

### AutoResearch Measurable Objectives (from autoResearch.json)

Objectives measured nightly, lowest-scoring prioritized for improvement:
1. `requirement_extraction_completeness` — completeness of requirements output
2. `prd_acceptance_criteria_quality` — acceptance criteria specificity and measurability
3. `architecture_completeness_score` — component coverage in architecture designs
4. `code_quality_gate_pass_rate` — % of code reviews that pass quality gate first time
5. `deployment_success_rate` — % of deployments that succeed without rollback
6. `quality_gate_blocker_count` — number of blockers found by quality agents per build
7. `agent_output_relevance_score` — cosine similarity between agent output and requirement
8. `session_memory_hit_rate` — % of pattern recognize() calls that return a match >= 0.75

---

## SECTION 9: PHILOSOPHICAL INTELLIGENCE LAYER

### The Compound Leverage Theorem

Every system interaction is an investment of time, tokens, and attention. The ROI of that investment does not expire — it compounds.

A 10% improvement in pattern recognition today means 10% better outputs on every future task. A 10% improvement in agent routing today means 10% less wasted effort on every future request. A new automation today eliminates human input on every future occurrence of that trigger.

These improvements compound multiplicatively:
```
annual_improvement = (1 + daily_improvement_rate)^365

At 1% daily: 1.01^365 = 37.8× better after one year
At 0.5% daily: 1.005^365 = 6.2× better after one year
At 0.1% daily: 1.001^365 = 1.44× better after one year
```

The system does not need to be 10% better per day. The nightly cycle targets ~0.5% improvement per night across all agents. Compounded over 365 cycles: **6.2× capability improvement per year**, passively.

### The Information Asymmetry Principle

Most people have access to the same raw data. The advantage is in three specific capabilities:

**1. Pattern Recognition (seeing connections others miss)**
The eBay arbitrage system, the unusual flow detector, the compound chain builder — all of these are pattern engines. The first person to recognize that "Dewalt tools sell at 3× markup on eBay vs FB Marketplace in Denver" is the only one making 300% margins. After six people know it, margins compress. The edge is in finding the pattern before it becomes common knowledge.

**2. Execution Speed (acting faster than others)**
A trending topic is worth 100× more in the first 6 hours than after 48 hours. A crypto signal has a 15-minute window before arbitrage collapses. Every CMNDCENTER chain is optimized for execution speed — cron at 7am, real-time monitoring, instant Telegram notifications, automated builds. Speed converts information asymmetry into monetary advantage before the gap closes.

**3. Conviction from Data (holding positions others abandon)**
Most people exit trades or abandon content themes based on emotion. IntelliTradeX holds until `RSI > 70` OR `take_profit_pct` is hit — not until fear kicks in. WAND continues uploading in a niche until `VCP+ < 0.12` for 5 consecutive videos — not until views "feel slow." Data-driven conviction is the systematic version of patience.

### The Autonomous Compounding Loop

The system is most powerful when human input is a trigger, not a requirement.

**Current state (as of 2026-05-22):**
- Human says "check opportunities" → system queries 5 scored items ready to act on
- Human says "build X" → Loki Mode runs 37 agents, deploys to GitHub, sends Telegram notification
- Human wakes up → Telegram already has overnight upgrade report, WAND video uploaded, market signals ready

**Target state (next 90 days):**
- Human wakes up → Telegram has 3 executed crypto trades (with P&L), 1 eBay flip scouted with buy details, WAND content uploaded with projected revenue, and system upgrade log from the night
- Human input is entirely optional for routine operations — input is reserved for novel decisions

Every manual task that gets identified is a gap to automate within that session. Not "I'll automate this later." Within the session. The longer a manual task persists, the more it compounds in the wrong direction — each repetition costs time without building the system.

### The Permanent Fix Principle

Patches treat symptoms. Architecture treats root causes. CMNDCENTER only does architecture.

When a service goes down: the fix is not to restart it. The fix is to add it to gap-bridge.ts auto-fix logic so it never stays down for more than 3 minutes again.

When a bug recurs: the fix is not to patch the same line a second time. The fix is to identify the root cause pattern, save it as a `category: "failures"` entry in patterns.json, and add a quality gate that catches it in the future.

When a prompt produces low-quality output: the fix is not to manually rephrase it once. The fix is to add it to the nightly AutoResearch cycle so the agent learns to improve its own outputs.

**Root Cause Protocol (for any recurring failure):**
1. `root-cause-analyst` agent: run 5-whys analysis
2. Identify the structural reason the failure can recur
3. Save to `patterns.json` as `category: "failures"` with `prevention_rule` field
4. Wire the prevention: add to quality gate, health check, or agent system prompt
5. Confirm the failure cannot recur with its current structural cause

### The Pattern Cascade Vision

The end state is a system that generates its own improvements without human input.

The progression:
- **Now:** Claude saves patterns manually when told to or when it remembers
- **Month 1:** AutoResearch uses patterns to improve agent prompts nightly, automatically
- **Month 3:** Agents begin recognizing when their own outputs produce successful patterns and flag them for the system
- **Month 6:** The pattern graph is dense enough that compound chains surface insights that no single session could produce
- **Year 1:** The system's baseline capability has compounded 6×. What took 10 minutes in Month 1 takes 90 seconds now. The same human triggers a system that produces 6× more output.

The recognition cascade:
```
New pattern detected
  → saved to patterns.json + ChromaDB
  → buildCascade() finds (A→C) transitive chains
  → new chains saved as Tier 2+ patterns
  → nightly cycle picks up new patterns
  → agent prompts updated with compound knowledge
  → agents produce higher-quality outputs
  → higher-quality outputs contain more patterns
  → more patterns saved
  → cycle continues, confidence increases, capability compounds
```

This is not exponential in the mathematical sense. It is exponential in the compound interest sense: small, consistent improvements that never reset. The system does not forget what it learned. Every session adds to a foundation that the next session builds on. The goal is a system that, after one year of operation, makes every individual interaction 6× more valuable than it was on day one — not because Claude got smarter, but because the system around Claude got smarter.

---

## QUICK REFERENCE: PATHS, PORTS, AND COMMANDS

### Critical Files
```
~/.amsa/memory/patterns.json           Pattern database (source of truth)
~/.amsa/memory/karpathy_wrapup.json    Session learnings
~/.amsa/memory/upgrade-log.json        Nightly upgrade history
~/.amsa/linear-queue/roi-queue.json    High-ROI opportunity queue
~/.amsa/linear-queue/gaps.json         Open system gaps
~/CMNDCENTER/loki/loki.sh              37-agent build entry point
~/CMNDCENTER/intellitradeX/.HALT       Trading kill switch (create to halt)
~/Library/LaunchAgents/com.cmndcenter.loki-improver.plist  Nightly cron
```

### Service Ports
```
LiteLLM    localhost:4000    Unified model routing
ChromaDB   localhost:8000    Vector embeddings
Supabase   localhost:54321   Structured data + analytics
n8n        localhost:5678    Workflow automation
Ollama     localhost:11434   Local model inference
AnythingLLM localhost:3001   Local RAG interface
Neo4j      localhost:7474    Knowledge graph (HTTP)
Neo4j      localhost:7687    Knowledge graph (bolt)
Redis      localhost:6379    Cache + pub/sub
Flowise    localhost:3000    Visual LLM flows
Open-LLM-VTuber localhost:12393  Voice avatar output
```

### Core TypeScript Utilities
```typescript
// ROI scoring
import { scoreROI, rankTasks } from "./system/roi-brain";

// Pattern recognition and saving
import { patternEngine } from "./system/pattern-engine";
const matches = await patternEngine.recognize("task description");
patternEngine.savePattern(newPattern);

// Gap detection and auto-fix
import { detectGaps, captureSystemState, healthMatrix } from "./system/gap-bridge";

// Agent routing
import { routeToAgent, getAgentsByPhase } from "./src/utils/agent-registry";

// LLM calls (always via LiteLLM, always with caching)
import { queryClaude, streamClaude } from "./src/utils/claude-integration";
```

### Key Commands
```bash
# Build
loki "product requirement"
loki --type [saas|api|cli|ai|data|full] "requirement"

# Status
loki --status && loki --memory && loki --briefing

# System health
cat ~/.amsa/linear-queue/roi-queue.json | python3 -m json.tool | head -50
cat ~/.amsa/memory/upgrade-log.json | python3 -m json.tool | tail -30

# Services
ollama serve &
litellm --config integrations/litellm/config.yaml --port 4000 &
supabase start
docker start chromadb n8n neo4j redis

# Upgrade cycle
python3 ~/CMNDCENTER/loki/loki_improver.py --session-start
python3 ~/CMNDCENTER/loki/loki_improver.py --session-end

# Trading control
touch ~/CMNDCENTER/intellitradeX/.HALT    # Stop all trades
rm ~/CMNDCENTER/intellitradeX/.HALT       # Resume trading
```

---

*End of CLAUDE DESIGN v4.0 — CMNDCENTER Intelligence Architecture*
*This document is the living operational consciousness. Update it when the system evolves.*
*Every section is active configuration. Every formula is live. Every path is real.*
