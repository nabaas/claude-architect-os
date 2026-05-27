"""
potentiation-matrix.py — FUSION-MASTER Pythagorean Potentiation Engine
Capability vectors: [intelligence, execution, memory, automation, monetization, content]
Potentiation: P(A,B) = roi(A) × roi(B) × orthogonality(A,B)
No external deps beyond stdlib + json + pathlib.
"""

import math
import json
from itertools import combinations
from pathlib import Path

# ─── CAPABILITY VECTORS ──────────────────────────────────────────────────────
# Dimensions: [intelligence, execution, memory, automation, monetization, content]

CAPABILITY_DIMENSIONS: dict[str, list[float]] = {
    "claude-code":      [1.0, 0.7, 0.3, 0.5, 0.4, 0.5],
    "litellm":          [0.8, 0.6, 0.1, 0.7, 0.3, 0.2],
    "n8n":              [0.3, 0.9, 0.2, 1.0, 0.5, 0.4],
    "chromadb":         [0.4, 0.3, 1.0, 0.5, 0.1, 0.1],
    "supabase":         [0.2, 0.5, 0.9, 0.6, 0.3, 0.1],
    "langgraph":        [0.9, 0.8, 0.5, 0.7, 0.3, 0.2],
    "dspy":             [1.0, 0.6, 0.4, 0.5, 0.2, 0.1],
    "freqtrade":        [0.5, 0.9, 0.3, 0.9, 1.0, 0.1],
    "hummingbot":       [0.4, 0.9, 0.2, 0.9, 1.0, 0.1],
    "qlib":             [0.8, 0.6, 0.7, 0.4, 0.9, 0.1],
    "openbb":           [0.7, 0.5, 0.6, 0.5, 0.8, 0.3],
    "the0":             [0.6, 0.7, 0.3, 0.8, 0.9, 0.2],
    "fenixai":          [0.7, 0.6, 0.4, 0.7, 0.9, 0.2],
    "loki":             [0.8, 1.0, 0.4, 0.9, 0.6, 0.5],
    "superclaude":      [1.0, 0.8, 0.5, 0.8, 0.4, 0.5],
    "repomix":          [0.6, 0.5, 0.8, 0.6, 0.2, 0.1],
    "aider":            [0.7, 0.9, 0.2, 0.8, 0.3, 0.1],
    "crewai":           [0.9, 0.8, 0.3, 0.8, 0.4, 0.3],
    "mem0":             [0.5, 0.3, 1.0, 0.6, 0.2, 0.2],
    "prefect":          [0.3, 0.8, 0.4, 1.0, 0.3, 0.1],
    "compound-loop":    [0.7, 0.6, 0.8, 0.9, 0.5, 0.3],
    "quick-scan":       [0.8, 0.7, 0.3, 0.7, 0.6, 0.2],
    "wand":             [0.6, 0.5, 0.4, 0.7, 0.5, 0.8],
    "intellitradeX":    [0.9, 0.8, 0.5, 0.8, 1.0, 0.2],
    "roi-brain":        [0.8, 0.6, 0.6, 0.7, 1.0, 0.3],
}

BASELINE_ROI: dict[str, float] = {
    "claude-code": 85, "litellm": 72, "n8n": 80, "chromadb": 65,
    "supabase": 70, "langgraph": 78, "dspy": 75, "freqtrade": 82,
    "hummingbot": 80, "qlib": 76, "openbb": 74, "the0": 78,
    "fenixai": 77, "loki": 88, "superclaude": 90, "repomix": 82,
    "aider": 79, "crewai": 76, "mem0": 68, "prefect": 72,
    "compound-loop": 83, "quick-scan": 75, "wand": 70,
    "intellitradeX": 87, "roi-brain": 86,
}

DOMAIN_ANCHORS: dict[str, list[float]] = {
    "trading":      [0.6, 0.8, 0.4, 0.8, 1.0, 0.1],
    "ml":           [1.0, 0.7, 0.6, 0.6, 0.3, 0.1],
    "ops":          [0.3, 0.9, 0.3, 1.0, 0.4, 0.2],
    "intel":        [0.9, 0.6, 0.7, 0.7, 0.7, 0.4],
    "code":         [0.8, 0.9, 0.4, 0.8, 0.3, 0.2],
    "content":      [0.6, 0.7, 0.4, 0.7, 0.6, 1.0],
    "memory":       [0.5, 0.3, 1.0, 0.6, 0.2, 0.2],
    "automation":   [0.4, 0.9, 0.3, 1.0, 0.5, 0.3],
}

DIMS = ["intelligence", "execution", "memory", "automation", "monetization", "content"]

# ─── CORE MATH ───────────────────────────────────────────────────────────────

def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))

def _norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v))

def cosine_similarity(a: list[float], b: list[float]) -> float:
    n_a, n_b = _norm(a), _norm(b)
    if n_a == 0 or n_b == 0:
        return 0.0
    return _dot(a, b) / (n_a * n_b)

def orthogonality(tool_a: str, tool_b: str) -> float:
    """Cosine distance [0,1]: 1.0 = perfectly orthogonal, 0.0 = identical."""
    va = CAPABILITY_DIMENSIONS.get(tool_a)
    vb = CAPABILITY_DIMENSIONS.get(tool_b)
    if va is None or vb is None:
        return 0.0
    return 1.0 - cosine_similarity(va, vb)

def _pythagorean_magnitude(vectors: list[list[float]]) -> float:
    """Pythagorean chain: √(Σ vᵢ²) across all dimensions."""
    combined = [0.0] * len(DIMS)
    for v in vectors:
        for i, x in enumerate(v):
            combined[i] += x * x
    return math.sqrt(sum(combined))

def potentiation_score(tools: list[str]) -> float:
    """
    Pythagorean potentiation for N tools.
    Score = (Pythagorean magnitude of capability vectors)
            × (mean pairwise orthogonality bonus)
            × (geometric mean of baseline ROIs / 100)
    """
    valid = [t for t in tools if t in CAPABILITY_DIMENSIONS]
    if not valid:
        return 0.0
    if len(valid) == 1:
        return BASELINE_ROI.get(valid[0], 50) * 1.0

    vectors = [CAPABILITY_DIMENSIONS[t] for t in valid]
    magnitude = _pythagorean_magnitude(vectors)

    pairs = list(combinations(valid, 2))
    mean_orth = sum(orthogonality(a, b) for a, b in pairs) / len(pairs)

    roi_product = 1.0
    for t in valid:
        roi_product *= BASELINE_ROI.get(t, 50) / 100.0
    geo_roi = roi_product ** (1.0 / len(valid))

    return round(magnitude * (1 + mean_orth) * geo_roi * 100, 2)

# ─── CHAIN OPTIMIZER ─────────────────────────────────────────────────────────

def _domain_relevance(tool: str, domain: str) -> float:
    anchor = DOMAIN_ANCHORS.get(domain)
    vec = CAPABILITY_DIMENSIONS.get(tool)
    if anchor is None or vec is None:
        return 0.0
    return cosine_similarity(vec, anchor)

def best_chain(task_domain: str, n: int = 4) -> list[str]:
    """
    Select top-N tools for domain that maximize potentiation score.
    Uses greedy insertion: at each step, add tool with highest marginal gain.
    Domain relevance threshold: cosine similarity ≥ 0.3 to domain anchor.
    """
    candidates = [
        t for t in CAPABILITY_DIMENSIONS
        if _domain_relevance(t, task_domain) >= 0.3
    ]
    if not candidates:
        candidates = list(CAPABILITY_DIMENSIONS.keys())

    candidates.sort(key=lambda t: _domain_relevance(t, task_domain), reverse=True)

    selected: list[str] = []
    remaining = list(candidates)

    seed = candidates[0]
    selected.append(seed)
    remaining.remove(seed)

    while len(selected) < n and remaining:
        best_tool = max(
            remaining,
            key=lambda t: potentiation_score(selected + [t])
        )
        selected.append(best_tool)
        remaining.remove(best_tool)

    return selected

# ─── REPORTING ───────────────────────────────────────────────────────────────

def potentiation_report(chain: list[str]) -> str:
    valid = [t for t in chain if t in CAPABILITY_DIMENSIONS]
    lines = [
        "=" * 60,
        f"POTENTIATION REPORT — {len(valid)}-tool chain",
        "=" * 60,
    ]

    for tool in valid:
        vec = CAPABILITY_DIMENSIONS[tool]
        dominant = DIMS[vec.index(max(vec))]
        roi = BASELINE_ROI.get(tool, 50)
        lines.append(f"  {tool:<20} ROI={roi:>3}  dominant={dominant}")

    lines.append("")
    lines.append("Pairwise Orthogonality Matrix:")
    pairs = list(combinations(valid, 2))
    for a, b in pairs:
        orth = orthogonality(a, b)
        bar = "#" * int(orth * 20)
        lines.append(f"  {a} ⊥ {b:<20} {orth:.3f} |{bar:<20}|")

    lines.append("")
    score = potentiation_score(valid)
    lines.append(f"Chain Potentiation Score: {score:.2f}")

    mean_orth = sum(orthogonality(a, b) for a, b in pairs) / max(len(pairs), 1)
    additive = sum(BASELINE_ROI.get(t, 50) for t in valid)
    lines.append(f"Additive baseline sum:    {additive}")
    lines.append(f"Mean orthogonality:       {mean_orth:.3f}")
    lines.append(f"Pythagorean multiplier:   {score / max(additive, 1):.3f}x vs naive sum")

    lines.append("")
    lines.append("Why these tools multiply:")
    dim_coverage = {d: 0.0 for d in DIMS}
    for t in valid:
        for i, d in enumerate(DIMS):
            dim_coverage[d] = max(dim_coverage[d], CAPABILITY_DIMENSIONS[t][i])
    for d, v in sorted(dim_coverage.items(), key=lambda x: -x[1]):
        bar = "#" * int(v * 20)
        lines.append(f"  {d:<16} coverage={v:.2f} |{bar:<20}|")

    lines.append("=" * 60)
    return "\n".join(lines)

# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python potentiation-matrix.py chain <domain> [n]")
        print("  python potentiation-matrix.py score <tool1> <tool2> ...")
        print("  python potentiation-matrix.py orth <tool_a> <tool_b>")
        print(f"\nDomains: {', '.join(DOMAIN_ANCHORS)}")
        print(f"Tools:   {', '.join(CAPABILITY_DIMENSIONS)}")
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "chain":
        domain = sys.argv[2] if len(sys.argv) > 2 else "ops"
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
        chain = best_chain(domain, n)
        print(potentiation_report(chain))

    elif cmd == "score":
        tools = sys.argv[2:]
        score = potentiation_score(tools)
        print(f"Potentiation score for {tools}: {score}")

    elif cmd == "orth":
        if len(sys.argv) < 4:
            print("Usage: orth <tool_a> <tool_b>")
        else:
            print(f"Orthogonality({sys.argv[2]}, {sys.argv[3]}): {orthogonality(sys.argv[2], sys.argv[3]):.4f}")

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
