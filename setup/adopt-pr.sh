#!/usr/bin/env bash
# adopt-pr.sh — One command to wire the entire PR into OMNISTACK/CMNDCENTER
# Run after: git pull OR gh pr checkout <number>
# Usage: bash setup/adopt-pr.sh [--dry-run]
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY="${1:-}"
HOME_DIR="$HOME"
CMND="$HOME_DIR/CMNDCENTER"
OMNI="$HOME_DIR/OMNISTACK"
FUSION="$OMNI/FUSION-MASTER"

log()  { echo "[$(date +%H:%M:%S)] $*"; }
copy() {
  local src="$REPO/$1" dst="$2"
  [[ "$DRY" == "--dry-run" ]] && { echo "  DRY  $1 → $dst"; return; }
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst" && echo "  ✓  $1" || echo "  ✗  $1 (failed)"
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  OMNISTACK PR ADOPTION — wiring all files        ║"
[[ "$DRY" == "--dry-run" ]] && echo "║  MODE: DRY RUN (no files written)                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Step 1 — Source env
log "Step 1: Loading environment"
source "$CMND/system/.env" 2>/dev/null || true
source "$OMNI/.env" 2>/dev/null || true

# Step 2 — Hooks
log "Step 2: Syncing hooks → CMNDCENTER/scripts/"
copy "hooks/prompt-intelligence-engine.py" "$CMND/scripts/prompt-intelligence-engine.py"
copy "hooks/pattern-pipeline-router.py"    "$CMND/scripts/pattern-pipeline-router.py"

# Step 3 — VS Code performance layer
log "Step 3: VS Code settings + tasks + extensions"
copy "config/vscode-settings.json"   "$OMNI/.vscode/settings.json"
copy "config/vscode-tasks.json"      "$OMNI/.vscode/tasks.json"
copy "config/vscode-extensions.json" "$OMNI/.vscode/extensions.json"

# Step 4 — Agent engine + potentiation
log "Step 4: Agent manager + potentiation matrix"
copy "agents/agent-manager.py"       "$FUSION/hub/agent-manager.py"
copy "agents/potentiation-matrix.py" "$FUSION/hub/potentiation-matrix.py"
copy "agents/potentiate-now.py"      "$FUSION/hub/potentiate-now.py"

# Step 5 — Intelligence + pipelines
log "Step 5: Intelligence + pipeline scripts"
copy "intelligence/research-aggregator.py" "$FUSION/pipelines/research-aggregator.py"
copy "intelligence/scorer.py"              "$CMND/roi-brain/scorer.py"
copy "intelligence/wand_scan.py"           "$CMND/WAND/wand_scan.py"
copy "intelligence/intellitradeX.py"       "$CMND/intellitradeX/main.py"
copy "pipelines/compound-loop.py"          "$FUSION/hub/compound-loop.py"
copy "pipelines/quick-scan.py"             "$FUSION/hub/quick-scan.py"
copy "pipelines/fusion-trigger.sh"         "$FUSION/hub/fusion-trigger.sh"
copy "pipelines/master-refresh.sh"         "$FUSION/hub/master-refresh.sh"

# Step 6 — n8n workflows
log "Step 6: Importing n8n workflows"
if [[ "$DRY" != "--dry-run" ]] && docker inspect omnistack-n8n-1 >/dev/null 2>&1; then
  imported=0
  for f in "$REPO/n8n-workflows/"*.json; do
    name=$(basename "$f" .json)
    # Fix IDs before import
    python3 - "$f" << 'PYEOF'
import json, uuid, sys
path = sys.argv[1]
d = json.loads(open(path).read())
if "id" not in d: d["id"] = f"fusion-{path.split('/')[-1].replace('.json','')}-v1"
d.pop("tags", None)
for node in d.get("nodes", []):
    if not node.get("id"): node["id"] = str(uuid.uuid4())
open(path, "w").write(json.dumps(d, indent=2))
PYEOF
    docker cp "$f" omnistack-n8n-1:/tmp/${name}.json 2>/dev/null
    result=$(docker exec omnistack-n8n-1 n8n import:workflow --input="/tmp/${name}.json" 2>&1)
    echo "$result" | grep -q "Successfully" && { echo "  ✓  n8n: $name"; ((imported++)); } || true
  done
  docker exec omnistack-postgres-1 psql -U postgres -d n8n \
    -c "UPDATE workflow_entity SET active=true WHERE active=false;" >/dev/null 2>&1 && \
    echo "  ✓  n8n: all workflows activated" || true
else
  [[ "$DRY" == "--dry-run" ]] && echo "  DRY  n8n workflows (skipped in dry-run)" || \
    echo "  !   n8n not running — skipping workflow import"
fi

# Step 7 — Potentiation run (wire new patterns)
log "Step 7: Running potentiation engine"
if [[ "$DRY" != "--dry-run" ]]; then
  python3 "$FUSION/hub/potentiate-now.py" 2>/dev/null | \
    grep -E "adopted|Memory|Wallpaper|elapsed" | head -5
else
  echo "  DRY  potentiate-now.py (skipped)"
fi

# Step 8 — Wallpaper refresh
log "Step 8: Refreshing wallpaper with new agent teams"
[[ "$DRY" != "--dry-run" ]] && \
  python3 "$CMND/wallpapers/gen_wall_fusion.py" 2>/dev/null | grep "Stable path" || \
  echo "  DRY  wallpaper refresh (skipped)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ADOPTION COMPLETE                               ║"
echo "║  Verify: bash setup/verify.sh                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
