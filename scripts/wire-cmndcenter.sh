#!/usr/bin/env bash
# scripts/wire-cmndcenter.sh
# CMNDCENTER Wiring Script — Claude Architect OS v4.0
# Links claude-architect-os into ~/CMNDCENTER ecosystem:
#   - Creates symlinks for scripts
#   - Registers AMSA skills
#   - Adds Raycast script-commands
#   - Updates CLAUDE.md references
#   - Installs LaunchAgent links
#   - Wires session hooks into .claude/settings.json

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================
CAO_REPO="${CAO_REPO:-${HOME}/CMNDCENTER/repos/claude-architect-os}"
CMNDCENTER="${CMNDCENTER:-${HOME}/CMNDCENTER}"
HOME_DIR="${HOME}"
CLAUDE_DIR="${HOME_DIR}/.claude"
AMSA_DIR="${CMNDCENTER}/amsa"
LAUNCH_AGENTS_DIR="${HOME_DIR}/Library/LaunchAgents"
RAYCAST_SCRIPTS_DIR="${HOME_DIR}/.config/raycast-script-commands"
SETTINGS_JSON="${CLAUDE_DIR}/settings.json"
WIRING_LOG="${HOME_DIR}/.amsa/memory/wiring-log.json"

WIRED=()
SKIPPED=()
ERRORS=()

# ============================================================
# HELPERS
# ============================================================
ts()       { date +"%Y-%m-%dT%H:%M:%S"; }
log()      { echo "[$(ts)] $*"; }
log_ok()   { echo "[$(ts)] [OK]    $*"; WIRED+=("$1"); }
log_skip() { echo "[$(ts)] [SKIP]  $*"; SKIPPED+=("$1"); }
log_warn() { echo "[$(ts)] [WARN]  $*"; }
log_error(){ echo "[$(ts)] [ERROR] $*"; ERRORS+=("$*"); }

# Safe symlink: skip if already correct, overwrite if stale
safe_symlink() {
  local src="$1"
  local dest="$2"
  local label="${3:-$(basename "$dest")}"

  if [[ ! -e "$src" ]]; then
    log_warn "Source does not exist, skipping symlink: ${src}"
    return
  fi

  if [[ -L "$dest" ]]; then
    local current_target
    current_target=$(readlink "$dest")
    if [[ "$current_target" == "$src" ]]; then
      log_skip "${label} (symlink already correct)"
      return
    else
      rm "$dest"
    fi
  elif [[ -e "$dest" ]]; then
    log_warn "Non-symlink exists at ${dest} — backing up to ${dest}.bak"
    mv "$dest" "${dest}.bak"
  fi

  mkdir -p "$(dirname "$dest")"
  ln -sf "$src" "$dest"
  log_ok "${label}"
}

# ============================================================
# PREFLIGHT
# ============================================================
log "========================================"
log "CMNDCENTER Wiring — Claude Architect OS"
log "========================================"
log "CAO_REPO:   ${CAO_REPO}"
log "CMNDCENTER: ${CMNDCENTER}"
log ""

if [[ ! -d "$CAO_REPO" ]]; then
  log_error "CAO_REPO not found: ${CAO_REPO}"
  exit 1
fi

# ============================================================
# STEP 1: Script symlinks into ~/CMNDCENTER/scripts/
# ============================================================
log "--- Step 1: Script Symlinks ---"

mkdir -p "${CMNDCENTER}/scripts"

scripts_to_link=(
  "upgrade.sh"
  "install.sh"
  "wire-cmndcenter.sh"
)

for script in "${scripts_to_link[@]}"; do
  src="${CAO_REPO}/scripts/${script}"
  dest="${CMNDCENTER}/scripts/cao-${script}"
  if [[ -f "$src" ]]; then
    safe_symlink "$src" "$dest" "script:cao-${script}"
    chmod +x "$src"
  fi
done

# ============================================================
# STEP 2: Market intelligence symlinks
# ============================================================
log ""
log "--- Step 2: Market Intelligence Symlinks ---"

mkdir -p "${CMNDCENTER}/scripts/market-intel"

if [[ -d "${CAO_REPO}/market-intelligence" ]]; then
  safe_symlink \
    "${CAO_REPO}/market-intelligence" \
    "${CMNDCENTER}/repos/cao-market-intelligence" \
    "market-intelligence-dir"
fi

# ============================================================
# STEP 3: Register AMSA skills
# ============================================================
log ""
log "--- Step 3: AMSA Skills Registration ---"

mkdir -p "${AMSA_DIR}/skills"

SKILLS_TO_REGISTER=(
  "brain/core_identity/system.md:cao-system-identity"
  "agents/registry.json:cao-agent-registry"
  "brain/execution_protocols/router.json:cao-router"
  "brain/prompt_layers/stack.md:cao-prompt-stack"
)

for entry in "${SKILLS_TO_REGISTER[@]}"; do
  local_path="${entry%%:*}"
  skill_name="${entry##*:}"
  src="${CAO_REPO}/${local_path}"
  dest="${AMSA_DIR}/skills/${skill_name}"

  if [[ -f "$src" ]]; then
    safe_symlink "$src" "$dest" "amsa-skill:${skill_name}"
  fi
done

# Write AMSA skills index
AMSA_SKILLS_INDEX="${AMSA_DIR}/skills/cao-index.json"
cat > "$AMSA_SKILLS_INDEX" << 'SKILLEOF'
{
  "source": "claude-architect-os",
  "version": "4.0.0",
  "skills": [
    {
      "id": "cao-system-identity",
      "type": "system-prompt",
      "description": "Master Claude identity — recursive operational intelligence system",
      "path": "cao-system-identity"
    },
    {
      "id": "cao-agent-registry",
      "type": "config",
      "description": "37-agent registry with full schemas",
      "path": "cao-agent-registry"
    },
    {
      "id": "cao-router",
      "type": "config",
      "description": "AI model routing rules",
      "path": "cao-router"
    },
    {
      "id": "cao-prompt-stack",
      "type": "documentation",
      "description": "7-layer prompt inheritance system",
      "path": "cao-prompt-stack"
    }
  ]
}
SKILLEOF
log_ok "amsa-skills-index"

# ============================================================
# STEP 4: Raycast script-commands
# ============================================================
log ""
log "--- Step 4: Raycast Script Commands ---"

mkdir -p "$RAYCAST_SCRIPTS_DIR"

# Generate a Raycast script-command for Claude Architect OS
RAYCAST_CAO_SCRIPT="${RAYCAST_SCRIPTS_DIR}/cao-launch.sh"
if [[ -f "$RAYCAST_CAO_SCRIPT" ]]; then
  log_skip "Raycast cao-launch.sh already exists"
else
  cat > "$RAYCAST_CAO_SCRIPT" << RAYCASTEOF
#!/usr/bin/env bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Claude Architect OS
# @raycast.mode silent
# @raycast.packageName CMNDCENTER

# Optional parameters:
# @raycast.icon 🏗
# @raycast.description Launch Claude Architect OS session

cd "${CAO_REPO}"
open -a Terminal "${CAO_REPO}"
RAYCASTEOF
  chmod +x "$RAYCAST_CAO_SCRIPT"
  log_ok "raycast-cao-launch"
fi

# Generate Raycast script for upgrade
RAYCAST_UPGRADE_SCRIPT="${RAYCAST_SCRIPTS_DIR}/cao-upgrade.sh"
if [[ -f "$RAYCAST_UPGRADE_SCRIPT" ]]; then
  log_skip "Raycast cao-upgrade.sh already exists"
else
  cat > "$RAYCAST_UPGRADE_SCRIPT" << RAYCASTEOF
#!/usr/bin/env bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title CAO Auto-Upgrade
# @raycast.mode silent
# @raycast.packageName CMNDCENTER

# Optional parameters:
# @raycast.icon ⬆
# @raycast.description Run Claude Architect OS upgrade now

bash "${CAO_REPO}/scripts/upgrade.sh" &
RAYCASTEOF
  chmod +x "$RAYCAST_UPGRADE_SCRIPT"
  log_ok "raycast-cao-upgrade"
fi

# Link existing CMNDCENTER Raycast scripts if they exist
if [[ -d "${CMNDCENTER}/raycast-scripts" ]]; then
  for script in "${CMNDCENTER}/raycast-scripts"/*.sh; do
    [[ -f "$script" ]] || continue
    dest="${RAYCAST_SCRIPTS_DIR}/$(basename "$script")"
    if [[ ! -f "$dest" ]]; then
      cp "$script" "$dest"
      chmod +x "$dest"
      log_ok "raycast-$(basename "$script")"
    fi
  done
fi

# ============================================================
# STEP 5: Update CLAUDE.md references
# ============================================================
log ""
log "--- Step 5: CLAUDE.md Update ---"

CLAUDE_MD="${CMNDCENTER}/CLAUDE.md"

if [[ -f "$CLAUDE_MD" ]]; then
  # Check if claude-architect-os is already referenced
  if grep -q "claude-architect-os" "$CLAUDE_MD"; then
    log_skip "CLAUDE.md already references claude-architect-os"
  else
    # Append CAO reference block
    cat >> "$CLAUDE_MD" << 'CLAUDEMD'

## Claude Architect OS Integration

| Component | Path | Role |
|-----------|------|------|
| CAO Repo | `~/CMNDCENTER/repos/claude-architect-os/` | 37-agent autonomous pipeline |
| System Identity | `brain/core_identity/system.md` | Master Claude persona |
| Agent Registry | `agents/registry.json` | All 37 Loki Mode agents |
| Router | `brain/execution_protocols/router.json` | Model routing rules |
| Prompt Stack | `brain/prompt_layers/stack.md` | 7-layer inheritance |
| Memory Schema | `memory/schema/supabase.sql` | Supabase memory DB |
| Memory Extractor | `memory/extractors/session-memory.ts` | Pattern extraction |
| Docker Stack | `infrastructure/docker-compose.yml` | Full infrastructure |
| Opportunity Scorer | `market-intelligence/signals/opportunity-scorer.ts` | Signal scoring |
CLAUDEMD
    log_ok "claude-md-updated"
  fi
else
  log_warn "CLAUDE.md not found at ${CLAUDE_MD} — skipping update"
fi

# ============================================================
# STEP 6: LaunchAgent links
# ============================================================
log ""
log "--- Step 6: LaunchAgent Links ---"

PLIST_SRC="${CAO_REPO}/infrastructure/launchagents/com.claudearchitectos.auto-upgrade.plist"
PLIST_DEST="${LAUNCH_AGENTS_DIR}/com.claudearchitectos.auto-upgrade.plist"

if [[ -f "$PLIST_SRC" ]]; then
  if [[ -f "$PLIST_DEST" ]]; then
    # Check if content is current
    if diff -q "$PLIST_SRC" "$PLIST_DEST" &>/dev/null; then
      log_skip "LaunchAgent plist already current"
    else
      # Unload, update, reload
      launchctl unload "$PLIST_DEST" 2>/dev/null || true
      cp "$PLIST_SRC" "$PLIST_DEST"
      launchctl load "$PLIST_DEST"
      log_ok "launchagent-updated"
    fi
  else
    cp "$PLIST_SRC" "$PLIST_DEST"
    launchctl load "$PLIST_DEST"
    log_ok "launchagent-installed"
  fi
else
  log_warn "LaunchAgent plist not found at ${PLIST_SRC}"
fi

# ============================================================
# STEP 7: Wire Claude session hooks into settings.json
# ============================================================
log ""
log "--- Step 7: Claude Session Hooks ---"

mkdir -p "$CLAUDE_DIR"

LOKI_TRIGGER="${CMNDCENTER}/scripts/loki-trigger.sh"
SESSION_START="${CMNDCENTER}/scripts/loki-session-start.sh"
SESSION_END="${CMNDCENTER}/scripts/loki-session-end.sh"

# Only wire hooks if the hook scripts exist
if [[ ! -f "$LOKI_TRIGGER" ]]; then
  log_warn "loki-trigger.sh not found — skipping hook wiring"
else
  if [[ -f "$SETTINGS_JSON" ]]; then
    # Check if hooks already wired
    if jq -e '.hooks.UserPromptSubmit // empty' "$SETTINGS_JSON" &>/dev/null; then
      log_skip "Claude hooks already configured in settings.json"
    else
      log_warn "settings.json exists but has no hooks — add manually per CLAUDE.md instructions"
      log_warn "Hook scripts available at: ${CMNDCENTER}/scripts/"
    fi
  else
    # Create a minimal settings.json with hooks
    cat > "$SETTINGS_JSON" << SETTINGSEOF
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${LOKI_TRIGGER}\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${SESSION_START}\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${SESSION_END}\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
SETTINGSEOF
    log_ok "claude-settings-hooks-wired"
    log_warn "Review ${SETTINGS_JSON} to confirm hooks are correct"
  fi
fi

# ============================================================
# STEP 8: Verify wiring
# ============================================================
log ""
log "--- Step 8: Wiring Verification ---"

verify_link() {
  local name="$1"
  local path="$2"
  if [[ -e "$path" ]]; then
    log_ok "verify:${name}"
  else
    log_error "Missing after wiring: ${path}"
  fi
}

verify_link "amsa-skills-index"    "${AMSA_DIR}/skills/cao-index.json"
verify_link "raycast-dir"          "${RAYCAST_SCRIPTS_DIR}"
verify_link "cao-repo-in-repos"    "${CMNDCENTER}/repos/claude-architect-os"

# ============================================================
# WRITE WIRING LOG
# ============================================================
mkdir -p "$(dirname "$WIRING_LOG")"

WIRED_JSON=$(printf '%s\n' "${WIRED[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
SKIPPED_JSON=$(printf '%s\n' "${SKIPPED[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
ERRORS_JSON=$(printf '%s\n' "${ERRORS[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")

cat > "$WIRING_LOG" << WIREOF
{
  "wired_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$([ ${#ERRORS[@]} -eq 0 ] && echo "success" || echo "partial")",
  "wired": ${WIRED_JSON},
  "skipped": ${SKIPPED_JSON},
  "errors": ${ERRORS_JSON},
  "cmndcenter": "${CMNDCENTER}",
  "cao_repo": "${CAO_REPO}"
}
WIREOF

# ============================================================
# SUMMARY
# ============================================================
log ""
log "========================================"
log "Wiring complete"
log "  Wired:   ${#WIRED[@]}"
log "  Skipped: ${#SKIPPED[@]}"
log "  Errors:  ${#ERRORS[@]}"
log "  Log:     ${WIRING_LOG}"
log "========================================"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  for err in "${ERRORS[@]}"; do
    log_error "  - $err"
  done
  exit 1
fi
