# pipelines/ — OMNISTACK Execution Pipelines

Core pipeline scripts. Copy to `~/OMNISTACK/FUSION-MASTER/hub/` to activate.

## Files

| File | Trigger | What it does |
|------|---------|-------------|
| `fusion-trigger.sh` | `fuse` alias / CMD+SHIFT+F | Full 40-stack domino chain (10 tiers, ~21s) |
| `compound-loop.py` | 2:00am LaunchAgent | Nightly: SEARCH→SCORE→ADOPT→PROTOTYPE→MEMORIZE |
| `quick-scan.py` | 4x/day + git push | Post-session HN/GitHub scan → compound-memory save |
| `master-refresh.sh` | `fdash` / CMD+SHIFT+D | All 40 stacks health + wallpaper + Telegram |

## fusion-trigger.sh modes

```bash
fuse              # full chain (all 10 tiers, ~21s)
fuse quick        # research + wallpaper only (~13s)
fuse morning      # WAND + brief + wallpaper
fuse research     # research + adopt + score + memory
fuse refresh      # full intelligence refresh
fuse wallpaper    # wallpaper only
fuse dry          # print chain, don't execute
```

## compound-loop.py phases (runs 2am–6:30am)

```
SEARCH   → GitHub Trending + HN + GitHub Search API
SCORE    → ROI formula: leverage×speed×compound / effort×risk
ADOPT    → auto-clone repos scoring ≥78 ROI
PROTOTYPE→ generate minimal integration code
VALIDATE → syntax check prototypes
WIRE     → update TRIGGER-DICTIONARY + pattern-registry
OPTIMIZE → flag weakest domain for DSPy improvement
MEMORIZE → save all patterns to compound-memory.json
REPORT   → Telegram: "+N tools, +M patterns adopted"
LOOP     → repeat every 45min until 6:30am
```

## Kill switches

```bash
touch ~/OMNISTACK/.HALT                   # stop all pipelines
touch ~/CMNDCENTER/intellitradeX/.HALT    # stop trading only
```
