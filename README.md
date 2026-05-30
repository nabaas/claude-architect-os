# Claude Architect OS

> Turn Claude into a persistent operational architecture — not a single chatbot.

A recursive AI command center that compounds capability over time through autonomous workflow chaining, prompt memory layering, 37-agent orchestration, and self-improving pipelines.

---

## Architecture

```
USER (Raycast / Terminal / Voice)
         ↓
RAYCAST COMMAND CENTER (this extension)
  create-project · deploy-to-github · ai-dashboard · prompt-orchestrator
         ↓
CLAUDE CODE + VS CODE  ←→  AIDER · REPOMIX · SUPERCLAUDE
         ↓
PROMPT ORCHESTRATION  (7-layer inheritance stack)
  SYSTEM → MISSION → ROLE → TASK → CONTEXT → MEMORY → LIVE-DATA
         ↓
AGENT ROUTER  (37 specialists via Loki Mode)
  Phase 1: DISCOVER → Phase 2: DESIGN → Phase 3: BUILD
  Phase 4: QUALITY  → Phase 5: DEPLOY → Phase 6: MONETIZE → Phase 7: OPERATE
         ↓
AUTOMATION  (n8n · Zapier · LaunchAgents · nightly 3am upgrade)
         ↓
MEMORY  (Supabase · ChromaDB · Redis · Obsidian · ~/.amsa/memory/)
         ↓
DASHBOARDS + ALERTS + MONETIZATION
  (Next.js · Telegram · market-intelligence · arbitrage scoring)
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/nabaas/claude-architect-os
cd claude-architect-os

# 2. Install
bash scripts/install.sh

# 3. Wire into CMNDCENTER
bash scripts/wire-cmndcenter.sh

# 4. Start services
docker compose -f infrastructure/docker-compose.yml up -d

# 5. Load Raycast extension
npm install && npm run dev
```

---

## Repository Structure

```
claude-architect-os/
├── src/                          # Raycast extension
│   ├── create-project.tsx        # AI project scaffolding UI
│   ├── deploy-to-github.tsx      # One-command GitHub deploy
│   ├── ai-dashboard.tsx          # Agent + system monitoring
│   ├── prompt-orchestrator.tsx   # 7-layer prompt composer
│   └── utils/
│       ├── claude-integration.ts # Anthropic SDK + caching
│       ├── middleware-router.ts  # Task → best model routing
│       ├── cmndcenter-bridge.ts  # AMSA + Loki integration
│       ├── pipeline-engine.ts    # Automation pipeline runner
│       ├── agent-registry.ts     # 37-agent lookup
│       ├── system-monitor.ts     # Real-time health
│       └── project-manager.ts   # Project + GitHub management
│
├── agents/
│   ├── agent-manager.py          # 37-agent auto-assignment + compound learning
│   ├── potentiate-now.py         # 4-parallel-scanner potentiation engine
│   ├── potentiation-matrix.py    # Pythagorean √(a²+b²+c²) chain optimizer
│   ├── agent-router.json         # Agent routing rules
│   ├── model-selector.json       # Model selection rules per task type
│   ├── mini-project-agents.json  # Mini-project agent assignments
│   └── registry.json             # 37-agent configuration
│
├── brain/                        # Claude intelligence layer
│   ├── core_identity/system.md   # Master system prompt (XML)
│   ├── prompt_layers/stack.md    # 7-layer inheritance docs
│   ├── execution_protocols/
│   │   └── litellm-config.yaml   # LiteLLM model routing (localhost:4000)
│   ├── automation_templates/     # Reusable workflows
│   └── money_systems/            # Revenue optimization
│
├── core/
│   └── master-prompt.md          # Core laws loaded on every Claude session
│
├── config/
│   ├── vscode-settings.json      # VS Code editor settings / performance layer
│   ├── vscode-tasks.json         # VS Code task definitions (compound-loop, master-refresh, etc.)
│   └── vscode-extensions.json    # Recommended extension list
│
├── dashboard/                    # Local monitoring dashboard (open index.html)
│   ├── index.html                # Entry point
│   ├── app.jsx                   # Root component
│   ├── agents.jsx                # Agent status view
│   ├── mission.jsx               # Mission / goal tracker
│   ├── orchestrator.jsx          # Orchestrator status
│   ├── telemetry.jsx             # System telemetry
│   ├── shared.jsx                # Shared components
│   ├── data.js                   # Data layer
│   ├── colors_and_type.css       # Design tokens
│   └── styles.css                # Styles
│
├── prompts/                      # Prompt library
│   └── base/
│       ├── system-prompt.md      # Base operational prompt
│       └── master-prompts.md     # 10 master prompt templates
│
├── memory/
│   ├── schema/supabase.sql       # Full DB schema + RLS
│   └── extractors/session-memory.ts  # Pattern extraction + ChromaDB
│
├── market-intelligence/
│   └── signals/opportunity-scorer.ts  # (demand+compound+leverage)×ttv×sat
│
├── infrastructure/
│   ├── docker-compose.yml        # Full service stack
│   └── launchagents/             # 3am auto-upgrade daemon
│
├── scripts/
│   ├── install.sh                # Full idempotent setup
│   ├── upgrade.sh                # Auto-upgrade + health check
│   └── wire-cmndcenter.sh        # CMNDCENTER integration
│
├── ARCHITECTURE.md               # System design, 50 tools, 4 tiers, routing
├── MASTER-KEYS-MAP.md            # All hotkeys, aliases, pipeline triggers
├── ROI-STACK.md                  # ROI stack definition and chain flows
├── SELF-ENHANCE.md               # Self-enhancement loop documentation
├── SUPREME-MODE.md               # Supreme / autonomous mode docs
│
└── docs/
    ├── ARCHITECTURE.md           # System design + layers (legacy)
    └── WIRING.md                 # Every integration point
```

---

## Raycast Commands

| Command | Hotkey | Action |
|---------|--------|--------|
| Create AI Project | CMD+SHIFT+N | Scaffold + auto-deploy |
| Deploy to GitHub | CMD+SHIFT+D | Push current project |
| AI Dashboard | CMD+SHIFT+A | Agent + system status |
| Prompt Orchestrator | CMD+SHIFT+P | Compose prompt stacks |

---

## 37-Agent Loki Mode

Agents organized by phase — all accessible via `claude-architect-os` or directly via `loki "requirement"`:

| Phase | Agents |
|-------|--------|
| DISCOVER | requirements-analyst, product-manager, market-researcher, ux-researcher, deep-research-agent, repo-index, deep-research |
| DESIGN | system-architect, api-architect, database-architect, frontend-architect, backend-architect |
| BUILD | python-expert, data-engineer, ml-engineer, integration-specialist, prompt-engineer |
| QUALITY | code-reviewer, security-engineer, quality-engineer, test-architect, dependency-auditor, performance-engineer, root-cause-analyst |
| DEPLOY | devops-architect, deployment-engineer |
| MONETIZE | monetization-strategist, content-strategist, business-panel-experts |
| OPERATE | metrics-analyst, pm-agent, self-review, technical-writer, refactoring-expert, learning-guide, socratic-mentor |

---

## Agent Scripts

### `agents/agent-manager.py`
Auto-assigns the best specialist agent for any task based on 37-agent routing rules, with compound learning across sessions.

```bash
python agents/agent-manager.py --task "build a REST API for user auth"
# → Assigns: system-architect + backend-architect + security-engineer
```

### `agents/potentiate-now.py`
Runs a 4-parallel potentiation scan — reads recent patterns, scores them, wires high-ROI patterns into compound memory.

```bash
python agents/potentiate-now.py
# Runs: SEARCH → SCORE → ADOPT → MEMORIZE (all 4 scanners in parallel)
```

### `agents/potentiation-matrix.py`
Scores agent chains using a Pythagorean `√(a²+b²+c²)` optimizer. Used by the compound loop and `potentiate-now.py`.

---

## Dashboard

A local monitoring dashboard lives in `dashboard/`. Open it directly:

```bash
open dashboard/index.html
# or serve it:
cd dashboard && npx serve .
```

Shows live agent status, mission tracker, orchestrator state, and system telemetry.

---

## Self-Improvement Loop

Every night at 3:00 AM:

1. `scripts/upgrade.sh` runs via LaunchAgent
2. Pulls latest code + deps
3. Prunes expired memory patterns
4. Runs health checks on all services
5. Logs quality metrics to `~/.amsa/memory/upgrade-log.json`
6. Telegram notification

The system gets smarter every night without manual intervention.

---

## Model Routing

| Task | Model | Why |
|------|-------|-----|
| Coding | claude-sonnet-4-6 | Best code quality |
| Fast ops | ollama/hermes3 | Zero API cost |
| Deep research | claude-opus-4-7 | 200K context |
| Local automation | ollama/gemma3:4b | Fully offline |
| Market analysis | claude-sonnet-4-6 + RAG | Context augmented |

LiteLLM proxy config lives in `brain/execution_protocols/litellm-config.yaml`. Runs at `localhost:4000` — start it with:

```bash
litellm --config brain/execution_protocols/litellm-config.yaml
```

---

## Core Philosophy

> The leverage is not any individual AI model.
> The leverage is **orchestration + memory + automation + recursive improvement**.

5 principles this system is built on:

1. **Compounding Intelligence** — every session makes the next one smarter
2. **Reduced Friction** — one keystroke from intent to execution
3. **Recursive Optimization** — the system improves itself overnight
4. **Agent Specialization** — 37 specialists, not one generalist
5. **Execution > Information** — every output is implementation-ready

---

## Environment

Copy `.env.example` → `.env`:

```bash
cp .env.example ~/OMNISTACK/.env
nano ~/OMNISTACK/.env
# Then symlink for all tools to share one file:
ln -sf ~/OMNISTACK/.env ~/CMNDCENTER/.env
```

### Required

| Variable | Where to get it |
|----------|----------------|
| `ANTHROPIC_API_KEY` | [claude.ai/settings](https://claude.ai/settings) |

### Notifications (optional but recommended — enables nightly upgrade alerts)

| Variable | Notes |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Create a bot via [@BotFather](https://t.me/botfather) |
| `TELEGRAM_CHAT_ID` | Get from `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending your bot a message |

### Research APIs (optional — unlocks Firecrawl scraping + Perplexity search in pipelines)

| Variable | Where to get it |
|----------|----------------|
| `FIRECRAWL_API_KEY` | [firecrawl.dev](https://firecrawl.dev) |
| `PERPLEXITY_API_KEY` | [perplexity.ai/settings/api](https://perplexity.ai/settings/api) |
| `GITHUB_TOKEN` | github.com/settings/tokens (repo scope) |

### Docker Services (auto-configured by `install.sh` — change only if you have conflicts)

| Variable | Default | Notes |
|----------|---------|-------|
| `POSTGRES_USER` | `postgres` | n8n database user |
| `POSTGRES_PASSWORD` | `omnistack` | Change before production use |
| `POSTGRES_DB` | `n8n` | n8n database name |
| `N8N_ENCRYPTION_KEY` | *(generated)* | Auto-set by `install.sh` |
| `N8N_FUSION_TRIGGER_URL` | *(generated)* | Auto-populated by `install.sh` |
| `N8N_PROMPT_SUBMIT_URL` | *(generated)* | Auto-populated by `install.sh` |
| `REDIS_URL` | `redis://localhost:6379` | Local Redis instance |

### Memory / Vector Store

| Variable | Default | Notes |
|----------|---------|-------|
| `CHROMADB_URL` | `http://localhost:8000` | Local ChromaDB instance |
| `SUPABASE_URL` | `http://localhost:54321` | Local Supabase (Docker) or hosted |
| `SUPABASE_SERVICE_KEY` | *(from Supabase)* | Service role key (not anon key) |
| `MEMORY_STORE_PATH` | `~/.amsa/memory` | Local pattern + memory files |
| `PATTERNS_JSON_PATH` | `~/.amsa/memory/patterns.json` | Compound learning patterns |

### Timezone

| Variable | Default |
|----------|---------|
| `GENERIC_TIMEZONE` | `America/New_York` |
| `TZ` | `America/New_York` |

---

## Docs

- [Architecture](ARCHITECTURE.md) — full system design, 50 tools, 4 tiers, routing
- [Master Keys Map](MASTER-KEYS-MAP.md) — all hotkeys, aliases, pipeline triggers, command reference
- [ROI Stack](ROI-STACK.md) — ROI chain flows and scoring
- [Self-Enhancement Loop](SELF-ENHANCE.md) — how the system improves itself
- [Supreme Mode](SUPREME-MODE.md) — autonomous / supreme mode activation
- [Wiring Guide](docs/WIRING.md) — every integration point
- [Prompt Stack](brain/prompt_layers/stack.md) — 7-layer inheritance
- [Agent Registry](agents/registry.json) — all 37 agents

---

Built for [CMNDCENTER](https://github.com/nabaas/CMNDCENTER) — AI Command Center v4.0
