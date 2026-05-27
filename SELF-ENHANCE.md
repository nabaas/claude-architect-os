# SELF-ENHANCE — Autonomous Compounding Intelligence Architecture
# CMNDCENTER v4.0 | claude-architect-os | Version: 1.0 | 2026-05-26
#
# The system that makes the system smarter every night.
# Three layers: SELF-REALIZATION → SELF-CORRECTION → SELF-COMPOUNDING

---

## ARCHITECTURE OVERVIEW

```
                        ┌─────────────────────────────────────┐
                        │     SELF-REALIZATION LAYER           │
                        │  gap-bridge.ts + healthMatrix()      │
                        │  Detects: broken chains, missing     │
                        │  files, stale patterns, dead agents  │
                        └──────────────┬──────────────────────┘
                                       │ detects gaps
                                       ▼
                        ┌─────────────────────────────────────┐
                        │     SELF-CORRECTION LAYER            │
                        │  auto-fix (low severity) OR          │
                        │  queue to gaps.json (high severity)  │
                        │  Trigger: every 30min + on error     │
                        └──────────────┬──────────────────────┘
                                       │ patterns extracted
                                       ▼
                        ┌─────────────────────────────────────┐
                        │     SELF-COMPOUNDING LAYER           │
                        │  patternEngine.savePattern()         │
                        │  compound-memory.json update         │
                        │  ChromaDB upsert + Supabase log      │
                        │  Trigger: every task completion      │
                        └──────────────┬──────────────────────┘
                                       │ feeds back
                                       ▼
                              Next session starts smarter
```

---

## LAYER 1 — SELF-REALIZATION (Gap Detection)

**What it watches:**

```typescript
// gap-bridge.ts healthMatrix() — runs every 30min via LaunchAgent
const HEALTH_CHECKS = {
  // Services
  litellm:   { url: 'http://localhost:4000/health',  severity: 'critical' },
  n8n:       { url: 'http://localhost:5678/healthz',  severity: 'critical' },
  chromadb:  { url: 'http://localhost:8000/api/v1/heartbeat', severity: 'high' },
  supabase:  { url: 'http://localhost:54321/health', severity: 'high' },
  ollama:    { url: 'http://localhost:11434/api/tags', severity: 'medium' },
  freqtrade: { url: 'http://localhost:8080/api/v1/ping', severity: 'low' },
  vllm:      { url: 'http://localhost:8001/health',   severity: 'low' },

  // Files (must exist)
  compound_memory:   { path: '~/.amsa/memory/karpathy_wrapup.json', severity: 'high' },
  patterns:          { path: '~/.amsa/memory/patterns.json', severity: 'high' },
  pattern_registry:  { path: '~/CMNDCENTER/system/blueprints/pattern-registry.json', severity: 'medium' },

  // Chain integrity (output of A must be readable by B)
  chain_aider_n8n:   { check: 'git post-push hook → n8n webhook reachable', severity: 'medium' },
  chain_wand_wall:   { check: 'WAND output file exists after 7am run', severity: 'low' },
  chain_loki_github: { check: 'last Loki build has GitHub repo', severity: 'medium' },
};
```

**Auto-fix rules (execute without asking):**

```bash
# LOW severity — fix silently
ollama_down:      ollama serve &
chromadb_down:    docker start chromadb 2>/dev/null || docker compose up chromadb -d
n8n_down:         docker start n8n 2>/dev/null || docker compose up n8n -d
missing_memory:   mkdir -p ~/.amsa/memory && echo "[]" > ~/.amsa/memory/patterns.json
missing_queue:    mkdir -p ~/.amsa/linear-queue

# MEDIUM severity — fix + log to upgrade-log.json
pattern_stale:    patternEngine.reindex() → ChromaDB re-upsert
chain_broken:     identify break point → queue to gaps.json + Telegram alert

# HIGH severity — alert + halt dependent pipelines
litellm_down:     Telegram CRITICAL alert + stop all LLM calls + fallback to direct API
supabase_down:    Telegram alert + buffer writes to local SQLite until restored
```

---

## LAYER 2 — SELF-CORRECTION (Auto-Fix + Queue)

**Gap resolution pipeline:**

```
gap detected
    ↓
severity check
    ↓
auto-fixable?
  YES → execute fix → log to upgrade-log.json → Telegram: "Auto-fixed: {gap}"
  NO  → append to ~/.amsa/linear-queue/gaps.json → Telegram: "Gap queued: {gap}"
    ↓
re-run healthMatrix() in 5min to verify fix
    ↓
if still broken → escalate severity + page again
```

**Architectural integrity checks (run every 3am):**

```typescript
// system/gap-bridge.ts - architecturalIntegrityCheck()
const INTEGRITY_RULES = [
  // Every wired repo must have a CLAUDE.md
  { rule: 'each repo in pattern-registry has CLAUDE.md', fix: 'adopt.sh {repo}' },
  // Every integration config must be loadable
  { rule: 'integrations/ configs parse without error', fix: 'log + remove broken config' },
  // Every chain in STACK-WIRING-PAIRS must have both endpoints reachable
  { rule: 'chain endpoints exist', fix: 'queue endpoint setup to gaps.json' },
  // Every LaunchAgent plist must have a valid script path
  { rule: 'LaunchAgent scripts exist', fix: 'disable plist + log to gaps.json' },
  // compound-memory.json must be valid JSON
  { rule: 'compound-memory.json parses', fix: 'restore from last Supabase backup' },
];
```

---

## LAYER 3 — SELF-COMPOUNDING (Intelligence Growth)

**Trigger: every task completion**

```typescript
// Called after every non-trivial task (>5min or multi-step)
async function compoundLearning(task: CompletedTask) {
  const pattern = {
    id: `pattern_${Date.now()}`,
    domain: task.domain,
    trigger: task.triggerWords,
    agentChain: task.agentChain,
    quality: task.qualityScore,       // 0-1, from self-review agent
    roi: task.roiScore,               // 0-100, from roi-brain.ts
    compound: task.compoundFactor,    // 1-3
    timestamp: new Date().toISOString(),
    reuse_count: 0,
    confidence: task.qualityScore,
  };

  // Write to all memory layers simultaneously
  await patternEngine.savePattern(pattern);     // patterns.json + ChromaDB
  await supabase.from('patterns').upsert(pattern);
  updateCompoundMemory(task.domain, pattern);   // compound-memory.json
}
```

**Pattern confidence decay + refresh:**

```
Every pattern starts at confidence = quality_score (0-1)
Each reuse: confidence += 0.05 (capped at 0.99)
Stale (not used in 30 days): confidence -= 0.1
confidence < 0.3: flag for review, exclude from auto-routing
confidence < 0.1: archive to cold storage in Supabase
```

---

## OVERNIGHT PROCESSING SCHEDULE

```
02:55am  self-intelligence.py boot check
         → verify all 50 tool connections
         → log health snapshot to Supabase

03:00am  AutoResearch (100 iterations, stops 6am)
         → iterate: pick weakest agent → improve prompt → test → keep if better
         → output: improved agent prompts in agents/registry.json
         → Telegram: "Overnight improvement: X/10 → Y/10"

03:30am  Pattern compaction
         → patternEngine.compound() — find A→B→C chains, surface A→C shortcut
         → prune confidence < 0.2 patterns
         → re-index ChromaDB with new compound patterns

04:00am  Gap scan (full architectural integrity check)
         → gap-bridge.ts architecturalIntegrityCheck()
         → auto-fix all auto-fixable gaps
         → queue remaining to gaps.json

04:30am  Memory sync
         → ChromaDB → Supabase backup
         → karpathy_wrapup.json → patterns.json merge
         → compound-memory.json updated with overnight improvements

05:00am  Model warm-up
         → Ollama: pull latest hermes3 updates if available
         → LiteLLM: test all model routes, remove dead ones
         → vLLM: health check, restart if needed

05:30am  claude-auto-updater.py
         → scan GitHub trending for new repos scoring ≥78
         → update TRIGGER-DICTIONARY.md with new trigger patterns
         → update STACK-REGISTRY.md if new tool discovered

06:00am  Wallpaper refresh
         → gen_wall_fusion.py: new architecture map
         → reflects overnight capability improvements

06:05am  Session prep
         → karpathy_wrapup.json synthesized for today
         → top-10 patterns pre-loaded for PIE
         → ROI queue sorted for morning session
```

---

## BACKGROUND PROCESSING (runs during active sessions)

**Every 30 minutes (LaunchAgent or n8n schedule):**
```bash
gap-bridge.ts healthMatrix()          # service health
pattern-engine.ts recentPatterns()   # surface new patterns from last 30min
roi-brain.ts rescoreQueue()           # re-rank open opportunities
```

**Every git push (post-push hook):**
```bash
→ n8n webhook /webhook/git-push
→ repomix compress changed files
→ code-reviewer agent (async, silent)
→ security-engineer scan
→ if issues: Telegram alert + queue to gaps.json
→ if clean: ChromaDB index updated
```

**On every Loki build completion:**
```bash
→ patternEngine.savePattern(buildResult)
→ compound-memory.json updated (domain_memory + global_learnings)
→ n8n fires downstream cascade
→ Telegram: "Build complete: {product} at {github_url}"
→ Supabase: log build metadata, agent chain used, quality scores
```

---

## SELF-INTEGRATION PROTOCOL (new tool/repo detected)

```
New repo detected (GitHub trending, WAND scout, or manual adopt)
    ↓
ROI Brain scores it (0-100)
    ↓
score ≥ 78?
  YES →
    1. adopt.sh {url}  →  CLAUDE.md created + registered in pattern-registry
    2. Identify domain + role from README
    3. Add to STACK-WIRING-PAIRS.md — find which chain it potentiates
    4. Add integration config to integrations/{tool}/
    5. If has Docker: add to docker-compose.master.yml
    6. If has REST API: add to TRIGGER-DICTIONARY.md (new endpoint)
    7. If has webhook: wire to n8n
    8. compound-memory.json: add to domain_memory effective_patterns
    9. Telegram: "New tool integrated: {name} (ROI: {score})"
  NO →
    log to ~/.amsa/linear-queue/opportunities.json for manual review
```

---

## PROMPT QUERY RETURN SYSTEM (trigger word allocation)

When the system encounters an unrecognized pattern, it queries itself:

```typescript
// On unmatched input (PIE semantic similarity < 0.4)
async function promptQueryReturn(rawInput: string): Promise<TriggerAllocation> {
  // Step 1: classify via haiku (fast, cheap)
  const classification = await queryClaude({
    model: 'claude-haiku-4-5',
    prompt: `Classify this input into: [domain, complexity, primaryIntent, suggestedTrigger]
    Input: "${rawInput}"
    Available domains: ${DOMAINS.join(', ')}
    Available trigger prefixes: ${TRIGGER_PREFIXES.join(', ')}`,
  });

  // Step 2: if confidence > 0.7, add to TRIGGER-DICTIONARY.md
  if (classification.confidence > 0.7) {
    appendToTriggerDictionary(classification);
    await patternEngine.savePattern({ type: 'trigger_mapping', ...classification });
  }

  // Step 3: execute with best-guess chain
  return routeToChain(classification);
}
```

**This closes the loop:** every unmatched input either matches next time OR generates a new trigger entry. The dictionary grows autonomously.

---

## COMPOUND GROWTH METRICS (track these in Supabase)

```sql
-- Track system intelligence growth over time
SELECT
  date_trunc('week', created_at) as week,
  COUNT(*) as patterns_added,
  AVG(quality_score) as avg_quality,
  AVG(roi_score) as avg_roi,
  SUM(reuse_count) as total_reuses
FROM patterns
GROUP BY 1 ORDER BY 1;

-- Agent performance over time
SELECT
  agent_name,
  AVG(quality_score) as avg_quality,
  COUNT(*) as times_invoked,
  AVG(execution_ms) as avg_speed
FROM agent_executions
GROUP BY 1 ORDER BY 2 DESC;
```

---

## KILL SWITCHES

```bash
# Stop all overnight processing
launchctl unload ~/Library/LaunchAgents/com.cmndcenter.*.plist

# Stop self-improvement loop only
touch ~/CMNDCENTER/loki/.ENHANCE_HALT

# Stop trading only
touch ~/CMNDCENTER/intellitradeX/.HALT

# Stop gap auto-fix (manual review mode)
touch ~/CMNDCENTER/system/.GAP_MANUAL

# Full system stop
touch ~/OMNISTACK/.HALT && pkill -f "n8n\|ollama\|loki\|freqtrade"
```

---

*This file defines the autonomous intelligence growth loop.*
*System improves every night whether or not you interact with it.*
*Every session starts smarter than the last. This is the compound effect.*
