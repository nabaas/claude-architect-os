# OMNISTACK — INSTALLATION SEQUENCE
# Maximum execution order. Copy-paste each block. Wait times are exact.
# Total cold-start time: ~25 minutes (Ollama model pulls dominate)
# ═══════════════════════════════════════════════════════════════════════

---

## PRE-FLIGHT (run once, verify before proceeding)

```bash
# Verify prerequisites
command -v git && command -v docker && command -v python3 && command -v node && echo "All prereqs OK"
# Required: git, docker, python3 ≥3.11, node ≥18, brew (macOS)
# If missing: brew install git docker node python3
```

**Wait:** 0s — instant check

---

## BLOCK 1 — CLONE + ENV (0:00)

```bash
# Clone the repo
git clone https://github.com/nabaas/claude-architect-os.git ~/CMNDCENTER/repos/claude-architect-os
cd ~/CMNDCENTER/repos/claude-architect-os

# Set up env file — fill in your API keys
cp .env.example ~/OMNISTACK/.env
nano ~/OMNISTACK/.env
# Required keys to fill:
#   ANTHROPIC_API_KEY=sk-ant-...
#   TELEGRAM_BOT_TOKEN=         (optional but recommended for notifications)
#   TELEGRAM_CHAT_ID=           (optional)
#   FIRECRAWL_API_KEY=          (optional — improves web scraping)
#   GITHUB_TOKEN=               (optional — higher API rate limits)

# Symlink canonical .env path
ln -sf ~/OMNISTACK/.env ~/CMNDCENTER/.env
echo "ENV ready"
```

**Wait:** Fill in ANTHROPIC_API_KEY — this is the only required key.

---

## BLOCK 2 — PYTHON DEPS (0:02)

```bash
# Install all Python dependencies (run in background — takes 2-3 min)
pip3 install anthropic requests langgraph dspy-ai mem0ai 'crewai[tools]' \
             openbb pyqlib pillow supabase 2>&1 | tee ~/cmndcenter_pip.log &
PIP_PID=$!
echo "Installing Python deps (PID $PIP_PID) — continue to Block 3 now"
```

**Wait:** Don't wait — continue to Block 3 immediately. Pip runs in background.

---

## BLOCK 3 — DOCKER STACK (0:02)

```bash
# Start Docker stack (n8n + postgres + redis + qdrant)
cd ~/OMNISTACK
docker compose up -d

# Wait for n8n to become healthy
echo "Waiting for n8n..."
until curl -sf http://localhost:5678/healthz >/dev/null 2>&1; do sleep 3; printf "."; done
echo " n8n UP"
```

**Wait:** ~30 seconds for Docker containers to initialize.

---

## BLOCK 4 — OLLAMA MODELS (0:03, background)

```bash
# Pull local LLM models in background — takes 10-20 min (4GB each)
ollama pull hermes3 &
ollama pull deepseek-coder &
ollama pull mistral &
echo "Pulling Ollama models in background — these take 10-20 min"
echo "Check progress: ollama list"
# Continue to Block 5 — don't wait for these
```

**Wait:** 0s — fire and forget. Models will be ready by the time you need them.

---

## BLOCK 5 — N8N WORKFLOWS (0:03)

```bash
# Import all 10 FUSION-MASTER workflows into n8n
cd ~/CMNDCENTER/repos/claude-architect-os

# Fix workflow IDs and strip invalid tags
python3 - << 'EOF'
import json, uuid
from pathlib import Path
for f in Path("n8n-workflows").glob("*.json"):
    d = json.loads(f.read_text())
    if "id" not in d:
        d["id"] = f"fusion-{f.stem}-v1"
    d.pop("tags", None)
    for node in d.get("nodes", []):
        if not node.get("id"):
            node["id"] = str(uuid.uuid4())
    f.write_text(json.dumps(d, indent=2))
    print(f"  Fixed: {f.stem}")
EOF

# Import via docker exec
for f in n8n-workflows/*.json; do
  name=$(basename "$f" .json)
  docker cp "$f" omnistack-n8n-1:/tmp/${name}.json 2>/dev/null
  result=$(docker exec omnistack-n8n-1 n8n import:workflow --input="/tmp/${name}.json" 2>&1)
  echo "$result" | grep -q "Successfully" && echo "  ✓ $name" || echo "  ✗ $name"
done

# Activate all in postgres (no API key needed)
docker exec omnistack-postgres-1 psql -U postgres -d n8n \
  -c "UPDATE workflow_entity SET active=true WHERE active=false;"
echo "All workflows activated"
```

**Wait:** ~45 seconds for all imports.

---

## BLOCK 6 — VS CODE EXTENSIONS + SETTINGS (0:04)

```bash
# Install required VS Code extensions
code --install-extension ms-azuretools.vscode-docker
code --install-extension eamodio.gitlens
code --install-extension usernamehw.errorlens
code --install-extension redhat.vscode-yaml
code --install-extension GitHub.vscode-pull-request-github
code --install-extension aaron-bond.better-comments
code --install-extension Gruntfuggly.todo-tree
code --install-extension wayou.vscode-todo-highlight

# Apply VS Code settings
mkdir -p ~/OMNISTACK/.vscode
cp config/vscode-settings.json ~/OMNISTACK/.vscode/settings.json
cp config/vscode-tasks.json    ~/OMNISTACK/.vscode/tasks.json
cp config/vscode-extensions.json ~/OMNISTACK/.vscode/extensions.json
echo "VS Code configured"
```

**Wait:** ~30 seconds for extension installs.

---

## BLOCK 7 — CLAUDE HOOKS (0:05)

```bash
# Wire PIE hook + pattern router into ~/.claude/settings.json
# Open Claude Code settings and add hooks manually:
code ~/.claude/settings.json

# Add these two hooks (merge into existing hooks object):
cat << 'EOF'
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "python3 ~/CMNDCENTER/scripts/prompt-intelligence-engine.py"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "python3 ~/CMNDCENTER/scripts/pattern-pipeline-router.py"
        }]
      }
    ]
  }
}
EOF

# Or use Claude Code CLI:
# Settings → Hooks → Add UserPromptSubmit hook
# Command: python3 ~/CMNDCENTER/scripts/prompt-intelligence-engine.py
echo "Hooks — add manually via Claude Code settings UI"
```

**Wait:** Manual step — 2 minutes to add via Claude Code settings UI.

---

## BLOCK 8 — LAUNCHAGENTS (0:07)

```bash
# Install macOS LaunchAgents for autonomous overnight processing
cp ~/CMNDCENTER/repos/claude-architect-os/../../../Library/LaunchAgents/com.cmndcenter.compound-loop.plist \
   ~/Library/LaunchAgents/ 2>/dev/null || true

# Create from templates if not present
cat > ~/Library/LaunchAgents/com.cmndcenter.compound-loop.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.cmndcenter.compound-loop</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>/Users/nadirabaas/OMNISTACK/FUSION-MASTER/hub/run-compound-loop.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict>
    <key>Hour</key><integer>2</integer><key>Minute</key><integer>0</integer>
  </dict>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>/Users/nadirabaas</string>
  </dict>
  <key>StandardOutPath</key><string>/Users/nadirabaas/CMNDCENTER/logs/compound-loop.stdout.log</string>
  <key>StandardErrorPath</key><string>/Users/nadirabaas/CMNDCENTER/logs/compound-loop.stderr.log</string>
  <key>RunAtLoad</key><false/><key>KeepAlive</key><false/>
</dict></plist>
EOF

launchctl load ~/Library/LaunchAgents/com.cmndcenter.compound-loop.plist
echo "compound-loop LaunchAgent loaded (fires at 2:00am)"
```

**Wait:** 0s — instant.

---

## BLOCK 9 — SHELL SHORTCUTS (0:07)

```bash
# Install shell aliases (fuse, loki, fresearch, etc.)
source ~/OMNISTACK/FUSION-MASTER/triggers/shortcuts.sh
bash ~/OMNISTACK/FUSION-MASTER/triggers/shortcuts.sh install
source ~/.zshrc
echo "Shortcuts loaded: fuse, loki, fresearch, fmorning, fwall, fdash, fscan, ftrade"
```

**Wait:** 0s — instant. You can use all aliases immediately.

---

## BLOCK 10 — FIRST POTENTIATION RUN (0:08)

```bash
# Fire the first full potentiation run — scans, scores, adopts, wires everything
source ~/CMNDCENTER/system/.env 2>/dev/null
source ~/OMNISTACK/.env 2>/dev/null
python3 ~/OMNISTACK/FUSION-MASTER/hub/potentiate-now.py
```

**Wait:** ~90 seconds. Outputs:
- 100+ items scanned (GitHub Trending + HN + GitHub Search + IntelliTradeX)
- Top repos auto-adopted (ROI ≥78)
- Desktop wallpaper refreshed with architecture map + agent teams
- n8n cascade triggered
- compound-loop fired in background

---

## BLOCK 11 — VERIFY EVERYTHING (0:10)

```bash
# Run the full verification suite
bash ~/CMNDCENTER/repos/claude-architect-os/setup/verify.sh
```

**Expected output:**
```
L1 WORKSPACE    ✓  All files present
L2 DEPS         ✓  anthropic, requests installed; ANTHROPIC_API_KEY set
L3 RUNTIME      ✓  n8n UP | Ollama UP | Docker healthy
L4 ORCHESTRATION ✓  LaunchAgents loaded | n8n workflows active
L5 AGENTS       ✓  PIE hook firing | agent-manager working
```

**Wait:** 0s — just read the output.

---

## BLOCK 12 — OPEN CLAUDE CODE (0:10)

```bash
# Open the workspace in VS Code
code ~/OMNISTACK/overlays/ai-fusion-stack-v1/editors/vscode-fusion.code-workspace
# Or simply:
code ~/OMNISTACK
```

**Wait:** First-time folder open triggers:
- Auto-Start task (system/startup.sh)
- QUICK SCAN (post-prompt intelligence search)
- PATTERN WATCH (scans codebase + shows Docker stack)

---

## BLOCK 13 — FIRST CLAUDE SESSION (0:11)

Open Claude Code in the OMNISTACK workspace. The PIE hook will fire on your first prompt:

```
╔═ PIE ═══════════════════════════════════════════════════
║ Domain: ...  Complexity: ...  Model: ...
║ Agents: loki-coordinator → [specialist agents]
║ Laws: VS Code=control plane | Docker=runtime | n8n=orchestration
╚═══════════════════════════════════════════════════════
```

**First prompt to run:**
```
fuse
```

This fires the full 40-stack domino chain. All systems activate.

---

## OVERNIGHT (AUTOMATIC — no action needed)

```
02:00am  compound-loop.py   SEARCH→SCORE→ADOPT→PROTOTYPE→WIRE→MEMORIZE
05:30am  claude-auto-updater  new skills + loopholes
06:05am  gen_wall_fusion.py  wallpaper refresh + agent team update
07:00am  wand-daily (n8n)   WAND signal scan
10:00am  morning-brief (n8n) Claude → brief → notify
```

**Every morning when you open VS Code:**
- Wallpaper shows updated intelligence architecture
- PIE hook carries overnight learnings into every prompt
- New repos adopted overnight appear in pattern-registry

---

## TIMING SUMMARY

| Block | Action | Duration | Wait Before Next |
|-------|--------|----------|-----------------|
| 1 | Clone + env | 1 min | 0s |
| 2 | Python deps | fires in background | 0s — continue immediately |
| 3 | Docker stack | 30s | Wait for n8n UP ping |
| 4 | Ollama models | fires in background | 0s — takes 10-20 min |
| 5 | n8n workflows | 45s | Wait for all ✓ |
| 6 | VS Code extensions | 30s | Wait for installs |
| 7 | Claude hooks | 2 min (manual) | Complete before Block 8 |
| 8 | LaunchAgents | instant | 0s |
| 9 | Shell shortcuts | instant | 0s |
| 10 | First potentiation | 90s | Wait for DONE report |
| 11 | Verify | instant | 0s |
| 12 | Open VS Code | 5s | Let tasks auto-run |
| 13 | First Claude session | — | System is live |
| **Total** | | **~8 min active** | **+20 min background** |

---

## RE-ACTIVATION (subsequent sessions)

```bash
# Everything persists. Just open VS Code and run:
fuse          # refresh all 40 stacks
fdash         # show intelligence dashboard + wallpaper
fresearch     # research + adopt new tools
```

The system self-improves overnight. Each session starts smarter than the last.
