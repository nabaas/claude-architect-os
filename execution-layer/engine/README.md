# Layer 2 — Execution Engine

Turns Layer 1 (Prompt Brain) outputs into real code commits and running processes.

## Tools Wired

```
VS Code          → primary IDE, Continue.dev extension for inline AI
Cursor           → composer mode for multi-file builds
Cline            → autonomous task agent (reads CLAUDE.md automatically)
Aider            → git-native: auto-commits every change with message
Claude Code      → this session (highest capability, primary brain)
```

## Configs

- `cursor.json`    — Cursor model routing (LiteLLM backend at localhost:4000)
- `cline.json`     — Cline MCP server config + allowed tools
- `vscode.json`    — Workspace settings (points Continue.dev at LiteLLM)

## How It's Wired

```
Layer 1 output (Claude)
       ↓
  Has action: "execute"?
       ↓ yes
  Route to tool based on task type:
    type=code   → Cline autonomous execution
    type=commit → Aider git-native commit
    type=multi  → Cursor composer
    type=infra  → Claude Code bash
       ↓
  SpawnGuard rate-limiter (system/spawn_guard.py)
       ↓
  Output → git commit → GitHub push → Layer 5 memory
```
