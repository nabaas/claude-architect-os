# Keyboard Maestro Macros — Claude Architect OS

Import these macros into Keyboard Maestro (Preferences → Macros → Import).

---

## Macro 1: Loki Mode Quick Launch

**Trigger:** CMD+SHIFT+L (or Raycast)
**Actions:**
1. Prompt for text: "Enter build requirement"
2. Execute shell script:
```bash
bash ~/CMNDCENTER/loki/loki.sh "${promptResult}"
```
3. Display notification: "🔱 Loki Mode triggered"

---

## Macro 2: Opportunity Scan

**Trigger:** CMD+SHIFT+F
**Actions:**
1. Execute shell: `python3 ~/CMNDCENTER/repos/claude-architect-os/market-intelligence/signals/opportunity-scorer.ts`
2. Open file: `~/.amsa/linear-queue/latest.json`
3. Notification: "📡 Opportunity scan complete"

---

## Macro 3: System Health Dashboard

**Trigger:** CMD+SHIFT+H
**Actions:**
1. Execute shell: `docker compose -f ~/CMNDCENTER/repos/claude-architect-os/infrastructure/docker-compose.yml ps`
2. Open URL: `http://localhost:3002` (dashboard)

---

## Macro 4: Claude Code — Open Current Project

**Trigger:** CMD+SHIFT+C
**Actions:**
1. Execute: `claude ~/CMNDCENTER`
2. Open Warp to CMNDCENTER

---

## Macro 5: WAND Content Pipeline

**Trigger:** CMD+SHIFT+W
**Actions:**
1. Open URL: `http://localhost:5678` (n8n)
2. Execute: trigger WAND workflow via n8n webhook
```bash
curl -s -X POST http://localhost:5678/webhook/wand-daily
```

---

## Macro 6: Memory Sync

**Trigger:** CMD+SHIFT+M
**Actions:**
1. Execute shell:
```bash
python3 ~/CMNDCENTER/repos/claude-architect-os/integrations/llamaindex/rag-engine.py
```
2. Notification: "🧠 Memory synced"

---

## Macro 7: Upgrade Cycle (Manual Trigger)

**Trigger:** CMD+SHIFT+U
**Actions:**
1. Show dialog: "Run upgrade cycle now?"
2. If confirmed, execute:
```bash
bash ~/CMNDCENTER/repos/claude-architect-os/scripts/upgrade.sh
```
3. Notification when done: "⚡ Upgrade complete"

---

## Macro 8: Claude + Context Inject

**Trigger:** Any app — select text + CMD+SHIFT+I
**Actions:**
1. Copy selected text
2. Execute shell:
```bash
QUERY="${clipboard}" python3 -c "
import sys, os
sys.path.insert(0, os.path.expanduser('~/CMNDCENTER/repos/claude-architect-os'))
from integrations.mem0.mem0_config import build_context_block
ctx = build_context_block('nabaas', os.environ['QUERY'])
print(ctx)
" | pbcopy
```
3. Paste (inserts memory context before your text)
4. Notification: "🧠 Context injected from memory"

---

## Macro 9: Broadcast to Desktop Avatar

**Trigger:** CMD+SHIFT+V
**Actions:**
1. Prompt for text: "What should the avatar say?"
2. Execute:
```bash
curl -s -X POST http://localhost:12393/tts \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"${promptResult}\"}"
```

---

## Macro 10: ROI Quick Score

**Trigger:** CMD+SHIFT+R (text selected)
**Actions:**
1. Copy selected text as task description
2. Execute shell and display result:
```bash
node -e "
const { scoreROI } = require('$HOME/CMNDCENTER/repos/claude-architect-os/system/roi-brain');
const result = scoreROI({ task: '${clipboard}', context: '', urgency: 3, estimatedHours: 4, systemsAffected: [] });
console.log('ROI: ' + result.score + '/100 | ' + result.recommendation);
"
```
3. Show large text with ROI score

---

## Import Instructions

1. Open Keyboard Maestro
2. File → Import Macros...
3. Select the .kmmacros file from `integrations/keyboard-maestro/`
4. Or create each macro manually using the specs above

All macros assume `~/CMNDCENTER` is the root. Change if your path differs.
