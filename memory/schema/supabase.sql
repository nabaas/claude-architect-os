-- memory/schema/supabase.sql
-- Complete Memory System Schema — Claude Architect OS v4.0
-- Supabase PostgreSQL + Row Level Security
-- Run with: supabase db push OR psql -d postgres -f supabase.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- trigram search for fuzzy text match
CREATE EXTENSION IF NOT EXISTS "btree_gin";       -- GIN indexes for JSONB

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE session_status AS ENUM ('active', 'completed', 'failed', 'aborted');
CREATE TYPE interaction_type AS ENUM ('task', 'decision', 'handoff', 'error', 'insight', 'artifact');
CREATE TYPE agent_phase AS ENUM ('discover', 'design', 'build', 'quality', 'deploy', 'monetize', 'operate', 'meta');
CREATE TYPE opportunity_status AS ENUM ('queued', 'active', 'completed', 'failed', 'archived', 'snoozed');
CREATE TYPE signal_source AS ENUM ('amazon', 'tiktok', 'ebay', 'google_trends', 'reddit', 'twitter', 'manual', 'system');
CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'paused', 'failed', 'archived');
CREATE TYPE knowledge_node_type AS ENUM ('concept', 'artifact', 'decision', 'pattern', 'system', 'person', 'tool');

-- ============================================================
-- TABLE: sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      TEXT NOT NULL UNIQUE,                       -- YYYYMMDD_HHMMSS_XXXX format
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    status          session_status NOT NULL DEFAULT 'active',
    user_id         UUID,                                       -- null for system sessions
    mission         TEXT,                                       -- active mission objective
    primary_agent   TEXT,                                       -- loki-coordinator or specific agent
    model_used      TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    artifact_count  INTEGER NOT NULL DEFAULT 0,
    task_count      INTEGER NOT NULL DEFAULT 0,
    opportunity_count INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0,
    input_tokens    BIGINT NOT NULL DEFAULT 0,
    output_tokens   BIGINT NOT NULL DEFAULT 0,
    karpathy_wrapup JSONB,                                      -- synthesized session insights
    improvement_vectors JSONB,                                  -- AutoResearch input vectors
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_session_id ON sessions (session_id);
CREATE INDEX idx_sessions_started_at ON sessions (started_at DESC);
CREATE INDEX idx_sessions_status ON sessions (status);
CREATE INDEX idx_sessions_user_id ON sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sessions_metadata ON sessions USING GIN (metadata);

-- ============================================================
-- TABLE: interactions
-- ============================================================

CREATE TABLE IF NOT EXISTS interactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      TEXT NOT NULL REFERENCES sessions (session_id) ON DELETE CASCADE,
    interaction_type interaction_type NOT NULL,
    agent_id        TEXT,                                       -- which agent produced this
    phase           agent_phase,
    task_id         TEXT,                                       -- links to a task if applicable
    input_summary   TEXT,                                       -- compressed input (not full text)
    output_summary  TEXT,                                       -- compressed output
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0,
    model_used      TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    latency_ms      INTEGER,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    error_code      TEXT,
    error_message   TEXT,
    decision        TEXT,                                       -- if type=decision, what was decided
    rationale       TEXT,                                       -- why this decision was made
    confidence      NUMERIC(3, 2),                             -- 0.00 to 1.00
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_session_id ON interactions (session_id);
CREATE INDEX idx_interactions_created_at ON interactions (created_at DESC);
CREATE INDEX idx_interactions_agent_id ON interactions (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_interactions_phase ON interactions (phase) WHERE phase IS NOT NULL;
CREATE INDEX idx_interactions_type ON interactions (interaction_type);
CREATE INDEX idx_interactions_success ON interactions (success);
CREATE INDEX idx_interactions_tags ON interactions USING GIN (tags);
CREATE INDEX idx_interactions_task_id ON interactions (task_id) WHERE task_id IS NOT NULL;

-- ============================================================
-- TABLE: prompts
-- ============================================================

CREATE TABLE IF NOT EXISTS prompts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id       TEXT NOT NULL UNIQUE,                       -- human-readable ID
    layer           TEXT NOT NULL,                             -- system|mission|role|task|context|memory|live-data
    version         TEXT NOT NULL DEFAULT '1.0.0',
    name            TEXT NOT NULL,
    description     TEXT,
    content         TEXT NOT NULL,                             -- full prompt content
    content_hash    TEXT NOT NULL,                             -- SHA256 of content
    use_cases       TEXT[] NOT NULL DEFAULT '{}',
    agent_ids       TEXT[] NOT NULL DEFAULT '{}',             -- which agents use this prompt
    token_count     INTEGER,
    performance_score NUMERIC(4, 3),                          -- 0.000 to 1.000, measured quality
    test_results    JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    parent_id       UUID REFERENCES prompts (id),             -- inheritance chain
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompts_prompt_id ON prompts (prompt_id);
CREATE INDEX idx_prompts_layer ON prompts (layer);
CREATE INDEX idx_prompts_version ON prompts (version);
CREATE INDEX idx_prompts_is_active ON prompts (is_active);
CREATE INDEX idx_prompts_agent_ids ON prompts USING GIN (agent_ids);
CREATE INDEX idx_prompts_use_cases ON prompts USING GIN (use_cases);
CREATE INDEX idx_prompts_content_hash ON prompts (content_hash);

-- ============================================================
-- TABLE: agents
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    phase           agent_phase NOT NULL,
    description     TEXT NOT NULL,
    capabilities    TEXT[] NOT NULL DEFAULT '{}',
    default_model   TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    system_prompt_path TEXT,
    input_schema    JSONB,
    output_schema   JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    version         TEXT NOT NULL DEFAULT '1.0.0',
    run_count       BIGINT NOT NULL DEFAULT 0,
    success_count   BIGINT NOT NULL DEFAULT 0,
    failure_count   BIGINT NOT NULL DEFAULT 0,
    avg_latency_ms  NUMERIC(10, 2),
    avg_cost_usd    NUMERIC(10, 6),
    performance_metrics JSONB NOT NULL DEFAULT '{}',
    last_run_at     TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_agent_id ON agents (agent_id);
CREATE INDEX idx_agents_phase ON agents (phase);
CREATE INDEX idx_agents_is_active ON agents (is_active);
CREATE INDEX idx_agents_capabilities ON agents USING GIN (capabilities);

-- ============================================================
-- TABLE: workflows
-- ============================================================

CREATE TABLE IF NOT EXISTS workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    workflow_type   TEXT NOT NULL,                             -- loki|automation|pipeline|n8n|cron
    status          workflow_status NOT NULL DEFAULT 'draft',
    definition      JSONB NOT NULL DEFAULT '{}',              -- full workflow definition
    n8n_workflow_id TEXT,                                      -- n8n external ID if applicable
    trigger_config  JSONB NOT NULL DEFAULT '{}',              -- cron, webhook, event triggers
    last_run_at     TIMESTAMPTZ,
    last_run_status TEXT,
    run_count       BIGINT NOT NULL DEFAULT 0,
    success_count   BIGINT NOT NULL DEFAULT 0,
    failure_count   BIGINT NOT NULL DEFAULT 0,
    avg_duration_ms NUMERIC(10, 2),
    health_check_url TEXT,
    output_destination TEXT,                                   -- where outputs go
    dependencies    TEXT[] NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_workflow_id ON workflows (workflow_id);
CREATE INDEX idx_workflows_status ON workflows (status);
CREATE INDEX idx_workflows_workflow_type ON workflows (workflow_type);
CREATE INDEX idx_workflows_tags ON workflows USING GIN (tags);
CREATE INDEX idx_workflows_last_run_at ON workflows (last_run_at DESC) WHERE last_run_at IS NOT NULL;

-- ============================================================
-- TABLE: opportunities
-- ============================================================

CREATE TABLE IF NOT EXISTS opportunities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id  TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    opportunity_type TEXT NOT NULL,                            -- flip|saas|arbitrage|affiliate|service
    status          opportunity_status NOT NULL DEFAULT 'queued',
    score           NUMERIC(5, 4) NOT NULL,                   -- 0.0000 to 1.0000
    demand_score    NUMERIC(5, 4),
    compound_factor NUMERIC(5, 4),
    leverage_multiplier NUMERIC(5, 4),
    ttv_days        NUMERIC(8, 2),                            -- time-to-value in days
    saturation_score NUMERIC(5, 4),
    expected_return_multiplier NUMERIC(8, 2),
    required_capital_usd NUMERIC(12, 2),
    required_effort_hours NUMERIC(8, 2),
    confidence      NUMERIC(3, 2) NOT NULL,
    data_sources    TEXT[] NOT NULL DEFAULT '{}',
    raw_signals     JSONB NOT NULL DEFAULT '{}',
    action_plan     JSONB,                                     -- structured next steps
    outcome         JSONB,                                     -- filled when completed/failed
    actioned_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,                               -- when this opportunity goes stale
    created_by      TEXT NOT NULL DEFAULT 'opportunity-scorer',
    session_id      TEXT REFERENCES sessions (session_id),
    tags            TEXT[] NOT NULL DEFAULT '{}',
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunities_opportunity_id ON opportunities (opportunity_id);
CREATE INDEX idx_opportunities_status ON opportunities (status);
CREATE INDEX idx_opportunities_score ON opportunities (score DESC);
CREATE INDEX idx_opportunities_created_at ON opportunities (created_at DESC);
CREATE INDEX idx_opportunities_expires_at ON opportunities (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_opportunities_type ON opportunities (opportunity_type);
CREATE INDEX idx_opportunities_tags ON opportunities USING GIN (tags);

-- ============================================================
-- TABLE: market_signals
-- ============================================================

CREATE TABLE IF NOT EXISTS market_signals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id       TEXT NOT NULL UNIQUE,
    source          signal_source NOT NULL,
    signal_type     TEXT NOT NULL,                             -- trending|price_gap|demand_spike|viral|arbitrage
    keyword         TEXT,
    category        TEXT,
    raw_data        JSONB NOT NULL DEFAULT '{}',
    processed_data  JSONB NOT NULL DEFAULT '{}',
    velocity        NUMERIC(8, 4),                            -- rate of change
    volume          NUMERIC(12, 2),                           -- search volume, sales volume, etc.
    price_usd       NUMERIC(12, 2),                           -- relevant price point if applicable
    margin_pct      NUMERIC(6, 2),                            -- profit margin if arbitrage signal
    confidence      NUMERIC(3, 2) NOT NULL,
    is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
    opportunity_id  TEXT REFERENCES opportunities (opportunity_id),
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_signals_signal_id ON market_signals (signal_id);
CREATE INDEX idx_market_signals_source ON market_signals (source);
CREATE INDEX idx_market_signals_signal_type ON market_signals (signal_type);
CREATE INDEX idx_market_signals_fetched_at ON market_signals (fetched_at DESC);
CREATE INDEX idx_market_signals_is_processed ON market_signals (is_processed);
CREATE INDEX idx_market_signals_keyword ON market_signals USING GIN (keyword gin_trgm_ops);
CREATE INDEX idx_market_signals_confidence ON market_signals (confidence DESC);

-- ============================================================
-- TABLE: knowledge_graph
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_graph (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id         TEXT NOT NULL UNIQUE,
    node_type       knowledge_node_type NOT NULL,
    title           TEXT NOT NULL,
    summary         TEXT,
    content         TEXT,
    content_hash    TEXT,
    confidence      NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
    leverage_score  NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
    domain          TEXT,                                      -- profit-systems|automation|research|etc
    session_id      TEXT REFERENCES sessions (session_id),
    agent_id        TEXT,
    source_path     TEXT,                                      -- file path or URL
    tags            TEXT[] NOT NULL DEFAULT '{}',
    embedding_id    TEXT,                                      -- ChromaDB document ID
    ttl_days        INTEGER,                                   -- null = permanent
    access_count    BIGINT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_node_id ON knowledge_graph (node_id);
CREATE INDEX idx_knowledge_node_type ON knowledge_graph (node_type);
CREATE INDEX idx_knowledge_domain ON knowledge_graph (domain);
CREATE INDEX idx_knowledge_session_id ON knowledge_graph (session_id);
CREATE INDEX idx_knowledge_confidence ON knowledge_graph (confidence DESC);
CREATE INDEX idx_knowledge_leverage_score ON knowledge_graph (leverage_score DESC);
CREATE INDEX idx_knowledge_tags ON knowledge_graph USING GIN (tags);
CREATE INDEX idx_knowledge_title ON knowledge_graph USING GIN (title gin_trgm_ops);
CREATE INDEX idx_knowledge_content ON knowledge_graph USING GIN (content gin_trgm_ops)
    WHERE content IS NOT NULL;

-- ============================================================
-- TABLE: knowledge_edges (graph relationships)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_node_id    TEXT NOT NULL REFERENCES knowledge_graph (node_id) ON DELETE CASCADE,
    to_node_id      TEXT NOT NULL REFERENCES knowledge_graph (node_id) ON DELETE CASCADE,
    edge_type       TEXT NOT NULL,                             -- depends_on|produces|references|contradicts|supports
    weight          NUMERIC(4, 3) NOT NULL DEFAULT 1.0,       -- relationship strength 0.000-1.000
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (from_node_id, to_node_id, edge_type)
);

CREATE INDEX idx_edges_from ON knowledge_edges (from_node_id);
CREATE INDEX idx_edges_to ON knowledge_edges (to_node_id);
CREATE INDEX idx_edges_type ON knowledge_edges (edge_type);
CREATE INDEX idx_edges_weight ON knowledge_edges (weight DESC);

-- ============================================================
-- TABLE: embeddings
-- ============================================================

CREATE TABLE IF NOT EXISTS embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    embedding_id    TEXT NOT NULL UNIQUE,
    source_type     TEXT NOT NULL,                             -- knowledge_graph|interaction|prompt|opportunity
    source_id       TEXT NOT NULL,                             -- ID in the source table
    content_hash    TEXT NOT NULL,                             -- hash of content that was embedded
    model           TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions      INTEGER NOT NULL DEFAULT 1536,
    vector          vector(1536),                              -- pgvector embedding
    chroma_doc_id   TEXT,                                      -- ChromaDB fallback ID
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_embeddings_embedding_id ON embeddings (embedding_id);
CREATE INDEX idx_embeddings_source_type_id ON embeddings (source_type, source_id);
CREATE INDEX idx_embeddings_is_current ON embeddings (is_current);
CREATE INDEX idx_embeddings_content_hash ON embeddings (content_hash);
-- IVFFlat index for approximate nearest-neighbor search
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (vector vector_cosine_ops)
    WITH (lists = 100)
    WHERE is_current = TRUE;

-- ============================================================
-- VIEWS
-- ============================================================

-- Active opportunities ranked by score
CREATE OR REPLACE VIEW v_opportunity_queue AS
SELECT
    o.opportunity_id,
    o.title,
    o.opportunity_type,
    o.score,
    o.confidence,
    o.ttv_days,
    o.expected_return_multiplier,
    o.required_capital_usd,
    o.expires_at,
    EXTRACT(EPOCH FROM (o.expires_at - NOW())) / 3600 AS hours_until_expiry,
    o.status,
    o.created_at
FROM opportunities o
WHERE o.status IN ('queued', 'active')
ORDER BY o.score DESC, o.expires_at ASC NULLS LAST;

-- Session performance summary
CREATE OR REPLACE VIEW v_session_summary AS
SELECT
    s.session_id,
    s.started_at,
    s.ended_at,
    EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) / 60 AS duration_minutes,
    s.status,
    s.artifact_count,
    s.opportunity_count,
    s.cost_usd,
    s.input_tokens + s.output_tokens AS total_tokens,
    COUNT(DISTINCT i.id) AS interaction_count,
    SUM(CASE WHEN i.success = FALSE THEN 1 ELSE 0 END) AS error_count,
    AVG(i.confidence) AS avg_confidence
FROM sessions s
LEFT JOIN interactions i ON i.session_id = s.session_id
GROUP BY s.id, s.session_id, s.started_at, s.ended_at, s.status,
         s.artifact_count, s.opportunity_count, s.cost_usd, s.input_tokens, s.output_tokens
ORDER BY s.started_at DESC;

-- Recent market signals with opportunity linkage
CREATE OR REPLACE VIEW v_recent_signals AS
SELECT
    ms.signal_id,
    ms.source,
    ms.signal_type,
    ms.keyword,
    ms.velocity,
    ms.confidence,
    ms.margin_pct,
    ms.is_processed,
    ms.fetched_at,
    o.opportunity_id,
    o.score AS opportunity_score,
    o.status AS opportunity_status
FROM market_signals ms
LEFT JOIN opportunities o ON o.opportunity_id = ms.opportunity_id
WHERE ms.fetched_at > NOW() - INTERVAL '48 hours'
ORDER BY ms.confidence DESC, ms.velocity DESC;

-- Knowledge graph with connectivity metrics
CREATE OR REPLACE VIEW v_knowledge_hub AS
SELECT
    k.node_id,
    k.title,
    k.node_type,
    k.domain,
    k.confidence,
    k.leverage_score,
    k.access_count,
    COUNT(DISTINCT e_out.to_node_id) AS outbound_edges,
    COUNT(DISTINCT e_in.from_node_id) AS inbound_edges,
    k.created_at
FROM knowledge_graph k
LEFT JOIN knowledge_edges e_out ON e_out.from_node_id = k.node_id
LEFT JOIN knowledge_edges e_in ON e_in.to_node_id = k.node_id
GROUP BY k.id, k.node_id, k.title, k.node_type, k.domain,
         k.confidence, k.leverage_score, k.access_count, k.created_at
ORDER BY (k.leverage_score + k.confidence) / 2 DESC;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Semantic search over knowledge graph via pgvector
CREATE OR REPLACE FUNCTION search_knowledge(
    query_vector vector(1536),
    match_count   INTEGER DEFAULT 10,
    min_confidence NUMERIC DEFAULT 0.0
)
RETURNS TABLE (
    node_id     TEXT,
    title       TEXT,
    summary     TEXT,
    domain      TEXT,
    confidence  NUMERIC,
    similarity  FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.node_id,
        k.title,
        k.summary,
        k.domain,
        k.confidence,
        1 - (e.vector <=> query_vector) AS similarity
    FROM embeddings e
    JOIN knowledge_graph k ON k.node_id = e.source_id AND e.source_type = 'knowledge_graph'
    WHERE e.is_current = TRUE
      AND k.confidence >= min_confidence
    ORDER BY e.vector <=> query_vector
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update access_count and last_accessed_at on read
CREATE OR REPLACE FUNCTION touch_knowledge_node(p_node_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE knowledge_graph
    SET access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE node_id = p_node_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER tg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_knowledge_updated_at
    BEFORE UPDATE ON knowledge_graph
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tg_prompts_updated_at
    BEFORE UPDATE ON prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_signals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_graph  ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings       ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by backend services with service_role key)
CREATE POLICY "service_role_bypass_sessions" ON sessions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_interactions" ON interactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_prompts" ON prompts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_agents" ON agents
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_workflows" ON workflows
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_opportunities" ON opportunities
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_market_signals" ON market_signals
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_knowledge_graph" ON knowledge_graph
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_knowledge_edges" ON knowledge_edges
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_bypass_embeddings" ON embeddings
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated user access to their own sessions
CREATE POLICY "user_own_sessions" ON sessions
    FOR ALL USING (
        auth.role() = 'authenticated' AND
        (user_id = auth.uid() OR user_id IS NULL)
    );

-- Read-only access to agents and prompts for authenticated users
CREATE POLICY "user_read_agents" ON agents
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "user_read_prompts" ON prompts
    FOR SELECT USING (
        auth.role() IN ('authenticated', 'service_role') AND is_active = TRUE
    );

-- Authenticated users can read all opportunities (shared intelligence)
CREATE POLICY "user_read_opportunities" ON opportunities
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- Authenticated users can read knowledge graph
CREATE POLICY "user_read_knowledge" ON knowledge_graph
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "user_read_edges" ON knowledge_edges
    FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- ============================================================
-- SEED DATA: Core agents
-- ============================================================

INSERT INTO agents (agent_id, name, phase, description, capabilities, default_model, system_prompt_path, version) VALUES
-- Phase 1: DISCOVER
('requirements-analyst', 'Requirements Analyst', 'discover', 'Extracts and formalizes product requirements from natural language', ARRAY['requirement-extraction','ambiguity-detection','acceptance-criteria'], 'claude-sonnet-4-6', 'agents/discover/requirements-analyst.md', '1.0.0'),
('product-manager', 'Product Manager', 'discover', 'Defines product scope, priorities, and success metrics', ARRAY['scope-definition','prioritization','roadmap-planning'], 'claude-sonnet-4-6', 'agents/discover/product-manager.md', '1.0.0'),
('market-researcher', 'Market Researcher', 'discover', 'Analyzes market conditions, competition, and demand signals', ARRAY['market-analysis','competitive-intel','demand-forecasting'], 'claude-sonnet-4-6', 'agents/discover/market-researcher.md', '1.0.0'),
('ux-researcher', 'UX Researcher', 'discover', 'Maps user journeys, pain points, and interaction patterns', ARRAY['user-journey-mapping','pain-point-analysis','persona-development'], 'claude-sonnet-4-6', 'agents/discover/ux-researcher.md', '1.0.0'),
('deep-research-agent', 'Deep Research Agent', 'discover', 'Conducts exhaustive multi-source research and synthesis', ARRAY['web-research','synthesis','citation-management','fact-checking'], 'claude-sonnet-4-6', 'agents/discover/deep-research-agent.md', '1.0.0'),
('repo-index', 'Repo Index Agent', 'discover', 'Indexes and compresses repository context for downstream agents', ARRAY['repomix-compression','codebase-mapping','dependency-analysis'], 'ollama/hermes3', 'agents/discover/repo-index.md', '1.0.0'),
('deep-research', 'Deep Research', 'discover', 'Alternative deep research with different source strategy', ARRAY['academic-sources','patent-search','technical-documentation'], 'claude-sonnet-4-6', 'agents/discover/deep-research.md', '1.0.0'),
-- Phase 2: DESIGN
('system-architect', 'System Architect', 'design', 'Designs high-level system architecture and component boundaries', ARRAY['system-design','component-modeling','scalability-planning','fault-tolerance'], 'claude-sonnet-4-6', 'agents/design/system-architect.md', '1.0.0'),
('api-architect', 'API Architect', 'design', 'Designs RESTful and GraphQL APIs with security and versioning', ARRAY['api-design','openapi-spec','auth-flows','rate-limiting'], 'claude-sonnet-4-6', 'agents/design/api-architect.md', '1.0.0'),
('database-architect', 'Database Architect', 'design', 'Designs schemas, indexes, and data access patterns', ARRAY['schema-design','query-optimization','migration-planning','rls-policies'], 'claude-sonnet-4-6', 'agents/design/database-architect.md', '1.0.0'),
('frontend-architect', 'Frontend Architect', 'design', 'Designs component hierarchy, state management, and UX flows', ARRAY['component-design','state-management','accessibility','performance-budget'], 'claude-sonnet-4-6', 'agents/design/frontend-architect.md', '1.0.0'),
('backend-architect', 'Backend Architect', 'design', 'Designs server-side systems, service boundaries, and data pipelines', ARRAY['service-design','data-pipelines','caching-strategy','security-patterns'], 'claude-sonnet-4-6', 'agents/design/backend-architect.md', '1.0.0'),
-- Phase 3: BUILD
('python-expert', 'Python Expert', 'build', 'Implements Python services, scripts, and ML pipelines', ARRAY['python','fastapi','data-processing','ml-integration','testing'], 'claude-sonnet-4-6', 'agents/build/python-expert.md', '1.0.0'),
('data-engineer', 'Data Engineer', 'build', 'Builds data pipelines, ETL processes, and analytics systems', ARRAY['etl','streaming','sql','data-modeling','airflow'], 'claude-sonnet-4-6', 'agents/build/data-engineer.md', '1.0.0'),
('ml-engineer', 'ML Engineer', 'build', 'Implements and integrates machine learning models and inference', ARRAY['model-training','inference','embeddings','fine-tuning','evaluation'], 'claude-sonnet-4-6', 'agents/build/ml-engineer.md', '1.0.0'),
('integration-specialist', 'Integration Specialist', 'build', 'Connects external APIs, webhooks, and third-party services', ARRAY['api-integration','webhook-handling','oauth','n8n-workflows','stripe'], 'claude-sonnet-4-6', 'agents/build/integration-specialist.md', '1.0.0'),
('prompt-engineer', 'Prompt Engineer', 'build', 'Designs, tests, and optimizes prompts for AI systems', ARRAY['prompt-design','few-shot-learning','chain-of-thought','evaluation','optimization'], 'claude-sonnet-4-6', 'agents/build/prompt-engineer.md', '1.0.0'),
-- Phase 4: QUALITY
('code-reviewer', 'Code Reviewer', 'quality', 'Reviews code for correctness, maintainability, and best practices', ARRAY['code-review','refactoring','pattern-detection','documentation-review'], 'claude-sonnet-4-6', 'agents/quality/code-reviewer.md', '1.0.0'),
('security-engineer', 'Security Engineer', 'quality', 'Audits for security vulnerabilities, auth flaws, and data exposure', ARRAY['security-audit','owasp','auth-review','secrets-scanning','penetration-testing'], 'claude-sonnet-4-6', 'agents/quality/security-engineer.md', '1.0.0'),
('quality-engineer', 'Quality Engineer', 'quality', 'Defines and executes quality gates and acceptance testing', ARRAY['acceptance-testing','regression-testing','quality-metrics','test-planning'], 'claude-sonnet-4-6', 'agents/quality/quality-engineer.md', '1.0.0'),
('test-architect', 'Test Architect', 'quality', 'Designs comprehensive test strategies and automated test suites', ARRAY['test-strategy','unit-testing','integration-testing','e2e-testing','coverage'], 'claude-sonnet-4-6', 'agents/quality/test-architect.md', '1.0.0'),
('dependency-auditor', 'Dependency Auditor', 'quality', 'Audits dependencies for vulnerabilities, licenses, and bloat', ARRAY['dependency-analysis','vulnerability-scanning','license-compliance','tree-shaking'], 'ollama/hermes3', 'agents/quality/dependency-auditor.md', '1.0.0'),
('performance-engineer', 'Performance Engineer', 'quality', 'Profiles and optimizes system performance and resource usage', ARRAY['profiling','load-testing','query-optimization','caching','benchmarking'], 'claude-sonnet-4-6', 'agents/quality/performance-engineer.md', '1.0.0'),
('root-cause-analyst', 'Root Cause Analyst', 'quality', 'Investigates failures and identifies systemic root causes', ARRAY['failure-analysis','log-analysis','trace-analysis','5-whys','incident-response'], 'claude-sonnet-4-6', 'agents/quality/root-cause-analyst.md', '1.0.0'),
-- Phase 5: DEPLOY
('devops-architect', 'DevOps Architect', 'deploy', 'Designs CI/CD pipelines, infrastructure, and deployment strategies', ARRAY['ci-cd','docker','kubernetes','infrastructure-as-code','monitoring'], 'claude-sonnet-4-6', 'agents/deploy/devops-architect.md', '1.0.0'),
('deployment-engineer', 'Deployment Engineer', 'deploy', 'Executes deployments, smoke tests, and production verification', ARRAY['deployment','health-checks','rollback','smoke-testing','canary-releases'], 'claude-sonnet-4-6', 'agents/deploy/deployment-engineer.md', '1.0.0'),
-- Phase 6: MONETIZE
('monetization-strategist', 'Monetization Strategist', 'monetize', 'Designs revenue models, pricing strategies, and growth loops', ARRAY['revenue-modeling','pricing-strategy','growth-loops','ltv-optimization','conversion'], 'claude-sonnet-4-6', 'agents/monetize/monetization-strategist.md', '1.0.0'),
('content-strategist', 'Content Strategist', 'monetize', 'Plans content for acquisition, retention, and monetization', ARRAY['content-planning','seo','social-media','email-marketing','funnel-design'], 'claude-sonnet-4-6', 'agents/monetize/content-strategist.md', '1.0.0'),
('business-panel-experts', 'Business Panel Experts', 'monetize', 'Multi-expert business analysis from CEO/CFO/CMO perspectives', ARRAY['business-analysis','financial-modeling','market-positioning','go-to-market'], 'claude-sonnet-4-6', 'agents/monetize/business-panel-experts.md', '1.0.0'),
-- Phase 7: OPERATE
('metrics-analyst', 'Metrics Analyst', 'operate', 'Monitors KPIs, identifies anomalies, and drives data decisions', ARRAY['kpi-analysis','anomaly-detection','dashboards','reporting','ab-testing'], 'claude-sonnet-4-6', 'agents/operate/metrics-analyst.md', '1.0.0'),
('pm-agent', 'PM Agent', 'operate', 'Coordinates ongoing work, priorities, and team velocity', ARRAY['project-management','prioritization','velocity-tracking','blocker-resolution'], 'claude-sonnet-4-6', 'agents/operate/pm-agent.md', '1.0.0'),
('self-review', 'Self Review Agent', 'operate', 'Evaluates system outputs against objectives for continuous improvement', ARRAY['output-evaluation','quality-scoring','improvement-identification','regression-detection'], 'claude-sonnet-4-6', 'agents/operate/self-review.md', '1.0.0'),
('technical-writer', 'Technical Writer', 'operate', 'Produces documentation, runbooks, and API references', ARRAY['documentation','runbooks','api-docs','changelog','user-guides'], 'claude-sonnet-4-6', 'agents/operate/technical-writer.md', '1.0.0'),
('refactoring-expert', 'Refactoring Expert', 'operate', 'Identifies and executes code quality improvements and tech debt paydown', ARRAY['code-smells','design-patterns','tech-debt','performance-refactoring'], 'claude-sonnet-4-6', 'agents/operate/refactoring-expert.md', '1.0.0'),
('learning-guide', 'Learning Guide', 'operate', 'Synthesizes learnings from sessions and produces improvement recommendations', ARRAY['pattern-extraction','lesson-documentation','knowledge-synthesis','training-data'], 'claude-sonnet-4-6', 'agents/operate/learning-guide.md', '1.0.0'),
('socratic-mentor', 'Socratic Mentor', 'operate', 'Facilitates deep thinking via structured questioning and exploration', ARRAY['socratic-method','requirements-discovery','assumption-challenging','design-review'], 'claude-sonnet-4-6', 'agents/operate/socratic-mentor.md', '1.0.0')
ON CONFLICT (agent_id) DO NOTHING;
