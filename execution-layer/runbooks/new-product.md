# Runbook: New Product Build (Loki Mode)

**Chain:** C5-Loki-Build  
**Time:** ~20 min end-to-end  
**ROI Gate:** ≥ 60 before executing

## Steps

```bash
# 1. State requirement
loki "SaaS for [description]"

# 2. Loki runs 7 phases automatically:
#    P1 DISCOVER  → requirements + market research (parallel, 7 agents)
#    P2 DESIGN    → architecture + API + DB schema (parallel, 5 agents)
#    P3 BUILD     → implementation (parallel by domain, 5 agents)
#    P4 QUALITY   → review + security + tests (parallel gate, 7 agents)
#    P5 DEPLOY    → docker + CI/CD (sequential, 2 agents)
#    P6 MONETIZE  → pricing + GTM (parallel with deploy, 3 agents)
#    P7 OPERATE   → metrics + feedback loop (ongoing, 7 agents)

# 3. Monitor
loki --status

# 4. Output lands at:
#    ~/CMNDCENTER/loki/runs/<timestamp>/
#    ~/.amsa/memory/loki_runs/<timestamp>.json
```

## Kill Switch

```bash
touch ~/CMNDCENTER/loki/.HALT
```

## Feeds

- Pattern engine (C2) on every successful build
- GitHub push (C4 repo-intel) on deploy
- Content pipeline (C7) with project summary
