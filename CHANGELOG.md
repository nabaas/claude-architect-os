# Changelog

All notable changes to this project will be documented here.

---

## [Unreleased]

---

## [2.0.0] — 2026-05-27 — OMNISTACK System Overhaul

**This is a major internal overhaul** — 33 files added, complete system re-architecture as OMNISTACK.

### Added

**Agent Layer**
- `agents/agent-manager.py` — 37-agent auto-assignment with compound learning; assigns the best specialist team for any task
- `agents/potentiate-now.py` — 4-parallel-scanner potentiation engine; run after any significant session to wire new patterns into memory
- `agents/potentiation-matrix.py` — Pythagorean `√(a²+b²+c²)` chain optimizer used by the compound loop
- `agents/agent-router.json` — agent routing rules
- `agents/model-selector.json` — model selection rules per task type

**Dashboard**
- `dashboard/` — new local monitoring dashboard (open `dashboard/index.html`)
  - Agent status view, mission tracker, orchestrator state, system telemetry
  - Fully self-contained; no build step required

**Core / Brain**
- `core/master-prompt.md` — core laws loaded on every Claude session (read first)
- `brain/execution_protocols/litellm-config.yaml` — LiteLLM model routing proxy config (runs at `localhost:4000`)
- `brain/claude-desktop-prompt.md` — optimized Claude Desktop system prompt

**Hooks (wired in CLAUDE.md)**
- `UserPromptSubmit` → `hooks/prompt-intelligence-engine.py` (PIE) — fires on every prompt, injects `Agents:` + `Laws:` headers
- `PostToolUse` → `hooks/pattern-pipeline-router.py` — domain classifier for compound routing

**VS Code Integration**
- `config/vscode-settings.json` — performance layer settings
- `config/vscode-tasks.json` — task definitions: `tier-0-pattern-watch`, `master-refresh`, `compound-loop`, `potentiate-now`
- `config/vscode-extensions.json` — recommended extension list

**n8n Workflows**
- 10 active workflow JSONs under `n8n-workflows/`

**Documentation**
- `ARCHITECTURE.md` — full system architecture (50 tools, 4 tiers, routing, pipeline data models, n8n webhook surfaces)
- `MASTER-KEYS-MAP.md` — all hotkeys, aliases, pipeline trigger words, command reference
- `ROI-STACK.md` — ROI chain flows and scoring definitions
- `SELF-ENHANCE.md` — self-enhancement loop documentation
- `SUPREME-MODE.md` — supreme / autonomous mode activation guide
- `agents/CLAUDE.md` — agent-specific Claude Code instructions

**Pipelines**
- `pipelines/compound-loop` — nightly SEARCH→SCORE→ADOPT→MEMORIZE cycle
- `pipelines/quick-scan` — fast pattern scan
- `pipelines/fusion-trigger` — n8n fusion webhook trigger
- `pipelines/master-refresh` — full system refresh pipeline

**Intelligence**
- `intelligence/research-aggregator` — multi-source research aggregation
- `intelligence/scorer` — opportunity scoring engine
- `intelligence/wand_scan` — WAND project scanner
- `intelligence/intellitradeX` — market intelligence layer

### Changed

- `.env.example` — renamed project context from `Claude Architect OS` to `OMNISTACK`; added Telegram, Firecrawl, Perplexity, and Postgres configuration sections
- `CLAUDE.md` — +225 lines: auto-adoption protocol, hooks wiring, MCP server config, COMMAND_CENTER_X integration
- `setup/install.sh` — 13-block installer with exact wait times

### Migration Notes

- Copy the updated `.env.example` to `~/OMNISTACK/.env` and fill in the new keys (Telegram, Firecrawl, Perplexity are optional; Postgres vars have safe defaults)
- If you already have a `~/CMNDCENTER/.env`, symlink: `ln -sf ~/OMNISTACK/.env ~/CMNDCENTER/.env`
- Run `bash setup/verify.sh` after upgrading — expects 26+ pass, 0 critical failures

---

## [1.0.0] — 2026-05-22 — Initial release

- Raycast extension with 4 commands: Create AI Project, Deploy to GitHub, AI Dashboard, Prompt Orchestrator
- 37-agent Loki Mode configuration
- 7-layer prompt inheritance stack
- Nightly self-improvement loop via LaunchAgent
- Full Docker service stack (Supabase, ChromaDB, Redis, n8n)
