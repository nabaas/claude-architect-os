/**
 * agent-registry.ts
 * Registry of all 37 Loki Mode agents matching CMNDCENTER's phase architecture.
 * Each agent maps to a phase, has capabilities, and a preferred model.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type AgentPhase =
  | "discover"
  | "design"
  | "build"
  | "quality"
  | "deploy"
  | "monetize"
  | "operate"
  | "meta";

export interface Agent {
  id: string;
  name: string;
  phase: AgentPhase;
  description: string;
  capabilities: string[];
  defaultModel: string;
  /** Keyword patterns used by routeToAgent for matching */
  keywords: string[];
}

// ── Agent definitions ──────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  // ── Phase 1: DISCOVER ────────────────────────────────────────────────────
  {
    id: "requirements-analyst",
    name: "Requirements Analyst",
    phase: "discover",
    description:
      "Extracts structured requirements from vague user inputs and translates them into actionable specs.",
    capabilities: [
      "requirement extraction",
      "user story generation",
      "acceptance criteria",
      "scope definition",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["requirement", "spec", "scope", "user story", "feature"],
  },
  {
    id: "product-manager",
    name: "Product Manager",
    phase: "discover",
    description:
      "Defines product vision, roadmap priorities, and success metrics aligned to business goals.",
    capabilities: [
      "roadmap planning",
      "priority scoring",
      "KPI definition",
      "stakeholder alignment",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["roadmap", "product", "priority", "kpi", "milestone"],
  },
  {
    id: "market-researcher",
    name: "Market Researcher",
    phase: "discover",
    description:
      "Analyzes market opportunities, competitive landscape, and monetization potential.",
    capabilities: [
      "competitive analysis",
      "market sizing",
      "trend identification",
      "opportunity scoring",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["market", "competition", "competitor", "trend", "opportunity"],
  },
  {
    id: "ux-researcher",
    name: "UX Researcher",
    phase: "discover",
    description:
      "Designs user journeys, identifies pain points, and validates assumptions with user research patterns.",
    capabilities: [
      "user journey mapping",
      "pain point analysis",
      "persona creation",
      "usability heuristics",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["ux", "user experience", "persona", "journey", "usability"],
  },
  {
    id: "deep-research-agent",
    name: "Deep Research Agent",
    phase: "discover",
    description:
      "Performs exhaustive technical and domain research using web search and knowledge synthesis.",
    capabilities: [
      "web research",
      "technical deep-dive",
      "paper summarization",
      "knowledge synthesis",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["research", "deep dive", "study", "investigate", "survey"],
  },
  {
    id: "repo-index",
    name: "Repo Index",
    phase: "discover",
    description:
      "Indexes and compresses repository context for efficient multi-agent consumption via Repomix.",
    capabilities: [
      "repo indexing",
      "context compression",
      "dependency mapping",
      "codebase summarization",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["repo", "index", "codebase", "compress", "repomix"],
  },
  {
    id: "deep-research",
    name: "Deep Research",
    phase: "discover",
    description:
      "Broad discovery agent that orchestrates multi-source research across technical and business domains.",
    capabilities: [
      "multi-source synthesis",
      "domain bridging",
      "signal extraction",
      "insight generation",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["explore", "discover", "insight", "synthesis"],
  },

  // ── Phase 2: DESIGN ──────────────────────────────────────────────────────
  {
    id: "system-architect",
    name: "System Architect",
    phase: "design",
    description:
      "Designs overall system architecture including service boundaries, data flows, and scalability patterns.",
    capabilities: [
      "system design",
      "architecture diagrams",
      "scalability patterns",
      "service decomposition",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["architecture", "system design", "scalability", "services"],
  },
  {
    id: "api-architect",
    name: "API Architect",
    phase: "design",
    description:
      "Designs RESTful and GraphQL APIs with OpenAPI specs, auth patterns, and versioning strategies.",
    capabilities: [
      "REST design",
      "GraphQL schemas",
      "OpenAPI spec",
      "auth patterns",
      "versioning",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["api", "rest", "graphql", "endpoint", "openapi", "swagger"],
  },
  {
    id: "database-architect",
    name: "Database Architect",
    phase: "design",
    description:
      "Designs data models, schemas, migration strategies, and storage selection for SQL/NoSQL systems.",
    capabilities: [
      "schema design",
      "data modeling",
      "migration planning",
      "query optimization",
      "storage selection",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["database", "schema", "sql", "nosql", "data model", "migration"],
  },
  {
    id: "frontend-architect",
    name: "Frontend Architect",
    phase: "design",
    description:
      "Designs component hierarchies, state management, accessibility patterns, and performance budgets.",
    capabilities: [
      "component design",
      "state management",
      "WCAG compliance",
      "performance budgeting",
      "design systems",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: [
      "frontend",
      "ui",
      "component",
      "react",
      "accessibility",
      "design system",
    ],
  },
  {
    id: "backend-architect",
    name: "Backend Architect",
    phase: "design",
    description:
      "Designs server-side logic, microservice patterns, queue systems, and reliability strategies.",
    capabilities: [
      "microservice design",
      "queue architecture",
      "reliability patterns",
      "caching strategies",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["backend", "server", "microservice", "queue", "worker"],
  },

  // ── Phase 3: BUILD ───────────────────────────────────────────────────────
  {
    id: "python-expert",
    name: "Python Expert",
    phase: "build",
    description:
      "Implements Python services, scripts, and data pipelines with idiomatic patterns and type safety.",
    capabilities: [
      "python implementation",
      "async patterns",
      "type annotations",
      "packaging",
      "testing",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["python", "fastapi", "django", "flask", "asyncio", "script"],
  },
  {
    id: "data-engineer",
    name: "Data Engineer",
    phase: "build",
    description:
      "Builds ETL pipelines, data warehouses, streaming systems, and analytics infrastructure.",
    capabilities: [
      "ETL pipelines",
      "data warehousing",
      "streaming",
      "Spark",
      "Airflow",
      "dbt",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["data pipeline", "etl", "warehouse", "streaming", "spark"],
  },
  {
    id: "ml-engineer",
    name: "ML Engineer",
    phase: "build",
    description:
      "Implements ML models, training pipelines, embeddings, and inference optimization.",
    capabilities: [
      "model training",
      "embeddings",
      "fine-tuning",
      "inference optimization",
      "MLOps",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["ml", "machine learning", "model", "embedding", "training"],
  },
  {
    id: "integration-specialist",
    name: "Integration Specialist",
    phase: "build",
    description:
      "Builds third-party integrations, webhook handlers, and API connectors with proper error handling.",
    capabilities: [
      "API integration",
      "webhook handling",
      "OAuth flows",
      "SDK wrapping",
      "retry logic",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["integration", "webhook", "oauth", "connector", "sdk"],
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    phase: "build",
    description:
      "Designs and optimizes prompts for reliability, consistency, and cost efficiency across AI models.",
    capabilities: [
      "prompt design",
      "chain-of-thought",
      "few-shot examples",
      "output structuring",
      "caching optimization",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["prompt", "llm", "chain of thought", "few-shot", "system prompt"],
  },

  // ── Phase 4: QUALITY ─────────────────────────────────────────────────────
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    phase: "quality",
    description:
      "Reviews code for correctness, maintainability, naming, and adherence to project conventions.",
    capabilities: [
      "code review",
      "style enforcement",
      "logic verification",
      "refactor suggestions",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["review", "code quality", "lint", "style", "readability"],
  },
  {
    id: "security-engineer",
    name: "Security Engineer",
    phase: "quality",
    description:
      "Identifies security vulnerabilities, OWASP top-10 risks, and hardening opportunities.",
    capabilities: [
      "vulnerability scanning",
      "OWASP analysis",
      "secret detection",
      "dependency audit",
      "threat modeling",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["security", "vulnerability", "owasp", "exploit", "auth bypass"],
  },
  {
    id: "quality-engineer",
    name: "Quality Engineer",
    phase: "quality",
    description:
      "Defines test strategies, acceptance criteria, and quality gates across the full delivery pipeline.",
    capabilities: [
      "test strategy",
      "acceptance criteria",
      "quality gates",
      "regression planning",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["qa", "quality", "test strategy", "acceptance", "gate"],
  },
  {
    id: "test-architect",
    name: "Test Architect",
    phase: "quality",
    description:
      "Designs and implements unit, integration, and e2e test suites with high coverage targets.",
    capabilities: [
      "unit tests",
      "integration tests",
      "e2e tests",
      "mocking",
      "coverage analysis",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["unit test", "e2e", "integration test", "jest", "pytest", "coverage"],
  },
  {
    id: "dependency-auditor",
    name: "Dependency Auditor",
    phase: "quality",
    description:
      "Audits package dependencies for vulnerabilities, license compliance, and bloat.",
    capabilities: [
      "dependency scanning",
      "CVE detection",
      "license audit",
      "bundle analysis",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["dependency", "package", "cve", "license", "npm audit"],
  },
  {
    id: "performance-engineer",
    name: "Performance Engineer",
    phase: "quality",
    description:
      "Analyzes and optimizes runtime performance, Core Web Vitals, and resource utilization.",
    capabilities: [
      "performance profiling",
      "Core Web Vitals",
      "memory analysis",
      "query optimization",
      "load testing",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["performance", "optimization", "speed", "latency", "web vitals"],
  },
  {
    id: "root-cause-analyst",
    name: "Root Cause Analyst",
    phase: "quality",
    description:
      "Performs systematic root cause analysis on bugs, incidents, and regressions.",
    capabilities: [
      "root cause analysis",
      "incident post-mortem",
      "bug bisection",
      "hypothesis testing",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["bug", "error", "crash", "root cause", "incident", "regression"],
  },

  // ── Phase 5: DEPLOY ──────────────────────────────────────────────────────
  {
    id: "devops-architect",
    name: "DevOps Architect",
    phase: "deploy",
    description:
      "Designs CI/CD pipelines, infrastructure-as-code, and container orchestration strategies.",
    capabilities: [
      "CI/CD design",
      "Terraform",
      "Docker",
      "Kubernetes",
      "GitOps",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["devops", "cicd", "pipeline", "docker", "kubernetes", "terraform"],
  },
  {
    id: "deployment-engineer",
    name: "Deployment Engineer",
    phase: "deploy",
    description:
      "Executes deployments, manages rollouts, and handles rollback procedures safely.",
    capabilities: [
      "deployment execution",
      "blue/green deploys",
      "canary releases",
      "rollback procedures",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["deploy", "release", "rollout", "canary", "rollback"],
  },

  // ── Phase 6: MONETIZE ────────────────────────────────────────────────────
  {
    id: "monetization-strategist",
    name: "Monetization Strategist",
    phase: "monetize",
    description:
      "Designs pricing models, revenue streams, and growth loops for sustainable monetization.",
    capabilities: [
      "pricing strategy",
      "revenue modeling",
      "freemium design",
      "growth loops",
      "LTV optimization",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["monetize", "pricing", "revenue", "freemium", "subscription"],
  },
  {
    id: "content-strategist",
    name: "Content Strategist",
    phase: "monetize",
    description:
      "Creates content plans, SEO strategies, and distribution channels to drive organic growth.",
    capabilities: [
      "content planning",
      "SEO optimization",
      "distribution strategy",
      "audience building",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["content", "seo", "blog", "distribution", "audience"],
  },
  {
    id: "business-panel-experts",
    name: "Business Panel Experts",
    phase: "monetize",
    description:
      "Multi-expert business panel providing financial projections, go-to-market plans, and investment readiness.",
    capabilities: [
      "financial modeling",
      "GTM planning",
      "investor pitch",
      "unit economics",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["business", "gtm", "investor", "financial", "unit economics"],
  },

  // ── Phase 7: OPERATE ─────────────────────────────────────────────────────
  {
    id: "metrics-analyst",
    name: "Metrics Analyst",
    phase: "operate",
    description:
      "Tracks product and business metrics, builds dashboards, and surfaces actionable insights.",
    capabilities: [
      "metrics definition",
      "dashboard design",
      "anomaly detection",
      "reporting",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["metrics", "analytics", "dashboard", "reporting", "kpi tracking"],
  },
  {
    id: "pm-agent",
    name: "PM Agent",
    phase: "operate",
    description:
      "Manages sprint execution, Linear/Notion task tracking, and team coordination.",
    capabilities: [
      "sprint management",
      "task tracking",
      "Linear integration",
      "Notion sync",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["sprint", "linear", "notion", "task", "backlog"],
  },
  {
    id: "self-review",
    name: "Self Review",
    phase: "operate",
    description:
      "Evaluates agent outputs for quality, correctness, and alignment with original requirements.",
    capabilities: [
      "output evaluation",
      "requirement alignment",
      "quality scoring",
      "improvement suggestions",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["review", "evaluate", "self-assess", "quality check"],
  },
  {
    id: "technical-writer",
    name: "Technical Writer",
    phase: "operate",
    description:
      "Produces clear technical documentation, API references, and user guides.",
    capabilities: [
      "README generation",
      "API documentation",
      "user guides",
      "changelog writing",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["docs", "documentation", "readme", "guide", "changelog"],
  },
  {
    id: "refactoring-expert",
    name: "Refactoring Expert",
    phase: "operate",
    description:
      "Improves code structure, eliminates technical debt, and enforces architectural consistency.",
    capabilities: [
      "code refactoring",
      "tech debt reduction",
      "pattern extraction",
      "naming improvement",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["refactor", "tech debt", "cleanup", "restructure", "simplify"],
  },
  {
    id: "learning-guide",
    name: "Learning Guide",
    phase: "operate",
    description:
      "Distills session learnings, creates skill-building plans, and generates training materials.",
    capabilities: [
      "learning synthesis",
      "skill gap analysis",
      "tutorial creation",
      "knowledge transfer",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["learn", "training", "tutorial", "skill", "knowledge"],
  },
  {
    id: "socratic-mentor",
    name: "Socratic Mentor",
    phase: "operate",
    description:
      "Asks probing questions to surface hidden assumptions and guide deeper thinking.",
    capabilities: [
      "Socratic questioning",
      "assumption surfacing",
      "critical thinking",
      "decision facilitation",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["why", "assumption", "question", "challenge", "think deeper"],
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  {
    id: "loki-coordinator",
    name: "Loki Coordinator",
    phase: "meta",
    description:
      "Orchestrates all 37 agents across phases, manages phase transitions, and aggregates results.",
    capabilities: [
      "phase orchestration",
      "agent dispatch",
      "result aggregation",
      "build coordination",
    ],
    defaultModel: "claude-sonnet-4-6",
    keywords: ["orchestrate", "coordinate", "loki", "full build", "all phases"],
  },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns all registered agents.
 */
export function getAllAgents(): Agent[] {
  return [...AGENTS];
}

/**
 * Returns agents filtered by phase.
 *
 * @param phase  One of the AgentPhase values
 */
export function getAgentsByPhase(phase: AgentPhase): Agent[] {
  return AGENTS.filter((a) => a.phase === phase);
}

/**
 * Finds an agent by its unique ID.
 */
export function getAgentById(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

/**
 * Routes a task description to the most appropriate agent
 * by scoring keyword matches across all agents.
 * Falls back to loki-coordinator if no match is found.
 *
 * @param task  Natural language task description
 */
export function routeToAgent(task: string): Agent {
  const normalised = task.toLowerCase();

  let bestAgent: Agent | undefined;
  let bestScore = -1;

  for (const agent of AGENTS) {
    let score = 0;
    for (const kw of agent.keywords) {
      if (normalised.includes(kw.toLowerCase())) {
        // Longer keyword matches are more specific — weight by length
        score += kw.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  // Return best match or fall back to the coordinator
  return bestAgent ?? (AGENTS.find((a) => a.id === "loki-coordinator") as Agent);
}

/**
 * Returns all unique phases in pipeline order.
 */
export const PHASE_ORDER: AgentPhase[] = [
  "discover",
  "design",
  "build",
  "quality",
  "deploy",
  "monetize",
  "operate",
  "meta",
];
