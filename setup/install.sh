#!/usr/bin/env bash
# install.sh — One-shot OMNISTACK installer
# Usage: bash setup/install.sh
# Installs all 13 blocks from sequence.md in the correct order.
# Prerequisites: git, docker, python3, node, brew (macOS)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOME_DIR="$HOME"
CMND="$HOME_DIR/CMNDCENTER"
OMNI="$HOME_DIR/OMNISTACK"
FUSION="$OMNI/FUSION-MASTER"
LOGS="$CMND/logs"
mkdir -p "$LOGS"

LOG="$LOGS/install-$(date +%Y%m%d-%H%M).log"
ERRORS=0

ts() { date '+%H:%M:%S'; }
log()  { echo "[$(ts)] $*" | tee -a "$LOG"; }
ok()   { echo "  ✓ $*"; }
warn() { echo "  ⚠ $*" | tee -a "$LOG"; ((ERRORS++)) || true; }
die()  { echo "  ✗ $*" >&2; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     OMNISTACK — ONE-SHOT INSTALLER v3.0              ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Logs: $LOG"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── B1: ENV CHECK ─────────────────────────────────────────────────────────────
log "BLOCK 1: Environment check"
for cmd in git docker python3 node jq; do
  command -v "$cmd" >/dev/null 2>&1 && ok "$cmd" || warn "$cmd not found — install with: brew install $cmd"
done

[[ -f "$OMNI/.env" ]] && ok ".env found" || {
  [[ -f "$REPO_ROOT/.env.example" ]] && cp "$REPO_ROOT/.env.example" "$OMNI/.env" || \
    touch "$OMNI/.env"
  warn ".env created at $OMNI/.env — add ANTHROPIC_API_KEY before proceeding"
  echo ""
  echo "  Open: nano $OMNI/.env"
  echo "  Add:  ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  read -p "  Press Enter once you've filled in ANTHROPIC_API_KEY..." || true
}
ln -sf "$OMNI/.env" "$CMND/.env" 2>/dev/null || true
ok "CMNDCENTER/.env symlinked"

# ── B2: PYTHON DEPS (background) ─────────────────────────────────────────────
log "BLOCK 2: Python dependencies (background)"
pip3 install --quiet anthropic requests langgraph dspy-ai mem0ai 'crewai[tools]' pillow 2>&1 \
  >> "$LOGS/pip-install.log" &
PIP_PID=$!
ok "pip install started (PID $PIP_PID) — continuing"

# ── B3: DOCKER STACK ──────────────────────────────────────────────────────────
log "BLOCK 3: Docker stack"
if docker info >/dev/null 2>&1; then
  cd "$OMNI"
  docker compose up -d 2>&1 | tail -3
  echo -n "  Waiting for n8n"
  TRIES=0
  until curl -sf http://localhost:5678/healthz >/dev/null 2>&1 || [[ $TRIES -gt 30 ]]; do
    sleep 2; printf "."; ((TRIES++))
  done
  echo ""
  curl -sf http://localhost:5678/healthz >/dev/null 2>&1 && ok "n8n UP" || warn "n8n not responding — check docker compose ps"
  cd "$REPO_ROOT"
else
  warn "Docker not running — start Docker Desktop and re-run"
fi

# ── B4: OLLAMA MODELS (background) ────────────────────────────────────────────
log "BLOCK 4: Ollama models (background, ~20 min)"
if command -v ollama >/dev/null 2>&1; then
  for model in hermes3 mistral deepseek-coder; do
    ollama list 2>/dev/null | grep -q "^$model" || \
      ollama pull "$model" >> "$LOGS/ollama-pull.log" 2>&1 &
  done
  ok "Model pulls started — check: ollama list"
else
  warn "ollama not found — install: brew install ollama"
fi

# ── B5: N8N WORKFLOWS ─────────────────────────────────────────────────────────
log "BLOCK 5: n8n workflow import"
if docker inspect omnistack-n8n-1 >/dev/null 2>&1; then
  python3 - << 'PYEOF'
import json, uuid
from pathlib import Path
wf_dir = Path(__file__).parent.parent / "n8n-workflows" if "__file__" in dir() else Path("n8n-workflows")
# Find actual n8n-workflows dir
import os
script_dir = Path(os.environ.get("REPO_ROOT", "."))
wf_dir = next((d for d in [script_dir/"n8n-workflows", Path("n8n-workflows")] if d.exists()), None)
if wf_dir:
    for f in wf_dir.glob("*.json"):
        d = json.loads(f.read_text())
        if "id" not in d: d["id"] = f"fusion-{f.stem}-v1"
        d.pop("tags", None)
        for node in d.get("nodes", []):
            if not node.get("id"): node["id"] = str(uuid.uuid4())
        f.write_text(json.dumps(d, indent=2))
    print(f"Fixed {len(list(wf_dir.glob('*.json')))} workflow files")
PYEOF

  imported=0
  for f in "$REPO_ROOT/n8n-workflows/"*.json; do
    name=$(basename "$f" .json)
    docker cp "$f" omnistack-n8n-1:/tmp/${name}.json 2>/dev/null
    result=$(docker exec omnistack-n8n-1 n8n import:workflow --input="/tmp/${name}.json" 2>&1)
    echo "$result" | grep -q "Successfully" && { ok "$name"; ((imported++)); } || warn "Failed: $name"
  done
  docker exec omnistack-postgres-1 psql -U postgres -d n8n \
    -c "UPDATE workflow_entity SET active=true WHERE active=false;" >/dev/null 2>&1 && \
    ok "All workflows activated"
  log "$imported n8n workflows imported"
else
  warn "n8n container not running — skipping workflow import"
fi

# ── B6: VS CODE ───────────────────────────────────────────────────────────────
log "BLOCK 6: VS Code extensions + settings"
mkdir -p "$OMNI/.vscode"
[[ -f "$REPO_ROOT/config/vscode-settings.json" ]] && \
  cp "$REPO_ROOT/config/vscode-settings.json" "$OMNI/.vscode/settings.json" && ok "settings.json"
[[ -f "$REPO_ROOT/config/vscode-tasks.json" ]] && \
  cp "$REPO_ROOT/config/vscode-tasks.json" "$OMNI/.vscode/tasks.json" && ok "tasks.json"
[[ -f "$REPO_ROOT/config/vscode-extensions.json" ]] && \
  cp "$REPO_ROOT/config/vscode-extensions.json" "$OMNI/.vscode/extensions.json" && ok "extensions.json"

if command -v code >/dev/null 2>&1; then
  for ext in ms-azuretools.vscode-docker eamodio.gitlens usernamehw.errorlens \
             redhat.vscode-yaml GitHub.vscode-pull-request-github \
             aaron-bond.better-comments Gruntfuggly.todo-tree; do
    code --install-extension "$ext" --force 2>/dev/null || true
  done
  ok "VS Code extensions installed"
fi

# ── B7: CLAUDE HOOKS ─────────────────────────────────────────────────────────
log "BLOCK 7: Claude hooks — copy scripts to CMNDCENTER"
mkdir -p "$CMND/scripts"
[[ -f "$REPO_ROOT/hooks/prompt-intelligence-engine.py" ]] && \
  cp "$REPO_ROOT/hooks/prompt-intelligence-engine.py" "$CMND/scripts/" && ok "PIE hook"
[[ -f "$REPO_ROOT/hooks/pattern-pipeline-router.py" ]] && \
  cp "$REPO_ROOT/hooks/pattern-pipeline-router.py" "$CMND/scripts/" && ok "Pattern router hook"
echo ""
echo "  ─── MANUAL STEP REQUIRED ────────────────────────────────────────────"
echo "  Open Claude Code → Settings → Hooks → Add two hooks:"
echo ""
echo "  Hook 1 — UserPromptSubmit:"
echo "    Command: python3 ~/CMNDCENTER/scripts/prompt-intelligence-engine.py"
echo ""
echo "  Hook 2 — PostToolUse (matcher: Edit|Write):"
echo "    Command: python3 ~/CMNDCENTER/scripts/pattern-pipeline-router.py"
echo "  ─────────────────────────────────────────────────────────────────────"
echo ""
read -p "  Press Enter once hooks are added in Claude Code..." || true

# ── B8: LAUNCHAGENTS ─────────────────────────────────────────────────────────
log "BLOCK 8: LaunchAgents"
mkdir -p "$HOME/Library/LaunchAgents"

# compound-loop (2am nightly)
cat > "$HOME/Library/LaunchAgents/com.cmndcenter.compound-loop.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.cmndcenter.compound-loop</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>$FUSION/hub/run-compound-loop.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict>
    <key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer>
  </dict>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME_DIR</string>
  </dict>
  <key>StandardOutPath</key><string>$LOGS/compound-loop.stdout.log</string>
  <key>StandardErrorPath</key><string>$LOGS/compound-loop.stderr.log</string>
  <key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
</dict></plist>
EOF
launchctl load "$HOME/Library/LaunchAgents/com.cmndcenter.compound-loop.plist" 2>/dev/null && \
  ok "compound-loop loaded (fires 2:00am)" || warn "LaunchAgent load failed"

# quick-scan (4x daily)
cat > "$HOME/Library/LaunchAgents/com.cmndcenter.quick-scan.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.cmndcenter.quick-scan</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>$FUSION/hub/run-quick-scan.sh</string>
  </array>
  <key>StartCalendarInterval</key><array>
    <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>11</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>15</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME_DIR</string>
  </dict>
  <key>StandardOutPath</key><string>$LOGS/quick-scan.stdout.log</string>
  <key>StandardErrorPath</key><string>$LOGS/quick-scan.stderr.log</string>
  <key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
</dict></plist>
EOF
launchctl load "$HOME/Library/LaunchAgents/com.cmndcenter.quick-scan.plist" 2>/dev/null && \
  ok "quick-scan loaded (fires 7/11/3/7pm)" || warn "quick-scan LaunchAgent load failed"

# ── B9: SHELL SHORTCUTS ───────────────────────────────────────────────────────
log "BLOCK 9: Shell shortcuts"
if [[ -f "$FUSION/triggers/shortcuts.sh" ]]; then
  bash "$FUSION/triggers/shortcuts.sh" install
  ok "Shortcuts installed in ~/.zshrc"
fi

# ── B10: FIRST POTENTIATION RUN ──────────────────────────────────────────────
log "BLOCK 10: First potentiation run"
echo ""
echo "  Running first full potentiation scan (~90s)..."
source "$CMND/system/.env" 2>/dev/null || true
source "$OMNI/.env" 2>/dev/null || true
python3 "$FUSION/hub/potentiate-now.py" 2>/dev/null | \
  grep -E "═══|TIER|complete|adopted|Memory|Wallpaper|n8n|elapsed|TOP" | head -20

# ── FINAL REPORT ─────────────────────────────────────────────────────────────
wait $PIP_PID 2>/dev/null || true  # pip should be done by now

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     OMNISTACK INSTALL COMPLETE                       ║"
echo "╠══════════════════════════════════════════════════════╣"
WIRED=$(python3 -c "import json; r=json.load(open('$CMND/system/blueprints/pattern-registry.json')); print(sum(1 for v in r['repos'].values() if v.get('wired')))" 2>/dev/null || echo "?")
AGENTS=$(launchctl list 2>/dev/null | grep -c cmndcenter || echo "?")
echo "║  Repos wired: $WIRED"
echo "║  LaunchAgents: $AGENTS"
echo "║  n8n: $(curl -sf http://localhost:5678/healthz 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status","?"))' 2>/dev/null || echo "check manually")"
echo "║  Warnings: $ERRORS"
echo "║"
echo "║  NEXT STEPS:"
echo "║  1. source ~/.zshrc"
echo "║  2. code ~/OMNISTACK"
echo "║  3. Run in Claude: fuse"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Full log: $LOG"
