# AnythingLLM — Claude Architect OS Integration

AnythingLLM provides a local ChatGPT-style interface over your own documents.
Runs at http://localhost:3001 (or 3002 if Flowise is on 3001).

## Docker Setup

```bash
docker run -d \
  --name anythingllm \
  -p 3001:3001 \
  -v ~/.anythingllm:/app/server/storage \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e OLLAMA_BASE_PATH=http://host.docker.internal:11434 \
  mintplexlabs/anythingllm
```

## Workspace Configuration

### Workspace: CMNDCENTER Brain
- **LLM**: Claude Sonnet 4.6
- **Embedding**: Ollama/nomic-embed-text
- **Vector DB**: LanceDB (built-in) or ChromaDB
- **Documents to ingest**:
  - `brain/core_identity/system.md`
  - `brain/prompt_layers/stack.md`
  - `prompts/base/master-prompts.md`
  - `docs/ARCHITECTURE.md`
  - `docs/WIRING.md`
  - `agents/registry.json`

### Workspace: Market Intelligence
- **Documents**: `~/.amsa/linear-queue/*.json`
- **LLM**: claude-sonnet-4-6
- **Prompt**: "You are a market intelligence analyst. Answer only from the provided signals."

### Workspace: Code Assistant
- **Documents**: entire `src/` directory (auto-sync via watchman)
- **LLM**: claude-sonnet-4-6 (coding mode)

## Auto-Sync Script

```bash
#!/bin/bash
# Sync new patterns to AnythingLLM workspace via API
WORKSPACE_SLUG="cmndcenter-brain"
API_URL="http://localhost:3001/api/v1"
API_KEY="${ANYTHINGLLM_API_KEY}"

# Upload new pattern files
for f in ~/.amsa/memory/patterns-*.json; do
  curl -s -X POST "$API_URL/workspace/$WORKSPACE_SLUG/upload" \
    -H "Authorization: Bearer $API_KEY" \
    -F "file=@$f"
done
```

Add to `scripts/upgrade.sh` to auto-sync on every upgrade cycle.
