#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# FUSION-MASTER DOMINO TRIGGER
# One command fires the full 40-stack potentiation chain.
#
# Usage:
#   bash fusion-trigger.sh            → full chain (all phases)
#   bash fusion-trigger.sh quick      → research + wallpaper only (60s)
#   bash fusion-trigger.sh morning    → morning brief + WAND + wallpaper
#   bash fusion-trigger.sh research   → research + adopt + store
#   bash fusion-trigger.sh refresh    → full intelligence refresh
#   bash fusion-trigger.sh wallpaper  → wallpaper refresh only
#   bash fusion-trigger.sh dry        → print chain, no execute
#
# Domino chain:
#   ENV → Research (GitHub+HN+Perplexity) → Score (ROI Brain)
#   → Adopt repos (≥78) → Notify (macOS+Slack+Discord+n8n)
#   → Compound Memory update → Wallpaper refresh → n8n cascade
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail  # -e removed: individual steps use || true; chain must complete fully

CMND="$HOME/CMNDCENTER"
FUSION="$HOME/OMNISTACK/FUSION-MASTER"
PIPELINES="$FUSION/pipelines"
NOTIFICATIONS="$FUSION/notifications"
WALLPAPERS="$CMND/wallpapers"
LOGS="$CMND/logs"
ENV_FILE="$CMND/.env"
MODE="${1:-all}"
DRY="${DRY:-0}"
[ "$MODE" = "dry" ] && DRY=1 && MODE="all"

mkdir -p "$LOGS"

# ── helpers ───────────────────────────────────────────────────────────────────
ts()  { date '+%H:%M:%S'; }
log() { echo "[$(ts)] $*" | tee -a "$LOGS/fusion-trigger.log"; }
run() {
  local label="$1"; shift
  if [ "$DRY" = "1" ]; then
    echo "  [DRY] $label: $*"
    return 0
  fi
  log "▶ $label"
  # shellcheck disable=SC1090
  source "$ENV_FILE" 2>/dev/null || true
  if eval "$@"; then
    log "  ✓ $label"
  else
    log "  ⚠ $label (exit $?) — continuing"
  fi
}

# ── wall refresh helper ───────────────────────────────────────────────────────
refresh_wallpaper() {
  # Try fusion wallpaper first, fall back to v3
  if [ -f "$WALLPAPERS/gen_wall_fusion.py" ]; then
    run "wallpaper:fusion" python3 "$WALLPAPERS/gen_wall_fusion.py"
  elif [ -f "$WALLPAPERS/gen_wall_v3.py" ]; then
    run "wallpaper:v3" python3 "$WALLPAPERS/gen_wall_v3.py"
  fi
  # Kick the LaunchAgent to re-apply it
  launchctl kickstart -k "gui/$(id -u)/com.cmndcenter.wallpaper" 2>/dev/null || true
}

# ── notify helper ─────────────────────────────────────────────────────────────
notify_all() {
  local title="$1" body="$2" score="${3:-70}"
  # Write to JSON file to avoid eval word-splitting multi-word strings
  local tmp="/tmp/notify-payload.json"
  printf '{"title":"%s","body":"%s","score":%s}' \
    "${title//\"/\\\"}" "${body//\"/\\\"}" "$score" > "$tmp"
  run "notify" python3 "$NOTIFICATIONS/auto-notify.py" --from-file "$tmp"
}

# ════════════════════════════════════════════════════════════════════════════
# PHASE DEFINITIONS
# ════════════════════════════════════════════════════════════════════════════

phase_research() {
  local mode="${1:-research}" out="/tmp/research-results.json"
  run "research:aggregator[$mode]" \
    python3 "$PIPELINES/research-aggregator.py" --mode "$mode" --output "$out"
  echo "$out"
}

phase_adopt() {
  local results_file="${1:-/tmp/research-results.json}"
  run "adopt:auto[≥78]" python3 -c "
import json, subprocess
from pathlib import Path
adopt = Path.home() / 'CMNDCENTER/system/blueprints/adopt.sh'
if not adopt.exists():
    print('adopt.sh not found'); exit(0)
with open('$results_file') as f: results = json.load(f)
adopted = 0
for r in results:
    if r.get('roi_score', 0) >= 78 and 'github.com' in r.get('url','') and r.get('type') == 'repo':
        res = subprocess.run(['bash', str(adopt), r['url'], '--domain', r.get('domain','ai')],
                             capture_output=True, timeout=120)
        adopted += 1 if res.returncode == 0 else 0
print(f'{adopted} repos adopted from {len(results)} results')
"
}

phase_roi_score() {
  local input="${1:-/tmp/research-results.json}" output="/tmp/fusion-scored.json"
  run "roi:rescore" python3 "$CMND/roi-brain/scorer.py" \
    --input "$input" --output "$output" 2>/dev/null || \
    run "roi:fallback-copy" cp "$input" "$output"
  echo "$output"
}

phase_memory() {
  local input="${1:-/tmp/fusion-scored.json}"
  run "memory:loki-improver" python3 "$CMND/loki/loki_improver.py" \
    --session-update --input "$input" 2>/dev/null || true
}

phase_n8n_trigger_get() {
  local path="$1"
  run "n8n:webhook[GET:$path]" \
    curl -s -G "http://localhost:5678/webhook/$path" \
    --data-urlencode "source=fusion-trigger" \
    --data-urlencode "mode=$MODE" \
    --max-time 5 2>/dev/null || true
}

phase_n8n_trigger() {
  local path="$1"
  # Use canonical fusion-trigger webhook URL from .env (with UUID path)
  # Falls back to simple path if N8N_FUSION_TRIGGER_URL not set
  local url
  if [[ "$path" == "fusion-trigger" && -n "${N8N_FUSION_TRIGGER_URL:-}" ]]; then
    url="$N8N_FUSION_TRIGGER_URL"
  else
    url="http://localhost:5678/webhook/$path"
  fi
  run "n8n:webhook[$path]" \
    curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "{\"source\":\"fusion-trigger\",\"mode\":\"$MODE\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    --max-time 5 2>/dev/null || true
}

# ════════════════════════════════════════════════════════════════════════════
# MODE CHAINS
# ════════════════════════════════════════════════════════════════════════════

START=$(date +%s)
echo ""
echo "╔═══════════════════════════════════════════════════════════"
echo "║  FUSION-MASTER DOMINO TRIGGER  ·  mode=$MODE  ·  $(ts)"
echo "╚═══════════════════════════════════════════════════════════"
echo ""

case "$MODE" in

  # ── QUICK: research → wallpaper (≈60s) ──────────────────────────────────
  quick)
    results=$(phase_research "research")
    refresh_wallpaper
    notify_all "FUSION Quick Run" "Research done. Wallpaper refreshed." 72
    ;;

  # ── MORNING: WAND → brief → wallpaper ───────────────────────────────────
  morning)
    run "wand:scan" python3 "$CMND/WAND/wand_scan.py" \
      --quick --output /tmp/wand-morning.json 2>/dev/null || true
    run "pipeline:morning-brief" \
      python3 "$PIPELINES/omnistack-flow.py" --phase morning
    refresh_wallpaper
    phase_n8n_trigger "morning-ready"
    notify_all "Morning Pipeline Done" "Brief + WAND + wallpaper refreshed." 80
    ;;

  # ── RESEARCH: aggregate → adopt → store ─────────────────────────────────
  research)
    results=$(phase_research "research")
    phase_adopt "$results"
    scored=$(phase_roi_score "$results")
    phase_memory "$scored"
    phase_n8n_trigger_get "research-sweep"
    refresh_wallpaper
    notify_all "Research Sweep Done" "Signals scored. Top repos adopted. Wallpaper refreshed." 78 \
      || true
    ;;

  # ── WALLPAPER only ───────────────────────────────────────────────────────
  wallpaper)
    refresh_wallpaper
    notify_all "Wallpaper Refreshed" "FUSION architecture map updated." 65
    ;;

  # ── REFRESH: full intelligence refresh ──────────────────────────────────
  refresh)
    run "pipeline:refresh" python3 "$PIPELINES/omnistack-flow.py" --phase refresh
    refresh_wallpaper
    phase_n8n_trigger_get "full-intelligence"
    notify_all "Full Refresh Done" "All 40 stacks rescored. Memory updated. Wallpaper live." 82
    ;;

  # ── ALL: full domino chain ───────────────────────────────────────────────
  all | *)
    log "Starting full domino chain…"

    # Agent assignment — auto-assign optimal sub-agents for this run
    run "agents:assign" python3 "$FUSION/hub/agent-manager.py" \
      "full domino chain research adopt build deploy" --json \
      > /tmp/fusion-agents.json 2>/dev/null || true

    # Tier 1 — Research & Signal collection (parallel conceptually, serial here)
    results=$(phase_research "research")

    # Tier 2 — WAND scan
    run "wand:scan" python3 "$CMND/WAND/wand_scan.py" \
      --quick --output /tmp/wand-fusion.json 2>/dev/null || true

    # Tier 3 — ROI score everything
    scored=$(phase_roi_score "$results")

    # Tier 4 — Auto-adopt top repos
    phase_adopt "$results"

    # Tier 5 — Content pipeline
    run "youtube:trends" python3 "$CMND/youtube-pipeline/modules/trend_scraper.py" \
      --output /tmp/yt-trends.json 2>/dev/null || true

    # Tier 6 — IntelliTradeX signals
    run "intellitradeX:scan" python3 "$CMND/intellitradeX/main.py" \
      --scan --output /tmp/trade-signals.json 2>/dev/null || true

    # Tier 7 — Update compound memory
    phase_memory "$scored"

    # Tier 8 — Wallpaper refresh (architecture map + top signals)
    refresh_wallpaper

    # Tier 9 — Notify all channels
    notify_all "FUSION Full Chain Complete" "All 40 stacks fired. Memory updated. Wallpaper refreshed." 85

    # Tier 10 — Cascade into n8n
    phase_n8n_trigger "fusion-trigger"
    phase_n8n_trigger_get "full-intelligence"
    phase_n8n_trigger_get "research-sweep"
    ;;
esac

# ── timing ────────────────────────────────────────────────────────────────────
END=$(date +%s)
ELAPSED=$((END - START))
echo ""
log "═══ DONE: mode=$MODE  elapsed=${ELAPSED}s ═══"
echo ""
echo "  Artifacts:"
ls -lah /tmp/research-results.json /tmp/fusion-scored.json \
         /tmp/wand-fusion.json /tmp/morning-brief.md 2>/dev/null \
  | awk '{print "  ", $5, $9}'
echo ""
echo "  Logs: $LOGS/fusion-trigger.log"
echo "  Wallpaper: $WALLPAPERS/"
echo ""
