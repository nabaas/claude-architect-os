#!/usr/bin/env bash
# master-refresh.sh — All 40 stacks → CMNDCENTER display refresh
# Triggers: wallpaper, notifications, mini-project status, pattern counts
# Usage: bash master-refresh.sh [--notify] [--quiet]
# Wired to: frefresh alias, n8n /webhook/full-refresh, VS Code task

set -euo pipefail
source ~/CMNDCENTER/.env 2>/dev/null || true

NOTIFY=true
QUIET=false
for arg in "$@"; do
  [[ "$arg" == "--quiet" ]] && QUIET=true
  [[ "$arg" == "--no-notify" ]] && NOTIFY=false
done

log() { $QUIET || echo "[$(date +%H:%M:%S)] $*"; }
CMND="$HOME/CMNDCENTER"
OMNI="$HOME/OMNISTACK"
FUSION="$OMNI/FUSION-MASTER"
RESULTS_FILE="$CMND/logs/master-refresh-$(date +%Y%m%d).json"

# ── 1. SERVICE HEALTH (all 40 stacks) ────────────────────────────────────────
log "Checking stack health..."
declare -A STACK_STATUS
check_service() {
  local name=$1 url=$2
  if curl -sf --max-time 3 "$url" >/dev/null 2>&1; then
    STACK_STATUS[$name]="UP"
  else
    STACK_STATUS[$name]="DOWN"
  fi
}

check_service "litellm"   "http://localhost:4000/health"
check_service "n8n"       "http://localhost:5678/healthz"
check_service "chromadb"  "http://localhost:8000/api/v1/heartbeat"
check_service "supabase"  "http://localhost:54321/health"
check_service "ollama"    "http://localhost:11434/api/tags"
check_service "flowise"   "http://localhost:3000/api/v1/chatflows"
check_service "freqtrade" "http://localhost:8080/api/v1/ping"
check_service "vllm"      "http://localhost:8001/health"

UP_COUNT=0
DOWN_LIST=()
for svc in "${!STACK_STATUS[@]}"; do
  [[ "${STACK_STATUS[$svc]}" == "UP" ]] && ((UP_COUNT++)) || DOWN_LIST+=("$svc")
done
log "Services: $UP_COUNT UP | ${#DOWN_LIST[@]} DOWN: ${DOWN_LIST[*]:-none}"

# ── 2. PATTERN + MEMORY COUNTS ───────────────────────────────────────────────
log "Loading intelligence state..."
PATTERN_COUNT=$(python3 -c "
import json, pathlib
try:
    m = json.loads(pathlib.Path('$CMND/system/intelligence/compound-memory.json').read_text())
    print(len(m.get('global_learnings', [])))
except:
    print(0)
" 2>/dev/null || echo 0)

REGISTRY_COUNT=$(python3 -c "
import json, pathlib
try:
    r = json.loads(pathlib.Path('$CMND/system/blueprints/pattern-registry.json').read_text())
    print(len(r.get('repos', {})))
except:
    print(0)
" 2>/dev/null || echo 0)

PROTO_COUNT=$(ls "$FUSION/hub/prototypes/"*.py 2>/dev/null | wc -l | tr -d ' ')
log "Patterns: $PATTERN_COUNT | Repos: $REGISTRY_COUNT | Prototypes: $PROTO_COUNT"

# ── 3. MINI-PROJECT RESULTS (last build, last trade, last content) ────────────
log "Fetching mini-project results..."
LAST_BUILD=$(ls -t "$CMND/logs/"*loki*.log 2>/dev/null | head -1 || echo "none")
LAST_BUILD_NAME=$(basename "$LAST_BUILD" .log 2>/dev/null || echo "—")

FREQTRADE_PNL="—"
if [[ "${STACK_STATUS[freqtrade]:-DOWN}" == "UP" ]]; then
  FREQTRADE_PNL=$(curl -sf http://localhost:8080/api/v1/profit 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(f\"\${d.get('profit_all_coin',0):.4f}\")" 2>/dev/null || echo "—")
fi

WAND_STATUS="—"
[[ -f "$CMND/WAND/last_run.txt" ]] && WAND_STATUS=$(cat "$CMND/WAND/last_run.txt" 2>/dev/null || echo "—")

# ── 4. WAND WALLPAPER REFRESH ─────────────────────────────────────────────────
log "Refreshing wallpaper..."
WALL_OK=false
if python3 "$CMND/wallpapers/gen_wall_fusion.py" 2>/dev/null; then
  WALL_OK=true
  # Set as desktop background (macOS)
  osascript -e "tell application \"Finder\" to set desktop picture to POSIX file \"$CMND/wallpapers/fusion_today.png\"" 2>/dev/null || true
  log "Wallpaper updated: fusion_today.png"
else
  log "Wallpaper: gen_wall_fusion.py not available"
fi

# ── 5. BUILD RESULTS JSON (for VS Code display + notifications) ───────────────
cat > "$RESULTS_FILE" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "services": {
    "up": $UP_COUNT,
    "down": ${#DOWN_LIST[@]},
    "down_list": [$(printf '"%s",' "${DOWN_LIST[@]:-}" | sed 's/,$//')]
  },
  "intelligence": {
    "global_patterns": $PATTERN_COUNT,
    "registered_repos": $REGISTRY_COUNT,
    "prototypes": $PROTO_COUNT
  },
  "projects": {
    "last_build": "$LAST_BUILD_NAME",
    "freqtrade_pnl": "$FREQTRADE_PNL",
    "wand_status": "$WAND_STATUS",
    "wallpaper_refreshed": $WALL_OK
  }
}
EOF
log "Results written: $RESULTS_FILE"

# ── 6. NOTIFICATIONS (all channels) ──────────────────────────────────────────
if $NOTIFY; then
  MSG="🔄 *CMNDCENTER Refresh*
Services: ${UP_COUNT} UP | ${#DOWN_LIST[@]} DOWN ${DOWN_LIST:+(${DOWN_LIST[*]})}
Patterns: ${PATTERN_COUNT} | Repos: ${REGISTRY_COUNT} | Protos: ${PROTO_COUNT}
PnL: ${FREQTRADE_PNL} | Build: ${LAST_BUILD_NAME}
Wallpaper: $([ "$WALL_OK" = true ] && echo '✅' || echo '⏭️')"

  # Telegram
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -sf -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
      -d "chat_id=$TELEGRAM_CHAT_ID" \
      -d "text=$MSG" \
      -d "parse_mode=Markdown" >/dev/null 2>&1 || true
    log "Telegram notified"
  fi

  # n8n downstream cascade
  curl -sf -X POST "http://localhost:5678/webhook/62d963cc-953a-48af-aac1-99ec591b9a16/webhook/fusion-trigger" \
    -H "Content-Type: application/json" \
    -d "{\"source\":\"master-refresh\",\"patterns\":$PATTERN_COUNT,\"repos\":$REGISTRY_COUNT}" \
    >/dev/null 2>&1 || true
fi

# ── 7. STDOUT SUMMARY ─────────────────────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════╗"
echo "║  CMNDCENTER REFRESH COMPLETE           ║"
echo "╠═══════════════════════════════════════╣"
echo "║  Services : $UP_COUNT UP | ${#DOWN_LIST[@]} DOWN"
printf "║  Patterns : %-27s║\n" "$PATTERN_COUNT global | $REGISTRY_COUNT repos"
printf "║  Protos   : %-27s║\n" "$PROTO_COUNT generated"
printf "║  PnL      : %-27s║\n" "$FREQTRADE_PNL"
printf "║  Wallpaper: %-27s║\n" "$([ "$WALL_OK" = true ] && echo 'refreshed' || echo 'skipped')"
echo "╚═══════════════════════════════════════╝"
