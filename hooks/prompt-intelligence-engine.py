#!/usr/bin/env python3
"""
Prompt Intelligence Engine (PIE) — CMNDCENTER v1.0
UserPromptSubmit hook: runs before every Claude prompt.

Input:  JSON on stdin  {"prompt": "...", "cwd": "...", "session_id": "..."}
Output: context block on stdout → injected into Claude's active context

Transforms raw user input by injecting:
  • Optimal model recommendation
  • Auto-selected agent persona activation
  • Domain-specific enhancement instructions
  • Relevant compound memory / prior learnings
  • Suggested tool/skill chain
  • Pattern-registry context (if project recognized)

Design: must complete in < 2 seconds (hook timeout = 5s, leaving margin).
Uses only local computation — no LLM calls, no network.
"""

from __future__ import annotations
import json, os, re, sys, datetime
from pathlib import Path
from typing import Optional

# ── Paths ─────────────────────────────────────────────────────────────────────
CMNDCENTER      = Path(os.environ.get("CMNDCENTER", "/Users/nadirabaas/CMNDCENTER"))
INTELLIGENCE    = CMNDCENTER / "system" / "intelligence"
BLUEPRINTS      = CMNDCENTER / "system" / "blueprints"
KARPATHY_WRAPUP = Path.home() / ".amsa" / "memory" / "karpathy_wrapup.json"
MASTER_PROMPT   = Path.home() / "OMNISTACK" / "core" / "master-prompt.md"
AGENT_MANAGER   = Path.home() / "OMNISTACK" / "FUSION-MASTER" / "hub" / "agent-manager.py"
MP_AGENTS       = Path.home() / "OMNISTACK" / "FUSION-MASTER" / "hub" / "mini-project-agents.json"

# Core laws — always injected (read from master-prompt.md, cached here for speed)
CORE_LAWS = [
    "VS Code=control plane | Docker=runtime | n8n=orchestration",
    "Preserve stability · Enhance automation · No duplicates · Recursive orchestration",
    "3-vector min: memory + execution + automation",
]

MODEL_SEL   = INTELLIGENCE / "model-selector.json"
AGENT_ROUTE = INTELLIGENCE / "agent-router.json"
COMPOUND    = INTELLIGENCE / "compound-memory.json"
PATTERN_REG = BLUEPRINTS   / "pattern-registry.json"

# ── Load config (graceful — never crash the hook) ─────────────────────────────
def _load(path: Path) -> dict:
    try:
        return json.loads(path.read_text()) if path.exists() else {}
    except Exception:
        return {}

# ── Parse stdin ───────────────────────────────────────────────────────────────
def parse_input() -> tuple[str, str, str]:
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            return "", "", ""
        d = json.loads(raw)
        return (d.get("prompt", ""), d.get("cwd", ""), d.get("session_id", ""))
    except Exception:
        return "", "", ""

# ── Domain classifier ─────────────────────────────────────────────────────────
DOMAIN_SIGNALS = {
    "loki":       r"\bloki\b|37.agent|autonomous build|full build",
    "trading":    r"trading|crypto|signal|intellitradex|wand|market|portfolio|alpha",
    "ai":         r"\bml\b|model|train|llm|embedding|fine.tun|transformer|inference",
    "code":       r"python|typescript|javascript|\.py|\.ts|function|class|method|def |async |await ",
    "api":        r"\bapi\b|rest|graphql|endpoint|webhook|openapi|oauth|jwt|http",
    "frontend":   r"react|vue|next\.js|svelte|component|css|tailwind|ui |ux |frontend",
    "data":       r"pipeline|etl|stream|kafka|airflow|dbt|warehouse|database|schema|sql",
    "ops":        r"deploy|docker|kubernetes|k8s|ci/cd|github actions|terraform|devops|infra",
    "security":   r"security|vuln|xss|injection|csrf|owasp|auth|penetration",
    "architecture": r"architect|system design|blueprint|scalab|microservice|design pattern",
    "research":   r"research|investigate|competitive|landscape|market analysis|find out",
    "content":    r"copy|landing|seo|marketing|blog|brand|monetiz",
}

def classify_domain(prompt: str) -> str:
    p = prompt.lower()
    scores: dict[str, int] = {}
    for domain, pattern in DOMAIN_SIGNALS.items():
        matches = len(re.findall(pattern, p))
        if matches:
            scores[domain] = matches
    if not scores:
        return "general"
    return max(scores, key=scores.__getitem__)

# ── Complexity scorer ─────────────────────────────────────────────────────────
HIGH_SIGNALS = ["multiple", "entire", "all of", "system", "comprehensive", "full",
                "complete", "everything", "architecture", "redesign", "overhaul",
                "autonomous", "pipeline", "end to end", "integrate"]
LOW_SIGNALS  = ["show", "list", "check", "what is", "explain briefly", "status"]

def score_complexity(prompt: str) -> str:
    p = prompt.lower()
    word_count = len(prompt.split())
    high_hits  = sum(1 for s in HIGH_SIGNALS if s in p)
    low_hits   = sum(1 for s in LOW_SIGNALS  if s in p)

    if word_count > 150 or high_hits >= 2:
        return "deep"
    if high_hits >= 1 or word_count > 60:
        return "complex"
    if low_hits >= 1 or word_count < 12:
        return "simple"
    return "moderate"

# ── Model selector ────────────────────────────────────────────────────────────
def select_model(prompt: str, domain: str, complexity: str) -> tuple[str, str]:
    cfg = _load(MODEL_SEL)
    p = prompt.lower()

    for rule in cfg.get("intent_rules", []):
        if any(pat in p for pat in rule.get("patterns", [])):
            return rule["model"], rule.get("reason", "intent match")

    overrides = cfg.get("mode_overrides", {})
    if "```" in prompt or len(prompt.split()) > 300:
        return "opus", "long/complex prompt"
    if "loki" in p:
        return "opus", "Loki build pipeline"

    complexity_map = {"deep": "opus", "complex": "sonnet", "moderate": "sonnet", "simple": "haiku"}
    return complexity_map.get(complexity, "sonnet"), f"complexity:{complexity}"

# ── Agent router ──────────────────────────────────────────────────────────────
def route_agent(prompt: str, domain: str) -> Optional[dict]:
    cfg = _load(AGENT_ROUTE)
    p   = prompt.lower()
    best: Optional[dict] = None
    best_score = 0

    for route in cfg.get("primary_routes", []):
        score = sum(1 for t in route.get("triggers", []) if t in p)
        if score > best_score:
            best_score = score
            best = route

    if not best:
        best = cfg.get("fallback", {"agent": "system-architect",
                                    "activation": "ROUTE: @system-architect"})
    return best

# ── Pattern registry lookup ───────────────────────────────────────────────────
def get_registry_context(cwd: str) -> Optional[str]:
    try:
        reg = _load(PATTERN_REG)
        repos = reg.get("repos", {})
        cwd_path = cwd.lower()
        for repo_name, info in repos.items():
            if repo_name.lower() in cwd_path:
                domain = info.get("domain", "")
                role   = info.get("role", "")
                potentiates = ", ".join(info.get("potentiates", []))
                dom_info = reg.get("domains", {}).get(domain, {})
                agents   = ", ".join(dom_info.get("agents", []))
                patterns = ", ".join(dom_info.get("output_patterns", []))
                return (f"Active repo: {repo_name} | Domain: {domain} | Role: {role} | "
                        f"Agents: {agents} | Output patterns: {patterns} | "
                        f"Potentiates: {potentiates}")
    except Exception:
        pass
    return None

# ── Compound memory lookup ────────────────────────────────────────────────────
def get_compound_context(domain: str, complexity: str) -> list[str]:
    lines = []
    try:
        mem = _load(COMPOUND)
        global_learnings = mem.get("global_learnings", [])[:2]
        lines.extend(global_learnings)

        dom_mem = mem.get("domain_memory", {}).get(domain, {})
        patterns = dom_mem.get("effective_patterns", [])[:2]
        lines.extend(patterns)

        enhancement = (mem.get("prompt_enhancement_patterns", {})
                          .get("by_complexity", {})
                          .get(complexity, ""))
        if enhancement:
            lines.append(f"Enhancement: {enhancement}")

        domain_enh = (mem.get("prompt_enhancement_patterns", {})
                         .get("by_domain", {})
                         .get(domain, ""))
        if domain_enh:
            lines.append(f"Domain constraint: {domain_enh}")
    except Exception:
        pass
    return lines

# ── Karpathy memory ───────────────────────────────────────────────────────────
def get_karpathy_context() -> list[str]:
    try:
        if KARPATHY_WRAPUP.exists():
            data = json.loads(KARPATHY_WRAPUP.read_text())
            learnings = data.get("key_learnings", [])[:2]
            return [f"Prior session: {l}" for l in learnings if l]
    except Exception:
        pass
    return []

# ── Tool chain recommendation ─────────────────────────────────────────────────
def recommend_chain(domain: str, complexity: str, agent_name: str) -> str:
    chains = {
        "loki":         "loki --type {profile} → Aider commit → metrics-analyst",
        "code":         "Read(context) → Edit(implementation) → Bash(tests) → git commit",
        "architecture": "system-architect design → api-architect contracts → database-architect schema",
        "ai":           "ml-engineer design → python-expert impl → prompt-engineer tune → eval",
        "api":          "api-architect spec → backend-architect impl → security-engineer audit → deploy",
        "data":         "data-engineer pipeline → database-architect schema → metrics-analyst dashboard",
        "ops":          "devops-architect → deployment-engineer → security-engineer → monitor",
        "trading":      "WAND scout → IntelliTradeX signal → risk-gate → execute → measure",
        "research":     "deep-research-agent → market-researcher → product-manager → requirements",
        "security":     "security-engineer audit → dependency-auditor → code-reviewer → fix",
        "frontend":     "ux-researcher → frontend-architect → performance-engineer → deploy",
    }
    default = "Read → Analyze → Implement → Test → Commit"
    chain = chains.get(domain, default)

    if complexity == "deep":
        chain = "repomix (compress context) → " + chain
    return chain

# ── Update compound memory stats ─────────────────────────────────────────────
def update_stats(domain: str, model: str, agent_name: str) -> None:
    try:
        mem = _load(COMPOUND)
        idx = mem.setdefault("compound_index", {})
        idx.setdefault("most_used_agents", {})[agent_name] = \
            idx["most_used_agents"].get(agent_name, 0) + 1
        idx.setdefault("most_used_models", {})[model] = \
            idx["most_used_models"].get(model, 0) + 1
        idx.setdefault("domains_by_frequency", {})[domain] = \
            idx["domains_by_frequency"].get(domain, 0) + 1
        mem["_meta"]["total_prompts_processed"] = \
            mem.get("_meta", {}).get("total_prompts_processed", 0) + 1
        mem["_meta"]["last_updated"] = datetime.date.today().isoformat()
        COMPOUND.write_text(json.dumps(mem, indent=2))
    except Exception:
        pass

# ── Main output builder ───────────────────────────────────────────────────────
def build_context(prompt: str, cwd: str) -> str:
    if not prompt.strip():
        return ""

    domain     = classify_domain(prompt)
    complexity = score_complexity(prompt)
    model, model_reason = select_model(prompt, domain, complexity)
    agent_info = route_agent(prompt, domain)
    agent_name = agent_info.get("agent", "system-architect") if agent_info else "system-architect"
    agent_act  = agent_info.get("activation", "") if agent_info else ""
    chain      = recommend_chain(domain, complexity, agent_name)
    compound   = get_compound_context(domain, complexity)
    karpathy   = get_karpathy_context()
    reg_ctx    = get_registry_context(cwd)

    # ── Agent-manager sub-agent assignment (fast, no LLM, <100ms) ────────────
    assigned_agents: list[str] = []
    try:
        import importlib.util as _ilu
        _spec = _ilu.spec_from_file_location("am", str(AGENT_MANAGER))
        if _spec and _spec.loader:
            _am = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_am)          # type: ignore[attr-defined]
            _manifest = _am.assign(prompt, domain_override=domain, complexity_override=complexity)
            assigned_agents = [a["name"] for a in _manifest.get("agents", [])[:4]]
    except Exception:
        pass

    # ── Mini-project lead agent ───────────────────────────────────────────────
    mp_lead = ""
    try:
        _mp = json.loads(MP_AGENTS.read_text()) if MP_AGENTS.exists() else {}
        _match = next((v for k, v in _mp.items() if k.lower() in domain.lower()
                       or domain.lower() in (v.get("domain",""))), None)
        if _match:
            mp_lead = f"Mini-project lead: {_match.get('lead_agent','')}"
    except Exception:
        pass

    update_stats(domain, model, agent_name)

    lines = [
        f"╔═ PIE ═══════════════════════════════════════════════════",
        f"║ Domain: {domain:<12} Complexity: {complexity:<10} Model: {model} ({model_reason})",
        f"║ {agent_act}",
        f"║ Chain: {chain}",
    ]

    # Assigned sub-agents
    if assigned_agents:
        lines.append(f"║ Agents: {' → '.join(assigned_agents)}")

    if mp_lead:
        lines.append(f"║ {mp_lead}")

    if reg_ctx:
        lines.append(f"║ Repo: {reg_ctx}")

    if compound or karpathy:
        lines.append(f"║ Memory:")
        for item in (karpathy + compound)[:4]:
            lines.append(f"║   · {item}")

    # Core laws — always present, 1 line
    lines.append(f"║ Laws: {CORE_LAWS[0]}")

    lines.append(f"╚═══════════════════════════════════════════════════════")
    return "\n".join(lines)

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        prompt, cwd, session_id = parse_input()
        ctx = build_context(prompt, cwd)
        if ctx:
            print(ctx)
    except Exception:
        pass  # Never crash the hook — silent fail
    sys.exit(0)
