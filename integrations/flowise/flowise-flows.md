# Flowise — Claude Architect OS Flows

Flowise runs at http://localhost:3001 (add to docker-compose if needed).

## Setup

```bash
npm install -g flowise
flowise start --PORT=3001 --FLOWISE_USERNAME=admin --FLOWISE_PASSWORD=yourpassword
```

## Core Flows to Import

### Flow 1: Market Intelligence RAG
```
FileLoader (market-signals JSON)
  → TextSplitter (1000 tokens, 200 overlap)
  → Ollama Embeddings (nomic-embed-text)
  → ChromaDB Vector Store
  → Retrieval QA Chain
    → Claude Sonnet 4.6 (via LiteLLM proxy localhost:4000)
    → "Given these market signals, what are the top 3 arbitrage opportunities?"
```

### Flow 2: Memory-Augmented Claude
```
ChatAnthropic (claude-sonnet-4-6)
  + BufferMemory (last 10 messages)
  + ChromaDB Retriever (query ~/.amsa/memory/ patterns)
  → ConversationRetrievalChain
  → Output: response + extracted_patterns[]
```

### Flow 3: Agent Orchestrator
```
OpenAI Functions Agent
  + Tool: BrowserTool (market scanning)
  + Tool: SerpAPI (trend detection)
  + Tool: Calculator (ROI scoring)
  + Tool: WriteFileTool (→ ~/.amsa/linear-queue/)
  → Claude Sonnet 4.6
  → Final answer: opportunity report
```

### Flow 4: Loki Mode Trigger
```
WebhookTrigger (POST /webhook/loki)
  → CustomFunction: parse requirement
  → HTTP Request: POST localhost:5678/webhook/loki-trigger
  → n8n executes Loki pipeline
  → Response: build status URL
```

## Environment Variables (Flowise)
```
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key (for tools that need OpenAI format)
CHROMA_URL=http://localhost:8000
FLOWISE_PORT=3001
```
