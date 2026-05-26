#!/usr/bin/env python3
"""
research-aggregator.py — FUSION-MASTER intelligence pipeline
Pulls from: GitHub Trending, HackerNews, ProductHunt, Perplexity, OpenAI
Scores via ROI Brain formula, outputs JSON consumed by n8n workflows.

Modes:
  --mode research   → focused AI/ML/SaaS signals (research-sweep workflow)
  --mode refresh    → broad full-stack intelligence (full-refresh workflow)
  --mode overnight  → deep scrape for self-intelligence loop (3am)
  --output <path>   → output JSON path (default: /tmp/research-results.json)
"""

import os
import sys
import json
import time
import argparse
import datetime
import hashlib
import ssl
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from typing import Optional

def _urlopen(url_or_req, headers=None, timeout=15):
    """urlopen accepting either a URL string or Request object, with macOS SSL fallback."""
    if isinstance(url_or_req, str):
        req = urllib.request.Request(url_or_req, headers=headers or {"User-Agent": "FUSION-MASTER/1.0"})
    else:
        req = url_or_req  # already a Request object
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except Exception:
        ctx = ssl._create_unverified_context()
        return urllib.request.urlopen(req, timeout=timeout, context=ctx)

# ── optional deps (graceful fallback if missing) ──────────────────────────────
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    from supabase import create_client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False

# ── env ───────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY   = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY      = os.environ.get("OPENAI_API_KEY", "")
PERPLEXITY_API_KEY  = os.environ.get("PERPLEXITY_API_KEY", "")
GITHUB_TOKEN        = os.environ.get("GITHUB_TOKEN", "")
SUPABASE_URL        = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
FIRECRAWL_API_KEY   = os.environ.get("FIRECRAWL_API_KEY", "")

# ── ROI scoring weights (mirrors hub/roi-algorithm.md) ────────────────────────
DOMAIN_MULTIPLIERS = {
    "ai": 1.4, "saas": 1.3, "crypto": 1.25, "content": 1.1,
    "automation": 1.2, "data": 1.15, "ops": 1.05, "general": 1.0,
}
TOPIC_KEYWORDS = {
    "ai": ["llm", "claude", "gpt", "agent", "rag", "embedding", "langchain",
           "anthropic", "openai", "mistral", "gemini", "inference", "fine-tun"],
    "saas": ["saas", "b2b", "stripe", "subscription", "mrr", "arr", "indie",
             "product hunt", "launch", "waitlist"],
    "automation": ["n8n", "workflow", "automate", "pipeline", "trigger",
                   "scheduler", "cron", "webhook"],
    "crypto": ["bitcoin", "ethereum", "defi", "nft", "web3", "token",
               "blockchain", "trading", "arbitrage"],
    "data": ["supabase", "postgres", "redis", "vector", "chroma", "pinecone",
             "embedding", "analytics", "dashboard"],
}


def _classify_domain(text: str) -> str:
    text_lower = text.lower()
    for domain, keywords in TOPIC_KEYWORDS.items():
        if any(k in text_lower for k in keywords):
            return domain
    return "general"


def _roi_score(item: dict) -> int:
    stars    = min(item.get("stars", 0) / 100, 10)
    recency  = 10 if item.get("fresh", True) else 5
    relevance = item.get("relevance", 7)
    confidence = item.get("confidence", 6)
    mult     = DOMAIN_MULTIPLIERS.get(item.get("domain", "general"), 1.0)

    raw = (relevance * 0.35 + recency * 0.25 + stars * 0.20
           + confidence * 0.15 + 5 * 0.05) * 10
    return min(100, int(raw * mult))


# ── GitHub Trending ────────────────────────────────────────────────────────────
def scrape_github_trending(language: str = "", since: str = "daily") -> list[dict]:
    url = f"https://github.com/trending/{urllib.parse.quote(language)}?since={since}"
    headers = {"Accept": "text/html", "User-Agent": "FUSION-MASTER/1.0"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with _urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[GH-trending] {e}", file=sys.stderr)
        return []

    items = []
    # simple extraction — no BeautifulSoup required
    for block in html.split('<article class="Box-row">')[1:]:
        try:
            repo_path = block.split('<a href="')[1].split('"')[0].strip("/")
            desc_raw  = block.split('<p class="col-9')[1].split(">", 1)[1].split("</p>")[0].strip() if '<p class="col-9' in block else ""
            stars_raw = block.split("aria-label=\"Stargazers\"")[1].split(">")[1].split("<")[0].strip().replace(",", "") if "aria-label=\"Stargazers\"" in block else "0"
            stars     = int(stars_raw) if stars_raw.isdigit() else 0
            url_full  = f"https://github.com/{repo_path}"
            title     = repo_path.replace("/", " / ")
            domain    = _classify_domain(f"{title} {desc_raw}")
            items.append({
                "id":         hashlib.md5(url_full.encode()).hexdigest()[:12],
                "title":      title,
                "url":        url_full,
                "description": desc_raw[:200],
                "stars":      stars,
                "source":     "github_trending",
                "type":       "repo",
                "domain":     domain,
                "fresh":      True,
                "relevance":  9 if domain == "ai" else 7,
                "confidence": 8,
                "ts":         datetime.datetime.utcnow().isoformat(),
            })
        except Exception:
            continue
    return items[:20]


# ── Hacker News (Algolia API — no key needed) ─────────────────────────────────
def scrape_hacker_news(query: str = "AI agent LLM automation", pages: int = 1) -> list[dict]:
    results = []
    for page in range(pages):
        encoded = urllib.parse.quote(query)
        api_url = (f"https://hn.algolia.com/api/v1/search?query={encoded}"
                   f"&tags=story&hitsPerPage=20&page={page}&numericFilters=points>50")
        try:
            req = urllib.request.Request(api_url, headers={"User-Agent": "FUSION-MASTER/1.0"})
            with _urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"[HN] {e}", file=sys.stderr)
            break

        for hit in data.get("hits", []):
            url_val = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
            title   = hit.get("title", "")
            domain  = _classify_domain(title)
            points  = hit.get("points", 0)
            results.append({
                "id":         hashlib.md5(url_val.encode()).hexdigest()[:12],
                "title":      title,
                "url":        url_val,
                "description": f"HN points: {points} | comments: {hit.get('num_comments', 0)}",
                "stars":      points // 10,
                "source":     "hacker_news",
                "type":       "article",
                "domain":     domain,
                "fresh":      True,
                "relevance":  8 if domain in ("ai", "saas") else 6,
                "confidence": 7,
                "ts":         datetime.datetime.utcnow().isoformat(),
            })
    return results


# ── GitHub Search API ─────────────────────────────────────────────────────────
def search_github_repos(queries: list[str], min_stars: int = 50) -> list[dict]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "FUSION-MASTER/1.0"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    results = []
    for q in queries:
        encoded = urllib.parse.quote(f"{q} stars:>{min_stars} pushed:>2026-01-01")
        api_url = f"https://api.github.com/search/repositories?q={encoded}&sort=stars&per_page=10"
        req = urllib.request.Request(api_url, headers=headers)
        try:
            with _urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"[GH-search] {q}: {e}", file=sys.stderr)
            continue

        for repo in data.get("items", []):
            domain = _classify_domain(f"{repo['name']} {repo.get('description', '')}")
            results.append({
                "id":         hashlib.md5(repo["html_url"].encode()).hexdigest()[:12],
                "title":      repo["full_name"],
                "url":        repo["html_url"],
                "description": repo.get("description", "")[:200],
                "stars":      repo.get("stargazers_count", 0),
                "source":     "github_search",
                "type":       "repo",
                "domain":     domain,
                "fresh":      True,
                "relevance":  9 if domain == "ai" else 7,
                "confidence": 8,
                "ts":         datetime.datetime.utcnow().isoformat(),
                "language":   repo.get("language", ""),
            })
        time.sleep(0.5)  # GH rate limit
    return results


# ── Perplexity API ────────────────────────────────────────────────────────────
def query_perplexity(queries: list[str]) -> list[dict]:
    if not PERPLEXITY_API_KEY:
        print("[Perplexity] no key — skipping", file=sys.stderr)
        return []

    results = []
    api_url = "https://api.perplexity.ai/chat/completions"

    for q in queries:
        payload = json.dumps({
            "model": "sonar",
            "messages": [
                {"role": "system", "content": "You are a research assistant. Return JSON array of {title, url, description, domain} for the top 5 most relevant findings."},
                {"role": "user",   "content": q}
            ],
            "return_related_questions": False,
            "return_images": False,
        }).encode()

        req = urllib.request.Request(
            api_url,
            data=payload,
            headers={
                "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "FUSION-MASTER/1.0",
            },
            method="POST",
        )
        try:
            with _urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read())
            text = data["choices"][0]["message"]["content"]
            # extract JSON block
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "[" in text:
                text = text[text.index("["):text.rindex("]") + 1]
            items = json.loads(text)
            for item in items:
                url_val = item.get("url", "")
                results.append({
                    "id":         hashlib.md5((url_val + q).encode()).hexdigest()[:12],
                    "title":      item.get("title", q[:60]),
                    "url":        url_val,
                    "description": item.get("description", "")[:200],
                    "stars":      0,
                    "source":     "perplexity",
                    "type":       "article" if "github.com" not in url_val else "repo",
                    "domain":     item.get("domain") or _classify_domain(item.get("title", "")),
                    "fresh":      True,
                    "relevance":  8,
                    "confidence": 7,
                    "ts":         datetime.datetime.utcnow().isoformat(),
                })
        except Exception as e:
            print(f"[Perplexity] {q[:40]}: {e}", file=sys.stderr)
        time.sleep(1)
    return results


# ── OpenAI research synthesis ─────────────────────────────────────────────────
def synthesize_with_openai(items: list[dict], mode: str) -> list[dict]:
    if not (HAS_OPENAI and OPENAI_API_KEY):
        return items

    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    top_titles = [i["title"] for i in items[:15]]
    prompt = (
        f"Mode: {mode}. Given these signals: {json.dumps(top_titles)}. "
        "For each, estimate relevance (0-10) for an AI/SaaS builder in 2026. "
        "Return JSON array [{title, relevance_score, reason}]. Be terse."
    )
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.2,
        )
        text = resp.choices[0].message.content or ""
        if "[" in text:
            text = text[text.index("["):text.rindex("]") + 1]
        scores = {s["title"]: s.get("relevance_score", 7) for s in json.loads(text)}
        for item in items:
            if item["title"] in scores:
                item["relevance"] = scores[item["title"]]
                item["openai_scored"] = True
    except Exception as e:
        print(f"[OpenAI-synth] {e}", file=sys.stderr)
    return items


# ── Claude synthesis (final ranking pass) ─────────────────────────────────────
def synthesize_with_claude(items: list[dict], mode: str) -> list[dict]:
    if not (HAS_ANTHROPIC and ANTHROPIC_API_KEY):
        return items

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    top = items[:20]
    prompt = (
        f"Mode: {mode}. Rank these research items for an autonomous AI builder system in 2026. "
        "Focus on: adoptability, compounding value, automation potential. "
        f"Items: {json.dumps([{k: v for k, v in i.items() if k in ('title','description','domain','stars','source')} for i in top])}. "
        "Return JSON array [{title, final_score (0-100), action}] where action is one of: "
        "adopt_repo | research_more | build_prototype | monitor | skip. Be terse."
    )
    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text
        if "[" in text:
            text = text[text.index("["):text.rindex("]") + 1]
        rankings = {r["title"]: r for r in json.loads(text)}
        for item in items:
            if item["title"] in rankings:
                r = rankings[item["title"]]
                item["claude_score"]  = r.get("final_score", item.get("roi_score", 60))
                item["action"]        = r.get("action", "monitor")
    except Exception as e:
        print(f"[Claude-synth] {e}", file=sys.stderr)
    return items


# ── Dedup + final ROI scoring ─────────────────────────────────────────────────
def deduplicate(items: list[dict]) -> list[dict]:
    seen_ids = set()
    seen_urls = set()
    out = []
    for item in items:
        if item["id"] in seen_ids or (item["url"] and item["url"] in seen_urls):
            continue
        seen_ids.add(item["id"])
        if item["url"]:
            seen_urls.add(item["url"])
        out.append(item)
    return out


def apply_roi_scores(items: list[dict]) -> list[dict]:
    for item in items:
        base = _roi_score(item)
        claude_boost = item.get("claude_score", 0)
        item["roi_score"] = max(base, claude_boost) if claude_boost else base
    return sorted(items, key=lambda x: x["roi_score"], reverse=True)


# ── Mode query sets ───────────────────────────────────────────────────────────
MODE_QUERIES = {
    "research": {
        "github_search": ["claude agent autonomous", "llm pipeline automation",
                          "ai saas starter", "n8n workflow ai"],
        "hn":            ["AI agent 2026", "LLM automation tools"],
        "perplexity":    ["best new AI repos GitHub trending 2026",
                          "most promising AI SaaS tools this week"],
    },
    "refresh": {
        "github_search": ["ai automation 2026", "saas boilerplate ai",
                          "autonomous agent framework", "vector search embedding"],
        "hn":            ["Show HN 2026 AI", "new AI productivity tools"],
        "perplexity":    ["AI developer tools 2026 new releases",
                          "hot GitHub repositories AI automation May 2026"],
    },
    "overnight": {
        "github_search": ["ai agent framework stars:>100", "llm tool calling",
                          "autonomous coding agent", "ai scraper pipeline",
                          "saas template nextjs ai", "trading bot ai 2026"],
        "hn":            ["AI agent 2026", "new LLM tools", "AI SaaS indie hacker"],
        "perplexity":    ["biggest AI breakthroughs this week",
                          "best new open source AI tools 2026",
                          "AI loopholes hacks productivity compounding"],
    },
}


# ── Main ──────────────────────────────────────────────────────────────────────
def run(mode: str, output: str, min_score: int = 0) -> list[dict]:
    print(f"[research-aggregator] mode={mode} output={output}", file=sys.stderr)
    queries = MODE_QUERIES.get(mode, MODE_QUERIES["research"])

    all_items: list[dict] = []

    # 1. GitHub Trending (no key required)
    print("[research-aggregator] scraping GitHub Trending…", file=sys.stderr)
    all_items += scrape_github_trending("Python", "daily")
    all_items += scrape_github_trending("TypeScript", "daily")
    if mode == "overnight":
        all_items += scrape_github_trending("", "weekly")

    # 2. Hacker News
    print("[research-aggregator] scraping Hacker News…", file=sys.stderr)
    for q in queries["hn"]:
        all_items += scrape_hacker_news(q)
        time.sleep(0.3)

    # 3. GitHub Search API
    print("[research-aggregator] searching GitHub API…", file=sys.stderr)
    all_items += search_github_repos(queries["github_search"])

    # 4. Perplexity (if key set)
    if PERPLEXITY_API_KEY:
        print("[research-aggregator] querying Perplexity…", file=sys.stderr)
        all_items += query_perplexity(queries["perplexity"])

    # 5. Dedup + initial ROI scoring
    all_items = deduplicate(all_items)
    all_items = apply_roi_scores(all_items)

    # 6. OpenAI relevance pass (optional)
    all_items = synthesize_with_openai(all_items, mode)

    # 7. Claude final ranking (optional)
    all_items = synthesize_with_claude(all_items, mode)

    # 8. Re-score after AI passes, filter
    all_items = apply_roi_scores(all_items)
    if min_score > 0:
        all_items = [i for i in all_items if i["roi_score"] >= min_score]

    print(f"[research-aggregator] {len(all_items)} items → {output}", file=sys.stderr)
    Path(output).write_text(json.dumps(all_items, indent=2))
    return all_items


def main():
    parser = argparse.ArgumentParser(description="FUSION-MASTER research aggregator")
    parser.add_argument("--mode",      default="research",
                        choices=["research", "refresh", "overnight"])
    parser.add_argument("--output",    default="/tmp/research-results.json")
    parser.add_argument("--min-score", type=int, default=0)
    args = parser.parse_args()

    results = run(args.mode, args.output, args.min_score)
    top3 = [f"  [{r['roi_score']}] {r['title']}" for r in results[:3]]
    print(f"Top results:\n" + "\n".join(top3))


if __name__ == "__main__":
    main()
