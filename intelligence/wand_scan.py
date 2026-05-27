"""
WAND Signal Scanner — Worldwide Automated News Digester
Lightweight stdlib-only scanner for OMNISTACK FUSION-MASTER.

Called by fusion-trigger.sh:
    python3 "$CMND/WAND/wand_scan.py" --quick --output /tmp/wand-morning.json
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

WAND_DIR = Path.home() / "CMNDCENTER" / "WAND"
AI_KEYWORDS = {"ai", "automation", "agent", "autonomous", "llm", "gpt", "ml", "neural"}
DOMAIN_KEYWORDS = {
    "content": {"youtube", "video", "viral", "content", "creator", "shorts", "tiktok"},
    "trading": {"trade", "crypto", "stock", "signal", "market", "btc", "eth", "defi"},
    "ai": {"ai", "llm", "gpt", "agent", "autonomous", "ml", "neural", "model"},
}


def _is_ssl_error(exc: Exception) -> bool:
    import urllib.error
    if isinstance(exc, ssl.SSLError):
        return True
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, ssl.SSLError):
        return True
    return False


def _fetch(url: str, timeout: int = 15) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "WAND/2.0 FUSION-MASTER"})
    for ctx in (ssl.create_default_context(), ssl._create_unverified_context()):
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
                return r.read()
        except Exception as exc:
            if _is_ssl_error(exc):
                continue
            raise
    raise RuntimeError(f"All SSL contexts failed for {url}")


def _classify_domain(text: str) -> str:
    lower = text.lower()
    for domain, keywords in DOMAIN_KEYWORDS.items():
        if any(k in lower for k in keywords):
            return domain
    return "general"


def _ai_boost(text: str) -> float:
    lower = text.lower()
    return 0.1 if any(k in lower for k in AI_KEYWORDS) else 0.0


def _assign_action(domain: str, source: str) -> str:
    if domain == "content":
        return "youtube_script"
    if source == "github":
        return "adopt"
    if domain == "trading":
        return "trade_signal"
    return "monitor"


def fetch_hn_signals(limit: int = 20) -> list[dict[str, Any]]:
    """Fetch top HN stories and score them."""
    top_ids = json.loads(_fetch(
        "https://hacker-news.firebaseio.com/v0/topstories.json"
    ))[:limit]

    signals: list[dict[str, Any]] = []
    for story_id in top_ids:
        try:
            item = json.loads(_fetch(
                f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
            ))
        except Exception:
            continue

        score = item.get("score", 0)
        title = item.get("title", "")
        url = item.get("url") or f"https://news.ycombinator.com/item?id={story_id}"
        domain = _classify_domain(title)
        base_strength = 0.9 if score > 300 else (0.7 if score > 150 else 0.5)
        strength = min(1.0, base_strength + _ai_boost(title))
        roi = min(95, 80 + int(strength * 15)) if score > 300 else min(75, 50 + int(strength * 25))

        signals.append({
            "title": title,
            "url": url,
            "signal_type": "viral" if score > 300 else "trending",
            "domain": domain,
            "strength": round(strength, 2),
            "source": "hn",
            "roi_potential": roi,
            "action": _assign_action(domain, "hn"),
            "_score": score,
        })

    return signals


def fetch_github_signals(limit: int = 5) -> list[dict[str, Any]]:
    """Scrape GitHub trending and score top repos."""
    html = _fetch("https://github.com/trending?since=daily").decode("utf-8", errors="ignore")
    repos = re.findall(
        r'href="/([^/"]+/[^/"]+)"[^>]*>.*?</a>.*?(\d[\d,]*)\s*stars',
        html, re.DOTALL
    )
    # fallback pattern for repo names without inline stars
    if not repos:
        names = re.findall(r'href="/([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)"', html)
        repos = [(n, "0") for n in dict.fromkeys(names) if "/" in n][:limit]

    signals: list[dict[str, Any]] = []
    seen: set[str] = set()
    for repo_path, stars_raw in repos[:limit]:
        if repo_path in seen:
            continue
        seen.add(repo_path)
        stars = int(stars_raw.replace(",", "")) if stars_raw.strip() else 0
        title = repo_path.replace("/", " / ")
        domain = _classify_domain(repo_path)
        base_strength = 0.85 if stars >= 500 else (0.65 if stars >= 100 else 0.5)
        strength = min(1.0, base_strength + _ai_boost(repo_path))
        roi = min(90, 70 + int(strength * 20))

        signals.append({
            "title": title,
            "url": f"https://github.com/{repo_path}",
            "signal_type": "trending",
            "domain": domain,
            "strength": round(strength, 2),
            "source": "github",
            "roi_potential": roi,
            "action": _assign_action(domain, "github"),
            "_stars": stars,
        })

    return signals


def generate_content_angles(signals: list[dict[str, Any]]) -> list[str]:
    top = [s["title"] for s in signals if s["roi_potential"] >= 70][:5]
    angles = []
    for title in top:
        angles.append(f"How {title.split('/')[0].strip()} is changing the game")
    angles.append("Top AI tools gaining traction this week")
    angles.append("What developers are building right now")
    return angles[:3]


def run_scan(mode: str, domain_filter: str | None) -> dict[str, Any]:
    signals: list[dict[str, Any]] = []

    try:
        signals.extend(fetch_hn_signals(20 if mode == "full" else 20))
    except Exception as exc:
        sys.stderr.write(f"[WAND] HN fetch failed: {exc}\n")

    if mode in ("quick", "full"):
        try:
            signals.extend(fetch_github_signals(5))
        except Exception as exc:
            sys.stderr.write(f"[WAND] GitHub fetch failed: {exc}\n")

    if domain_filter:
        signals = [s for s in signals if s["domain"] == domain_filter]

    signals.sort(key=lambda s: (s["roi_potential"], s["strength"]), reverse=True)

    # strip internal sort keys
    clean: list[dict[str, Any]] = [
        {k: v for k, v in s.items() if not k.startswith("_")} for s in signals
    ]

    top_signal = clean[0] if clean else {}
    return {
        "scan_time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "signals": clean,
        "top_signal": top_signal,
        "content_angles": generate_content_angles(signals),
    }


def save_last_run(signal_count: int) -> None:
    WAND_DIR.mkdir(parents=True, exist_ok=True)
    (WAND_DIR / "last_run.txt").write_text(
        f"{datetime.now(timezone.utc).isoformat()} | signals={signal_count}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="WAND Signal Scanner")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--quick", action="store_true", help="Fast scan: HN + GitHub only")
    mode_group.add_argument("--full", action="store_true", help="Full scan including domain scrape")
    parser.add_argument("--output", metavar="PATH", help="Write JSON to file (default: stdout)")
    parser.add_argument("--domain", metavar="STR", choices=["content", "trading", "ai", "general"],
                        help="Filter signals by domain")
    args = parser.parse_args()

    mode = "full" if args.full else "quick"
    result = run_scan(mode, args.domain)
    save_last_run(len(result["signals"]))

    payload = json.dumps(result, indent=2)
    if args.output:
        Path(args.output).write_text(payload)
        sys.stderr.write(f"[WAND] {len(result['signals'])} signals → {args.output}\n")
    else:
        print(payload)


if __name__ == "__main__":
    main()
