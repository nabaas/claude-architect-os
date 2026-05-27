# OMNISTACK — MASTER KEYS MAP
# Version 3.0 | 2026-05-26 | Auto-updated by claude-auto-updater.py
# Single authoritative reference: keys → pipelines → repos → mini-projects → outputs

---

## ⌨️ SECTION 1 — MASTER HOTKEYS

| Key | Alias | Pipeline Fired | Output |
|-----|-------|---------------|--------|
| CMD+SHIFT+F | `fuse` | Full 40-stack domino | Research + Score + Adopt + Wallpaper + Notify + n8n |
| CMD+SHIFT+W | `fwall` | Wallpaper only | fusion_today.png → desktop |
| CMD+SHIFT+L | `loki` | 37-agent build | Full SaaS/product in one session |
| CMD+SHIFT+R | `fresearch` | Research + Adopt | Scored repos → adopted if ROI≥78 |
| CMD+SHIFT+I | `fintel` | ROI rescore + IntelliTradeX | Trade signals + rescore |
| CMD+SHIFT+M | `fmorning` | Morning brief + WAND | Signals brief + wallpaper |
| CMD+SHIFT+A | `fswarm` | AI Swarm (all stacks) | Multi-agent parallel build |
| CMD+SHIFT+T | `ftrade` | Trading chain | OpenBB→qlib→the0→freqtrade |
| CMD+SHIFT+Y | `fyt` | YouTube pipeline | Trends → scripts → upload |
| CMD+SHIFT+O | `fscan` | Quick-scan + ROI | Top HN/GitHub finds saved to memory |
| CMD+SHIFT+D | `fdash` | Intelligence dashboard | All 40 stacks status + wallpaper |
| CMD+SHIFT+V | `fvoice` | AIRI / VTuber | Voice avatar activated |

---

## 🔗 SECTION 2 — ALIAS → PIPELINE → CHAIN FLOW

```
fuse        → fusion-trigger.sh all     → FULL DOMINO (10 tiers, ~4min)
fquick      → fusion-trigger.sh quick   → Research + Wallpaper (~60s)
fmorning    → fusion-trigger.sh morning → WAND + Brief + Wallpaper
fresearch   → fusion-trigger.sh research → Research + Adopt + Score + Memory
frefresh    → fusion-trigger.sh refresh → Full Intelligence Refresh
fwall       → gen_wall_fusion.py        → Wallpaper only
fdash       → master-refresh.sh        → 40-stack health + wallpaper + Telegram
loki        → loki.sh                  → 37 agents, 7 phases
fswarm      → fusion-trigger.sh all    → All stacks potentiated
ftrade      → fusion-trigger.sh trade  → Trading intelligence chain
fscan       → quick-scan.py            → HN/GitHub scan → memory save
fdry        → fusion-trigger.sh dry    → Print chain, no execute
fstatus     → cron-schedule.sh status  → LaunchAgent health table
flogs       → cron-schedule.sh logs    → Tail all agent logs
frun        → omnistack-flow.py        → Run specific phase
frevenue    → shell loop               → Revenue stream status
```

---

## 🏗️ SECTION 3 — MINI-PROJECTS MAP

### 💹 IntelliTradeX  `~/CMNDCENTER/intellitradeX/`
```
Key: ftrade / CMD+SHIFT+T / fintel
Trigger words: trade, signal, crypto, pnl, backtest
Repos wired:
  intellitradeX     → main.py (F&G + CoinGecko scanner)
  freqtrade         → algo trading execution engine        [unwired — adopt pending]
  hummingbot        → arbitrage + market-making            [unwired — adopt pending]
  qlib              → alpha mining, predictive ML          [unwired — adopt pending]
  openbb            → macro intelligence terminal          [unwired — adopt pending]
  the0              → signal orchestration router          [unwired — adopt pending]
  fenixai           → multi-agent reasoning layer         [unwired — adopt pending]
Pipeline: OpenBB(macro) → qlib(predict) → fenixai(validate) → the0(route)
          → freqtrade(trend) + hummingbot(arb) → intellitradeX(PnL)
HALT: touch ~/CMNDCENTER/intellitradeX/.HALT
Output: /tmp/trade-signals.json + last_scan.json
```

### 📡 WAND  `~/CMNDCENTER/WAND/`
```
Key: fmorning / CMD+SHIFT+M
Trigger words: content, video, shorts, brief, trending, viral
Repos wired:
  WAND              → wand_scan.py (HN + GitHub signal scanner)
  youtube-pipeline  → trend scraper + script engine + upload
  roi-brain         → signals scored for content angle ROI
Pipeline: WAND(scan) → ROI Brain(score) → YouTube Pipeline(script + upload)
          → AIRI(narrate if configured) → Content Evening n8n workflow
Output: /tmp/wand-*.json + content_angles[] + WAND/last_run.txt
n8n: fusion-wand-daily-v1 fires 7am
```

### 🧠 ROI Brain  `~/CMNDCENTER/roi-brain/`
```
Key: fresearch / fscan
Trigger words: score, rank, roi, opportunity, value
Repos wired:
  roi-brain         → scorer.py (ROI = leverage×speed×compound / effort×risk)
  compound-memory   → patterns feed scoring calibration
  pattern-registry  → domain multipliers + chain assignments
Pipeline: Any scanner output → scorer.py → sorted ranked list
Usage: python3 scorer.py --input FILE --output FILE --threshold 60 --top 20
Output: /tmp/fusion-scored.json
```

### 🔬 Research + Adoption  `~/OMNISTACK/FUSION-MASTER/`
```
Key: fresearch / fuse
Trigger words: research, find, what's new, adopt, clone, integrate
Repos wired:
  research-aggregator → GitHub Trending + HN + GitHub Search API
  quick-scan.py       → lightweight HN post-prompt scan
  potentiate-now.py   → full Pythagorean potentiation run
  adopt.sh            → clone + wire + register any repo ≥78 ROI
  wire.sh             → create CLAUDE.md + register in pattern-registry
Pipeline: research-aggregator(gather) → scorer.py(rank) → adopt.sh(≥78)
          → wire.sh(register) → compound-memory(save) → n8n(cascade)
Output: /tmp/research-results.json → /tmp/fusion-scored.json
```

### 🏭 Loki (SaaS Factory)  `~/CMNDCENTER/loki/`
```
Key: loki / CMD+SHIFT+L / fswarm
Trigger words: build, create, product, saas, mvp, ship
Repos wired:
  loki              → loki.sh + loki_engine.py (37-agent orchestrator)
  SuperClaude       → persona routing (amplifies agent output quality)
  repomix-src       → 94% context compression before builds
  claude-architect-os → system brain, ROI gates, pattern engine
  crewai            → hierarchical multi-agent crew execution  [wired]
  langgraph         → stateful execution graph with checkpoints [wired]
  open-saas         → SaaS scaffold (Next.js + Stripe + Auth)   [unwired]
Pipeline (7 phases):
  P1 DISCOVER  → requirements-analyst + product-manager + market-researcher
  P2 DESIGN    → system-architect + api-architect + db-architect
  P3 BUILD     → python-expert + data-engineer + ml-engineer
  P4 QUALITY   → code-reviewer + security-engineer + quality-engineer
  P5 DEPLOY    → devops-architect + deployment-engineer
  P6 MONETIZE  → monetization-strategist + content-strategist
  P7 OPERATE   → metrics-analyst + pm-agent → compound-memory
```

### 🖼 Wallpaper + Dashboard  `~/CMNDCENTER/wallpapers/`
```
Key: fwall / fdash / CMD+SHIFT+W / CMD+SHIFT+D
Auto-fires: 6:05am via LaunchAgent
Repos wired:
  wallpapers  → gen_wall_fusion.py (architecture map → PNG)
  master-refresh.sh → 40-stack health + wallpaper + Telegram + JSON
Pipeline: master-refresh.sh → gen_wall_fusion.py → osascript(set desktop)
          → Telegram notify → n8n cascade
Output: ~/CMNDCENTER/wallpapers/fusion_today.png (desktop background)
        ~/CMNDCENTER/logs/master-refresh-YYYYMMDD.json
```

### 💰 Revenue Streams  `~/CMNDCENTER/revenue/`
```
Key: frevenue
Mini-projects:
  FlipScout         → Product arbitrage scanner (gap to build)
  DealScout         → Deal discovery + ROI scoring (gap to build)
  SteamStream       → Steam/gaming trend monetization (gap to build)
  AffiliateFunnels  → AI-generated affiliate content (gap to build)
  TrendSignals      → Trend prediction → early-mover signals (gap to build)
  IntelliTradeX     → Crypto trading signals (LIVE — ~/CMNDCENTER/intellitradeX/)
Status: IntelliTradeX LIVE; others are funded empty slots (next Loki builds)
```

### 🤖 Agent Avatar  `~/CMNDCENTER/repos/`
```
Key: fvoice / CMD+SHIFT+V
Trigger words: voice, avatar, narrate, speak
Repos wired:
  airi              → AI companion + voice communication
  Open-LLM-VTuber   → persistent AI avatar shell
  nova_app          → AI avatar system (if present)
Pipeline: High-value Claude output → Open-LLM-VTuber → speak → desktop
n8n: fusion-heartbeat workflow checks avatar health
```

---

## 🌊 SECTION 4 — FULL DOMINO FLOW (`fuse`)

```
USER INPUT (any editor / terminal / Raycast / n8n webhook)
    │
    ▼
PIE Hook (UserPromptSubmit) — classifies domain + complexity + model
    │
    ▼
TRIGGER-DICTIONARY.md lookup → domain + chain assigned
    │
    ├─[build/saas]──→ loki.sh → 37 agents → 7 phases → GitHub → n8n
    ├─[code/fix]───→ repomix → python-expert → code-reviewer → Aider commit
    ├─[research]───→ research-aggregator → scorer → adopt.sh (≥78) → memory
    ├─[trade]──────→ intellitradeX → the0 → freqtrade/hummingbot → PnL log
    ├─[content]────→ WAND scan → YouTube pipeline → schedule upload
    └─[all/fuse]───→ FULL CHAIN (below):

    TIER 0 PARALLEL [4 scanners × orthogonal domains]:
    research-aggregator(intel) ──┐
    wand_scan.py(content) ───────┤→ 126+ items combined
    intellitradeX/main.py(trade)─┤
    quick-scan.py(ops) ──────────┘
          │
          ▼
    TIER 1: roi-brain/scorer.py → ranked by ROI, threshold 60
          │
          ▼
    TIER 2 PARALLEL:
    adopt.sh (ROI≥78 GitHub repos) ─┐
    compound-loop.py (background) ──┘→ new repos cloned + wired
          │
          ▼
    TIER 3:
    compound-memory.json update → +new learnings
    gen_wall_fusion.py → fusion_today.png (set as desktop)
    n8n fusion-trigger webhook → cascade to 23 active workflows
    auto-notify.py → Telegram + macOS notification
          │
          ▼
    OUTPUTS:
    ├── /tmp/research-results.json  (raw signals)
    ├── /tmp/fusion-scored.json     (ROI-ranked)
    ├── /tmp/wand-*.json            (content angles)
    ├── /tmp/trade-signals.json     (market signals)
    ├── ~/CMNDCENTER/wallpapers/fusion_today.png
    ├── ~/CMNDCENTER/logs/potentiation-report-*.json
    └── ~/CMNDCENTER/system/intelligence/compound-memory.json
```

---

## 🔑 SECTION 5 — TRIGGER WORDS → CHAIN → AGENTS

| Trigger | Domain | Chain | Primary Agents | Model |
|---------|--------|-------|----------------|-------|
| build / create / saas / mvp / loki | ops | LOKI-FULL (V1) | loki-coordinator→37 agents | opus→sonnet |
| fix / debug / refactor / optimize | code | CODING (Q2) | python-expert→code-reviewer→security | sonnet |
| research / find / scout / what's new | data | RESEARCH (Q1) | deep-research→market-researcher→analyst | opus |
| trade / signal / crypto / pnl / backtest | intel | TRADE (H4) | intellitradeX→roi-brain→wand | opus |
| content / video / shorts / viral | content | CONTENT (V3) | content-strategist→youtube-pipeline | sonnet |
| deploy / docker / infra / k8s | ops | DEPLOY (V5) | devops-architect→deployment-engineer | sonnet |
| morning / brief / today | data | MORNING (V2) | wand→research→claude→notify | sonnet |
| adopt / clone / integrate / wire | ops | ADOPT (Q1) | adopt.sh→wire.sh→pattern-registry | sonnet |
| enhance / improve / overnight / gap | ai | OVERNIGHT (Q6) | compound-loop→dspy→openhands | opus |
| api / endpoint / backend | api | BACKEND (Q2) | api-architect→python-expert→code-reviewer | sonnet |
| data / pipeline / etl / ingest | data | DATA (Q4) | data-engineer→database-architect→metrics | sonnet |
| HALT | system | STOP | – | – |

---

## 🏭 SECTION 6 — REPO → MINI-PROJECT WIRING TABLE

| Repo | Domain | Mini-Project | Status | Potentiates |
|------|--------|-------------|--------|-------------|
| SuperClaude_Framework | ai | Loki + all agents | ✓ wired | Every agent chain |
| claude-architect-os | ai | System brain | ✓ wired | All pipelines |
| repomix-src | ops | Loki context prep | ✓ wired | Loki, code tasks |
| n8n | ops | All cascades | ✓ wired | Every pipeline |
| langgraph | ai | Loki + agents | ✓ wired | Loki P3, overnight |
| dspy | ai | Prompt optimizer | ✓ wired | All prompts nightly |
| mem0 | ai | Cross-session memory | ✓ wired | All sessions |
| crewai | ai | Loki P3 BUILD | ✓ wired | Loki, code tasks |
| wand | content | WAND mini-project | ✓ wired | YouTube, content |
| roi-brain | ops | Research + adopt | ✓ wired | All scoring |
| intellitradeX | trading | IntelliTradeX | ✓ wired | Trading chain |
| airi | ai | Avatar mini-project | ✓ wired | All outputs |
| Open-LLM-VTuber | ai | Avatar mini-project | ✓ wired | All outputs |
| expxagents-vscode | ops | IDE orchestration | ✓ wired | VS Code |
| freqtrade | intel | IntelliTradeX | ○ unwired | ftrade chain |
| hummingbot | trading | IntelliTradeX | ○ unwired | ftrade chain |
| qlib | ml | IntelliTradeX | ○ unwired | alpha mining |
| openbb | intel | IntelliTradeX | ○ unwired | macro intel |
| the0 | trading | IntelliTradeX | ○ unwired | signal routing |
| vllm | ai | LiteLLM backend | ○ unwired | 73% cost reduction |
| openhands | ai | Overnight coding | ○ unwired | compound-loop |
| temporal | ops | Durable pipelines | ○ unwired | All pipelines |
| airbyte | data | Data ingestion | ○ unwired | Data pipelines |
| open-saas | frontend | SaaS factory | ○ unwired | Loki P5 |
| prefect | ops | Pipeline scheduler | ○ unwired | Overnight loop |

*Adopted in this session (via potentiate-now.py):*
| Upsonic | ai | Agent tools | ✓ just adopted |
| ruflo | ai | Agent framework | ✓ just adopted |
| Skyvern | ops | Browser automation | ✓ just adopted |
| n8n-io/n8n | ops | n8n reference | ✓ just adopted |
| rowboat | ai | Agent platform | ✓ just adopted |

---

## ⏰ SECTION 7 — DAILY SCHEDULE (autonomous)

| Time | System | Key | Chain | Output |
|------|--------|-----|-------|--------|
| 2:00am | compound-loop.py | `fswarm` | H2 overnight | SEARCH→SCORE→ADOPT→PROTOTYPE→WIRE→MEMORIZE |
| 3:00am | AutoResearch (n8n) | auto | H1 | 100 research iterations |
| 5:30am | claude-auto-updater | auto | V4 | New skills + loopholes |
| 6:05am | gen_wall_fusion.py | `fwall` | P7 | Architecture map wallpaper |
| 7:00am | quick-scan LaunchAgent | `fscan` | PAIR | HN top signals → memory |
| 7:30am | wand-daily (n8n) | `fmorning` | V2 | WAND scan + brief |
| 8:00am | youtube-daily (n8n) | `fyt` | V3 | Trends + script + upload |
| 10:00am | morning-brief (n8n) | `fmorning` | V2 | Full brief → Notion + notify |
| 11:00am | quick-scan LaunchAgent | `fscan` | PAIR | Midday signal scan |
| 12:00pm | roi-midday (n8n) | `fresearch` | Q5 | Rescore all opportunities |
| 2:00pm | research-sweep (n8n) | `fresearch` | Q1 | GitHub + HN + Perplexity |
| 3:00pm | quick-scan LaunchAgent | `fscan` | PAIR | Afternoon signal scan |
| 4:00pm | full-refresh (n8n) | `frefresh` | H1 | All stacks rescore + memory |
| 7:00pm | quick-scan LaunchAgent | `fscan` | PAIR | Evening signal scan |
| 10:00pm | content-evening (n8n) | `fyt` | V3 | Shorts + podcast + email |
| 11:59pm | session-wrapup (n8n) | auto | V4 | Karpathy wrap + memory save |

---

## 🔐 SECTION 8 — ENV KEYS (~/OMNISTACK/.env)

| Key | Used By | Required For |
|-----|---------|-------------|
| ANTHROPIC_API_KEY | All Claude calls | Core intelligence |
| N8N_FUSION_TRIGGER_URL | master-refresh, git-push, quick-scan | n8n cascade |
| N8N_PROMPT_SUBMIT_URL | hooks | Prompt logging |
| TELEGRAM_BOT_TOKEN | auto-notify.py, master-refresh | Notifications |
| TELEGRAM_CHAT_ID | auto-notify.py | Notifications |
| FIRECRAWL_API_KEY | research-aggregator, compound-loop | Web scraping |
| PERPLEXITY_API_KEY | research-aggregator | Research quality |
| GITHUB_TOKEN | research-aggregator GitHub API | Higher rate limits |
| POSTGRES_USER/PASSWORD | docker-compose, n8n | Data persistence |
| N8N_ENCRYPTION_KEY | docker-compose | n8n security |
| REDIS_URL | docker-compose | Job queue |

*Set all keys in `~/OMNISTACK/.env` — never hardcode anywhere.*

---

## 🛑 SECTION 9 — KILL SWITCHES

```bash
touch ~/OMNISTACK/.HALT                          # Stop ALL pipelines
touch ~/CMNDCENTER/intellitradeX/.HALT           # Stop trading only
docker compose -f ~/OMNISTACK/docker-compose.yml down   # Stop all containers
launchctl unload ~/Library/LaunchAgents/com.cmndcenter.*.plist  # Stop all agents
```

---

## ⚡ SECTION 10 — ONE-COMMAND ACTIVATION

```bash
# Full potentiation run (right now):
python3 ~/OMNISTACK/FUSION-MASTER/hub/potentiate-now.py

# Full domino chain:
fuse

# Build any product:
loki "requirement here"

# Morning intelligence:
fmorning

# Check everything:
fdash && fstatus
```

---
*Auto-updated by claude-auto-updater.py at 5:30am. Edit sections 1-3 only — rest is generated.*
