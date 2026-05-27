#!/usr/bin/env python3
"""
ROI Scoring Engine — OMNISTACK FUSION-MASTER
Called by: fusion-trigger.sh
Usage: scorer.py [--input FILE|-] [--output FILE] [--top N] [--threshold N]
"""

import json
import sys
import argparse
from pathlib import Path


# ---------------------------------------------------------------------------
# Domain tables
# ---------------------------------------------------------------------------

DOMAIN_COMPOUND: dict[str, float] = {
    "ai":      3.0,
    "trading": 3.0,
    "intel":   3.0,
    "ops":     2.0,
    "code":    2.0,
    "content": 1.5,
}

SOURCE_BASE_SPEED: dict[str, float] = {
    "github": 3.0,
    "github_trending": 3.0,
    "github_search":   3.0,
    "hn":     3.0,
    "hacker_news":     3.0,
    "intellitradeX":   3.5,
    "wand":   3.0,
    "arxiv":  2.0,
}

TYPE_BASE_LEVERAGE: dict[str, float] = {
    "repo":    5.0,
    "tool":    4.0,
    "article": 2.0,
}


# ---------------------------------------------------------------------------
# Core formula
# ---------------------------------------------------------------------------

def compute_roi(item: dict) -> float:
    """
    ROI = (leverage × speed_multiplier × compound_factor) / (effort × risk)

    All inputs clamped to their documented ranges before division.
    Final result clamped to [0, 99].
    """
    url: str    = (item.get("url") or "").lower()
    domain: str = (item.get("domain") or "").lower()
    source: str = (item.get("source") or "").lower()
    itype: str  = (item.get("type") or "").lower()
    hn_score: float = float(item.get("score") or 0)

    # --- leverage (1–10) ---
    leverage = TYPE_BASE_LEVERAGE.get(itype, 3.0)
    if "open source" in url or "github.com" in url:
        leverage = min(10.0, leverage + 2.0)

    # --- speed_multiplier (1–5) ---
    speed = SOURCE_BASE_SPEED.get(source, 2.0)
    if hn_score > 200:
        speed = min(5.0, speed + 1.0)

    # --- compound_factor (1–3) ---
    compound = DOMAIN_COMPOUND.get(domain, 1.0)

    # --- effort (0.1–10) ---
    # Repos and tools default to moderate integration effort; articles are lighter.
    effort_defaults: dict[str, float] = {"repo": 3.0, "tool": 2.0, "article": 0.5}
    effort = effort_defaults.get(itype, 2.0)
    # pip/npm installs are trivially integrated
    description = (item.get("description") or item.get("title") or "").lower()
    if "pip install" in description or "npm install" in description:
        effort = min(effort, 2.0)
    effort = max(0.1, min(10.0, effort))

    # --- risk (1–5) ---
    # Open-source / reversible integrations are low risk; destructive ops higher.
    if "github.com" in url or itype in ("repo", "tool"):
        risk = 1.5
    elif domain in ("trading", "intel"):
        risk = 2.0
    else:
        risk = 2.5
    risk = max(1.0, min(5.0, risk))

    # --- formula ---
    numerator   = leverage * speed * compound
    denominator = effort * risk
    raw = numerator / denominator if denominator else 0.0

    # Scale to a 0–99 range.  Raw values typically land in [0, ~100];
    # a simple clamp is sufficient — document scaling here if calibration needed.
    return round(max(0.0, min(99.0, raw)), 2)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="OMNISTACK ROI scoring engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input", "-i", default="-",
        help="Input JSON file path, or '-' for stdin (default: stdin)",
    )
    parser.add_argument(
        "--output", "-o", default=None,
        help="Output JSON file path (default: stdout)",
    )
    parser.add_argument(
        "--top", "-n", type=int, default=None,
        help="Return only top N items by roi_score",
    )
    parser.add_argument(
        "--threshold", "-t", type=float, default=None,
        help="Exclude items with roi_score below this value",
    )
    return parser.parse_args()


def load_items(source: str) -> list[dict]:
    if source == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(source).read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array, got {type(data).__name__}")
    return data


def score_and_rank(items: list[dict], threshold: float | None, top: int | None) -> list[dict]:
    for item in items:
        computed = compute_roi(item)
        # Preserve existing score if it's higher (upstream scorers may have more context)
        existing = float(item.get("roi_score") or item.get("roi_potential") or 0)
        item["roi_score"] = round(max(computed, existing), 2)

    ranked = sorted(items, key=lambda x: x["roi_score"], reverse=True)

    if threshold is not None:
        ranked = [r for r in ranked if r["roi_score"] >= threshold]

    if top is not None:
        ranked = ranked[:top]

    return ranked


def write_output(data: list[dict], dest: str | None) -> None:
    text = json.dumps(data, indent=2)
    if dest is None:
        print(text)
    else:
        Path(dest).write_text(text, encoding="utf-8")


def main() -> None:
    args = parse_args()
    items = load_items(args.input)
    ranked = score_and_rank(items, args.threshold, args.top)
    write_output(ranked, args.output)


if __name__ == "__main__":
    main()
