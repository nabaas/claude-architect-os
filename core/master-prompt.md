# OMNISTACK MASTER PROMPT
# Version: 3.0 | Auto-loaded every session | Read before every action
# ═══════════════════════════════════════════════════════════════════════

## CORE LAWS (never override, never skip)

1. **VS Code is the master control plane** — all tasks, tasks.json, extensions
2. **Docker is the execution runtime** — all services run containerized
3. **n8n is the orchestration layer** — all automation flows through localhost:5678
4. **Preserve core stability** — never modify OMNISTACK/CORE or CMNDCENTER core files directly
5. **Enhance automation density** — every action must increase automation or compound intelligence
6. **Avoid dependency conflicts** — check pattern-registry before adopting; no doubles
7. **Improve recursive orchestration** — every output should trigger the next system
8. **Never duplicate functionality** — if a tool already does it, route to it; don't rebuild

## CONTROL PLANE HIERARCHY

```
VS Code (master control plane)
  └── tasks.json     → fire any pipeline with Cmd+Shift+P
  └── extensions     → Docker, GitLens, Error Lens, YAML, GitHub PRs
  └── PIE hook       → classifies every prompt before response
  └── pattern router → routes files to correct pipeline after every edit

Docker (execution runtime)
  └── n8n            → localhost:5678  (23 active workflows)
  └── postgres       → localhost:5432  (n8n + supabase data)
  └── redis          → localhost:6379  (hot cache + job queue)
  └── qdrant         → vector search
  └── script-runner  → ephemeral task execution

n8n (orchestration layer)
  └── fusion-trigger → fires on every git push, task, and fuse command
  └── full-intelligence → full refresh webhook
  └── research-sweep → daily research cascade
  └── wand-daily     → WAND signal scan 7am
  └── compound-loop  → nightly 2am intelligence growth
  └── [18 more active workflows]
```

## AGENT INHERITANCE RULES

Every agent spawned by this system inherits:

```
model_routing:
  complex/architecture → claude-opus-4-7  (via LiteLLM:4000)
  standard/build       → claude-sonnet-4-6
  fast/classify        → claude-haiku-4-5
  local/sensitive      → ollama/hermes3 or ollama/mistral

memory_access:
  read:  ~/CMNDCENTER/system/intelligence/compound-memory.json
  write: patternEngine.savePattern() after every recurring solution
  vector: ChromaDB:8000 for semantic search

quality_gate:
  every complex task → code-reviewer + security-engineer before deploy
  every new tool → check pattern-registry for duplicates first
  every session end → metrics-analyst + self-review + memory save

output_cascade:
  every build → Aider commit → git push → fusion-trigger webhook → n8n cascade
  every scan  → compound-memory update → wallpaper refresh → Telegram notify
  every error → root-cause-analyst → permanent fix → pattern saved
```

## MINI-PROJECT → AGENT TEAM MAP

Loaded from: `~/OMNISTACK/FUSION-MASTER/hub/mini-project-agents.json`
Refreshed: daily at 6:05am via gen_wall_fusion.py + agent-manager.py

| Mini-Project | Lead Agent | Supporting | Domain |
|---|---|---|---|
| intellitradeX | loki-coordinator | python-expert + ml-engineer | trading |
| WAND | loki-coordinator | market-researcher + python-expert | content |
| roi-brain | loki-coordinator | deep-research | ops |
| loki-builder | loki-coordinator | deep-research + system-architect | build |
| youtube-pipeline | loki-coordinator | system-architect + python-expert | content |
| research-sweep | loki-coordinator | deep-research + python-expert | research |
| agent-swarm | loki-coordinator | deep-research + system-architect | all |
| compound-memory | loki-coordinator | code-reviewer | ai |

## POTENTIATION DEFAULTS

Every task runs through: `python3 ~/OMNISTACK/FUSION-MASTER/hub/potentiation-matrix.py chain <domain> 4`

Minimum 3-vector coverage required:
- **Memory vector**: compound-memory.json OR ChromaDB OR Supabase
- **Execution vector**: Loki OR python-expert OR devops-architect
- **Automation vector**: n8n OR LaunchAgent OR Aider+GitHub

## DAILY REFRESH (auto, no human input needed)

```
2:00am  compound-loop.py     SEARCH→SCORE→ADOPT→PROTOTYPE→WIRE→MEMORIZE
5:30am  claude-auto-updater  new skills + loopholes via haiku
6:05am  gen_wall_fusion.py   architecture map + agent teams → desktop wallpaper
7:00am  quick-scan           HN top signals → compound-memory
7:00am  wand-daily (n8n)     WAND scan → content angles
10:00am morning-brief (n8n)  Claude → Notion → Telegram
```

## ENV KEYS (single source of truth: ~/OMNISTACK/.env)

```
ANTHROPIC_API_KEY         → all Claude API calls
N8N_FUSION_TRIGGER_URL    → main cascade webhook (UUID path)
TELEGRAM_BOT_TOKEN        → notifications
FIRECRAWL_API_KEY         → web scraping
PERPLEXITY_API_KEY        → research quality
GITHUB_TOKEN              → higher API rate limits
```

## KILL SWITCHES

```bash
touch ~/OMNISTACK/.HALT                 # stop all pipelines
touch ~/CMNDCENTER/intellitradeX/.HALT  # stop trading only
```

---
*This file is read by every agent, every session, every prompt.*
*Updated nightly by claude-auto-updater.py at 5:30am.*
*Source: ~/OMNISTACK/core/master-prompt.md*
