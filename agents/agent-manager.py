#!/usr/bin/env python3
"""
agent-manager.py — Master OMNISTACK Agent Manager
Auto-assigns sub-agents to any task by specialty, domain, and compound-learned patterns.

Algorithm:
  1. CLASSIFY: domain + complexity from task text (PIE engine)
  2. RECALL:   check compound-memory for past patterns matching this task
  3. SCORE:    potentiation-matrix selects orthogonal agent chain
  4. ASSIGN:   output JSON manifest of agents with task-specific prompts
  5. LEARN:    record assignment → outcome → update pattern confidence

Usage:
  python3 agent-manager.py "build a crypto signal scanner"
  python3 agent-manager.py --domain trading --complexity high "optimize freqtrade signals"
  python3 agent-manager.py --json "fix the auth bug in api/auth.py"
  python3 agent-manager.py --report           # show learned pattern confidence scores
"""
from __future__ import annotations
import os, sys, json, re, argparse, datetime
from pathlib import Path

HOME      = Path.home()
CMND      = HOME / "CMNDCENTER"
OMNI      = HOME / "OMNISTACK"
FUSION    = OMNI / "FUSION-MASTER"
MEMORY    = CMND / "system" / "intelligence" / "compound-memory.json"
REGISTRY  = CMND / "system" / "blueprints" / "pattern-registry.json"
AGENT_DB  = FUSION / "hub" / "agent-scores.json"
LOG       = CMND / "logs" / "agent-manager.log"
LOG.parent.mkdir(parents=True, exist_ok=True)

# ─── AGENT REGISTRY ──────────────────────────────────────────────────────────
# 37 Claude agents with capability vectors + specialty domains
# Format: name → {domains[], skills[], model, roi_weight, capability_vec}
AGENTS: dict[str, dict] = {
    # Tier 1 — Architecture
    "system-architect":       {"domains": ["build","ops","all"], "skills": ["architecture","design","scalability"], "model": "opus", "roi_w": 1.3, "phase": 2},
    "api-architect":          {"domains": ["api","code","build"], "skills": ["api","rest","graphql","openapi"], "model": "opus", "roi_w": 1.2, "phase": 2},
    "database-architect":     {"domains": ["data","api","build"], "skills": ["sql","schema","migrations","nosql"], "model": "opus", "roi_w": 1.2, "phase": 2},
    "frontend-architect":     {"domains": ["frontend","build"], "skills": ["react","ui","ux","typescript"], "model": "sonnet", "roi_w": 1.1, "phase": 2},
    # Tier 2 — Build
    "python-expert":          {"domains": ["code","ai","data","all"], "skills": ["python","scripts","automation","ml"], "model": "sonnet", "roi_w": 1.4, "phase": 3},
    "data-engineer":          {"domains": ["data","ops"], "skills": ["etl","pipelines","streaming","sql"], "model": "sonnet", "roi_w": 1.2, "phase": 3},
    "ml-engineer":            {"domains": ["ai","ml","trading"], "skills": ["training","inference","llm","embeddings"], "model": "opus", "roi_w": 1.4, "phase": 3},
    "integration-specialist": {"domains": ["ops","api","all"], "skills": ["webhooks","oauth","sdks","third-party"], "model": "sonnet", "roi_w": 1.1, "phase": 3},
    "backend-architect":      {"domains": ["api","code"], "skills": ["backend","servers","auth","databases"], "model": "sonnet", "roi_w": 1.2, "phase": 3},
    # Tier 3 — Quality
    "code-reviewer":          {"domains": ["all"], "skills": ["review","bugs","patterns","clean-code"], "model": "sonnet", "roi_w": 1.3, "phase": 4},
    "security-engineer":      {"domains": ["all"], "skills": ["auth","vulnerabilities","owasp","secrets"], "model": "opus", "roi_w": 1.4, "phase": 4},
    "quality-engineer":       {"domains": ["all"], "skills": ["testing","coverage","e2e","regression"], "model": "sonnet", "roi_w": 1.1, "phase": 4},
    "test-architect":         {"domains": ["code","all"], "skills": ["tdd","bdd","test-strategy","mocking"], "model": "sonnet", "roi_w": 1.1, "phase": 4},
    # Tier 4 — Deploy
    "devops-architect":       {"domains": ["ops","deploy"], "skills": ["docker","ci-cd","infra","monitoring"], "model": "sonnet", "roi_w": 1.2, "phase": 5},
    "deployment-engineer":    {"domains": ["ops","deploy"], "skills": ["kubernetes","helm","terraform","releases"], "model": "sonnet", "roi_w": 1.1, "phase": 5},
    # Tier 5 — Intelligence
    "deep-research":          {"domains": ["research","data","all"], "skills": ["research","analysis","synthesis","web"], "model": "opus", "roi_w": 1.3, "phase": 1},
    "market-researcher":      {"domains": ["research","content","trading"], "skills": ["market","trends","competitive","sizing"], "model": "opus", "roi_w": 1.2, "phase": 1},
    "requirements-analyst":   {"domains": ["build","research","all"], "skills": ["requirements","specs","user-stories","gaps"], "model": "opus", "roi_w": 1.2, "phase": 1},
    "product-manager":        {"domains": ["build","all"], "skills": ["prd","roadmap","prioritization","stakeholders"], "model": "sonnet", "roi_w": 1.1, "phase": 1},
    # Tier 6 — Monetize/Operate
    "monetization-strategist":{"domains": ["content","trading","build"], "skills": ["revenue","pricing","growth","ltv"], "model": "sonnet", "roi_w": 1.3, "phase": 6},
    "content-strategist":     {"domains": ["content","all"], "skills": ["copy","seo","brand","launch"], "model": "sonnet", "roi_w": 1.1, "phase": 6},
    "metrics-analyst":        {"domains": ["all"], "skills": ["kpis","dashboards","ab-testing","analytics"], "model": "sonnet", "roi_w": 1.2, "phase": 7},
    "pm-agent":               {"domains": ["all"], "skills": ["documentation","retrospectives","improvements"], "model": "sonnet", "roi_w": 1.0, "phase": 7},
    "self-review":            {"domains": ["all"], "skills": ["validation","reflection","correctness"], "model": "sonnet", "roi_w": 1.0, "phase": 7},
    # Tier 7 — Specialists
    "prompt-engineer":        {"domains": ["ai","all"], "skills": ["prompts","chain-of-thought","evals","dspy"], "model": "opus", "roi_w": 1.3, "phase": 3},
    "refactoring-expert":     {"domains": ["code"], "skills": ["refactor","debt","solid","clean"], "model": "sonnet", "roi_w": 1.1, "phase": 3},
    "root-cause-analyst":     {"domains": ["code","ops","all"], "skills": ["debugging","rca","incidents","fixes"], "model": "opus", "roi_w": 1.3, "phase": 3},
    "performance-engineer":   {"domains": ["code","ops"], "skills": ["perf","profiling","optimization","bottlenecks"], "model": "sonnet", "roi_w": 1.1, "phase": 3},
    "loki-coordinator":       {"domains": ["build","all"], "skills": ["orchestration","37-agents","full-build","phases"], "model": "opus", "roi_w": 1.5, "phase": 0},
    "dependency-auditor":     {"domains": ["code","ops"], "skills": ["cve","licenses","supply-chain","packages"], "model": "sonnet", "roi_w": 1.1, "phase": 4},
    "technical-writer":       {"domains": ["all"], "skills": ["docs","readme","guides","api-docs"], "model": "sonnet", "roi_w": 1.0, "phase": 7},
    "learning-guide":         {"domains": ["all"], "skills": ["explain","teach","examples","concepts"], "model": "sonnet", "roi_w": 0.9, "phase": 7},
}

# ─── DOMAIN CLASSIFIER ───────────────────────────────────────────────────────
DOMAIN_KEYWORDS = {
    "build":    ["build","create","product","saas","mvp","ship","scaffold","loki"],
    "code":     ["fix","debug","refactor","optimize","review","test","implement","function","class","bug"],
    "api":      ["api","endpoint","rest","graphql","route","webhook","openapi","auth"],
    "data":     ["pipeline","etl","ingest","sync","database","schema","migration","analytics"],
    "ai":       ["llm","model","prompt","embed","rag","agent","inference","fine-tune","dspy"],
    "ops":      ["deploy","docker","infra","ci","cd","kubernetes","terraform","monitor"],
    "trading":  ["trade","signal","crypto","pnl","backtest","strategy","freqtrade","arbitrage"],
    "content":  ["content","video","youtube","shorts","viral","script","seo","wand"],
    "research": ["research","find","analyze","scout","market","trend","what","how"],
    "frontend": ["ui","ux","react","component","page","layout","tailwind","next"],
    "ml":       ["train","dataset","embedding","vector","chroma","predict","alpha","qlib"],
}

COMPLEXITY_SIGNALS = {
    "simple":   ["fix typo","rename","add comment","update docs","single file","quick"],
    "moderate": ["add feature","new endpoint","new component","integrate","connect"],
    "complex":  ["build system","full product","architecture","deploy","all stacks","loki"],
}

def classify_task(text: str) -> tuple[str, str]:
    """Returns (domain, complexity)."""
    t = text.lower()
    # Domain — score each and pick highest
    scores = {d: sum(1 for k in kws if k in t) for d, kws in DOMAIN_KEYWORDS.items()}
    domain = max(scores, key=scores.get) if max(scores.values()) > 0 else "all"
    # Complexity
    for level, signals in COMPLEXITY_SIGNALS.items():
        if any(s in t for s in signals):
            return domain, level
    words = len(text.split())
    complexity = "simple" if words < 8 else "moderate" if words < 25 else "complex"
    return domain, complexity

# ─── COMPOUND LEARNING ───────────────────────────────────────────────────────
def load_agent_scores() -> dict:
    """Load learned agent performance scores from agent-scores.json."""
    default = {name: {"confidence": 0.75, "uses": 0, "successes": 0} for name in AGENTS}
    if AGENT_DB.exists():
        try:
            stored = json.loads(AGENT_DB.read_text())
            for name in default:
                if name in stored:
                    default[name].update(stored[name])
        except Exception:
            pass
    return default

def save_agent_scores(scores: dict):
    AGENT_DB.write_text(json.dumps(scores, indent=2))

def record_outcome(agents_used: list[str], success: bool):
    """Update compound-learned agent confidence scores. Call after task completes."""
    scores = load_agent_scores()
    for name in agents_used:
        if name in scores:
            scores[name]["uses"] += 1
            if success:
                scores[name]["successes"] += 1
            # Confidence: proportion of successes, bounded 0.5–0.99
            uses = scores[name]["uses"]
            wins = scores[name]["successes"]
            scores[name]["confidence"] = round(min(0.99, max(0.50, wins / max(uses, 1))), 4)
    save_agent_scores(scores)

# ─── AGENT SELECTOR ──────────────────────────────────────────────────────────
def select_agents(domain: str, complexity: str, task: str, scores: dict) -> list[str]:
    """
    Select optimal agent chain using:
    1. Domain + skill match (primary filter)
    2. Compound-learned confidence score (multiplier)
    3. Potentiation: always include memory + execution + automation coverage
    4. Phase ordering: respect P1→P7 sequence
    """
    task_lower = task.lower()
    candidates = []

    for name, info in AGENTS.items():
        # Domain match — accept agent if domain is "all" or matches
        domain_match = (domain in info["domains"] or "all" in info["domains"])
        # Skill match — bonus if any skill keyword appears in task
        skill_bonus = sum(1 for s in info["skills"] if s in task_lower)
        # Base score: roi_weight × confidence × domain_match + skill_bonus
        conf = scores.get(name, {}).get("confidence", 0.75)
        base = info["roi_w"] * conf * (1.5 if domain_match else 0.5) + skill_bonus * 0.2
        candidates.append((name, base, info["phase"]))

    # Sort by composite score descending
    candidates.sort(key=lambda x: x[1], reverse=True)

    # Pick agents based on complexity
    n_agents = {"simple": 2, "moderate": 4, "complex": 7}.get(complexity, 4)

    # Always include quality gate (code-reviewer + security-engineer) for complex tasks
    selected_names = [c[0] for c in candidates[:n_agents]]
    if complexity == "complex":
        for gate in ["code-reviewer", "security-engineer", "self-review"]:
            if gate not in selected_names:
                selected_names.append(gate)

    # Sort selected by phase to ensure correct execution order
    selected_names.sort(key=lambda n: AGENTS[n]["phase"])
    return selected_names

# ─── PROMPT GENERATOR ────────────────────────────────────────────────────────
def make_prompt(agent: str, task: str, domain: str, context: dict) -> str:
    """Generate a task-specific prompt for each assigned agent."""
    info = AGENTS[agent]
    skills_str = ", ".join(info["skills"][:4])
    past = context.get("past_pattern", "")
    past_note = f"\n\nRelevant past pattern: {past}" if past else ""
    model = info["model"]

    prompts = {
        "loki-coordinator": f"[LOKI BUILD] Domain={domain}. Full 7-phase build: {task}. Use all 37 agents. Compress context with repomix first. Model: {model}.{past_note}",
        "system-architect":  f"[ARCHITECTURE] Design the system architecture for: {task}. Domain: {domain}. Focus on: {skills_str}. Produce: component diagram + data flow + scalability notes.{past_note}",
        "python-expert":     f"[PYTHON BUILD] Implement: {task}. Domain: {domain}. Write production-ready Python, SOLID principles. No extra comments. Test locally.{past_note}",
        "code-reviewer":     f"[REVIEW] Adversarial review of the implementation for: {task}. Check: logic bugs, security, performance, edge cases. Block deploy if Blocker severity found.{past_note}",
        "security-engineer": f"[SECURITY] Audit for OWASP top 10 + secrets exposure for: {task}. Domain: {domain}. Flag any hardcoded credentials, injection vectors, or auth gaps.{past_note}",
        "deep-research":     f"[RESEARCH] Comprehensive research on: {task}. Domain: {domain}. Use adaptive strategy. Synthesize findings with confidence scores.{past_note}",
        "devops-architect":  f"[DEVOPS] Infrastructure + deployment for: {task}. Domain: {domain}. Output: Dockerfile + docker-compose + CI config + health checks.{past_note}",
        "ml-engineer":       f"[ML] ML/AI implementation for: {task}. Domain: {domain}. Focus: {skills_str}. Wire to LiteLLM:4000 + ChromaDB:8000.{past_note}",
        "data-engineer":     f"[DATA] Data pipeline for: {task}. Design: ingestion + transform + storage. Use existing: Supabase:54321 + Redis:6379.{past_note}",
        "metrics-analyst":   f"[METRICS] Analytics + KPIs for: {task}. Define success metrics, dashboards, A/B test plan. Feed results to compound-memory.{past_note}",
        "self-review":       f"[VALIDATE] Post-implementation check for: {task}. Verify: all requirements met, no regressions, tests pass, docs updated.{past_note}",
    }
    return prompts.get(agent,
        f"[{agent.upper()}] Task: {task}. Domain: {domain}. Apply expertise in {skills_str}. Produce concrete artifact. Model: {model}.{past_note}"
    )

# ─── MEMORY LOOKUP ───────────────────────────────────────────────────────────
def find_past_pattern(task: str) -> str:
    """Search compound-memory for the most relevant past pattern."""
    if not MEMORY.exists():
        return ""
    try:
        mem = json.loads(MEMORY.read_text())
        learnings = mem.get("global_learnings", [])
        task_words = set(task.lower().split())
        best, best_score = "", 0
        for entry in learnings:
            if not isinstance(entry, dict):
                continue
            entry_text = (entry.get("title", "") + " " + entry.get("domain", "")).lower()
            overlap = len(task_words & set(entry_text.split()))
            if overlap > best_score:
                best_score = overlap
                best = entry.get("title", "")[:100]
        return best if best_score >= 2 else ""
    except Exception:
        return ""

# ─── MAIN ASSIGNMENT ENGINE ──────────────────────────────────────────────────
def assign(task: str, domain_override: str = "", complexity_override: str = "") -> dict:
    """Full agent assignment pipeline. Returns assignment manifest."""
    domain, complexity = classify_task(task)
    if domain_override:
        domain = domain_override
    if complexity_override:
        complexity = complexity_override

    scores = load_agent_scores()
    past  = find_past_pattern(task)
    agents = select_agents(domain, complexity, task, scores)

    manifest = {
        "task": task,
        "domain": domain,
        "complexity": complexity,
        "assigned_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "past_pattern": past,
        "agents": []
    }

    for agent in agents:
        info = AGENTS[agent]
        conf = scores.get(agent, {}).get("confidence", 0.75)
        manifest["agents"].append({
            "name": agent,
            "model": info["model"],
            "phase": info["phase"],
            "confidence": conf,
            "skills": info["skills"][:4],
            "prompt": make_prompt(agent, task, domain, {"past_pattern": past}),
        })

    # Log assignment
    log_entry = f"[{manifest['assigned_at'][:19]}] domain={domain} complexity={complexity} agents={[a['name'] for a in manifest['agents']]} task={task[:60]}"
    with open(LOG, "a") as f:
        f.write(log_entry + "\n")

    return manifest

# ─── CLI ──────────────────────────────────────────────────────────────────────
def print_manifest(manifest: dict, json_mode: bool = False):
    if json_mode:
        print(json.dumps(manifest, indent=2))
        return

    agents = manifest["agents"]
    print(f"\n{'═'*60}")
    print(f"  OMNISTACK AGENT MANAGER — ASSIGNMENT")
    print(f"{'═'*60}")
    print(f"  Task       : {manifest['task'][:65]}")
    print(f"  Domain     : {manifest['domain']}")
    print(f"  Complexity : {manifest['complexity']}")
    if manifest.get("past_pattern"):
        print(f"  Past match : {manifest['past_pattern'][:65]}")
    print(f"\n  Assigned {len(agents)} agents (phase order):")
    print(f"  {'Phase':<7} {'Agent':<28} {'Model':<8} {'Confidence'}")
    print(f"  {'─'*55}")
    for a in agents:
        bar = "█" * int(a["confidence"] * 10)
        print(f"  P{a['phase']:<6} {a['name']:<28} {a['model']:<8} {a['confidence']:.0%} {bar}")
    print(f"\n  Execution prompts (for Claude Code / loki):")
    for a in agents:
        print(f"\n  [{a['name']}]")
        print(f"    {a['prompt'][:120]}")
    print(f"\n{'═'*60}\n")

def show_report():
    scores = load_agent_scores()
    print(f"\n{'═'*55}")
    print(f"  COMPOUND-LEARNED AGENT SCORES")
    print(f"{'═'*55}")
    ranked = sorted(scores.items(), key=lambda x: x[1]["confidence"], reverse=True)
    for name, s in ranked:
        bar = "█" * int(s["confidence"] * 10)
        print(f"  {name:<30} {s['confidence']:.0%} {bar} ({s['uses']} uses)")
    print(f"{'═'*55}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OMNISTACK Agent Manager")
    parser.add_argument("task", nargs="?", default="", help="Task description")
    parser.add_argument("--domain", "-d", default="", help="Force domain")
    parser.add_argument("--complexity", "-c", default="", help="Force complexity")
    parser.add_argument("--json", action="store_true", help="Output JSON manifest")
    parser.add_argument("--report", action="store_true", help="Show learned confidence scores")
    parser.add_argument("--record", nargs="+", help="Record outcome: agent1 agent2 ... --success/--fail")
    args = parser.parse_args()

    if args.report:
        show_report()
        sys.exit(0)

    if args.record:
        agents_used = [a for a in args.record if not a.startswith("--")]
        success = "--fail" not in args.record
        record_outcome(agents_used, success)
        print(f"Recorded outcome for {agents_used}: {'success' if success else 'fail'}")
        sys.exit(0)

    if not args.task:
        parser.print_help()
        sys.exit(1)

    manifest = assign(args.task, args.domain, args.complexity)
    print_manifest(manifest, args.json)
