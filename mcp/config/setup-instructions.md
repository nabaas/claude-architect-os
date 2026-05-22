# MCP Server Setup — Claude Architect OS

MCP servers give Claude Code direct tool access: GitHub API, databases, browser, Docker, memory graph.

## Install All MCP Servers (One Command)

```bash
bash ~/CMNDCENTER/repos/claude-architect-os/scripts/mcp-setup.sh
```

## Manual: Add to ~/.claude/settings.json

Open `~/.claude/settings.json` and merge the contents of `mcp/config/mcp-servers.json` into the root object:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "your_token" }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem",
        "/Users/nadirabaas/CMNDCENTER",
        "/Users/nadirabaas/.amsa"
      ]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest",
        "--supabase-url", "http://localhost:54321",
        "--supabase-key", "your_service_role_key"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:postgres@localhost:5432/postgres"
      ]
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": { "NOTION_API_KEY": "your_notion_key" }
    },
    "docker": {
      "command": "npx",
      "args": ["-y", "mcp-server-docker"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "your_brave_key" }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite",
        "--db-path", "/Users/nadirabaas/.amsa/memory/local.db"
      ]
    }
  }
}
```

## What Each MCP Server Enables

| Server | What Claude Can Now Do |
|--------|----------------------|
| `github` | Read/write any repo, create PRs, search code, manage issues |
| `filesystem` | Read/write CMNDCENTER files, memory, configs without shell commands |
| `playwright` | Browse the web, scrape eBay/Amazon prices, test UIs autonomously |
| `supabase` | Query sessions, opportunities, trade signals directly in SQL |
| `postgres` | Raw DB access — analytics, aggregations, custom queries |
| `notion` | Update AMSA brain, create project pages, sync knowledge base |
| `docker` | Start/stop Ollama, ChromaDB, n8n, Supabase stack from Claude |
| `brave-search` | Live market research, competitor analysis, trend detection |
| `memory` | Persistent entity/relation graph — survives across sessions |
| `sequential-thinking` | Break complex architectures into step-by-step reasoning chains |
| `fetch` | Call any webhook, API endpoint, or URL directly |
| `sqlite` | Fast local queries on patterns.json, queue files |

## Power Combination: What This Unlocks

With all servers active, Claude can autonomously:
1. Search web for opportunity → scrape pricing (playwright) → store in DB (postgres) → alert via webhook (fetch)
2. Read CMNDCENTER file (filesystem) → improve it → commit to GitHub (github) → restart service (docker)
3. Query Supabase for signals → run analysis → write findings to Notion → update memory graph
4. Build full pipelines without leaving the Claude Code conversation
