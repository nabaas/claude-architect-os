# Claude Architect OS — Integration Wiring Guide

Every connection, every data flow, every integration point.

---

## CMNDCENTER Integration

### Automatic (via `scripts/wire-cmndcenter.sh`)

```bash
bash ~/CMNDCENTER/repos/claude-architect-os/scripts/wire-cmndcenter.sh
```

Creates:
- Symlinks: `~/CMNDCENTER/repos/claude-architect-os/scripts/` → `~/bin/cao-*`
- AMSA skill registration in `~/.amsa/skills/`
- Raycast script commands in `~/CMNDCENTER/raycast-scripts/`
- LaunchAgent registration
- `~/.claude/settings.json` hooks for session start/end

### Manual Additions to CLAUDE.md

Add to the `## Installed Stack` table:
```
| Claude Architect OS | 1.0.0 | ~/CMNDCENTER/repos/claude-architect-os/ | Raycast command surface + 37-agent bridge |
```

---

## Raycast Extension Wiring

### Prerequisites
```bash
npm install -g @raycast/api
cd ~/CMNDCENTER/repos/claude-architect-os
npm install
npm run dev  # opens Raycast dev mode
```

### Environment Variables in Raycast Preferences
- `GITHUB_TOKEN` (required) — repo:write scope
- `ANTHROPIC_API_KEY` (required) — for Claude integration
- Configured via Extension Preferences UI

---

## Claude API (Anthropic SDK)

`src/utils/claude-integration.ts` uses prompt caching:

```typescript
// Cache system prompt (saves ~80% tokens on repeat calls)
messages: [{ role: "user", content: [
  { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
  { type: "text", text: userQuery }
]}]
```

Model defaults:
- Standard queries: `claude-sonnet-4-6`
- Deep research: `claude-opus-4-7`
- Fast/cheap: `claude-haiku-4-5-20251001`

---

## AMSA Orchestrator Wiring

AMSA reads from `~/.amsa/memory/` and `~/.amsa/linear-queue/`.

Claude Architect OS writes to these locations:
- `session-memory.ts` → `~/.amsa/memory/patterns.json`
- `opportunity-scorer.ts` → `~/.amsa/linear-queue/opportunities-YYYY-MM-DD.json`
- `scripts/upgrade.sh` → `~/.amsa/memory/upgrade-log.json`

---

## Loki Mode Bridge

`src/utils/cmndcenter-bridge.ts` exposes:

```typescript
// Trigger full 37-agent build
await triggerLoki("SaaS for invoice management");

// Check Loki last run
const status = await getLokiStatus();

// Sync patterns to AMSA memory
await syncMemory({ patterns, session_id, timestamp });
```

Internally executes:
```bash
bash ~/CMNDCENTER/loki/loki.sh "requirement"
```

---

## Memory Stack Wiring

### ChromaDB (Vector)
- Running at `localhost:8000` via Docker
- Collection: `claude-architect-os`
- `session-memory.ts` auto-upserts embeddings after each session
- `loadContext()` queries ChromaDB before injecting into prompts

### Supabase (Structured)
- Running at `localhost:54321` via Docker
- Schema: `memory/schema/supabase.sql`
- Tables: sessions, interactions, prompts, opportunities, market_signals, knowledge_graph

### Redis (Fast State)
- Running at `localhost:6379` via Docker
- Used by: system-monitor.ts (cache TTL 30s), pipeline-engine.ts (job queue)

---

## n8n Automation Wiring

n8n runs at `localhost:5678`. Import workflows from `automations/`:

1. **Market Scanner** — runs daily, calls opportunity-scorer.ts, writes to Linear queue
2. **Memory Sync** — triggers on session end, syncs patterns to Supabase
3. **GitHub Monitor** — watches CMNDCENTER repos, notifies on new commits
4. **Telegram Alerts** — receives webhooks from all services, routes to Telegram

Webhook base URL: `http://localhost:5678/webhook/`

---

## Docker Services Wiring

```bash
cd ~/CMNDCENTER/repos/claude-architect-os
docker compose -f infrastructure/docker-compose.yml up -d
```

Services and their ports:
| Service | Port | Purpose |
|---------|------|---------|
| Ollama | 11434 | Local LLM serving |
| Open-WebUI | 3000 | Local AI chat interface |
| Supabase Studio | 54323 | Database management |
| ChromaDB | 8000 | Vector storage API |
| n8n | 5678 | Automation workflows |
| Redis | 6379 | Fast state cache |
| PostgreSQL | 5432 | Structured storage |

---

## VS Code Extension Wiring

Recommended extensions (install via `code --install-extension`):
```bash
code --install-extension continue.continue
code --install-extension saoudrizwan.claude-dev
code --install-extension RooVetGit.roo-cline
code --install-extension eamodio.gitlens
code --install-extension usernamehw.errorlens
code --install-extension rangav.vscode-thunder-client
code --install-extension ms-azuretools.vscode-docker
```

---

## LaunchAgent Auto-Upgrade

Register the auto-upgrade daemon:

```bash
cp ~/CMNDCENTER/repos/claude-architect-os/infrastructure/launchagents/com.claudearchitectos.auto-upgrade.plist \
   ~/Library/LaunchAgents/

launchctl load ~/Library/LaunchAgents/com.claudearchitectos.auto-upgrade.plist
```

Runs daily at 3:00 AM. Logs to `~/.amsa/memory/upgrade-log.json`.

---

## Signal Flow: End-to-End Example

```
1. Raycast: CMD+SHIFT+F → FlipScout scan
2. opportunity-scorer.ts: scores 847 products
3. Top 10 written to ~/.amsa/linear-queue/
4. n8n webhook: picks up queue, sends Telegram alert
5. User reviews on iPhone
6. User triggers: CMD+SHIFT+L → Loki "build marketplace arbitrage bot"
7. Loki Phase 1-7: 37 agents build the bot
8. deploy-to-github: auto-creates GitHub repo
9. Metrics: performance logged to Supabase
10. 3am: upgrade.sh refines agents based on build quality
```
