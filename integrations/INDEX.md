# Integrations Index — Claude Architect OS

Every repo, tool, and platform wired into this system.

---

## AI Coding Agents

| Tool | Config | Purpose |
|------|--------|---------|
| **Cursor** | [`cursor/cursor-rules.md`](cursor/cursor-rules.md) | AI IDE with `.cursorrules` project context |
| **Continue.dev** | [`continue-dev/config.json`](continue-dev/config.json) | VS Code AI coding with Claude + Ollama |
| **Cline** | [`cline/cline-settings.json`](cline/cline-settings.json) | Autonomous coding agent in VS Code |
| **Roo Code** | [`roo-code/roo-config.json`](roo-code/roo-config.json) | Roo Code (Roo Cline fork) configuration |
| **Aider** | [`aider/aider-config.yml`](aider/aider-config.yml) | Git-native AI commits |

---

## Multi-Agent Frameworks

| Tool | Config | Purpose |
|------|--------|---------|
| **CrewAI** | [`crewai/crew-config.py`](crewai/crew-config.py) | 9 specialist agents (Scout, Builder, Research, etc.) |
| **AutoGen** | [`autogen/autogen-config.py`](autogen/autogen-config.py) | Microsoft AutoGen conversation framework |
| **LangChain** | [`langchain/`](langchain/) | Chain-of-thought + tool use orchestration |
| **Flowise** | [`flowise/flowise-flows.md`](flowise/flowise-flows.md) | Visual LLM flow builder at localhost:3001 |

---

## Model Infrastructure

| Tool | Config | Purpose |
|------|--------|---------|
| **Ollama** | [`ollama/setup.sh`](ollama/setup.sh) | Local LLMs: hermes3, gemma3:4b, nomic-embed |
| **LM Studio** | [`lm-studio/setup.md`](lm-studio/setup.md) | GUI model manager, API on port 1234 |
| **LiteLLM** | [`litellm/config.yaml`](litellm/config.yaml) | Unified proxy routing Claude→Ollama→OpenRouter |
| **OpenRouter** | [`openrouter/config.md`](openrouter/config.md) | 200+ model fallback API |
| **AnythingLLM** | [`anythingllm/config.md`](anythingllm/config.md) | Local RAG interface for CMNDCENTER docs |

---

## Memory & Knowledge

| Tool | Config | Purpose |
|------|--------|---------|
| **Mem0** | [`mem0/mem0-config.py`](mem0/mem0-config.py) | Persistent AI memory layer (Claude + ChromaDB) |
| **Obsidian** | [`obsidian/vault-setup.md`](obsidian/vault-setup.md) | Human-readable knowledge graph |
| **Neo4j** | [`neo4j/schema.cypher`](neo4j/schema.cypher) | Graph DB: repo→tool→signal relationships |
| **ChromaDB** | Via docker-compose | Vector store for semantic memory search |
| **Supabase** | Via docker-compose | Structured storage: sessions, opportunities |

---

## Automation

| Tool | Config | Purpose |
|------|--------|---------|
| **n8n** | Via docker-compose + `automations/` | Self-hosted workflow automation |
| **LangFlow** | [`langflow/`](langflow/) | Visual LangChain flow builder |
| **Trigger.dev** | [`trigger-dev/`](trigger-dev/) | Background job scheduling |

---

## Terminal & Environment

| Tool | Config | Purpose |
|------|--------|---------|
| **Warp** | AI-native terminal | Primary terminal |
| **Terminal stack** | [`terminal/setup.sh`](terminal/setup.sh) | Oh My Zsh + Starship + zoxide + fzf + bat + eza |

---

## VS Code

| File | Purpose |
|------|---------|
| [`../vscode/extensions.json`](../vscode/extensions.json) | 30 recommended extensions |
| [`../vscode/settings.json`](../vscode/settings.json) | Optimized settings with tool integrations |

---

## Model Routing Matrix

```
Task Type       → Model              → Fallback
─────────────────────────────────────────────────
coding          → claude-sonnet-4-6  → claude-haiku
fast            → ollama/hermes3     → claude-haiku
deep-research   → claude-opus-4-7   → claude-sonnet-4-6
local           → ollama/gemma3:4b   → ollama/hermes3
embedding       → ollama/nomic-embed → openai/ada
long-context    → claude-opus-4-7   → gemini-1.5-pro (via OpenRouter)
fallback-all    → openrouter/* (cost-optimized)
```

All routing goes through **LiteLLM proxy** at `localhost:4000`.
