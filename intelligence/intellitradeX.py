#!/usr/bin/env python3
"""IntelliTradeX — crypto signal scanner for OMNISTACK FUSION-MASTER.
Produces signals only. Never executes trades.
"""
import argparse
import json
import ssl
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    import certifi
    _SSL_CAFILE: str | None = certifi.where()
except ImportError:
    _SSL_CAFILE = None

HALT_PATHS = [
    Path.home() / "OMNISTACK" / ".HALT",
    Path.home() / "CMNDCENTER" / "intellitradeX" / ".HALT",
]
LAST_SCAN_PATH = Path.home() / "CMNDCENTER" / "intellitradeX" / "last_scan.json"

COINGECKO_IDS = [
    "bitcoin", "ethereum", "solana", "binancecoin", "ripple",
    "cardano", "avalanche-2", "polkadot", "chainlink", "dogecoin",
]
SYMBOL_MAP = {
    "bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL",
    "binancecoin": "BNB", "ripple": "XRP", "cardano": "ADA",
    "avalanche-2": "AVAX", "polkadot": "DOT", "chainlink": "LINK",
    "dogecoin": "DOGE",
}

def _halt_check(output_path: str | None) -> None:
    if any(p.exists() for p in HALT_PATHS):
        payload = {"halted": True}
        if output_path:
            Path(output_path).write_text(json.dumps(payload))
        print(json.dumps(payload))
        sys.exit(0)

def _fetch_json(url: str) -> dict:
    ctx = ssl.create_default_context(cafile=_SSL_CAFILE)
    req = urllib.request.Request(url, headers={"User-Agent": "IntelliTradeX/1.0"})
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        return json.loads(resp.read().decode())

def _fear_greed() -> tuple[int, str]:
    data = _fetch_json("https://api.alternative.me/fng/?limit=1")
    value = int(data["data"][0]["value"])
    classification = data["data"][0]["value_classification"]
    return value, classification

def _prices(ids: list[str]) -> dict:
    id_param = ",".join(ids)
    url = (
        "https://api.coingecko.com/api/v3/simple/price"
        f"?ids={id_param}&vs_currencies=usd&include_24hr_change=true"
    )
    return _fetch_json(url)

def _sentiment_label(fg: int) -> str:
    if fg <= 25:
        return "fear"
    if fg >= 75:
        return "greed"
    return "neutral"

def _build_signals(
    fg_value: int,
    price_data: dict,
    symbol_filter: list[str] | None,
    threshold: float,
) -> list[dict]:
    signals: list[dict] = []

    # Fear & Greed signals (market-wide)
    if fg_value < 20:
        sig = {
            "symbol": "MARKET",
            "signal_type": "divergence",
            "direction": "long",
            "strength": 0.8,
            "source": "fear_greed",
            "roi_potential": 72,
            "confidence": 0.78,
            "action": "alert",
            "reasoning": f"Extreme fear (F&G={fg_value}): contrarian long opportunity",
        }
        if sig["strength"] >= threshold:
            signals.append(sig)
    elif fg_value > 80:
        sig = {
            "symbol": "MARKET",
            "signal_type": "divergence",
            "direction": "short",
            "strength": 0.7,
            "source": "fear_greed",
            "roi_potential": 58,
            "confidence": 0.65,
            "action": "alert",
            "reasoning": f"Extreme greed (F&G={fg_value}): caution, potential reversal",
        }
        if sig["strength"] >= threshold:
            signals.append(sig)

    # Per-coin price signals
    for coin_id, sym in SYMBOL_MAP.items():
        if symbol_filter and sym not in symbol_filter:
            continue
        if coin_id not in price_data:
            continue
        coin = price_data[coin_id]
        change = coin.get("usd_24h_change", 0.0) or 0.0

        if change > 5.0:
            strength = min(0.6 + (change - 5.0) * 0.01, 0.95)
            sig = {
                "symbol": sym,
                "signal_type": "momentum",
                "direction": "long",
                "strength": round(strength, 3),
                "source": "trend_analysis",
                "roi_potential": int(45 + change * 2),
                "confidence": round(0.55 + (change - 5.0) * 0.005, 3),
                "action": "monitor" if strength < 0.75 else "alert",
                "reasoning": f"24h +{change:.1f}% momentum; price ${coin['usd']:,.2f}",
            }
            if sig["strength"] >= threshold:
                signals.append(sig)

        elif change < -8.0:
            strength = min(0.55 + abs(change + 8.0) * 0.01, 0.90)
            sig = {
                "symbol": sym,
                "signal_type": "trend",
                "direction": "neutral",
                "strength": round(strength, 3),
                "source": "volume_analysis",
                "roi_potential": int(40 + abs(change) * 1.5),
                "confidence": round(0.50 + abs(change + 8.0) * 0.005, 3),
                "action": "review",
                "reasoning": f"24h {change:.1f}% drop; potential mean-reversion setup at ${coin['usd']:,.2f}",
            }
            if sig["strength"] >= threshold:
                signals.append(sig)

    signals.sort(key=lambda s: s["strength"], reverse=True)
    return signals

def _write(path: str, data: dict) -> None:
    Path(path).write_text(json.dumps(data, indent=2))

def main() -> None:
    parser = argparse.ArgumentParser(description="IntelliTradeX signal scanner")
    parser.add_argument("--scan", action="store_true", required=True)
    parser.add_argument("--output", default=None)
    parser.add_argument("--symbols", nargs="+", default=None)
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    _halt_check(args.output)

    symbol_filter = [s.upper() for s in args.symbols] if args.symbols else None

    fg_value, fg_label = _fear_greed()
    ids_to_fetch = [
        cid for cid, sym in SYMBOL_MAP.items()
        if symbol_filter is None or sym in symbol_filter
    ]
    price_data = _prices(ids_to_fetch)

    signals = _build_signals(fg_value, price_data, symbol_filter, args.threshold)
    sentiment = _sentiment_label(fg_value)

    result = {
        "scan_time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "signals": signals,
        "market_sentiment": sentiment,
        "fear_greed_index": fg_value,
        "fear_greed_label": fg_label,
        "top_signal": signals[0] if signals else None,
    }

    if args.output:
        _write(args.output, result)
    LAST_SCAN_PATH.parent.mkdir(parents=True, exist_ok=True)
    _write(str(LAST_SCAN_PATH), result)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
