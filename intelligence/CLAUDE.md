# intelligence/ — OMNISTACK Signal Scanners

Scanner and scoring scripts. Copy to their active paths (listed below) to activate.

## Files + Active Paths

| File | Active path | Role |
|------|------------|------|
| `research-aggregator.py` | `~/OMNISTACK/FUSION-MASTER/pipelines/` | GitHub Trending + HN + GitHub Search → JSON |
| `scorer.py` | `~/CMNDCENTER/roi-brain/` | ROI formula engine — ranks any item list |
| `wand_scan.py` | `~/CMNDCENTER/WAND/` | HN + GitHub trending → content angles + signals |
| `intellitradeX.py` | `~/CMNDCENTER/intellitradeX/main.py` | F&G index + CoinGecko → trading signals |

## scorer.py — ROI Formula

```
ROI = (leverage × speed_multiplier × compound_factor) / (effort × risk)

leverage (1–10)      : how many CMNDCENTER systems this tool touches
speed_multiplier(1–5): 5=instant, 4=<5min, 3=<30min, 2=<2hr, 1=days
compound_factor (1–3): 3=self-improving, 2=reusable, 1=one-time
effort (0.1–10)      : normalized hours to integrate
risk (1–5)           : 1=safe/reversible, 5=destructive

Adoption threshold: ROI ≥ 78
```

```bash
# Score a file of items
python3 scorer.py --input /tmp/research-results.json --output /tmp/scored.json --threshold 60

# Pipe from stdin
cat items.json | python3 scorer.py --threshold 78 --top 10
```

## research-aggregator.py sources

- GitHub Trending (HTML scrape, top 20/language/day)
- HN Algolia API (stories with score >50, AI/automation keywords)
- GitHub Search API (8 rotating queries, authentication optional)

```bash
python3 research-aggregator.py --mode research  --output /tmp/results.json
python3 research-aggregator.py --mode refresh   --output /tmp/results.json
python3 research-aggregator.py --mode overnight --output /tmp/results.json
```
