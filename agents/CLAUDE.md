# agents/ — OMNISTACK Agent Engine

Files in this directory are the core agent assignment and potentiation layer.
Copy to `~/OMNISTACK/FUSION-MASTER/hub/` and they become active immediately.

## Files

| File | Role | Run with |
|------|------|----------|
| `agent-manager.py` | Auto-assigns 37 agents by domain+complexity, compound-learns from outcomes | `python3 agent-manager.py "task description"` |
| `potentiation-matrix.py` | Pythagorean √(a²+b²) tool chain optimizer — finds highest-ROI orthogonal stacks | `python3 potentiation-matrix.py chain <domain> <n>` |
| `potentiate-now.py` | Full 4-parallel-scanner potentiation run: research+WAND+ITX+scan → score → adopt | `python3 potentiate-now.py` |
| `mini-project-agents.json` | Cached mini-project → agent team assignments (refreshed daily by wallpaper) | Read-only cache |

## Usage patterns

```bash
# Assign agents to any task
python3 agent-manager.py "build crypto signal scanner" --domain trading

# Find best 4-tool chain for a domain
python3 potentiation-matrix.py chain ai 4

# Score arbitrary chain
python3 potentiation-matrix.py score repomix claude-code n8n chromadb

# Run full potentiation (all scanners parallel → adopt → compound)
python3 potentiate-now.py

# Show compound-learned agent confidence scores
python3 agent-manager.py --report

# Record task outcome (improves future assignments)
python3 agent-manager.py --record python-expert code-reviewer --success
```

## Compound learning algorithm

Agent confidence scores live in `~/OMNISTACK/FUSION-MASTER/hub/agent-scores.json`.
- Starts at 75% confidence for all agents
- +success/total_uses per agent after each task completion
- Bounded [50%, 99%] — never fully excludes an agent
- Decays toward 75% if unused (30-day window)
- Run `--report` to see current scores
