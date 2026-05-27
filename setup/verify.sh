#!/usr/bin/env bash
# verify.sh — OMNISTACK health check across all 5 stability layers
# Usage: bash setup/verify.sh
set -uo pipefail

HOME_DIR="$HOME"
CMND="$HOME_DIR/CMNDCENTER"
OMNI="$HOME_DIR/OMNISTACK"
FUSION="$OMNI/FUSION-MASTER"
PASS=0; FAIL=0

# Source env early so ANTHROPIC_API_KEY check works in subshells
source "$CMND/system/.env" 2>/dev/null || true
source "$OMNI/.env" 2>/dev/null || true

chk() {
  local label="$1" result="$2"
  if [[ "$result" == "1" || "$result" == "true" || "$result" == "OK" ]]; then
    echo "  ✓ $label"; ((PASS++))
  else
    echo "  ✗ $label: $result"; ((FAIL++))
  fi
}

echo ""
echo "═══ OMNISTACK HEALTH CHECK ═══"
echo ""

echo "L1 WORKSPACE:"
chk_file() { [ -f "$2" ] && chk "$1" "1" || chk "$1" "MISSING: $2"; }
chk_file "OMNISTACK/CLAUDE.md"      "$OMNI/CLAUDE.md"
chk_file "core/master-prompt.md"    "$OMNI/core/master-prompt.md"
chk_file "MASTER-KEYS-MAP.md"       "$FUSION/MASTER-KEYS-MAP.md"
chk_file "agent-manager.py"         "$FUSION/hub/agent-manager.py"
chk_file "potentiate-now.py"        "$FUSION/hub/potentiate-now.py"
chk_file "compound-loop.py"         "$FUSION/hub/compound-loop.py"
chk_file "quick-scan.py"            "$FUSION/hub/quick-scan.py"
chk_file "roi-brain/scorer.py"      "$CMND/roi-brain/scorer.py"
chk_file "WAND/wand_scan.py"        "$CMND/WAND/wand_scan.py"
chk_file "intellitradeX/main.py"    "$CMND/intellitradeX/main.py"
chk_file "PIE hook"                 "$CMND/scripts/prompt-intelligence-engine.py"

echo ""
echo "L2 DEPENDENCIES:"
python3 -c "import anthropic" 2>/dev/null && chk "anthropic" "1" || chk "anthropic" "pip install anthropic"
python3 -c "import requests" 2>/dev/null && chk "requests" "1" || chk "requests" "pip install requests"
python3 -c "import langgraph" 2>/dev/null && chk "langgraph" "1" || chk "langgraph" "pip install langgraph"
[[ -n "${ANTHROPIC_API_KEY:-}" ]] && chk "ANTHROPIC_API_KEY" "1" || {
  source "$CMND/system/.env" 2>/dev/null; source "$OMNI/.env" 2>/dev/null
  [[ -n "${ANTHROPIC_API_KEY:-}" ]] && chk "ANTHROPIC_API_KEY" "1" || chk "ANTHROPIC_API_KEY" "NOT SET — add to ~/OMNISTACK/.env"
}
command -v git >/dev/null && chk "git" "1" || chk "git" "MISSING"
command -v docker >/dev/null && chk "docker" "1" || chk "docker" "MISSING"

echo ""
echo "L3 RUNTIME:"
curl -sf http://localhost:5678/healthz >/dev/null 2>&1 && chk "n8n:5678" "1" || chk "n8n:5678" "DOWN — docker compose up -d"
curl -sf http://localhost:11434/api/tags >/dev/null 2>&1 && chk "ollama:11434" "1" || chk "ollama:11434" "DOWN — ollama serve"
docker inspect omnistack-postgres-1 >/dev/null 2>&1 && chk "postgres" "1" || chk "postgres" "DOWN"
docker inspect omnistack-redis-1 >/dev/null 2>&1 && chk "redis" "1" || chk "redis" "DOWN"

echo ""
echo "L4 ORCHESTRATION:"
AGENTS=$(launchctl list 2>/dev/null | grep -c cmndcenter || echo 0)
[[ "$AGENTS" -ge 2 ]] && chk "LaunchAgents ($AGENTS loaded)" "1" || chk "LaunchAgents" "only $AGENTS — run: launchctl load ~/Library/LaunchAgents/com.cmndcenter.*.plist"
WF_COUNT=$(docker exec omnistack-postgres-1 psql -U postgres -d n8n -tAc \
  "SELECT COUNT(*) FROM workflow_entity WHERE active=true;" 2>/dev/null | tr -d ' ' || echo 0)
[[ "$WF_COUNT" -ge 10 ]] && chk "n8n workflows ($WF_COUNT active)" "1" || chk "n8n workflows" "only $WF_COUNT — run Block 5 in sequence.md"
[[ -f "$FUSION/hub/fusion-trigger.sh" ]] && bash -n "$FUSION/hub/fusion-trigger.sh" 2>/dev/null && chk "fusion-trigger.sh syntax" "1" || chk "fusion-trigger.sh" "SYNTAX ERROR"

echo ""
echo "L5 AGENTS:"
echo '{"prompt":"test","cwd":"/tmp","session_id":"verify"}' | \
  python3 "$CMND/scripts/prompt-intelligence-engine.py" 2>/dev/null | grep -q "PIE" && \
  chk "PIE hook" "1" || chk "PIE hook" "not firing — check Claude Code hooks settings"
python3 -c "
import importlib.util; spec = importlib.util.spec_from_file_location('am', '$FUSION/hub/agent-manager.py')
am = importlib.util.module_from_spec(spec); spec.loader.exec_module(am)
m = am.assign('test task'); print('OK' if m['agents'] else 'EMPTY')
" 2>/dev/null | grep -q "OK" && chk "agent-manager" "1" || chk "agent-manager" "check $FUSION/hub/agent-manager.py"
MEM=$(python3 -c "import json; m=json.load(open('$CMND/system/intelligence/compound-memory.json')); print(len(m.get('global_learnings',[])))" 2>/dev/null || echo 0)
[[ "$MEM" -gt 0 ]] && chk "compound-memory ($MEM learnings)" "1" || chk "compound-memory" "empty — run potentiate-now.py"

echo ""
echo "═══════════════════════════════════"
echo "  PASS: $PASS  |  FAIL: $FAIL"
[[ $FAIL -eq 0 ]] && echo "  STATUS: ALL SYSTEMS GO ✓" || echo "  STATUS: $FAIL issues to resolve (see ✗ above)"
echo "═══════════════════════════════════"
echo ""
