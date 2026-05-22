# Make.com (Integromat) — Claude Architect OS Scenarios

Make.com provides visual automation with 1000+ app integrations.
Complements n8n for workflows requiring third-party SaaS integrations.

## Setup

1. Sign up at make.com
2. Install the Make app on Raycast (if available) or use webhooks
3. Create scenarios below

---

## Scenario 1: eBay Price Alert → Arbitrage Scanner

**Trigger:** eBay Price Drop Alert (via eBay API or email parse)
**Flow:**
```
eBay Price Alert
  → HTTP POST to ~/CMNDCENTER/repos/claude-architect-os webhook
  → profit-systems/arbitrage/scanner.ts analyzeArbitrageOpportunity()
  → If margin > 30%: Telegram alert
  → Write to ~/.amsa/linear-queue/
```

**Webhook URL:** `http://localhost:5678/webhook/make-ebay-alert`
*(Expose externally: `ngrok http 5678` → use generated HTTPS URL)*

---

## Scenario 2: TikTok Trending → WAND Content

**Trigger:** TikTok Trending Topics API (via RapidAPI)
**Flow:**
```
TikTok Trending (every 4h)
  → Filter: view_count > 1M
  → HTTP POST to n8n (localhost:5678/webhook/wand-trigger)
  → WAND generates video script for trending topic
  → Open-LLM-VTuber records narration
  → YouTube upload
```

---

## Scenario 3: Google Alerts → Market Intelligence

**Trigger:** Google Alerts RSS feed for monitored keywords
**Flow:**
```
Google Alert: ["AI tool", "marketplace arbitrage", "crypto signal"]
  → Parse article text
  → Claude API: extract opportunity score
  → If score > 0.7: add to ~/.amsa/linear-queue/
  → Telegram notification
```

---

## Scenario 4: Stripe Revenue → Dashboard Update

**Trigger:** Stripe payment received
**Flow:**
```
Stripe webhook: payment.succeeded
  → Parse: amount, product, customer
  → Supabase INSERT INTO revenue_events
  → Update Notion revenue tracker page
  → Telegram: "💰 Payment received: $X from Y"
  → Recalculate monthly P&L in Supabase
```

---

## Scenario 5: GitHub Release → WAND Changelog Video

**Trigger:** GitHub Release published (any CMNDCENTER repo)
**Flow:**
```
GitHub Release webhook
  → Extract: version, changelog, key features
  → Claude: generate 60-second changelog video script
  → WAND queue: add to next day's content
  → Telegram: "📦 Release v{X} — changelog video scheduled"
```

---

## Scenario 6: iPhone Shortcut → Loki Build

**Trigger:** iOS Shortcut webhook (from Pushcut or Apple Shortcuts)
**Flow:**
```
iPhone Shortcut: "Build [voice input]"
  → Make HTTP POST to n8n webhook
  → n8n triggers: bash ~/CMNDCENTER/loki/loki.sh "[requirement]"
  → Loki runs 37-agent build
  → Telegram: "🔱 Build complete: [repo URL]"
  → Make: update Notion project page
```

---

## Webhook Base URL

Point all Make scenarios to:
```
http://localhost:5678/webhook/make-{scenario-name}
```

Or expose via ngrok for external triggers:
```bash
ngrok http 5678
# Use: https://your-ngrok-url.ngrok.io/webhook/make-{scenario-name}
```

---

## Make vs n8n Decision Matrix

| Use Case | Use Make | Use n8n |
|----------|---------|---------|
| SaaS app integrations (Stripe, HubSpot) | ✅ | |
| Complex logic + code execution | | ✅ |
| Self-hosted, privacy-sensitive | | ✅ |
| Rapid visual prototyping | ✅ | |
| CMNDCENTER internal workflows | | ✅ |
| Third-party API connectors | ✅ | |
