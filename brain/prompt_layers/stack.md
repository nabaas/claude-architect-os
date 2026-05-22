# brain/prompt_layers/stack.md
# Complete Prompt Inheritance System — 7-Layer Stack
# Claude Architect OS v4.0

## Overview

The prompt stack is a structured inheritance hierarchy. Each layer inherits all context
from layers above it and adds specificity. Higher layers are loaded less frequently but
persist longer. Lower layers are ephemeral and task-specific.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: SYSTEM      (identity, always active)             │
│  └─ Layer 2: MISSION  (goal, session-scoped)                │
│     └─ Layer 3: ROLE  (agent persona, task-scoped)          │
│        └─ Layer 4: TASK (specific work unit)                │
│           └─ Layer 5: CONTEXT (relevant state)              │
│              └─ Layer 6: MEMORY (recalled patterns)         │
│                 └─ Layer 7: LIVE-DATA (real-time signals)   │
└─────────────────────────────────────────────────────────────┘
```

Each layer can override specific fields from parent layers. Fields not overridden
are inherited verbatim. The final prompt sent to any model is the composed result
of all 7 layers, collapsed into a single structured string.

---

## Layer Specifications

### Layer 1: SYSTEM

**Purpose:** Establishes the permanent identity and non-negotiable operating principles.

**Scope:** Always active. Never changes within a deployment version. Inherited by all layers.

**Source:** `brain/core_identity/system.md`

**Contents:**
- Identity declaration (not a chatbot, operational intelligence system)
- Core capabilities list
- Operating principles (P1-P8)
- Output format standards
- Memory protocol
- Orchestration rules

**Compose rule:** This layer is always prepended first. It is never overridden. It may be
*extended* by lower layers but never contradicted.

**Template:**
```xml
<system_prompt version="{version}">
  {full content of brain/core_identity/system.md}
</system_prompt>
```

**Loading mechanism:**
```bash
SYSTEM_LAYER=$(cat brain/core_identity/system.md)
```

---

### Layer 2: MISSION

**Purpose:** Defines the current session's overarching goal, success criteria, and constraints.

**Scope:** Session-scoped. Set once at session start. May be updated mid-session if objective changes.

**Contents:**
- Primary objective for this session
- Success criteria (measurable, time-bounded)
- Hard constraints (budget, time, technology)
- Priority ordering of competing objectives
- Stakeholder context

**Compose rule:** Appended after SYSTEM. If mission conflicts with operating principles, operating
principles win. Mission sets the *direction*, principles set the *guardrails*.

**Template:**
```xml
<mission session_id="{session_id}">
  <objective>{primary_goal}</objective>
  <success_criteria>
    <criterion id="1">{measurable_outcome_1}</criterion>
    <criterion id="2">{measurable_outcome_2}</criterion>
  </success_criteria>
  <constraints>
    <budget_usd>{budget}</budget_usd>
    <time_horizon>{timeframe}</time_horizon>
    <tech_constraints>{tech_limits}</tech_constraints>
  </constraints>
  <priority_order>{p1} > {p2} > {p3}</priority_order>
</mission>
```

**Use case examples:**
- `profit-systems`: "Generate $10K MRR in 90 days via automated digital product sales"
- `flips`: "Identify and execute 5 arbitrage flips this week with >40% margin each"
- `automation`: "Eliminate all manual daily reporting tasks by end of month"

---

### Layer 3: ROLE

**Purpose:** Activates a specific agent persona with domain expertise and specialized output behavior.

**Scope:** Task-scoped. Changes when the active agent changes (e.g., when Loki Mode hands off between phases).

**Source:** `agents/registry.json` — each agent's systemPromptPath

**Contents:**
- Agent identity and domain expertise
- Specific output format requirements for this agent
- Tools and capabilities available to this agent
- Quality gates this agent must pass before handoff
- Interaction style (technical depth, brevity, etc.)

**Compose rule:** Inherits SYSTEM + MISSION. Overrides output format standards if agent requires
a specialized format. Never overrides operating principles or identity.

**Template:**
```xml
<role agent_id="{agent_id}" phase="{phase}">
  <persona>{agent_name} — {domain_expertise_summary}</persona>
  <specialization>{specific_domain_skills}</specialization>
  <output_contract>
    <format>{required_output_format}</format>
    <required_fields>{field_list}</required_fields>
    <quality_gate>{completion_criteria}</quality_gate>
  </output_contract>
  <tools_available>{tool_list}</tools_available>
  <handoff_target>{next_agent_id}</handoff_target>
</role>
```

**Use case examples:**
- `market_analysis`: Role = market-researcher, outputs structured opportunity JSON
- `research`: Role = deep-research-agent, outputs synthesis report with citations
- `execution`: Role = deployment-engineer, outputs deployment manifest + health checks

---

### Layer 4: TASK

**Purpose:** The specific unit of work. Concrete, bounded, time-limited.

**Scope:** Single task or subtask within a session. Multiple tasks may execute per session.

**Contents:**
- Exact task description with clear deliverables
- Input specification (what data/files/context is provided)
- Output specification (exact format, destination, acceptance criteria)
- Timeout and cost limits for this specific task
- Dependency declaration (what must exist before this task runs)

**Compose rule:** Inherits all above. Overrides nothing. Provides the concrete "what to do now."
The most specific layer — all prior context exists to enable this task.

**Template:**
```xml
<task id="{task_id}" priority="{priority}">
  <description>{exact_task_description}</description>
  <inputs>
    <input type="{type}" source="{source}">{input_detail}</input>
  </inputs>
  <outputs>
    <output type="{type}" destination="{destination}">{output_spec}</output>
  </outputs>
  <acceptance_criteria>{done_definition}</acceptance_criteria>
  <timeout_ms>{timeout}</timeout_ms>
  <cost_limit_usd>{limit}</cost_limit_usd>
  <dependencies>{dep_task_ids}</dependencies>
</task>
```

**Use case examples:**
- `profit-systems`: "Build Stripe payment endpoint for digital product checkout in < 2 hours"
- `automation`: "Write n8n workflow to auto-post TikTok clips at peak hours, given CSV of content"
- `flips`: "Score these 50 eBay listings against current Amazon prices, output JSON"

---

### Layer 5: CONTEXT

**Purpose:** Provides the relevant state of the world — what is true right now that the model
needs to know to execute the task correctly.

**Scope:** Task-scoped. Regenerated for each task. Context is assembled from multiple sources.

**Contents:**
- Current codebase state (relevant files, recent commits)
- Active system state (running services, deployed versions)
- Relevant prior decisions from this session
- Related artifacts produced earlier in this session
- Any configuration or environment specifics

**Compose rule:** Context is *curated*, not dumped. Only include what is directly relevant
to the current task. Use Repomix to compress codebase context. Target < 30K tokens total.

**Template:**
```xml
<context assembled_at="{timestamp}">
  <codebase_state>
    <file path="{path}" relevance="{score}">{compressed_content}</file>
  </codebase_state>
  <system_state>
    <service name="{name}" status="{status}" endpoint="{url}"/>
  </system_state>
  <session_decisions>
    <decision id="{id}" at="{timestamp}">{decision_summary}</decision>
  </session_decisions>
  <related_artifacts>
    <artifact id="{id}" type="{type}" path="{path}">{summary}</artifact>
  </related_artifacts>
  <environment>
    <var name="{name}" value="{value}"/>
  </environment>
</context>
```

**Use case examples:**
- `execution`: Include current deploy manifest, last 3 commit messages, active environment vars
- `market_analysis`: Include today's cached trend data, last successful scan results
- `research`: Include prior research session summaries, known-good sources list

---

### Layer 6: MEMORY

**Purpose:** Injects recalled patterns, prior learnings, and successful strategies from past
sessions that are directly relevant to the current task.

**Scope:** Task-scoped. Assembled by semantic search against ChromaDB + patterns.json.

**Contents:**
- Top 5 most relevant patterns from prior sessions (by vector similarity)
- Known failure modes for this task type (to avoid)
- Successful solution strategies for similar tasks
- Karpathy wrapup insights from last 3 sessions
- Any agent-specific learnings (what this agent got right/wrong before)

**Compose rule:** Memory augments but does not replace current context. Memory patterns
have a confidence score — only inject patterns with confidence > 0.6. Stale patterns
(> 30 days without reinforcement) are flagged as potentially outdated.

**Template:**
```xml
<memory session_id="{session_id}" query="{semantic_query}">
  <patterns>
    <pattern id="{id}" confidence="{score}" age_days="{age}">
      <description>{pattern_summary}</description>
      <application>{how_to_apply_now}</application>
    </pattern>
  </patterns>
  <failure_modes>
    <failure type="{type}" frequency="{count}">{what_went_wrong}</failure>
  </failure_modes>
  <karpathy_insights>
    <insight session="{session_id}" rank="{rank}">{insight_text}</insight>
  </karpathy_insights>
</memory>
```

**Loading mechanism:**
```typescript
// memory/extractors/session-memory.ts
const context = await loadContext(task.description);
// Returns XML-formatted memory block for injection
```

**Use case examples:**
- `profit-systems`: Recall which SaaS pricing tiers converted best, which tech stacks shipped fastest
- `flips`: Recall which product categories had best flip margins, which platforms had stale pricing
- `automation`: Recall which n8n node patterns caused failures, which retry configs worked

---

### Layer 7: LIVE-DATA

**Purpose:** Real-time signals — market prices, trending searches, current system metrics,
live API responses — injected immediately before model call.

**Scope:** Per-call. Freshest possible data. Hard TTL: data older than 1 hour is not
injected as "live" — it is moved to CONTEXT layer instead.

**Contents:**
- Current market prices / arbitrage spreads (if task is market-related)
- Live trend data from Google Trends, TikTok, Amazon (if task is trend-related)
- Current system health metrics (if task is operational)
- Recent git commits / PR status (if task is code-related)
- Real-time opportunity scores from opportunity-scorer.ts

**Compose rule:** This layer is small and dense. Maximum 2000 tokens. Every field must
have a timestamp. The model is instructed to weight live data highest for time-sensitive
decisions but lowest for architectural decisions (where context and memory dominate).

**Template:**
```xml
<live_data fetched_at="{iso_timestamp}" ttl_minutes="60">
  <market_signals>
    <signal source="{source}" type="{type}" confidence="{score}" at="{timestamp}">
      {signal_data}
    </signal>
  </market_signals>
  <system_metrics>
    <metric name="{name}" value="{value}" unit="{unit}" at="{timestamp}"/>
  </system_metrics>
  <trend_snapshots>
    <trend keyword="{kw}" velocity="{score}" platform="{platform}" at="{timestamp}"/>
  </trend_snapshots>
  <opportunity_queue>
    <opportunity rank="{rank}" score="{score}" ttv_days="{ttv}">{summary}</opportunity>
  </opportunity_queue>
</live_data>
```

**Use case examples:**
- `market_analysis`: Live Amazon BSR changes, TikTok hashtag velocity, eBay sold comps from last hour
- `flips`: Real-time price spread between sourcing platform and resale platform
- `execution`: Current CI/CD pipeline status, live error rates from deployed service

---

## Stack Composition

### Full Stack Assembly Function

```python
# Pseudocode for stack composition
def compose_prompt_stack(
    task: Task,
    session: Session,
    agent: Agent,
    memory_service: MemoryService,
    live_data_fetcher: LiveDataFetcher
) -> str:
    
    # Layer 1: Always loaded from file
    system = load_file("brain/core_identity/system.md")
    
    # Layer 2: From session state
    mission = session.to_mission_xml()
    
    # Layer 3: From agent registry
    role = load_agent_role(agent.id)
    
    # Layer 4: Direct from task definition
    task_xml = task.to_xml()
    
    # Layer 5: Assembled from codebase + session state
    context = assemble_context(task, session)
    context = repomix_compress(context, max_tokens=30000)
    
    # Layer 6: Semantic recall from memory
    patterns = memory_service.query(
        query=task.description,
        top_k=5,
        min_confidence=0.6
    )
    memory_xml = patterns.to_xml()
    
    # Layer 7: Real-time data (if task type warrants it)
    live_data_xml = ""
    if task.requires_live_data:
        live_data_xml = live_data_fetcher.fetch(task.data_requirements)
    
    # Collapse all layers into final prompt
    return "\n\n".join([
        system, mission, role, task_xml,
        context, memory_xml, live_data_xml
    ])
```

---

## Use Case Compositions

### profit-systems

Goal: Build or optimize a revenue-generating automated system.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — maximize leverage, compound outputs |
| MISSION | "Generate recurring revenue via automated digital pipeline" |
| ROLE | product-manager → system-architect → python-expert (sequential Loki phases) |
| TASK | "Build Stripe-integrated product delivery webhook" |
| CONTEXT | Existing codebase, current payment integrations, deploy environment |
| MEMORY | Prior SaaS builds that shipped in < 1 week, pricing strategies that converted |
| LIVE-DATA | Current market demand signal for this product category |

### flips

Goal: Identify, score, and execute product arbitrage opportunities.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — asymmetrical opportunities, time-sensitive |
| MISSION | "Find and execute 5 flip opportunities this week, >40% margin" |
| ROLE | market-researcher → monetization-strategist |
| TASK | "Score these 50 product listings against current Amazon BSR and pricing" |
| CONTEXT | Current inventory, past flip history, available capital |
| MEMORY | Which product categories yielded highest margin, which failed |
| LIVE-DATA | Live Amazon prices, eBay sold comps from last 2 hours, TikTok trending products |

### market_analysis

Goal: Systematic scan and rank of market opportunities across data sources.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — signal discovery, operational advantage |
| MISSION | "Produce ranked opportunity queue for next 7 days of execution" |
| ROLE | deep-research-agent + market-researcher |
| TASK | "Scan Amazon, TikTok, eBay for emerging demand signals. Score and rank. Output to linear-queue." |
| CONTEXT | Prior scan results, known saturated categories, available tools |
| MEMORY | Which signals reliably predicted profitable opportunities |
| LIVE-DATA | Google Trends velocity, TikTok hashtag growth rates, Amazon BSR movers |

### automation

Goal: Eliminate manual work via scalable automation pipelines.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — friction elimination, meta-automation |
| MISSION | "Automate all identified manual daily tasks" |
| ROLE | integration-specialist + devops-architect |
| TASK | "Build n8n workflow that auto-processes daily sales report and posts to Slack" |
| CONTEXT | Current manual process documentation, available APIs, existing n8n instance |
| MEMORY | Which n8n nodes caused failures, which webhook patterns were reliable |
| LIVE-DATA | Current n8n workflow status, last run timestamps |

### research

Goal: Deep synthesis of a domain to extract actionable intelligence.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — convert information into operational advantage |
| MISSION | "Produce actionable intelligence brief on [topic]" |
| ROLE | deep-research-agent |
| TASK | "Research [topic]. Synthesize top signals. Output structured brief with confidence scores." |
| CONTEXT | Prior research on adjacent topics, known-reliable sources |
| MEMORY | Which research methods yielded highest-quality outputs |
| LIVE-DATA | Latest developments from web search (if research is time-sensitive) |

### execution

Goal: Deploy and operate a system already designed and built.

| Layer | Content |
|-------|---------|
| SYSTEM | Full identity — observable execution, security by default |
| MISSION | "Deploy [system] to production with full observability" |
| ROLE | deployment-engineer |
| TASK | "Deploy v1.2 to production. Run health checks. Set up monitoring. Smoke test all endpoints." |
| CONTEXT | Current infrastructure state, deployment manifest, environment vars |
| MEMORY | Prior deployment failures and their root causes |
| LIVE-DATA | Current server metrics, recent error rates, CI/CD pipeline status |

---

## Layer Compression Rules

When total token count exceeds the model's practical context limit, apply these compression
rules in order:

1. **LIVE-DATA**: Truncate to top 3 signals only. Hard limit: 1000 tokens.
2. **MEMORY**: Reduce to top 3 patterns, highest confidence only. Hard limit: 2000 tokens.
3. **CONTEXT**: Apply Repomix compression. Remove files with relevance score < 0.5.
4. **ROLE**: Collapse to essential output contract only. Remove elaboration.
5. **TASK**: Never compress. Always kept verbatim.
6. **MISSION**: Never compress. Always kept verbatim.
7. **SYSTEM**: Never compress. Core identity is non-negotiable.

---

## Version Control

All layers are versioned independently. A prompt stack version is a tuple:
`(system_v, mission_v, role_v, task_v)` where each is a semver string.

Changes to SYSTEM or MISSION require a full pipeline re-test (all 37 agents).
Changes to ROLE require a phase re-test.
Changes to TASK, CONTEXT, MEMORY, LIVE-DATA are low-risk and require only unit testing.
