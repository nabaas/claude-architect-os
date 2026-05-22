# Obsidian Vault — Claude Architect OS Knowledge Graph

## Vault Location
`~/CMNDCENTER/obsidian-vault/` (create if not exists)

## Plugin Stack (install via Community Plugins)

| Plugin | Purpose |
|--------|---------|
| Dataview | Query notes as database — power your opportunity dashboard |
| Templater | Auto-generate note templates on creation |
| Obsidian Git | Auto-commit vault to GitHub |
| Smart Connections | AI-powered note linking (uses local embeddings) |
| Canvas | Visual knowledge mapping |
| Tasks | Track implementation todos |
| Excalidraw | Architecture diagrams inline |
| Notion-like Databases | Structured data views |
| Periodic Notes | Daily intelligence logs |

## Vault Structure

```
claude-architect-os-vault/
├── 00-Inbox/           # Raw captures from Raycast AI Capture command
├── 01-Projects/        # Active builds (each gets a note)
├── 02-Market-Intel/    # Opportunity notes from scorer
├── 03-Agents/          # One note per agent (links to registry.json)
├── 04-Prompts/         # Prompt library (synced from prompts/)
├── 05-Workflows/       # Automation documentation
├── 06-Architecture/    # System diagrams (Excalidraw)
├── 07-Patterns/        # Extracted success patterns
├── 08-Revenue/         # Monetization tracking
└── 09-Research/        # Deep research outputs
```

## Dataview Example Queries

```dataview
TABLE score, ttv, status
FROM "02-Market-Intel"
WHERE status = "active"
SORT score DESC
LIMIT 10
```

```dataview
LIST
FROM "01-Projects"
WHERE contains(tags, "loki-build")
SORT file.ctime DESC
```

## Smart Connections Configuration

```json
{
  "embedding_model": "ollama/nomic-embed-text",
  "ollama_base_url": "http://localhost:11434",
  "vector_store": "local",
  "auto_suggest": true,
  "min_similarity": 0.75
}
```

## Auto-Sync from CMNDCENTER

Add to `scripts/upgrade.sh`:
```bash
# Sync market signals to Obsidian
if [ -d "$HOME/CMNDCENTER/obsidian-vault" ]; then
  cp ~/.amsa/linear-queue/latest.json \
     "$HOME/CMNDCENTER/obsidian-vault/02-Market-Intel/$(date +%Y-%m-%d)-signals.json"
fi
```

## Obsidian Git Auto-Commit

In `.obsidian/plugins/obsidian-git/data.json`:
```json
{
  "autoSaveInterval": 30,
  "autoPushInterval": 60,
  "commitMessage": "vault: auto-sync {{date}}",
  "pullBeforePush": true
}
```
