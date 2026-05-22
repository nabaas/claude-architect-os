# Claude Architect OS — System Architecture

## Mission

Transform Claude from a single chatbot into a **persistent operational architecture** — a recursive AI command center that compounds capability over time through autonomous workflow chaining, prompt memory layering, multi-agent execution, and repo orchestration.

---

## System Layers

```
USER INPUT (Raycast / Voice / Terminal)
         ↓
RAYCAST COMMAND CENTER (claude-architect-os extension)
  - create-project      → scaffold AI projects → auto-deploy to GitHub
  - prompt-orchestrator → compose 7-layer prompt stacks
  - ai-dashboard        → real-time agent + system monitoring
  - deploy-to-github    → one-command GitHub push
         ↓
CLAUDE CODE + VS CODE (primary execution brain)
  - Continue.dev + Cline + Roo Code
  - Aider (git-native commits)
  - Repomix (context compression)
         ↓
PROMPT ORCHESTRATION LAYER (7-layer inheritance)
  SYSTEM → MISSION → ROLE → TASK → CONTEXT → MEMORY → LIVE-DATA
         ↓
AGENT ROUTER / MIDDLEWARE
  - LiteLLM routing: task type → best model
  - 37-agent Loki Mode registry
  - Phase-based execution (DISCOVER→DESIGN→BUILD→QUALITY→DEPLOY→MONETIZE→OPERATE)
         ↓
TASK EXECUTION STACK
  - Python + TypeScript engines
  - n8n automation workflows
  - Pipeline engine (signal-to-build, repo-analysis, market-scan)
         ↓
AUTOMATION LAYER
  - n8n (self-hosted) + Zapier webhooks
  - LaunchAgents (3am nightly upgrade cycle)
  - Keyboard Maestro / Apple Shortcuts
         ↓
DATA MEMORY + VECTOR STORAGE
  - Supabase (structured: sessions, interactions, opportunities)
  - ChromaDB (vector: embeddings, semantic search)
  - ~/.amsa/memory/ (local JSON patterns)
  - Obsidian (human-readable knowledge graph)
         ↓
DASHBOARDS + ALERTS + MONETIZATION
  - Next.js dashboard (opportunity feed, agent status, profit heatmap)
  - Telegram/Discord alerts
  - Market intelligence → arbitrage scoring → revenue pipeline
```

---

## Core Subsystems

### 1. Raycast Extension (`src/`)
The command surface. Every workflow starts here.

| File | Purpose |
|------|---------|
| `create-project.tsx` | Scaffold AI projects with templates |
| `deploy-to-github.tsx` | Push to GitHub (no-view, instant) |
| `ai-dashboard.tsx` | Agent monitoring + recent ops |
| `prompt-orchestrator.tsx` | Compose + activate prompt layers |

### 2. Utility Layer (`src/utils/`)

| File | Purpose |
|------|---------|
| `claude-integration.ts` | Anthropic SDK with prompt caching |
| `middleware-router.ts` | Route tasks to optimal model |
| `cmndcenter-bridge.ts` | AMSA/Loki integration |
| `pipeline-engine.ts` | Execute automation pipelines |
| `agent-registry.ts` | 37-agent lookup + routing |
| `system-monitor.ts` | Real-time system health |
| `project-manager.ts` | Project scaffolding + GitHub deploy |

### 3. Brain Layer (`brain/`)

| Directory | Contents |
|-----------|---------|
| `core_identity/` | Master system prompt (XML-structured) |
| `prompt_layers/` | 7-layer inheritance stack |
| `execution_protocols/` | Model routing rules (JSON) |
| `automation_templates/` | Reusable workflow patterns |
| `market_models/` | Opportunity scoring models |
| `money_systems/` | Revenue optimization logic |

### 4. Memory System (`memory/`)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Structured storage | Supabase/PostgreSQL | Sessions, interactions, prompts |
| Vector search | ChromaDB | Semantic retrieval, context injection |
| Fast state | Redis | Active session cache |
| Human-readable | Obsidian | Knowledge graph navigation |
| Pattern files | JSON (~/.amsa/memory/) | Local session patterns |

### 5. Agent Registry (`agents/`)

37 agents organized by Loki Mode phase. Each agent has:
- `input_schema` / `output_schema`
- `quality_gate` assertion
- `timeout_ms` + `cost_limit_usd`
- `schedule` (for Phase 7 operate agents)

### 6. Infrastructure (`infrastructure/`)

- **Docker Compose**: Ollama, Open-WebUI, Supabase stack, ChromaDB, n8n, Redis
- **LaunchAgent**: Daily 3am auto-upgrade cycle
- **CMNDCENTER wiring**: Symlinks, AMSA skill registration, Raycast commands

---

## Compounding Chains

### Signal → Build → Monetize
```
Power Orchestrate signals
  → market-intelligence/signals/opportunity-scorer.ts
  → Loki Mode (37-agent build)
  → GitHub deploy
  → Metrics collection
  → AutoResearch overnight improvement
```

### Memory → Context → Better Outputs
```
Claude interaction
  → memory/extractors/session-memory.ts
  → ChromaDB embeddings
  → Context retrieval on next query
  → Richer prompt injection
  → Higher quality outputs
```

### Auto-Upgrade Loop (3am daily)
```
scripts/upgrade.sh
  → git pull latest
  → npm install
  → health check all services
  → prune expired patterns
  → log metrics
  → notify via Telegram
```

---

## Model Routing Matrix

| Task Type | Primary Model | Fallback | Reason |
|-----------|--------------|---------|--------|
| Coding | claude-sonnet-4-6 | claude-haiku-4-5 | Best code quality |
| Fast reasoning | ollama/hermes3 | claude-haiku-4-5 | Cost + speed |
| Deep research | claude-opus-4-7 | claude-sonnet-4-6 | Long context |
| Local automation | ollama/gemma3:4b | ollama/hermes3 | Zero API cost |
| Market analysis | claude-sonnet-4-6 + RAG | claude-sonnet-4-6 | Context augmentation |

---

## 5 Core Principles

1. **Compounding Intelligence** — Every session makes the next one smarter
2. **Reduced Friction** — Raycast → one keystroke to any capability
3. **Recursive Optimization** — The system improves itself overnight
4. **Agent Specialization** — 37 agents, each expert in one domain
5. **Execution > Information** — Every output is implementation-ready
