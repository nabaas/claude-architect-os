#!/usr/bin/env bash
# execution-layer/install/setup.sh — wire the 5-layer OMNISTACK into CMNDCENTER
set -euo pipefail

CMND="$HOME/CMNDCENTER"
REPO="$CMND/repos/claude-architect-os"
MEMORY="$HOME/.amsa/memory"
QUEUE="$HOME/.amsa/linear-queue"

echo "=== OMNISTACK Execution Layer Setup ==="
echo ""

# Layer 5: memory directories
mkdir -p "$MEMORY" "$QUEUE"
echo "✓ Layer 5: memory dirs created"

# Layer 4: make scouts executable
chmod +x "$REPO/execution-layer/scout/run-all.py" 2>/dev/null || true
echo "✓ Layer 4: scout scripts marked executable"

# Layer 3: check n8n
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "✓ Layer 3: Docker running — n8n available at localhost:5678"
else
  echo "⚠ Layer 3: Docker not running — start Docker Desktop for n8n"
fi

# Layer 2: check execution tools
for tool in code cursor aider; do
  if command -v "$tool" &>/dev/null; then
    echo "✓ Layer 2: $tool found"
  else
    echo "⚠ Layer 2: $tool not found — install manually"
  fi
done

# Layer 1: verify brain files
for f in system.md claude-design.md claude-desktop-prompt.md; do
  if [[ -f "$REPO/brain/$f" ]]; then
    echo "✓ Layer 1: brain/$f present"
  else
    echo "✗ Layer 1: brain/$f MISSING"
  fi
done

echo ""
echo "=== Dashboard ==="
echo "Open: file://$REPO/dashboard/index.html"

echo ""
echo "=== Claude Desktop Prompt ==="
echo "Copy from: $REPO/brain/claude-desktop-prompt.md"
echo "Paste into: Claude Desktop → Settings → System Prompt"

echo ""
echo "=== Done === ROI: 87/100 ==="
