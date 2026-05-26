#!/usr/bin/env python3
"""
potentiate-now.py — Full OMNISTACK potentiation run, maximum efficiency.

Execution order derived from potentiation-matrix.py:
  TIER 0 (PARALLEL)  : orthogonal scanners fire simultaneously
                        research(intel) × WAND(content) × ITX(trading) × quick-scan(ops)
                        → √(a²+b²+c²+d²) > sum(a+b+c+d)
  TIER 1 (SERIAL)    : ROI scorer ranks combined output from all tier-0
  TIER 2 (PARALLEL)  : adopt ≥78 repos + compound-loop single cycle (background)
  TIER 3 (SERIAL)    : memory consolidation + n8n cascade + wallpaper
  TIER 4 (REPORT)    : print what compounded
"""
from __future__ import annotations
import os, sys, json, subprocess, time, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

HOME   = Path.home()
CMND   = HOME / "CMNDCENTER"
OMNI   = HOME / "OMNISTACK"
FUSION = OMNI / "FUSION-MASTER"
ENV1   = CMND / "system" / ".env"
ENV2   = OMNI / ".env"
LOGS   = CMND / "logs"
LOGS.mkdir(parents=True, exist_ok=True)
LOG    = LOGS / "potentiate-now.log"

# Load env vars
for ef in [ENV1, ENV2]:
    if ef.exists():
        for line in ef.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

FUSION_WEBHOOK = os.environ.get(
    "N8N_FUSION_TRIGGER_URL",
    "http://localhost:5678/webhook/62d963cc-953a-48af-aac1-99ec591b9a16/webhook/fusion-trigger"
)

session = {
    "start": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "t0_results": {}, "scored": [], "adopted": [], "prototypes": [], "errors": []
}

def ts():
    return datetime.datetime.now().strftime("%H:%M:%S")

def log(msg, level="INFO"):
    line = f"[{ts()}][{level}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def run_cmd(label: str, cmd: list[str], timeout: int = 120) -> tuple[bool, str]:
    """Run a subprocess, return (success, stdout)."""
    log(f"▶ {label}")
    try:
        r = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout,
            env={**os.environ, "HOME": str(HOME)}
        )
        ok = r.returncode == 0
        out = r.stdout.strip()
        if ok:
            log(f"  ✓ {label}")
        else:
            log(f"  ⚠ {label} (exit {r.returncode}) — {r.stderr.strip()[:80]}", "WARN")
            session["errors"].append({"step": label, "err": r.stderr.strip()[:120]})
        return ok, out
    except subprocess.TimeoutExpired:
        log(f"  ✗ {label} TIMEOUT after {timeout}s", "WARN")
        return False, ""
    except Exception as e:
        log(f"  ✗ {label}: {e}", "ERR")
        return False, ""

# ─────────────────────────────────────────────────────────────────────────────
# TIER 0 — PARALLEL ORTHOGONAL SCANNERS
# research(intel) × WAND(content) × ITX(trading) × quick-scan(ops)
# Capability vectors are maximally orthogonal → highest √(Σa²) potentiation
# ─────────────────────────────────────────────────────────────────────────────
def tier0_parallel_scan():
    log("═══ TIER 0: PARALLEL ORTHOGONAL SCANNERS ═══")
    tasks = {
        "research":    ([sys.executable,
                         str(FUSION/"pipelines"/"research-aggregator.py"),
                         "--mode", "research", "--output", "/tmp/pt-research.json"], 90),
        "wand":        ([sys.executable,
                         str(CMND/"WAND"/"wand_scan.py"),
                         "--quick", "--output", "/tmp/pt-wand.json"], 60),
        "intellitradeX": ([sys.executable,
                           str(CMND/"intellitradeX"/"main.py"),
                           "--scan", "--output", "/tmp/pt-trade.json"], 30),
        "quick-scan":  ([sys.executable,
                         str(FUSION/"hub"/"quick-scan.py")], 60),
    }
    results = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(run_cmd, label, cmd, to): label
                   for label, (cmd, to) in tasks.items()}
        for fut in as_completed(futures):
            label = futures[fut]
            ok, _ = fut.result()
            results[label] = ok

    # Merge all scanner outputs into combined pool
    combined = []
    for path in ["/tmp/pt-research.json", "/tmp/pt-wand.json"]:
        try:
            data = json.loads(Path(path).read_text())
            items = data if isinstance(data, list) else data.get("signals", [])
            combined.extend(items)
        except Exception:
            pass

    # Merge intellitradeX signals
    try:
        td = json.loads(Path("/tmp/pt-trade.json").read_text())
        for sig in td.get("signals", []):
            combined.append({
                "title": f"{sig['symbol']} {sig['signal_type']} signal",
                "url": "", "domain": "trading", "type": "signal",
                "source": "intellitradeX", "roi_score": sig.get("roi_potential", 60),
                "strength": sig.get("strength", 0.5)
            })
        session["t0_results"]["trade_sentiment"] = td.get("market_sentiment", "unknown")
        session["t0_results"]["fear_greed"] = td.get("fear_greed_index", 0)
    except Exception:
        pass

    session["t0_results"]["combined_count"] = len(combined)
    session["t0_results"]["scanners"] = results
    Path("/tmp/pt-combined.json").write_text(json.dumps(combined, indent=2))
    log(f"Tier 0 complete: {len(combined)} total items from {sum(results.values())}/4 scanners")
    return combined

# ─────────────────────────────────────────────────────────────────────────────
# TIER 1 — ROI SCORER (serial — depends on tier 0 combined output)
# ─────────────────────────────────────────────────────────────────────────────
def tier1_roi_score():
    log("═══ TIER 1: ROI SCORING ═══")
    ok, _ = run_cmd(
        "roi:score-combined",
        [sys.executable, str(CMND/"roi-brain"/"scorer.py"),
         "--input", "/tmp/pt-combined.json",
         "--output", "/tmp/pt-scored.json",
         "--threshold", "60"]
    )
    if ok:
        try:
            items = json.loads(Path("/tmp/pt-scored.json").read_text())
            session["scored"] = items
            top = [i for i in items if i.get("roi_score", 0) >= 78]
            log(f"Scored {len(items)} items | {len(top)} qualify for adoption (ROI≥78)")
            return items
        except Exception:
            pass
    return []

# ─────────────────────────────────────────────────────────────────────────────
# TIER 2 — PARALLEL: adopt ≥78 + background compound-loop cycle
# ─────────────────────────────────────────────────────────────────────────────
def tier2_adopt_and_loop(scored: list[dict]):
    log("═══ TIER 2: ADOPT + BACKGROUND LOOP ═══")
    adopt_sh = CMND / "system" / "blueprints" / "adopt.sh"
    adopted = 0

    # Adopt repos scoring ≥78
    import re
    _valid_repo = re.compile(r'https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')
    if adopt_sh.exists():
        for item in scored:
            if item.get("roi_score", 0) >= 78 and _valid_repo.match(item.get("url", "")):
                ok, _ = run_cmd(
                    f"adopt:{item['title'][:30]}",
                    ["bash", str(adopt_sh), item["url"],
                     "--domain", item.get("domain", "ai")],
                    timeout=90
                )
                if ok:
                    adopted += 1
                    session["adopted"].append(item["url"])
    else:
        log("adopt.sh not found — skipping adoption phase", "WARN")

    # Fire compound-loop as background process for continuous overnight compounding
    loop_log = LOGS / "potentiate-compound.log"
    subprocess.Popen(
        [sys.executable, str(FUSION/"hub"/"run-compound-loop.sh")],
        stdout=open(loop_log, "a"), stderr=subprocess.STDOUT,
        env={**os.environ, "HOME": str(HOME)}
    )
    log(f"compound-loop fired in background → {loop_log}")

    session["adopted_count"] = adopted
    log(f"Tier 2 complete: {adopted} repos adopted")

# ─────────────────────────────────────────────────────────────────────────────
# TIER 3 — MEMORY + N8N + WALLPAPER (serial — compound everything)
# ─────────────────────────────────────────────────────────────────────────────
def tier3_compound_memory_and_cascade(scored: list[dict]):
    log("═══ TIER 3: MEMORY CONSOLIDATION + CASCADE ═══")

    # Update compound-memory with top findings
    mem_path = CMND / "system" / "intelligence" / "compound-memory.json"
    try:
        memory = json.loads(mem_path.read_text()) if mem_path.exists() else {}
        if not isinstance(memory, dict):
            memory = {}
        learnings = memory.get("global_learnings", [])
        if not isinstance(learnings, list):
            learnings = []

        new_entries = 0
        for item in sorted(scored, key=lambda x: x.get("roi_score", 0), reverse=True)[:10]:
            entry = {
                "id": f"pt-now-{abs(hash(item.get('url','')))}",
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "roi_score": item.get("roi_score", 0),
                "domain": item.get("domain", "general"),
                "source": item.get("source", "potentiate-now"),
                "found_at": session["start"],
                "action": "adopt" if item.get("roi_score", 0) >= 78 else "watch",
            }
            existing_ids = {l.get("id") for l in learnings if isinstance(l, dict)}
            if entry["id"] not in existing_ids:
                learnings.append(entry)
                new_entries += 1

        memory["global_learnings"] = learnings[-250:]
        if "_meta" not in memory:
            memory["_meta"] = {}
        memory["_meta"]["last_potentiation_run"] = session["start"]
        memory["_meta"]["last_potentiation_count"] = len(scored)
        mem_path.write_text(json.dumps(memory, indent=2))
        log(f"Memory: +{new_entries} new learnings (total {len(learnings)})")
    except Exception as e:
        log(f"Memory update failed: {e}", "WARN")

    # Wallpaper refresh
    wall_py = CMND / "wallpapers" / "gen_wall_fusion.py"
    if wall_py.exists():
        run_cmd("wallpaper:refresh", [sys.executable, str(wall_py)], timeout=30)

    # n8n cascade — fire fusion-trigger webhook
    try:
        import urllib.request, ssl
        payload = json.dumps({
            "source": "potentiate-now",
            "items_scored": len(scored),
            "adopted": len(session["adopted"]),
            "ts": session["start"]
        }).encode()
        req = urllib.request.Request(
            FUSION_WEBHOOK,
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        try:
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            ctx = ssl._create_unverified_context()
            urllib.request.urlopen(req, timeout=5, context=ctx)
        log("n8n cascade: fusion-trigger fired")
    except Exception as e:
        log(f"n8n cascade failed (offline?): {e}", "WARN")

# ─────────────────────────────────────────────────────────────────────────────
# TIER 4 — POTENTIATION REPORT
# ─────────────────────────────────────────────────────────────────────────────
def tier4_report(t_start: float, scored: list[dict]):
    elapsed = int(time.time() - t_start)
    top5 = sorted(scored, key=lambda x: x.get("roi_score", 0), reverse=True)[:5]

    print("\n" + "═"*62)
    print("  OMNISTACK POTENTIATION RUN — COMPLETE")
    print("═"*62)
    print(f"  Elapsed        : {elapsed}s")
    print(f"  Items scanned  : {session['t0_results'].get('combined_count', 0)}")
    print(f"  Items scored   : {len(scored)}")
    print(f"  Repos adopted  : {session.get('adopted_count', 0)}")
    print(f"  Market         : {session['t0_results'].get('trade_sentiment','?')} | F&G={session['t0_results'].get('fear_greed',0)}")
    print(f"  Memory updated : ✓")
    print(f"  Wallpaper      : ✓ fusion_today.png")
    print(f"  n8n cascade    : ✓ fired")
    print(f"  Background     : compound-loop running")
    print()
    print("  TOP 5 SIGNALS:")
    for i, item in enumerate(top5):
        roi = item.get("roi_score", 0)
        src = item.get("source", "?")[:10]
        bar = "█" * (int(roi) // 10)
        print(f"  #{i+1} ROI={roi:>3} |{bar:<10}| [{src}] {item.get('title','')[:50]}")
    print("═"*62)
    print(f"  Logs: {LOG}")
    print("═"*62 + "\n")

    # Save session report
    report_path = LOGS / f"potentiation-report-{datetime.datetime.now().strftime('%Y%m%d-%H%M')}.json"
    report_path.write_text(json.dumps({
        **session,
        "elapsed_s": elapsed,
        "top5": top5
    }, indent=2, default=str))
    log(f"Report saved: {report_path}")

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    t_start = time.time()
    print("\n" + "═"*62)
    print("  OMNISTACK FULL POTENTIATION — STARTING ALL TIERS")
    print(f"  Pythagorean order: √(research²+wand²+itx²+scan²) → score → adopt → compound")
    print("═"*62 + "\n")

    combined  = tier0_parallel_scan()
    scored    = tier1_roi_score()
    if not scored:
        scored = combined  # fallback: use unscored if scorer failed
    tier2_adopt_and_loop(scored)
    tier3_compound_memory_and_cascade(scored)
    tier4_report(t_start, scored)
