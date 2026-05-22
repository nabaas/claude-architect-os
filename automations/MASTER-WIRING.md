# Master Wiring — Claude Architect OS

Every tool triggers every other. Every output feeds the next input.
Every chain produces either **profit**, **capability upgrade**, or **compounded intelligence**.

---

## CHAIN 1: SIGNAL → PROFIT (Daily 7:00 AM)

**Purpose:** Convert market data into money without manual intervention.

```
Trigger.dev (cron 7am)
  ↓
CrewAI Scout Agent
  → scrapes: TikTok trends, eBay pricing, Amazon BSR, Google Trends
  → scores each signal: (demand + compound + leverage) × ttv_inv × saturation_inv
  ↓
market-intelligence/signals/opportunity-scorer.ts
  → filters score > 0.7
  → writes: ~/.amsa/linear-queue/opportunities-YYYY-MM-DD.json
  ↓
n8n Workflow: "opportunity-alert"
  → reads linear-queue
  → formats Telegram message
  → sends to iPhone via Telegram Bot
  ↓
User reviews on iPhone (Pushcut shortcut opens dashboard)
  ↓
[If user triggers build]
Loki Mode (37-agent build via CMD+SHIFT+L)
  → Loki Phase 1-7: builds the product/tool
  → Deploys to GitHub (deploy-to-github Raycast command)
  ↓
IntelliTradeX (if signal is crypto-related)
  → executes trade on Binance/Alpaca
  → Telegram trade alert
  ↓
Supabase: logs revenue event
  ↓
NEXT DAY: upgrade.sh learns from what worked → improves Scout Agent prompt
```

**Tools in chain:** Trigger.dev → CrewAI → opportunity-scorer → n8n → Telegram → Loki → IntelliTradeX → Supabase → upgrade.sh

---

## CHAIN 2: KNOWLEDGE COMPOUNDING (Every interaction)

**Purpose:** Every session makes the next session smarter.

```
User asks Claude a question
  ↓
LlamaIndex RAG Engine
  → queries ChromaDB for relevant prior patterns
  → injects top-5 contexts into system prompt
  ↓
LiteLLM Proxy (localhost:4000)
  → routes to best model (claude-sonnet-4-6 for coding, claude-opus-4-7 for research)
  → includes cached system prompt (saves ~80% tokens)
  ↓
Claude responds (better than last time due to context)
  ↓
LangGraph save_memory node
  → extracts patterns from response
  → upserts to ChromaDB (vector)
  → appends to ~/.amsa/memory/patterns.json
  → if profit opportunity: writes to ~/.amsa/linear-queue/
  ↓
Mem0 auto-saves interaction
  ↓
Trigger.dev memory-sync job (every 6h)
  → syncs patterns.json → ChromaDB
  ↓
AnythingLLM workspace auto-updated
  ↓
GraphRAG re-indexes (weekly, finds compound relationships)
  ↓
Obsidian vault auto-note created
  → Obsidian Git: auto-commits vault
  → Dataview query updates dashboard panel
  ↓
NEXT QUERY: even richer context injected → output quality compounds
```

**Tools in chain:** LlamaIndex → LiteLLM → Claude → LangGraph → Mem0 → Trigger.dev → AnythingLLM → GraphRAG → Obsidian

---

## CHAIN 3: AUTO-UPGRADE LOOP (3:00 AM Daily)

**Purpose:** The system gets smarter overnight without manual work.

```
LaunchAgent fires: com.claudearchitectos.auto-upgrade.plist
  ↓
scripts/upgrade.sh
  Step 1: git pull (latest improvements)
  Step 2: npm install (new capabilities)
  Step 3: health check all Docker services
    → Ollama, ChromaDB, Supabase, n8n, Redis, LiteLLM
  Step 4: session-memory extractor (prunes expired patterns)
  Step 5: LlamaIndex re-indexes new docs
  Step 6: GraphRAG re-indexes (finds new relationships)
  Step 7: LLM self-improvement pass
    → reads last 50 patterns from memory
    → Claude identifies what worked vs failed
    → rewrites weak agent prompts in agents/registry.json
  Step 8: rotate LiteLLM routing logs
  Step 9: write upgrade-log.json
  Step 10: Telegram notification: "CMNDCENTER upgraded ✓ quality: X/10"
  ↓
Karpathy memory wrap-up
  → synthesizes session learnings
  → saves to ~/.amsa/memory/karpathy_wrapup.json
  ↓
NEXT SESSION: agents start with improved prompts + fresh context
```

**Tools in chain:** LaunchAgent → upgrade.sh → Ollama → ChromaDB → LlamaIndex → GraphRAG → Claude (self-improvement) → Telegram

---

## CHAIN 4: REPO INTELLIGENCE LOOP (On new git push)

**Purpose:** Every code commit improves the knowledge base and triggers quality checks.

```
git push to any CMNDCENTER repo
  ↓
GitHub Actions: .github/workflows/ci.yml
  → runs: npm lint, npm build, npm test
  ↓
GitHub webhook → n8n "repo-monitor" workflow
  → calls Repomix to compress repo context
  → sends compressed context to Claude for review
  ↓
CrewAI Audit Agent
  → checks for: security issues, logic bugs, performance problems
  → output: audit-report.json
  ↓
If issues found:
  → Aider auto-fixes (git-native commits)
  → Cline notified for complex fixes
  → Telegram alert: "Issues found in push"
  ↓
If clean:
  → Supabase: logs successful deployment
  → LlamaIndex: indexes new code
  → WAND content pipeline: generates changelog post
  ↓
Memory saved: "this pattern worked, this caused issues"
```

**Tools in chain:** GitHub Actions → n8n → Repomix → Claude → CrewAI Audit → Aider/Cline → WAND → LlamaIndex

---

## CHAIN 5: VOICE-TO-BUILD PIPELINE

**Purpose:** Speak a requirement, system builds and deploys it.

```
Voice input (AIRI / Open-LLM-VTuber)
  ↓
Whisper transcription
  ↓
Claude intent classifier
  → "build X" → Loki Mode
  → "find opportunity" → Scout Agent
  → "check status" → ai-dashboard
  → "show profits" → Supabase query
  ↓
Raycast command fired programmatically
  ↓
Loki Mode (if build intent)
  → 37-agent autonomous product build
  → GitHub deploy
  → Telegram: "Build complete: [repo URL]"
  ↓
Memory: logs what was requested and outcome
```

**Tools in chain:** Open-LLM-VTuber → Claude → Raycast → Loki Mode → GitHub → Telegram → Memory

---

## CHAIN 6: MARKET ARBITRAGE PROFIT SYSTEM

**Purpose:** Turn pricing asymmetry into consistent cash flow.

```
Daily: CrewAI Arbitrage Agent scans
  → eBay sold listings (< $X)
  → Amazon current price (> $X × 1.4 margin)
  → Local Denver Marketplace (Facebook, OfferUp)
  → opportunity-scorer: filters score > 0.8
  ↓
Neo4j: creates Product→Market→Signal nodes
  → finds hidden relationships (TikTok trending + eBay low = buy signal)
  ↓
n8n: sends structured opportunity to Notion database
  ↓
Telegram: instant iPhone alert with buy/sell info
  ↓
User action OR AutoBuy trigger (if configured)
  ↓
IntelliTradeX (for crypto arbitrage cross-exchange)
  → detects price delta between Binance/Alpaca
  → executes trade
  → logs P&L to Supabase
  ↓
Monthly: LangChain market node analyzes what worked
  → improves Arbitrage Agent scoring weights
  → updates opportunity-scorer formula constants
```

**Tools in chain:** CrewAI → opportunity-scorer → Neo4j → n8n → Telegram → IntelliTradeX → Supabase → LangChain (learning)

---

## CHAIN 7: CONTENT → REVENUE PIPELINE (WAND)

**Purpose:** AI-generated content creates passive income.

```
WAND daily 7am refresh
  → identifies trending topics (YouTube + Twitter API)
  → Claude generates: script, title, description, tags
  ↓
Open-LLM-VTuber: records AI avatar narration
  ↓
WAND uploads to YouTube
  ↓
Supabase: tracks views, AdSense revenue
  ↓
High-performing content:
  → Repomix compresses the winning formula
  → LlamaIndex indexes: "this topic + format = high views"
  → NEXT: WAND generates more of what works
  ↓
Memory: content strategy gets sharper over time
```

**Tools in chain:** WAND → Claude → Open-LLM-VTuber → YouTube → Supabase → Repomix → LlamaIndex → WAND (loop)

---

## TOOL DEPENDENCY MATRIX

```
Tool            → Triggers/Feeds                    → Produces
────────────────────────────────────────────────────────────────────────
Raycast         → LiteLLM, Loki, n8n               → Commands executed
Claude          → Memory, LangGraph, LlamaIndex    → Intelligent outputs
LiteLLM         → Claude, Ollama, OpenRouter        → Routed completions
Ollama          → Continue.dev, LiteLLM, Mem0      → Local LLM responses
LangGraph       → ChromaDB, Supabase, Queue        → Saved patterns
LlamaIndex      → ChromaDB, Obsidian               → RAG context
GraphRAG        → LlamaIndex, Neo4j                → Compound relationships
Mem0            → ChromaDB, Sessions               → Persistent memory
ChromaDB        → LlamaIndex, Mem0, LangChain      → Vector search
Supabase        → n8n, Dashboard                   → Structured analytics
n8n             → Telegram, Loki, Supabase         → Automated workflows
Trigger.dev     → CrewAI, n8n, Memory              → Scheduled executions
CrewAI          → Claude, Opportunity Scorer        → Agent outputs
AutoGen         → Claude, Builder, Reviewer         → Multi-agent builds
LangChain       → Claude, ChromaDB, Neo4j          → Chained reasoning
Flowise         → All LLMs, ChromaDB               → Visual flow outputs
AnythingLLM     → LlamaIndex, Obsidian docs        → Local RAG interface
Neo4j           → GraphRAG, LangChain              → Knowledge graph
Obsidian        → LlamaIndex, Dataview             → Human knowledge view
Aider           → Git, Claude                      → Auto commits
Cline           → Claude, filesystem               → Autonomous coding
Cursor          → Claude, Continue.dev             → AI-IDE coding
Repomix         → LlamaIndex, Claude               → Compressed context
IntelliTradeX   → Supabase, Telegram               → Trade execution + P&L
WAND            → Claude, YouTube, Supabase        → Content + revenue
Loki Mode       → All 37 agents                    → Deployed products
LaunchAgent     → upgrade.sh                       → Nightly improvement
Telegram        → User, n8n, Trigger.dev           → Mobile alerts
```

---

## ACTIVATION SEQUENCE (First Time)

```bash
# 1. Install everything
bash ~/CMNDCENTER/repos/claude-architect-os/scripts/install.sh

# 2. Start Docker services (Ollama, ChromaDB, Supabase, n8n, Redis)
docker compose -f infrastructure/docker-compose.yml up -d

# 3. Pull local models
bash integrations/ollama/setup.sh

# 4. Wire into CMNDCENTER
bash scripts/wire-cmndcenter.sh

# 5. Register LaunchAgent (auto-upgrade at 3am)
cp infrastructure/launchagents/com.claudearchitectos.auto-upgrade.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.claudearchitectos.auto-upgrade.plist

# 6. Build LlamaIndex knowledge base
python integrations/llamaindex/rag-engine.py

# 7. Load Raycast extension
cd ~/CMNDCENTER/repos/claude-architect-os && npm run dev

# 8. Import n8n workflows
# Open http://localhost:5678 → Import from automations/pipelines/

# System is now live. All chains are active.
```
