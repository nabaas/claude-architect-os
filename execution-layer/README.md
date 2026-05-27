# Execution Layer — OMNISTACK v4.0

> 5-layer architecture injected into Claude Architect OS.
> Each layer is independent, wired to the brain, and compounds the next.

```
LAYER 1 — PROMPT BRAIN        brain/                    Claude reasoning engine
LAYER 2 — EXECUTION ENGINE    execution-layer/engine/   VS Code + Cursor + Cline
LAYER 3 — ORCHESTRATION       execution-layer/automation/ n8n + scripts + APIs
LAYER 4 — DATA SCOUT          execution-layer/scout/    Trend + arbitrage signals
LAYER 5 — MEMORY + REPO       execution-layer/integrations/ GitHub + local storage
```

---

## Layer 2 — Execution Engine (`engine/`)

Turns Claude outputs into real code and actions.

| Tool | Role | Config |
|------|------|--------|
| VS Code + Continue.dev | AI-assisted editing | `integrations/continue-dev/` |
| Cursor | Composer-mode builds | `engine/cursor.json` |
| Cline | Autonomous task execution | `engine/cline.json` |
| Aider | Git-native commits | `integrations/aider/` |
| Claude Code | Primary brain | This session |

**Trigger:** Any output from Layer 1 with `action: execute` → routes here.

---

## Layer 3 — Orchestration Engine (`automation/`)

Runs workflows that connect all layers.

| Trigger | Workflow | Output |
|---------|----------|--------|
| 7am cron | `automation/wand-pipeline.json` | YouTube video queued |
| unusualScore > 0.75 | `automation/trade-execute.json` | IntelliTradeX BUY |
| Session end | `automation/karpathy-wrapup.json` | patterns.json updated |
| 3am cron | `automation/nightly-upgrade.json` | Agent quality +X% |
| GitHub push | `automation/deploy-notify.json` | Telegram alert |

**Activate n8n:** `docker compose -f ~/CMNDCENTER/infrastructure/docker-compose.yml up n8n -d`

---

## Layer 4 — Data Scout Engine (`scout/`)

Finds opportunities before they peak.

| Scanner | Source | Signal | Gate |
|---------|--------|--------|------|
| `scout/crypto-flow.py` | Binance/Coinbase | unusualScore > 0.75 | RSI < 40 |
| `scout/flip-scanner.py` | Facebook Marketplace | margin > 30% | Denver/Aurora |
| `scout/wand-outlier.py` | YouTube API | VCP+ > 0.25 | topic spike > 200% |
| `scout/repo-intel.py` | GitHub trending | ROI > 60 | stars/age ratio |

**Run all scouts:** `python3 ~/CMNDCENTER/execution-layer/scout/run-all.py`

---

## Layer 5 — Memory + Repo System (`integrations/`)

Everything produced by the system becomes a reusable module.

| Store | Location | What lives here |
|-------|----------|-----------------|
| Patterns | `~/.amsa/memory/patterns.json` | Solved problems + confidence |
| Vectors | ChromaDB localhost:8000 | Semantic search across all patterns |
| Sessions | `~/.amsa/memory/karpathy_wrapup.json` | Session learnings |
| Tasks | `~/.amsa/linear-queue/` | ROI opportunities + gaps |
| Repos | `~/CMNDCENTER/repos/` | All active modules |
| GitHub | `github.com/nabaas/` | Deployed + versioned |

---

## Install

```bash
bash ~/CMNDCENTER/repos/claude-architect-os/execution-layer/install/setup.sh
```

## Runbooks

- [`runbooks/new-product.md`](runbooks/new-product.md) — full Loki Mode build
- [`runbooks/trade-signal.md`](runbooks/trade-signal.md) — signal → execute flow
- [`runbooks/content-pipeline.md`](runbooks/content-pipeline.md) — WAND → YouTube
- [`runbooks/upgrade-cycle.md`](runbooks/upgrade-cycle.md) — nightly 3am flow
