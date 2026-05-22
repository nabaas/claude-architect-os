#!/bin/bash
# Ollama Setup — Claude Architect OS
# All local models used by the stack

set -e
echo "🦙 Setting up Ollama models for Claude Architect OS..."

# Install Ollama if not present
if ! command -v ollama &>/dev/null; then
  echo "Installing Ollama..."
  curl -fsSL https://ollama.ai/install.sh | sh
fi

# Start Ollama service
ollama serve &>/tmp/ollama.log &
sleep 3

# ─── Required Models ──────────────────────────────────────────────────────

echo "📥 Pulling hermes3 (fast reasoning, 8B)..."
ollama pull hermes3

echo "📥 Pulling gemma3:4b (ultra-fast local, 4B)..."
ollama pull gemma3:4b

echo "📥 Pulling nomic-embed-text (local embeddings)..."
ollama pull nomic-embed-text

# ─── Optional Models ──────────────────────────────────────────────────────

echo ""
read -p "Pull DeepSeek-Coder:6.7b for coding tasks? (y/N) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  ollama pull deepseek-coder:6.7b
fi

read -p "Pull Llama3:8b as general fallback? (y/N) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  ollama pull llama3:8b
fi

read -p "Pull Mistral:7b for instruction-following? (y/N) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  ollama pull mistral:7b
fi

# ─── Verify ───────────────────────────────────────────────────────────────

echo ""
echo "✅ Installed models:"
ollama list

echo ""
echo "🔗 API available at http://localhost:11434"
echo "   Test: curl http://localhost:11434/api/tags"

# ─── Open WebUI Setup ─────────────────────────────────────────────────────

echo ""
read -p "Set up Open WebUI for local chat interface? (y/N) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  if command -v docker &>/dev/null; then
    docker run -d \
      --name open-webui \
      --add-host=host.docker.internal:host-gateway \
      -p 3000:8080 \
      -v open-webui:/app/backend/data \
      -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
      -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
      --restart always \
      ghcr.io/open-webui/open-webui:main
    echo "✅ Open WebUI running at http://localhost:3000"
  else
    echo "⚠️  Docker not found. Install Docker first."
  fi
fi
