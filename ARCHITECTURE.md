# OMNISTACK FUSION-MASTER — System Architecture Design
# Type: Full-Stack Autonomous Intelligence OS
# Version: 2.0 | Designed: 2026-05-26

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OMNISTACK FUSION-MASTER v2.0                             │
│              Supreme Autonomous Compounding Intelligence OS                  │
│                                                                              │
│  INPUT LAYER      ROUTING LAYER      EXECUTION LAYER      OUTPUT LAYER      │
│  ───────────      ────────────       ───────────────      ────────────      │
│  User prompt  →   PIE classify   →   Agent chain      →   Artifact         │
│  File event   →   Trigger dict   →   Pipeline exec    →   Pattern saved    │
│  Time cron    →   ROI gate       →   Overnight loop   →   Wallpaper        │
│  Git push     →   Domain route   →   Self-enhance     →   Telegram notify  │
│  n8n webhook  →   Model select   →   Memory write     →   GitHub deploy    │
│                                                                              │
│  COMPOUND LAYER: every output feeds the next session's routing quality      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TIER ARCHITECTURE (50 Tools, 4 Tiers)

```
╔══════════════════════════════════════════════════════════════════════════╗
║  TIER 1 — AI CORE              Always running, mission-critical          ║
║  ─────────────────────────────────────────────────────────────────────  ║
║  Claude Code ─── LiteLLM:4000 ─── Ollama:11434 ─── vLLM:8001           ║
║       │               │                │               │                ║
║  SuperClaude      Model Router    Local Models    GPU Inference          ║
║  Loki Mode        opus/sonnet/    hermes3/         Mistral-7B           ║
║  AMSA:7070        haiku/ollama    gemma3:4b         quantized            ║
╠══════════════════════════════════════════════════════════════════════════╣
║  TIER 2 — DEV TOOLS            Active during build sessions             ║
║  ─────────────────────────────────────────────────────────────────────  ║
║  Cursor ─ Cline ─ Continue ─ Roo ─ Aider ─ Repomix ─ CrewAI ─ AutoGen  ║
║  LangChain ─ LangGraph ─ DSPy ─ mem0 ─ OpenHands ─ MetaGPT             ║
╠══════════════════════════════════════════════════════════════════════════╣
║  TIER 3 — AUTOMATION           Event-driven, always listening           ║
║  ─────────────────────────────────────────────────────────────────────  ║
║  n8n:5678 ─ Flowise:3000 ─ Temporal ─ Prefect ─ Trigger.dev            ║
║  LaunchAgents ─ Playwright ─ Firecrawl ─ Raycast ─ claude-triggers.py  ║
╠══════════════════════════════════════════════════════════════════════════╣
║  TIER 4 — INTELLIGENCE & DATA  Memory, signals, analytics               ║
║  ─────────────────────────────────────────────────────────────────────  ║
║  ChromaDB:8000 ─ Supabase:54321 ─ Redis:6379 ─ Neo4j:7474 ─ Cognee    ║
║  WAND ─ IntelliTradeX ─ ROI Brain ─ Freqtrade:8080 ─ Airbyte ─ OpenLIT║
╚══════════════════════════════════════════════════════════════════════════╝
```

---

## 3. ROUTING ARCHITECTURE

### 3.1 Input → Classification → Route

```
ANY INPUT
    │
    ▼
┌─────────────────────────────────────────────────┐
│  PIE (Prompt Intelligence Engine)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ EXACT    │  │ PREFIX   │  │ SEMANTIC     │  │
│  │ match    │  │ match    │  │ similarity   │  │
│  │ (word 1) │  │ (stem)   │  │ ChromaDB     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       └─────────────┴───────────────┘          │
│                      │                          │
│              TRIGGER-DICTIONARY.md lookup       │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  ROI Gate       │
              │  < 40 → reject  │
              │  40-79 → queue  │
              │  ≥ 80 → now     │
              └────────┬────────┘
                       │
                       ▼
         ┌─────────────────────────┐
         │  DOMAIN CLASSIFIER      │
         │  ops/ai/data/code/      │
         │  content/intel/general  │
         └──────────┬──────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │  MODEL SELECTOR              │
         │  opus   → architecture       │
         │  sonnet → implementation     │
         │  haiku  → simple ops         │
         │  hermes3→ offline/free       │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │  AGENT AUTO-ALLOCATOR        │
         │  top-skill[domain] sorted    │
         │  by skillScore descending    │
         │  + quality gate always added │
         └──────────────────────────────┘
```

### 3.2 Agent Skill Matrix

```
COMPONENT          RANK-1 AGENT           RANK-2 AGENT       MODEL
─────────────────────────────────────────────────────────────────────
Python code        python-expert          ml-engineer        sonnet
TypeScript/React   frontend-architect     python-expert      sonnet
System design      system-architect       backend-architect  opus
API design         api-architect          system-architect   opus
Database schema    database-architect     data-engineer      sonnet
ML/AI features     ml-engineer            prompt-engineer    opus
Security           security-engineer      code-reviewer      sonnet
Performance        performance-engineer   code-reviewer      sonnet
Testing            test-architect         quality-engineer   sonnet
Deployment         devops-architect       deployment-eng.    sonnet
Data pipelines     data-engineer          database-architect sonnet
Research           deep-research-agent    market-researcher  opus
Content            content-strategist     monetization-str.  sonnet
Business           business-panel-experts product-manager    opus
Documentation      technical-writer       learning-guide     haiku
Quality gate       code-reviewer          security-engineer  sonnet (always)
Final review       self-review            —                  haiku  (always)
```

---

## 4. SELF-ENHANCEMENT ARCHITECTURE

### 4.1 Three-Layer Self-Improvement Loop

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — SELF-REALIZATION (runs every 30min)              │
│  gap-bridge.ts healthMatrix()                               │
│  Watches: 8 services + 3 files + 4 chain connections        │
│  Auto-fixes: LOW + MEDIUM severity silently                 │
│  Alerts: HIGH severity → Telegram + gaps.json               │
└────────────────────────┬────────────────────────────────────┘
                         │ detects degradation
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2 — SELF-CORRECTION (triggered by Layer 1)           │
│  OpenHands: reads gap, writes fix, opens PR autonomously    │
│  Pattern confidence decay: unused 30d → confidence -0.1     │
│  Architectural integrity: each repo must have CLAUDE.md     │
│  Chain integrity: every chain endpoint must be reachable    │
└────────────────────────┬────────────────────────────────────┘
                         │ patterns extracted
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3 — SELF-COMPOUNDING (after every task)              │
│  patternEngine.savePattern() → patterns.json + ChromaDB     │
│  DSPy MIPROv2 → overnight prompt optimization               │
│  compound-memory.json domain_memory updated                 │
│  Confidence += 0.05 per reuse (cap 0.99)                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Overnight Processing Sequence

```
TIME    SYSTEM              ACTION
────────────────────────────────────────────────────────────────
02:00   compound-loop.py    SEARCH GitHub trending + HN + Claude research
02:15   compound-loop.py    SCORE (ROI formula) all found items
02:30   compound-loop.py    ADOPT ≥78 via adopt.sh
02:45   compound-loop.py    PROTOTYPE integration code for each
03:00   self-intelligence.py 100-iteration AutoResearch loop begins
03:00   compound-loop.py    WIRE: update trigger-dict + registry
03:15   compound-loop.py    MEMORIZE: compound-memory + ChromaDB
03:30   compound-loop.py    CYCLE 2 (next query rotation)
04:00   gap-bridge.ts       Full architectural integrity scan
04:30   compound-loop.py    DSPy: flag weakest prompt for optimization
05:00   compound-loop.py    CYCLE 3
05:30   claude-auto-updater.py  Skill/loophole discovery + TRIGGER-DICT update
06:00   gen_wall_fusion.py  Architecture map wallpaper refresh
06:05   Telegram notify     Summary: tools adopted, patterns saved, quality Δ
06:30   compound-loop.py    HALT — morning session prep begins
```

### 4.3 Pattern Recognition Flow

```
TASK ARRIVES
     │
     ▼
patternEngine.recognize(task)
     │
     ├── similarity ≥ 0.75 → REUSE: adapt existing solution (skip rebuild)
     │                        savePattern(result, reuse_count++)
     │
     └── similarity < 0.75 → BUILD NEW chain
                              execute via agent-allocator
                              quality score by self-review
                              │
                              ├── quality ≥ 0.7 → savePattern() to all layers
                              └── quality < 0.5 → root-cause-analyst diagnoses
```

---

## 5. PIPELINE WIRING DIAGRAM

### 5.1 Master Data Flow

```
SOURCES                 INGEST          SCORE           ROUTE
────────                ──────          ─────           ─────
GitHub trending    →    Airbyte    →    vLLM       →    n8n
HN / PH            →    PyAirbyte  →    ROI Brain  →    ├── trade signal → Freqtrade
arXiv papers       →    Firecrawl  →    LiteLLM    →    ├── build signal → Loki
User prompt        →    Claude     →    roi-brain  →    ├── content sig  → WAND
Git push           →    GitHub MCP →    pattern-eng→    ├── research sig → ChromaDB
Trade event        →    Freqtrade  →    IntelliTradeX→  └── gap signal   → OpenHands
                                                              │
MEMORY LAYERS                                                 ▼
─────────────                                         EXECUTION
patterns.json     ←──── savePattern() ←──────────── Agent chain runs
compound-memory   ←──── domain update ←──────────── Quality gate passes
ChromaDB          ←──── vector upsert ←──────────── self-review scores
Supabase          ←──── structured log ←─────────── Aider commits
                                                              │
OUTPUT SURFACES                                               ▼
───────────────                                       OUTPUTS
Telegram notify   ←──────────────────────────────── Artifact created
WAND wallpaper    ←──────────────────────────────── Pattern saved
GitHub PR         ←──────────────────────────────── Deployment done
VS Code display   ←──────────────────────────────── Task complete
n8n cascade       ←──────────────────────────────── Downstream fired
```

### 5.2 ROI Stack Chain (Highest-Compound)

```
airbyte ──[ingest]──▶ Supabase raw_signals
                            │
                     vLLM ──[score]──▶ signal_scores (0-100)
                            │
                      n8n ──[route]──▶ ┬── score ≥ 80 AND type=trade → Freqtrade execute
                                       ├── score ≥ 80 AND type=build → Loki queue
                                       ├── score ≥ 78 AND type=repo  → adopt.sh
                                       └── score ≥ 65               → ChromaDB index
                                                  │
                                         roi-brain.ts ──[learns]──▶ weights updated
                                                  │
                                         compound-memory ──[grows]──▶ next cycle smarter
```

### 5.3 Self-Enhancement Chain (SELF-ENHANCE stack)

```
Trigger.dev ──[reactive events]──▶ LangGraph ──[stateful execution]──▶
    ├── CrewAI ──[role allocation]──▶ OpenHands ──[code modification]──▶
    │       └── (parallel crews: research | build | quality)
    │
    └── Temporal ──[durable scheduling]──▶
            ├── DSPy ──[prompt optimization overnight]──▶ improved prompts
            └── Prefect ──[pipeline orchestration]──▶ all 13 overnight flows
                                │
                    mem0 ──[cross-session memory]──▶ agents remember history
                    Cognee ──[knowledge graph]──▶ entities + relationships
                    LlamaIndex ──[RAG retrieval]──▶ smart document search
                    OpenLIT ──[observability]──▶ self-healing Alertmanager→n8n
```

---

## 6. WAND + NOTIFICATION CASCADE

### 6.1 WAND Signal → Display Flow

```
WAND (7am daily)
    │
    ├── trend_scraper.py → YouTube trending + Twitter API
    │       └── ROI Brain scores topics (threshold: 0.6)
    │
    ├── content-strategist agent → script + title + description + tags
    │
    ├── Open-LLM-VTuber:12393 → AI avatar narration recorded
    │
    ├── YouTube upload → Supabase wand_videos table
    │
    └── gen_wall_fusion.py → fusion_today.png
            │
            ▼
        macOS desktop background (set via osascript)
        Shows: service health | pattern count | trade PnL |
               top opportunities | active pipelines | last build
```

### 6.2 Notification Routing

```
ANY SYSTEM EVENT
        │
        ▼
  Priority classification
        │
        ├── CRITICAL (service down, trade error, security alert)
        │       └── Telegram IMMEDIATE + pause dependent pipelines
        │
        ├── HIGH (build complete, adoption, overnight results)
        │       └── Telegram + wallpaper update + Notion log
        │
        ├── MEDIUM (pattern saved, gap fixed, model improved)
        │       └── Telegram (batched, 1/hour max)
        │
        └── LOW (routine health checks, minor pattern adds)
                └── Log to Supabase only (no notification)
```

---

## 7. VS CODE EXTENSION WIRING (Orchestration Layer)

```
Extensions active in OMNISTACK workspace:

GitLens ──────── Inline blame every line
                 Autolinks: ROUTE-/PLAN-/TODO- in commits
                 File/line history always visible
                 Branch comparison vs working tree

Error Lens ───── All 4 severity levels (error/warn/info/hint)
                 Status bar error count
                 Gutter icons + 300ms delay
                 Pattern: ROUTE/CHAIN errors surface immediately

Docker ──────── Container explorer refreshes every 5s
                Shows: name | status | ports
                Command: "docker compose" (V2)
                Compose files validated by YAML extension

YAML ─────────── Schema: docker-compose*.yml → compose-spec.json
                 Schema: .github/workflows/*.yml → github-workflow.json
                 Hover + completion on all workflow files

GitHub PRs ───── Tree layout, issues in SCM panel
                 Squash merge default
                 PR review mode: focusedMode: true

Better Comments ─ ROUTE: purple (#7c6fff) — OMNISTACK routing
                  CHAIN: light purple (#aaa2ff)
                  PLAN:  amber (#f59e0b)
                  TODO:  blue (#3b82f6)
                  FIXME: red + underline (#ef4444)
                  NOTE:  green (#22c55e)
                  HACK:  purple italic (#a855f7)

Todo Tree ──────── Groups: ACTIONS | PLANNING | SYSTEM | DEBT
                   Badge counts in sidebar always visible
                   Auto-refresh on file change

VS Code Tasks ──── Tier 0: PATTERN WATCH fires on folder open
(wired)            Tier 5c: MASTER REFRESH — all 40 stacks
                   Tier 5c: COMPOUND LOOP — run now
                   Tier 5c: INTELLIGENCE DASHBOARD
                   Tier 5c: EXTENSION ORCHESTRATE
                   Tier 5c: WAND + WALLPAPER
                   Tier 5c: TRIGGER DICTIONARY view
```

---

## 8. DATA MODELS

### 8.1 Pattern Schema (patterns.json + ChromaDB)

```typescript
interface Pattern {
  id: string;                    // "pattern_${timestamp}"
  domain: Domain;                // ops|ai|data|code|content|intel
  trigger: string[];             // words that activate this pattern
  agentChain: string[];          // ordered agent names
  qualityScore: number;          // 0-1, from self-review
  roiScore: number;              // 0-100, from roi-brain
  compoundFactor: 1 | 2 | 3;    // 1=one-time, 2=reusable, 3=self-improving
  confidence: number;            // starts at qualityScore, +0.05/reuse
  reuseCount: number;
  timestamp: string;             // ISO8601
  chromaEmbedding?: number[];    // stored in ChromaDB, not JSON
}
```

### 8.2 Repo Registry Schema (pattern-registry.json)

```typescript
interface RepoEntry {
  domain: string;
  role: string;
  wired: boolean;
  roiScore: number;              // 0-100
  github: string;                // https://github.com/...
  endpoint?: string;             // http://localhost:PORT
  dockerImage?: string;
  interface: string[];           // API surfaces
  chainRoles: string[];          // trigger|router|executor|memory_write
  potentiates: string[];         // domain names this improves
  notes: string;
  adoptCmd: string;
  litellmWire?: string;
  supabaseWire?: string;
}
```

### 8.3 Execution Log Schema (Supabase executions table)

```sql
CREATE TABLE executions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain      TEXT NOT NULL,
  trigger     TEXT,
  agent_chain TEXT[],
  model       TEXT,
  quality     FLOAT,
  roi         FLOAT,
  duration_ms INT,
  output_path TEXT,
  pattern_id  TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_executions_domain ON executions(domain);
CREATE INDEX idx_executions_quality ON executions(quality DESC);
CREATE INDEX idx_executions_roi ON executions(roi DESC);
```

---

## 9. INTERFACE DEFINITIONS

### 9.1 LiteLLM Supreme Routing Headers

```
POST http://localhost:4000/v1/chat/completions
Headers:
  x-task-type:    "code"|"architecture"|"research"|"fast"|"local"
  x-complexity:   "simple"|"moderate"|"complex"|"deep"
  x-cache:        "true"   (always — saves 60-80% token cost)
  x-compound:     "true"   (always — triggers savePattern on completion)
  Authorization:  Bearer ${ANTHROPIC_API_KEY}
```

### 9.2 n8n Webhook Surface

```
POST /webhook/fuse              → full domino chain
POST /webhook/git-push          → code review + security scan
POST /webhook/roi-stack         → airbyte→vLLM→freqtrade chain
POST /webhook/freqtrade-event   → trade log + Supabase + Telegram
POST /webhook/loki-complete     → build done → notify + memory update
POST /webhook/gap-detected      → auto-fix or queue to gaps.json
POST /webhook/pattern-save      → ChromaDB upsert + memory update
POST /webhook/morning           → WAND + brief + Notion sync
POST /webhook/overnight         → queue for 3am compound-loop
POST /webhook/fusion-trigger    → master domino (all downstream)
POST /webhook/self-heal         → OpenLIT alert → corrective pipeline
POST /webhook/compound-done     → compound-loop complete → wallpaper
```

### 9.3 ROI Brain Formula

```
ROI = (leverage × speed_multiplier × compound_factor) / (effort × risk)

leverage:         1-10  (# systems this output touches or improves)
speed_multiplier: 1-5   (1=days, 2=hours, 3=30min, 4=5min, 5=instant)
compound_factor:  1-3   (1=one-time, 2=reusable, 3=self-improving)
effort:           0.1-10 (estimated hours / 10, min 0.1)
risk:             1-5   (1=reversible, 5=destructive)

Thresholds:
  ≥ 80 → execute immediately
  60-79 → execute standard
  40-59 → queue
  < 40  → redirect
  Adoption gate: ≥ 78
```

---

## 10. DEPLOYMENT TOPOLOGY

```
MacBook (primary)
├── LaunchAgents (always-on daemons)
│   ├── com.cmndcenter.compound-loop      2:00am
│   ├── com.cmndcenter.loki-improver      3:00am
│   ├── com.cmndcenter.self-intelligence  2:55am
│   ├── com.cmndcenter.repo-watcher       continuous
│   ├── com.cmndcenter.ai-monitor         continuous
│   └── com.cmndcenter.split-wallpaper    6:05am
│
├── Docker Compose (~/CMNDCENTER/docker-compose.master.yml)
│   ├── n8n           :5678  (workflow backbone)
│   ├── chromadb      :8000  (vector memory)
│   ├── supabase      :54321 (structured store)
│   ├── redis         :6379  (hot cache)
│   ├── neo4j         :7474  (knowledge graph)
│   ├── flowise       :3000  (visual flows)
│   └── ollama        :11434 (local models)
│
├── On-demand (start when needed)
│   ├── vLLM          :8001  (GPU inference)
│   ├── freqtrade     :8080  (trading)
│   ├── litellm       :4000  (model proxy)
│   └── openhands     :3000  (code agent)
│
└── Cloud / External
    ├── Anthropic API (primary LLM)
    ├── OpenRouter    (fallback)
    ├── Telegram Bot  (notifications)
    ├── GitHub        (code storage + PRs)
    └── YouTube       (WAND content output)
```

---

## 11. SECURITY CONSTRAINTS

```
NEVER:  Hardcode secrets — all in ~/CMNDCENTER/.env
NEVER:  Expose internal ports externally without auth
NEVER:  Skip quality gate (code-reviewer + security-engineer)
NEVER:  Auto-execute trade ROI < 60
NEVER:  Modify OMNISTACK/CORE directly — overlays only
NEVER:  Run compound-loop past 06:30 — morning session conflict

ALWAYS: safe_mode: true in all overlay manifests
ALWAYS: Prompt cache on system turns ≥ 1024 tokens
ALWAYS: HALT file check every 10s in long-running processes
ALWAYS: Supabase RLS policies on all AI-written tables
ALWAYS: Telegram alert before any destructive auto-fix
```

---

## 12. EVOLUTION PATH

```
v2.0 (NOW)    ─── 50 tools, 37 agents, overnight compound loop
v2.1 (Q3)     ─── LangGraph as execution spine (replace raw pipelines)
v2.2 (Q3)     ─── DSPy nightly prompt optimization active
v2.3 (Q4)     ─── mem0 + Cognee full knowledge graph integration
v3.0 (Q4)     ─── Temporal durable execution for all overnight chains
v3.1 (2027)   ─── OpenHands autonomous PR generation nightly
v3.2 (2027)   ─── Full self-modification: system writes its own upgrades
```

---

*Architecture Design: OMNISTACK FUSION-MASTER v2.0*
*Designed: 2026-05-26 | Next review: when compound-loop adds ≥10 new repos*
*Implement with: /sc:implement | Build with: loki "requirement"*
