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
├── brain/                        # Claude intelligence layer
│   ├── core_identity/system.md   # Master system prompt (XML)
│   ├── prompt_layers/stack.md    # 7-layer inheritance docs
│   ├── execution_protocols/      # Model routing rules
│   ├── automation_templates/     # Reusable workflows
│   └── money_systems/            # Revenue optimization
│
├── prompts/                      # Prompt library
│   └── base/
│       ├── system-prompt.md      # Base operational prompt
│       └── master-prompts.md     # 10 master prompt templates
│
├── agents/
│   └── registry.json             # 37-agent configuration
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
└── docs/
    ├── ARCHITECTURE.md           # System design + layers
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

Copy `.env.example` → `.env` and fill in:
- `ANTHROPIC_API_KEY` — claude.ai/settings
- `GITHUB_TOKEN` — github.com/settings/tokens (repo scope)
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` — from Docker stack or supabase.com
- Other keys are optional (local services auto-start via Docker)

---

## Docs

- [Architecture](docs/ARCHITECTURE.md) — full system design
- [Wiring Guide](docs/WIRING.md) — every integration point
- [Prompt Stack](brain/prompt_layers/stack.md) — 7-layer inheritance
- [Agent Registry](agents/registry.json) — all 37 agents

---

Built for [CMNDCENTER](https://github.com/nabaas/CMNDCENTER) — AI Command Center v4.0
