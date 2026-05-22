# Execution Dashboard — Claude Architect OS

Next.js + Tailwind + shadcn/ui dashboard for real-time monitoring.

## Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui + Tremor
- **Data**: Supabase real-time subscriptions
- **Charts**: Recharts + Tremor
- **Auth**: Supabase Auth

## Setup

```bash
cd dashboard
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn-ui@latest init
npm install @tremor/react recharts @supabase/supabase-js
npm run dev  # http://localhost:3002
```

## Panels

| Panel | Component | Data Source |
|-------|-----------|------------|
| Opportunity Feed | `OpportunityFeed.tsx` | `~/.amsa/linear-queue/latest.json` via Supabase |
| Flip Scanner | `FlipScanner.tsx` | `market_signals` table, real-time |
| Agent Status | `AgentStatus.tsx` | `agents/registry.json` + active processes |
| Profit Heatmap | `ProfitHeatmap.tsx` | `opportunities` table, last 30 days |
| Trend Monitor | `TrendMonitor.tsx` | `market_signals` table, type=trend |
| Repo Health | `RepoHealth.tsx` | GitHub API + git status |
| Prompt Lab | `PromptLab.tsx` | Live Claude API calls |
| Workflow Monitor | `WorkflowMonitor.tsx` | n8n API localhost:5678 |

## Key Component: Opportunity Feed

```tsx
// dashboard/components/OpportunityFeed.tsx
import { createClient } from "@supabase/supabase-js";
import { Card, Table, Badge } from "@tremor/react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function OpportunityFeed() {
  // Real-time subscription to market_signals table
  // Displays: product, score, margin%, TTF, action
}
```

## n8n Dashboard Webhook

POST to `http://localhost:5678/webhook/dashboard-update` to push live updates:
```json
{
  "type": "opportunity",
  "data": { "product": "...", "score": 0.87, "margin": 0.42 }
}
```

## Deploy to Vercel

```bash
vercel --prod
# Set env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```
