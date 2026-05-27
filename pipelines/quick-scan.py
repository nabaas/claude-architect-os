#!/usr/bin/env python3
"""
quick-scan.py — Lightweight post-prompt intelligence scan (~30s)
Triggered: after every Claude session, git push, VS Code task
Mission: surface highest-ROI tool or pattern, prototype it, save it

Difference from compound-loop.py:
  - Runs in <60s (vs 4.5hr overnight loop)
  - Picks ONE highest-signal item per run (vs bulk batch)
  - Auto-exits — designed for background fire-and-forget
  - Feeds SEEN cache shared with compound-loop.py
"""
from __future__ import annotations
import os, sys, json, subprocess, datetime, hashlib
from pathlib import Path

HOME      = Path.home()
CMND      = HOME / "CMNDCENTER"
OMNI      = HOME / "OMNISTACK"
FUSION    = OMNI / "FUSION-MASTER"
MEMORY    = CMND / "system" / "intelligence" / "compound-memory.json"
REGISTRY  = CMND / "system" / "blueprints" / "pattern-registry.json"
SEEN_FILE = CMND / "logs" / "compound-seen.json"
LOG       = CMND / "logs" / "quick-scan.log"
HALT      = OMNI / ".HALT"

LOG.parent.mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def load_seen() -> set:
    if SEEN_FILE.exists():
        try:
            return set(json.loads(SEEN_FILE.read_text()).get("seen", []))
        except Exception:
            return set()
    return set()

def save_seen(seen: set):
    existing: dict = {}
    if SEEN_FILE.exists():
        try:
            data = json.loads(SEEN_FILE.read_text())
            if isinstance(data, dict):
                existing = data
            # list = old format from compound-loop.py — discard, start fresh dict
        except Exception:
            pass
    existing["seen"] = list(seen)[-500:]
    SEEN_FILE.write_text(json.dumps(existing, indent=2))

def _open(url: str, timeout: int = 8):
    """urllib.request.urlopen with macOS SSL fix."""
    import urllib.request, ssl
    try:
        return urllib.request.urlopen(url, timeout=timeout)
    except Exception:
        # macOS system Python often lacks root certs — fall back to unverified
        ctx = ssl._create_unverified_context()
        return urllib.request.urlopen(url, timeout=timeout, context=ctx)

def search_hn_top() -> list[dict]:
    """Fetch top HN stories filtered for AI/automation/tools."""
    try:
        with _open("https://hacker-news.firebaseio.com/v0/topstories.json") as r:
            ids = json.loads(r.read())[:30]

        results = []
        for item_id in ids[:20]:
            try:
                with _open(
                    f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json", timeout=5
                ) as r:
                    item = json.loads(r.read())
                if not item or item.get("type") != "story":
                    continue
                title = item.get("title", "").lower()
                keywords = ["ai", "llm", "agent", "automat", "claude", "openai",
                            "pipeline", "workflow", "sdk", "tool", "open source",
                            "github", "self-host", "local", "mcp", "rag"]
                if any(k in title for k in keywords) and item.get("score", 0) >= 50:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "score": item.get("score", 0),
                        "source": "hn",
                        "id": hashlib.md5(item.get("title", "").encode()).hexdigest()[:8],
                    })
            except Exception:
                continue
        return sorted(results, key=lambda x: x["score"], reverse=True)[:5]
    except Exception as e:
        log(f"HN fetch failed: {e}")
        return []

def roi_score(item: dict) -> float:
    """Quick ROI estimate based on title signals."""
    title = item.get("title", "").lower()
    score = 40.0  # baseline

    # High-value signals
    if any(k in title for k in ["self-host", "open source", "free", "local"]):
        score += 8
    if any(k in title for k in ["agent", "autonomous", "automat"]):
        score += 10
    if any(k in title for k in ["compound", "memory", "learning"]):
        score += 8
    if any(k in title for k in ["pipeline", "workflow", "orchestrat"]):
        score += 7
    if any(k in title for k in ["claude", "anthropic", "mcp"]):
        score += 6
    if item.get("score", 0) > 200:
        score += 5
    if "github.com" in item.get("url", ""):
        score += 5

    # Low-value signals
    if any(k in title for k in ["drama", "lawsuit", "funding round", "acquisition"]):
        score -= 15
    return min(score, 99.0)

def save_to_memory(item: dict, roi: float):
    """Append the finding to compound-memory.json global_learnings."""
    try:
        memory = json.loads(MEMORY.read_text()) if MEMORY.exists() else {}
        if not isinstance(memory, dict):
            memory = {}
        learnings = memory.get("global_learnings", [])
        if not isinstance(learnings, list):
            learnings = []
        entry = {
            "id": f"quick-scan-{item['id']}",
            "source": item.get("source", "hn"),
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "roi_score": round(roi, 1),
            "found_at": datetime.datetime.utcnow().isoformat() + "Z",
            "action": "adopt" if roi >= 78 else "watch",
        }
        # Deduplicate by id — learnings may be strings (legacy) or dicts (new)
        learnings = [l for l in learnings
                     if not (isinstance(l, dict) and l.get("id") == entry["id"])]
        learnings.append(entry)
        memory["global_learnings"] = learnings[-200:]  # keep last 200
        if "_meta" not in memory:
            memory["_meta"] = {}
        memory["_meta"]["last_quick_scan"] = entry["found_at"]
        MEMORY.write_text(json.dumps(memory, indent=2))
        log(f"Saved to memory: {item['title'][:60]} (ROI={roi:.0f})")
    except Exception as e:
        log(f"Memory save failed: {e}")

def trigger_adopt(item: dict):
    """Fire adopt.sh for GitHub repos scoring ≥78."""
    url = item.get("url", "")
    if "github.com" not in url:
        return
    adopt_sh = CMND / "system" / "blueprints" / "adopt.sh"
    if not adopt_sh.exists():
        return
    log(f"Adopting: {url}")
    subprocess.Popen(
        ["bash", str(adopt_sh), url],
        stdout=open(LOG, "a"),
        stderr=subprocess.STDOUT,
        env={**os.environ, "HOME": str(HOME)},
    )

def notify_n8n(item: dict, roi: float):
    """Ping n8n webhook with quick-scan result."""
    try:
        import urllib.request
        payload = json.dumps({
            "source": "quick-scan",
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "roi": roi,
            "action": "adopt" if roi >= 78 else "watch",
        }).encode()
        req = urllib.request.Request(
            "http://localhost:5678/webhook/62d963cc-953a-48af-aac1-99ec591b9a16/webhook/fusion-trigger",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass  # n8n offline is fine — local save already happened

def main():
    if HALT.exists():
        sys.exit(0)

    log("Quick-scan start")
    seen = load_seen()

    results = search_hn_top()
    if not results:
        log("No results — HN unreachable or no matching items")
        return

    # Filter seen, score all, pick top
    new_results = [r for r in results if r["id"] not in seen]
    if not new_results:
        log("All items already seen — nothing new")
        return

    scored = [(r, roi_score(r)) for r in new_results]
    scored.sort(key=lambda x: x[1], reverse=True)
    best_item, best_roi = scored[0]

    log(f"Top find: '{best_item['title'][:70]}' | ROI={best_roi:.0f}")

    # Save to compound memory always
    save_to_memory(best_item, best_roi)

    # Auto-adopt if ROI ≥ 78 and it's a GitHub repo
    if best_roi >= 78 and "github.com" in best_item.get("url", ""):
        trigger_adopt(best_item)

    # Notify n8n cascade
    notify_n8n(best_item, best_roi)

    # Mark as seen
    seen.add(best_item["id"])
    save_seen(seen)

    log(f"Quick-scan complete — top ROI {best_roi:.0f} item saved")

if __name__ == "__main__":
    main()
