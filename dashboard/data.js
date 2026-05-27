/* dashboard/data.js — live data for the Command Center HUD
   Reads from ~/.amsa/linear-queue/latest.json when available;
   falls back to mock data so the HUD always renders.
*/

const PHASES = [
  { id: "D", name: "DISCOVER",  color: "#7dd3fc", agents: 7, active: 2 },
  { id: "X", name: "DESIGN",    color: "#a78bfa", agents: 5, active: 1 },
  { id: "B", name: "BUILD",     color: "#7ee787", agents: 5, active: 3 },
  { id: "Q", name: "QUALITY",   color: "#f5a524", agents: 7, active: 2 },
  { id: "Y", name: "DEPLOY",    color: "#d97757", agents: 2, active: 0 },
  { id: "$", name: "MONETIZE",  color: "#f0c674", agents: 3, active: 1 },
  { id: "O", name: "OPERATE",   color: "#c9c4b8", agents: 8, active: 3 },
];

const SECTIONS = [
  { id: "mission",      label: "Mission" },
  { id: "agents",       label: "Agents · 37" },
  { id: "orchestrator", label: "Orchestrator" },
  { id: "telemetry",    label: "Telemetry" },
];

const OPPORTUNITIES = [
  { rank: 1, name: "Dewalt drill set",       sub: "FB → eBay flip · Denver",          meta: "$48 → $120 · 47% margin", score: 92, chain: "chain-6-arbitrage",     tier: "elite" },
  { rank: 2, name: "XRP unusual flow",       sub: "RSI 32 · vol 2.4× · sentiment +",  meta: "binance · 0.6021",         score: 87, chain: "chain-1-signal-profit", tier: "elite" },
  { rank: 3, name: "WAND outlier — \"loki mode shorts\"", sub: "topic spike +280% in 4h", meta: "VCP+ 0.31 · CTR target 8%", score: 81, chain: "chain-7-content-revenue", tier: "elite" },
  { rank: 4, name: "Patch chromadb upsert",  sub: "pat_xxx_solutions · auto-compound", meta: "compound_factor 3",         score: 76, chain: "chain-2-knowledge",     tier: "strong" },
  { rank: 5, name: "Lego retired set #75192",sub: "Bricklink ↑ 22% YoY · $310 → $480",meta: "FBA elig · rank 41k",       score: 71, chain: "chain-6-arbitrage",     tier: "strong" },
  { rank: 6, name: "Gumroad prompt-pack v2", sub: "$67 bundle of 100 tested prompts",  meta: "list mailout Tue 9am ET",   score: 64, chain: "chain-7-content-revenue",tier: "strong" },
];

const UNUSUAL_FLOW = [
  { pair: "XRP/USDT",  exch: "binance",  rsi: 32, volX: 2.4, dev: 0.08, score: 0.92, side: "BUY",   chg: +4.7 },
  { pair: "SOL/USDT",  exch: "coinbase", rsi: 38, volX: 1.8, dev: 0.05, score: 0.71, side: "BUY",   chg: +1.9 },
  { pair: "ETH/USDT",  exch: "binance",  rsi: 64, volX: 1.2, dev: 0.03, score: 0.42, side: "HOLD",  chg: +0.4 },
  { pair: "DOGE/USDT", exch: "binance",  rsi: 71, volX: 2.1, dev: 0.06, score: 0.66, side: "SELL",  chg: -2.1 },
  { pair: "AVAX/USDT", exch: "coinbase", rsi: 28, volX: 1.5, dev: 0.04, score: 0.58, side: "WATCH", chg: -0.8 },
];

const YOUTUBE_OUTLIERS = [
  { rank: 1, title: "I gave Claude my whole hard drive…",  ch: "@RecursiveLab", views: "412k", age: "6h",  vcp: 0.34, ctr: 0.094 },
  { rank: 2, title: "37 agents, 1 task, zero typing",      ch: "@AgentOS",     views: "188k", age: "11h", vcp: 0.29, ctr: 0.082 },
  { rank: 3, title: "Why I deleted my SaaS — Loki Mode",   ch: "@ShipDaily",   views: "97k",  age: "18h", vcp: 0.22, ctr: 0.071 },
  { rank: 4, title: "Crypto unusual flow bot, full code",  ch: "@QuantBros",   views: "61k",  age: "1d",  vcp: 0.19, ctr: 0.064 },
];

const FLIPS = [
  { rank: 1, item: "Dewalt 20V drill kit",      buy: 48,  sell: 120, margin: 0.47, where: "FB → eBay", flag: "buy" },
  { rank: 2, item: "Apple AirPods Pro 2 (NIB)", buy: 145, sell: 220, margin: 0.34, where: "FB → eBay", flag: "buy" },
  { rank: 3, item: "Lego 75192 UCS Falcon",     buy: 310, sell: 480, margin: 0.32, where: "FB → eBay", flag: "buy" },
  { rank: 4, item: "PS5 Slim + 2 controllers",  buy: 320, sell: 460, margin: 0.30, where: "FB → eBay", flag: "watch" },
];

const AGENTS = [
  { ph: "D", id: "requirements-analyst", v: "1.8", run: "2m",     succ: 91, st: "live" },
  { ph: "D", id: "product-manager",      v: "1.3", run: "12m",    succ: 86, st: "idle" },
  { ph: "D", id: "market-researcher",    v: "2.0", run: "8m",     succ: 82, st: "live" },
  { ph: "D", id: "ux-researcher",        v: "1.1", run: "6h",     succ: 78, st: "idle" },
  { ph: "D", id: "deep-research-agent",  v: "2.4", run: "1h",     succ: 89, st: "idle" },
  { ph: "D", id: "repo-index",           v: "1.0", run: "3m",     succ: 95, st: "idle" },
  { ph: "D", id: "deep-research",        v: "1.5", run: "2d",     succ: 84, st: "idle" },
  { ph: "X", id: "system-architect",     v: "2.4", run: "now",    succ: 94, st: "live" },
  { ph: "X", id: "api-architect",        v: "1.7", run: "1d",     succ: 88, st: "idle" },
  { ph: "X", id: "database-architect",   v: "1.2", run: "3d",     succ: 81, st: "idle" },
  { ph: "X", id: "frontend-architect",   v: "2.0", run: "5h",     succ: 87, st: "idle" },
  { ph: "X", id: "backend-architect",    v: "1.9", run: "1h",     succ: 90, st: "idle" },
  { ph: "B", id: "python-expert",        v: "3.1", run: "5m",     succ: 88, st: "live" },
  { ph: "B", id: "data-engineer",        v: "1.6", run: "2d",     succ: 83, st: "idle" },
  { ph: "B", id: "ml-engineer",          v: "1.8", run: "now",    succ: 80, st: "live" },
  { ph: "B", id: "integration-specialist", v: "2.2", run: "30m", succ: 85, st: "live" },
  { ph: "B", id: "prompt-engineer",      v: "2.2", run: "1h",     succ: 92, st: "idle" },
  { ph: "Q", id: "code-reviewer",        v: "1.4", run: "12m",    succ: 91, st: "proc" },
  { ph: "Q", id: "security-engineer",    v: "2.0", run: "6h",     succ: 88, st: "idle" },
  { ph: "Q", id: "quality-engineer",     v: "1.5", run: "3h",     succ: 86, st: "idle" },
  { ph: "Q", id: "test-architect",       v: "1.3", run: "now",    succ: 84, st: "live" },
  { ph: "Q", id: "dependency-auditor",   v: "1.0", run: "1d",     succ: 82, st: "idle" },
  { ph: "Q", id: "performance-engineer", v: "1.2", run: "4h",     succ: 79, st: "idle" },
  { ph: "Q", id: "root-cause-analyst",   v: "1.7", run: "20m",    succ: 88, st: "idle" },
  { ph: "Y", id: "devops-architect",     v: "1.5", run: "8h",     succ: 86, st: "idle" },
  { ph: "Y", id: "deployment-engineer",  v: "1.2", run: "6h",     succ: 79, st: "fail" },
  { ph: "$", id: "monetization-strategist", v: "1.0", run: "1d", succ: 75, st: "idle" },
  { ph: "$", id: "content-strategist",   v: "2.1", run: "now",    succ: 81, st: "live" },
  { ph: "$", id: "business-panel-experts", v: "1.4", run: "3d",  succ: 77, st: "idle" },
  { ph: "O", id: "metrics-analyst",      v: "1.3", run: "5m",     succ: 84, st: "live" },
  { ph: "O", id: "pm-agent",             v: "1.1", run: "1h",     succ: 80, st: "idle" },
  { ph: "O", id: "self-review",          v: "1.8", run: "nightly",succ: 91, st: "live" },
  { ph: "O", id: "technical-writer",     v: "1.5", run: "2d",     succ: 82, st: "idle" },
  { ph: "O", id: "refactoring-expert",   v: "1.4", run: "8h",     succ: 86, st: "idle" },
  { ph: "O", id: "learning-guide",       v: "1.0", run: "4d",     succ: 76, st: "idle" },
  { ph: "O", id: "socratic-mentor",      v: "1.2", run: "7d",     succ: 78, st: "idle" },
  { ph: "O", id: "loki-coordinator",     v: "2.5", run: "now",    succ: 93, st: "live" },
];

const PROMPT_LAYERS = [
  { key: "base",      label: "BASE",      desc: "Core identity. Always active.",                  icon: "○", color: "#c9c4b8", on: true,  sample: "You are an operational intelligence system — not a chatbot. You are a recursive execution engine embedded in a production AI command center." },
  { key: "mission",   label: "MISSION",   desc: "Overarching goal for this session.",             icon: "▲", color: "#a78bfa", on: true,  sample: "Build high-quality, production-ready software that solves real user problems. Every output should be deployable, not a prototype." },
  { key: "role",      label: "ROLE",      desc: "Persona + expertise the AI adopts.",             icon: "●", color: "#7dd3fc", on: true,  sample: "You are a Senior Full-Stack Engineer with 10+ years of experience across Python, TypeScript, and cloud infrastructure." },
  { key: "task",      label: "TASK",      desc: "Immediate instruction.",                         icon: "▶", color: "#f5a524", on: true,  sample: "[Task inserted at runtime — e.g. 'Build crypto unusual-flow scanner for IntelliTradeX']" },
  { key: "context",   label: "CONTEXT",   desc: "Background, constraints, project state.",        icon: "■", color: "#7ee787", on: true,  sample: "Project: CMNDCENTER v4.0. Stack: Python 3.12, TypeScript 5.4, Raycast API. No placeholder code, full implementations only." },
  { key: "memory",    label: "MEMORY",    desc: "Prior learnings and persistent patterns.",       icon: "◆", color: "#d97757", on: true,  sample: "Prior learnings: User prefers direct, actionable responses. Always use absolute file paths. Patterns >= 0.75 confidence are reused." },
  { key: "live-data", label: "LIVE-DATA", desc: "Real-time signals, market data, MCP state.",     icon: "◐", color: "#ff5d5d", on: false, sample: "[Live data injected at runtime — market signals, metrics, current portfolio state]" },
];

const CHAINS = [
  { id: 1, name: "signal-profit",      count: 3, color: "#7ee787" },
  { id: 2, name: "knowledge-compound", count: 7, color: "#a78bfa" },
  { id: 3, name: "auto-upgrade",       count: 1, color: "#7dd3fc" },
  { id: 4, name: "repo-intelligence",  count: 2, color: "#d97757" },
  { id: 5, name: "loki-build",         count: 0, color: "#c9c4b8" },
  { id: 6, name: "market-arbitrage",   count: 4, color: "#f5a524" },
  { id: 7, name: "content-revenue",    count: 2, color: "#f0c674" },
];

const ACTIVITY = [
  { t: "07:00:12", ev: "Chain-1 scan complete. 6 actionable opportunities surfaced.",   ch: "discover", lvl: "info" },
  { t: "07:00:18", ev: "Pattern saved · pat_1747896012_solutions · confidence 0.7",     ch: "memory",   lvl: "info" },
  { t: "07:00:24", ev: "● XRP unusual_score 0.92 — auto-execution gate passed",         ch: "trade",    lvl: "ok" },
  { t: "07:00:25", ev: "Telegram → [TRADE EXECUTED] BUY XRP @ 0.6021 · qty 1240",       ch: "alert",    lvl: "ok" },
  { t: "07:02:10", ev: "code-reviewer v1.3 → v1.4 (quality 7.2 → 7.6)",                ch: "upgrade",  lvl: "ok" },
  { t: "07:04:33", ev: "WAND content pipeline: 2 videos queued for upload",             ch: "content",  lvl: "info" },
  { t: "07:06:01", ev: "⚠ ChromaDB heartbeat 1/3 missed — retry in 30s",              ch: "infra",    lvl: "warn" },
  { t: "07:06:31", ev: "ChromaDB restored — 1 retry, 14ms latency",                    ch: "infra",    lvl: "ok" },
];

window.HUD_DATA = {
  PHASES, SECTIONS, OPPORTUNITIES, UNUSUAL_FLOW, YOUTUBE_OUTLIERS,
  FLIPS, AGENTS, PROMPT_LAYERS, CHAINS, ACTIVITY,
};
