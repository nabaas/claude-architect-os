#!/bin/bash
# MCP Server Setup — Claude Architect OS
# Installs all MCP servers and wires them into ~/.claude/settings.json

set -e
SETTINGS="$HOME/.claude/settings.json"
CAO="$HOME/CMNDCENTER/repos/claude-architect-os"

echo "🔌 Installing Claude Architect OS MCP servers..."

# Install all MCP packages globally
npm install -g \
  @modelcontextprotocol/server-github \
  @modelcontextprotocol/server-filesystem \
  @modelcontextprotocol/server-postgres \
  @modelcontextprotocol/server-memory \
  @modelcontextprotocol/server-sequential-thinking \
  @modelcontextprotocol/server-fetch \
  @modelcontextprotocol/server-sqlite \
  @modelcontextprotocol/server-brave-search \
  @notionhq/notion-mcp-server \
  mcp-server-docker 2>/dev/null || echo "⚠ Some packages may need manual install"

# Playwright MCP via npx (auto-installed on first use)
echo "✓ Playwright MCP: uses npx @playwright/mcp@latest (auto)"

# Supabase MCP
echo "✓ Supabase MCP: uses npx @supabase/mcp-server-supabase@latest (auto)"

# ─── Merge into ~/.claude/settings.json ─────────────────────────────────────

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

# Use Python to safely merge the MCP config into existing settings
python3 << PYEOF
import json, os

settings_path = os.path.expanduser("~/.claude/settings.json")
mcp_path = "$CAO/mcp/config/mcp-servers.json"

with open(settings_path) as f:
    settings = json.load(f)

with open(mcp_path) as f:
    mcp_config = json.load(f)

# Substitute env vars with actual values
import subprocess
def get_env(key, default=""):
    return os.environ.get(key, default)

# Replace placeholder env refs in mcp config
mcp_str = json.dumps(mcp_config)
for var in ["GITHUB_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "NOTION_API_KEY", "BRAVE_API_KEY"]:
    val = get_env(var, f'SET_{var}_IN_ENV')
    mcp_str = mcp_str.replace(f'${{{var}}}', val)
mcp_config = json.loads(mcp_str)

# Merge mcpServers
if "mcpServers" not in settings:
    settings["mcpServers"] = {}
settings["mcpServers"].update(mcp_config["mcpServers"])

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=2)

print(f"✅ Merged {len(mcp_config['mcpServers'])} MCP servers into {settings_path}")
PYEOF

echo ""
echo "✅ MCP servers configured in $SETTINGS"
echo ""
echo "Active servers:"
echo "  • github        — repo read/write, PRs, code search"
echo "  • filesystem    — CMNDCENTER, ~/.amsa read/write"
echo "  • playwright    — browser automation, market scraping"
echo "  • supabase      — direct DB queries (sessions, signals, P&L)"
echo "  • postgres      — raw SQL on local Supabase stack"
echo "  • notion        — AMSA brain sync, knowledge base"
echo "  • docker        — start/stop services from Claude"
echo "  • brave-search  — live web search, trend detection"
echo "  • memory        — persistent entity/relation graph"
echo "  • sequential-thinking — multi-step reasoning chains"
echo "  • fetch         — call any API/webhook directly"
echo "  • sqlite        — fast local pattern/queue queries"
echo ""
echo "Restart Claude Code to activate: claude"
