# hooks/ — Claude Code Hook Scripts

Scripts that fire automatically on every Claude prompt and file edit.
Copy to `~/CMNDCENTER/scripts/` then wire in Claude Code Settings → Hooks.

## Files

| File | Hook event | Fires when | Output |
|------|-----------|-----------|--------|
| `prompt-intelligence-engine.py` | UserPromptSubmit | Before every Claude response | PIE banner: domain + agents + laws |
| `pattern-pipeline-router.py` | PostToolUse (Edit/Write) | After every file edit | Pipeline recommendation + agent suggestion |

## Wiring (one-time setup)

Open Claude Code → Settings (gear icon) → Hooks:

```
Event: UserPromptSubmit
Command: python3 ~/CMNDCENTER/scripts/prompt-intelligence-engine.py

Event: PostToolUse
Matcher: Edit|Write
Command: python3 ~/CMNDCENTER/scripts/pattern-pipeline-router.py
```

Or copy the template:
```bash
cp setup/claude-settings-template.json ~/.claude/projects/$(basename $PWD)/settings.json
```

## PIE output (fires on every prompt)

```
╔═ PIE ═══════════════════════════════════════════════════
║ Domain: trading  Complexity: complex  Model: opus
║ Agents: loki-coordinator → ml-engineer → python-expert
║ Laws: VS Code=control plane | Docker=runtime | n8n=orchestration
╚═══════════════════════════════════════════════════════
```

## Error logging

Hook errors write to `~/CMNDCENTER/logs/pie-hook-errors.log`.
Never crashes Claude Code — fails silently to log file only.
Check: `tail -20 ~/CMNDCENTER/logs/pie-hook-errors.log`
