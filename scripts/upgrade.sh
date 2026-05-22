#!/usr/bin/env bash
# scripts/upgrade.sh
# Auto-Upgrade Script — Claude Architect OS v4.0
# Run by LaunchAgent daily at 3:00 AM
# Pulls latest from GitHub, reinstalls dependencies, runs health checks,
# updates CMNDCENTER integration, restarts services, logs results.

set -euo pipefail

# ============================================================
# CONFIGURATION
# ============================================================
CAO_REPO="${CAO_REPO:-${HOME}/CMNDCENTER/repos/claude-architect-os}"
CMNDCENTER="${CMNDCENTER:-${HOME}/CMNDCENTER}"
AMSA_MEMORY_DIR="${HOME}/.amsa/memory"
UPGRADE_LOG="${UPGRADE_LOG:-${AMSA_MEMORY_DIR}/upgrade-log.json}"
UPGRADE_HISTORY="${AMSA_MEMORY_DIR}/upgrade-history.jsonl"
MAX_LOG_ENTRIES=100

UPGRADE_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
UPGRADE_ID="upgrade_$(date +%Y%m%d_%H%M%S)"
STATUS="success"
STEPS_COMPLETED=()
STEPS_FAILED=()
WARNINGS=()

# ============================================================
# OUTPUT HELPERS
# ============================================================
ts() { date +"%Y-%m-%dT%H:%M:%S"; }

log()      { echo "[$(ts)] [INFO]  $*"; }
log_ok()   { echo "[$(ts)] [OK]    $*"; STEPS_COMPLETED+=("$1"); }
log_warn() { echo "[$(ts)] [WARN]  $*"; WARNINGS+=("$*"); }
log_fail() { echo "[$(ts)] [FAIL]  $*"; STEPS_FAILED+=("$1"); STATUS="partial"; }

die() {
  echo "[$(ts)] [FATAL] $*"
  STATUS="failed"
  write_log
  exit 1
}

# ============================================================
# LOG WRITER
# ============================================================
write_log() {
  local upgrade_end
  upgrade_end=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  mkdir -p "$(dirname "$UPGRADE_LOG")"

  # Build steps arrays as JSON
  local completed_json warnings_json failed_json
  completed_json=$(printf '%s\n' "${STEPS_COMPLETED[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  warnings_json=$(printf '%s\n' "${WARNINGS[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  failed_json=$(printf '%s\n' "${STEPS_FAILED[@]:-}" | jq -R . | jq -s . 2>/dev/null || echo "[]")

  # Write current log
  cat > "$UPGRADE_LOG" << LOGEOF
{
  "upgrade_id": "${UPGRADE_ID}",
  "started_at": "${UPGRADE_START}",
  "ended_at": "${upgrade_end}",
  "status": "${STATUS}",
  "git_branch": "$(git -C "${CAO_REPO}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")",
  "git_commit": "$(git -C "${CAO_REPO}" rev-parse --short HEAD 2>/dev/null || echo "unknown")",
  "steps_completed": ${completed_json},
  "steps_failed": ${failed_json},
  "warnings": ${warnings_json},
  "platform": "$(uname -sm)"
}
LOGEOF

  # Append to history (keep last MAX_LOG_ENTRIES)
  echo "{\"upgrade_id\":\"${UPGRADE_ID}\",\"started_at\":\"${UPGRADE_START}\",\"status\":\"${STATUS}\"}" >> "$UPGRADE_HISTORY"
  if [[ -f "$UPGRADE_HISTORY" ]]; then
    local line_count
    line_count=$(wc -l < "$UPGRADE_HISTORY" | tr -d ' ')
    if (( line_count > MAX_LOG_ENTRIES )); then
      tail -n "$MAX_LOG_ENTRIES" "$UPGRADE_HISTORY" > "${UPGRADE_HISTORY}.tmp"
      mv "${UPGRADE_HISTORY}.tmp" "$UPGRADE_HISTORY"
    fi
  fi

  log "Log written to: ${UPGRADE_LOG}"
}

# ============================================================
# TRAP: Always write log on exit
# ============================================================
trap write_log EXIT

# ============================================================
# PREFLIGHT
# ============================================================
log "========================================"
log "Claude Architect OS Auto-Upgrade"
log "Upgrade ID: ${UPGRADE_ID}"
log "========================================"

# Confirm repo exists
if [[ ! -d "$CAO_REPO" ]]; then
  die "CAO_REPO not found: ${CAO_REPO}"
fi

cd "$CAO_REPO"
log "Working directory: $(pwd)"

# ============================================================
# STEP 1: Git pull — get latest from GitHub
# ============================================================
log ""
log "--- Step 1: Git Pull ---"

if git -C "$CAO_REPO" remote -v &>/dev/null; then
  # Stash any local uncommitted changes to prevent merge conflicts
  if ! git -C "$CAO_REPO" diff --quiet HEAD 2>/dev/null; then
    log_warn "Uncommitted local changes detected — stashing before pull"
    git -C "$CAO_REPO" stash push -m "auto-upgrade stash ${UPGRADE_ID}" || log_warn "git stash failed"
  fi

  BEFORE_COMMIT=$(git -C "$CAO_REPO" rev-parse HEAD 2>/dev/null || echo "unknown")
  git -C "$CAO_REPO" fetch origin main --quiet 2>&1 || log_fail "git-fetch"

  if git -C "$CAO_REPO" pull origin main --ff-only --quiet 2>&1; then
    AFTER_COMMIT=$(git -C "$CAO_REPO" rev-parse HEAD 2>/dev/null || echo "unknown")
    if [[ "$BEFORE_COMMIT" == "$AFTER_COMMIT" ]]; then
      log "No new commits — already up to date"
    else
      log "Updated: ${BEFORE_COMMIT:0:7} → ${AFTER_COMMIT:0:7}"
    fi
    log_ok "git-pull"
  else
    log_fail "git-pull"
    log_warn "git pull failed — continuing with current version"
  fi
else
  log_warn "No remote origin configured — skipping git pull"
fi

# ============================================================
# STEP 2: Reinstall Node.js dependencies
# ============================================================
log ""
log "--- Step 2: Node.js Dependencies ---"

if [[ -f "${CAO_REPO}/package.json" ]]; then
  if npm install --prefer-offline --quiet 2>&1; then
    log_ok "npm-install"
  else
    log_fail "npm-install"
  fi
else
  log "No package.json — skipping npm install"
fi

# Update global tools
for pkg in repomix n8n typescript ts-node; do
  if command -v "$pkg" &>/dev/null; then
    npm update -g "$pkg" --quiet 2>&1 || log_warn "Could not update ${pkg}"
  fi
done
log_ok "npm-global-updates"

# ============================================================
# STEP 3: Reinstall Python dependencies
# ============================================================
log ""
log "--- Step 3: Python Dependencies ---"

if [[ -f "${CAO_REPO}/requirements.txt" ]]; then
  if python3 -m pip install --quiet --upgrade -r "${CAO_REPO}/requirements.txt" 2>&1; then
    log_ok "pip-install"
  else
    log_fail "pip-install"
  fi
else
  log "No requirements.txt — skipping pip install"
fi

# ============================================================
# STEP 4: Homebrew updates (non-breaking only)
# ============================================================
log ""
log "--- Step 4: Homebrew Updates ---"

if command -v brew &>/dev/null; then
  brew update --quiet 2>&1 || log_warn "brew update failed"
  # Only upgrade specific packages to avoid unintended upgrades
  for pkg in gh jq supabase; do
    brew upgrade "$pkg" --quiet 2>&1 || true  # silently skip if already latest
  done
  log_ok "homebrew-updates"
else
  log_warn "Homebrew not found — skipping"
fi

# ============================================================
# STEP 5: Update CMNDCENTER integration
# ============================================================
log ""
log "--- Step 5: CMNDCENTER Integration ---"

if [[ -f "${CAO_REPO}/scripts/wire-cmndcenter.sh" ]]; then
  if bash "${CAO_REPO}/scripts/wire-cmndcenter.sh" 2>&1; then
    log_ok "wire-cmndcenter"
  else
    log_fail "wire-cmndcenter"
  fi
else
  log_warn "wire-cmndcenter.sh not found — skipping"
fi

# ============================================================
# STEP 6: Restart Docker services
# ============================================================
log ""
log "--- Step 6: Docker Services ---"

COMPOSE_FILE="${CAO_REPO}/infrastructure/docker-compose.yml"

if [[ -f "$COMPOSE_FILE" ]] && docker info &>/dev/null 2>&1; then
  log "Pulling latest Docker images..."
  if docker compose -f "$COMPOSE_FILE" pull --quiet 2>&1; then
    log_ok "docker-pull"
  else
    log_fail "docker-pull"
  fi

  log "Restarting services with new images..."
  if docker compose -f "$COMPOSE_FILE" up -d --remove-orphans 2>&1; then
    log_ok "docker-restart"
  else
    log_fail "docker-restart"
  fi

  # Remove dangling images to free disk space
  docker image prune -f --quiet 2>&1 || true
  log_ok "docker-prune"
else
  log_warn "Docker not available or docker-compose.yml missing — skipping service restart"
fi

# ============================================================
# STEP 7: Health checks
# ============================================================
log ""
log "--- Step 7: Health Checks ---"

check_health() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 5 "$url" &>/dev/null; then
    log_ok "health-${name}"
    return 0
  else
    log_warn "${name} health check failed: ${url}"
    return 1
  fi
}

HEALTH_SCORE=0
HEALTH_TOTAL=0

health_check_service() {
  HEALTH_TOTAL=$((HEALTH_TOTAL + 1))
  if check_health "$@"; then
    HEALTH_SCORE=$((HEALTH_SCORE + 1))
  fi
}

health_check_service "chromadb"   "http://localhost:8000/api/v1/heartbeat"
health_check_service "ollama"     "http://localhost:11434/api/tags"
health_check_service "n8n"        "http://localhost:5678/healthz"
health_check_service "open-webui" "http://localhost:3001/health"
health_check_service "supabase"   "http://localhost:8000/rest/v1/"

log "Health score: ${HEALTH_SCORE}/${HEALTH_TOTAL}"

if (( HEALTH_SCORE < HEALTH_TOTAL / 2 )); then
  log_warn "Less than half of services are healthy — may need manual intervention"
  STATUS="partial"
fi

# ============================================================
# STEP 8: Ollama model updates
# ============================================================
log ""
log "--- Step 8: Ollama Model Updates ---"

if command -v ollama &>/dev/null && ollama list &>/dev/null 2>&1; then
  for model in "hermes3" "gemma3:4b"; do
    log "Refreshing model: ${model}"
    ollama pull "$model" 2>&1 | grep -E "already|pulling|success" | head -2 || log_warn "Could not update ${model}"
  done
  log_ok "ollama-model-updates"
else
  log_warn "Ollama not running — skipping model updates"
fi

# ============================================================
# STEP 9: Memory system maintenance
# ============================================================
log ""
log "--- Step 9: Memory Maintenance ---"

PATTERNS_FILE="${AMSA_MEMORY_DIR}/patterns.json"

if [[ -f "$PATTERNS_FILE" ]]; then
  # Count patterns
  PATTERN_COUNT=$(jq 'length' "$PATTERNS_FILE" 2>/dev/null || echo "unknown")
  log "Current pattern count: ${PATTERN_COUNT}"

  # Prune expired patterns (ttl_days exceeded)
  NOW_EPOCH=$(date +%s)
  if command -v jq &>/dev/null; then
    jq --argjson now "$NOW_EPOCH" '
      map(select(
        .ttl_days == null or
        ((.extracted_at | fromdateiso8601) + (.ttl_days * 86400)) > $now
      ))
    ' "$PATTERNS_FILE" > "${PATTERNS_FILE}.tmp" 2>/dev/null && mv "${PATTERNS_FILE}.tmp" "$PATTERNS_FILE"
    AFTER_COUNT=$(jq 'length' "$PATTERNS_FILE" 2>/dev/null || echo "unknown")
    PRUNED=$((PATTERN_COUNT - ${AFTER_COUNT:-0}))
    if [[ "$PRUNED" -gt 0 ]] 2>/dev/null; then
      log "Pruned ${PRUNED} expired patterns"
    fi
  fi
  log_ok "memory-maintenance"
else
  log_warn "patterns.json not found — skipping memory maintenance"
fi

# Rotate routing log if > 10MB
ROUTING_LOG="${AMSA_MEMORY_DIR}/routing-log.jsonl"
if [[ -f "$ROUTING_LOG" ]]; then
  ROUTING_SIZE=$(du -k "$ROUTING_LOG" | cut -f1)
  if (( ROUTING_SIZE > 10240 )); then
    mv "$ROUTING_LOG" "${ROUTING_LOG}.${UPGRADE_ID}.bak"
    touch "$ROUTING_LOG"
    log "Rotated routing log (was ${ROUTING_SIZE}KB)"
  fi
fi

# ============================================================
# STEP 10: AMSA skills update
# ============================================================
log ""
log "--- Step 10: AMSA Skills Update ---"

SUPERPOWERS_FILE="${CAO_REPO}/loki/skills/superpowers.json"
if [[ -f "$SUPERPOWERS_FILE" ]]; then
  VERSION=$(jq -r '.version // "unknown"' "$SUPERPOWERS_FILE" 2>/dev/null || echo "unknown")
  log "Current superpowers version: ${VERSION}"
  log_ok "amsa-skills-check"
else
  log_warn "superpowers.json not found at ${SUPERPOWERS_FILE}"
fi

# ============================================================
# FINAL STATUS
# ============================================================
log ""
log "========================================"
log "Upgrade ${UPGRADE_ID} complete"
log "Status:           ${STATUS}"
log "Steps completed:  ${#STEPS_COMPLETED[@]}"
log "Steps failed:     ${#STEPS_FAILED[@]}"
log "Warnings:         ${#WARNINGS[@]}"
log "Log:              ${UPGRADE_LOG}"
log "========================================"

# Exit with error code if any steps failed
if [[ "$STATUS" == "failed" ]]; then
  exit 1
elif [[ ${#STEPS_FAILED[@]} -gt 0 ]]; then
  exit 2
fi
exit 0
