#!/usr/bin/env python3
"""Layer 4 — Data Scout Engine: run all opportunity scanners."""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

SCOUT_DIR = Path(__file__).parent
QUEUE_DIR = Path.home() / ".amsa" / "linear-queue"
QUEUE_DIR.mkdir(parents=True, exist_ok=True)

SCOUTS = [
    "crypto-flow.py",
    "flip-scanner.py",
    "wand-outlier.py",
    "repo-intel.py",
]

def run_scout(name):
    script = SCOUT_DIR / name
    if not script.exists():
        return {"scout": name, "status": "missing", "signals": []}
    try:
        result = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=60
        )
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            data = {"raw": result.stdout[:500]}
        return {"scout": name, "status": "ok", "signals": data}
    except subprocess.TimeoutExpired:
        return {"scout": name, "status": "timeout", "signals": []}
    except Exception as e:
        return {"scout": name, "status": "error", "error": str(e), "signals": []}

def main():
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    print(f"[scout] Running all scouts at {ts}")

    results = [run_scout(s) for s in SCOUTS]

    all_signals = []
    for r in results:
        status = r["status"]
        symbol = "✓" if status == "ok" else "✗" if status == "error" else "?"
        print(f"  {symbol} {r['scout']}: {status}")
        if isinstance(r.get("signals"), list):
            all_signals.extend(r["signals"])

    output = {
        "timestamp": ts,
        "scouts_run": len(SCOUTS),
        "total_signals": len(all_signals),
        "results": results,
        "signals": all_signals,
    }

    out_path = QUEUE_DIR / f"opportunities-{datetime.now().strftime('%Y-%m-%d')}.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n[scout] {len(all_signals)} signals → {out_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
