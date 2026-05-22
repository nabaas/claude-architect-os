# OpenDevin (All Hands AI) — Claude Architect OS Integration

OpenDevin is an autonomous coding agent that can browse, code, run terminals, and deploy.
It mirrors what Loki Mode does but with a visual web interface.

## Docker Setup

```bash
docker run -d \
  --name opendevin \
  -p 3000:3000 \
  -v ~/.opendevin:/root/.opendevin \
  -e SANDBOX_TYPE=exec \
  -e LLM_MODEL=claude-sonnet-4-6 \
  -e LLM_API_KEY=$ANTHROPIC_API_KEY \
  -e LLM_BASE_URL=https://api.anthropic.com \
  ghcr.io/opendevin/opendevin:latest
```

## Configuration (~/.opendevin/config.toml)

```toml
[core]
workspace_base = "/Users/yourname/CMNDCENTER/repos"
persist_sandbox = true

[llm]
model = "claude-sonnet-4-6"
api_key = "${ANTHROPIC_API_KEY}"
temperature = 0.1
num_retries = 5

[sandbox]
sandbox_type = "exec"
timeout = 120
use_host_network = true

[agent]
name = "CodeActAgent"  # Best for CMNDCENTER tasks
```

## Wiring to Loki Mode

OpenDevin can execute Loki Mode builds from its web UI:
1. Open http://localhost:3000
2. Task: "Run bash ~/CMNDCENTER/loki/loki.sh 'build requirement'"
3. OpenDevin will execute the Loki pipeline and report back

## Use Cases in This Stack

| Scenario | Tool | Why |
|----------|------|-----|
| Complex multi-file builds | OpenDevin | Visual progress tracking |
| Interactive debugging | OpenDevin | Browser-based terminal |
| Quick iterations | Cline/Aider | Faster, no Docker overhead |
| Batch builds | Loki Mode | 37-agent parallel execution |
