# Cursor — Claude Architect OS Rules

## .cursorrules (place at project root)

```
You are working inside Claude Architect OS — a recursive AI command center.

Stack awareness:
- Primary brain: Claude Code (claude-sonnet-4-6)
- Agent system: 37-agent Loki Mode at ~/CMNDCENTER/loki/
- Memory: ChromaDB (localhost:8000) + Supabase (localhost:54321)
- Automation: n8n (localhost:5678)
- Local models: Ollama (localhost:11434) — hermes3, gemma3:4b

Coding rules:
1. Always prefer TypeScript over JavaScript
2. Use @anthropic-ai/sdk for all Claude API calls
3. Include prompt caching on all system prompts (cache_control: ephemeral)
4. Default model: claude-sonnet-4-6 (never hardcode older models)
5. Never commit .env files
6. All async functions must have try/catch with meaningful error messages
7. Prefer functional patterns over class instances

Architecture rules:
1. New utilities go in src/utils/
2. New agents go in agents/ with registry.json entry
3. New pipelines go in automations/pipelines/
4. Memory writes always go to ~/.amsa/memory/
5. Market signals always write to ~/.amsa/linear-queue/

Output format for plans:
Goal · Leverage · Integration Steps · Kill Switch · ROI (0-100)
```

## Cursor Settings (settings.json additions)

```json
{
  "cursor.cpp.enablePartialAccepts": true,
  "cursor.chat.model": "claude-sonnet-4-6",
  "cursor.general.gitGraphEnabled": true,
  "cursor.composer.collapsePaneInputBoxPills": true
}
```

## Interoperability with VS Code

Cursor and VS Code Insiders share the same extensions marketplace.
Install all extensions from `vscode/extensions.json` in both.

Shared config at:
- `~/.cursor/settings.json` — Cursor
- `~/Library/Application Support/Code - Insiders/User/settings.json` — VS Code Insiders
