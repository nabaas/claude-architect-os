// Neo4j Knowledge Graph Schema — Claude Architect OS
// Connect: bolt://localhost:7687 (via Docker)
// Start: docker run -p 7474:7474 -p 7687:7687 --env NEO4J_AUTH=neo4j/password neo4j:latest

// ─── Node Constraints ──────────────────────────────────────────────────────

CREATE CONSTRAINT repo_name IF NOT EXISTS FOR (r:Repo) REQUIRE r.name IS UNIQUE;
CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (a:Agent) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT tool_name IF NOT EXISTS FOR (t:Tool) REQUIRE t.name IS UNIQUE;
CREATE CONSTRAINT product_asin IF NOT EXISTS FOR (p:Product) REQUIRE p.asin IS UNIQUE;
CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (s:Signal) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT workflow_id IF NOT EXISTS FOR (w:Workflow) REQUIRE w.id IS UNIQUE;

// ─── Seed: CMNDCENTER Repo Graph ───────────────────────────────────────────

// Core repos
MERGE (claudeArchOS:Repo {name: "claude-architect-os", url: "https://github.com/nabaas/claude-architect-os"})
MERGE (cmndcenter:Repo {name: "CMNDCENTER", path: "~/CMNDCENTER"})
MERGE (loki:Repo {name: "loki-mode", path: "~/CMNDCENTER/loki"})
MERGE (amsa:Repo {name: "amsa", path: "~/CMNDCENTER/amsa"})
MERGE (intellitradeX:Repo {name: "intellitradeX", path: "~/CMNDCENTER/intellitradeX"})

// Tool nodes
MERGE (claude:Tool {name: "Claude", model: "claude-sonnet-4-6", provider: "Anthropic"})
MERGE (ollama:Tool {name: "Ollama", models: ["hermes3", "gemma3:4b"], type: "local-llm"})
MERGE (raycast:Tool {name: "Raycast", type: "command-surface"})
MERGE (n8n:Tool {name: "n8n", type: "automation", port: 5678})
MERGE (chromadb:Tool {name: "ChromaDB", type: "vector-store", port: 8000})
MERGE (supabase:Tool {name: "Supabase", type: "database", port: 54321})
MERGE (cursor:Tool {name: "Cursor", type: "ai-ide"})
MERGE (continuedev:Tool {name: "Continue.dev", type: "ai-coding"})
MERGE (cline:Tool {name: "Cline", type: "ai-agent"})
MERGE (aider:Tool {name: "Aider", type: "git-agent"})
MERGE (crewai:Tool {name: "CrewAI", type: "multi-agent"})
MERGE (litellm:Tool {name: "LiteLLM", type: "model-router", port: 4000})
MERGE (mem0:Tool {name: "Mem0", type: "memory-layer"})
MERGE (anythingllm:Tool {name: "AnythingLLM", type: "local-rag", port: 3001})

// ─── Relationships ─────────────────────────────────────────────────────────

// Repo dependencies
MATCH (cao:Repo {name: "claude-architect-os"}), (cm:Repo {name: "CMNDCENTER"})
MERGE (cao)-[:PART_OF]->(cm);

MATCH (l:Repo {name: "loki-mode"}), (cm:Repo {name: "CMNDCENTER"})
MERGE (l)-[:PART_OF]->(cm);

// Tool integrations
MATCH (cao:Repo {name: "claude-architect-os"}), (c:Tool {name: "Claude"})
MERGE (cao)-[:USES {primary: true, model: "claude-sonnet-4-6"}]->(c);

MATCH (cao:Repo {name: "claude-architect-os"}), (o:Tool {name: "Ollama"})
MERGE (cao)-[:USES {primary: false, use_case: "local-fallback"}]->(o);

MATCH (cao:Repo {name: "claude-architect-os"}), (r:Tool {name: "Raycast"})
MERGE (cao)-[:SURFACES_VIA]->(r);

MATCH (l:Tool {name: "LiteLLM"}), (c:Tool {name: "Claude"})
MERGE (l)-[:ROUTES_TO {task_type: "coding"}]->(c);

MATCH (l:Tool {name: "LiteLLM"}), (o:Tool {name: "Ollama"})
MERGE (l)-[:ROUTES_TO {task_type: "local"}]->(o);

// Memory graph
MATCH (cd:Tool {name: "ChromaDB"}), (s:Tool {name: "Supabase"})
MERGE (cd)-[:COMPLEMENTS {cd_role: "vectors", supabase_role: "structured"}]->(s);

// ─── Product/Signal Graph (Market Intelligence) ────────────────────────────

// Example: TikTok viral product → eBay arbitrage signal
MERGE (tiktok:Signal {id: "tiktok-viral", source: "TikTok", type: "virality"})
MERGE (ebay:Signal {id: "ebay-comp", source: "eBay", type: "pricing"})
MERGE (amazon:Signal {id: "amz-bsr", source: "Amazon", type: "rank"})

// Signal relationships
MATCH (t:Signal {id: "tiktok-viral"}), (e:Signal {id: "ebay-comp"})
MERGE (t)-[:CORRELATES_WITH {lag_days: 14, confidence: 0.73}]->(e);

MATCH (e:Signal {id: "ebay-comp"}), (a:Signal {id: "amz-bsr"})
MERGE (e)-[:PRICE_DELTA]->(a);

// ─── Useful Queries ────────────────────────────────────────────────────────

// Find all tools that Claude Architect OS uses:
// MATCH (cao:Repo {name: "claude-architect-os"})-[:USES]->(t:Tool) RETURN t.name, t.type

// Find compounding pathways (tools that connect to 3+ other nodes):
// MATCH (t:Tool)-[r]-() WITH t, count(r) as connections WHERE connections >= 3 RETURN t.name, connections ORDER BY connections DESC

// Find routing chain for a task:
// MATCH path = (source:Tool {name: "Raycast"})-[*1..4]-(target:Tool) RETURN path LIMIT 20
