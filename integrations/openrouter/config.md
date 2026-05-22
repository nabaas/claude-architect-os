# OpenRouter — Claude Architect OS Integration

OpenRouter provides a unified API endpoint for 200+ models with fallback routing.
Used as the tertiary fallback when both Claude and Ollama are unavailable.

## Setup

```bash
export OPENROUTER_API_KEY="your_key_from_openrouter.ai"
```

Add to `.env`:
```
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

## Models Used in This Stack

| Model | OpenRouter ID | Use Case |
|-------|--------------|---------|
| Claude Sonnet 4.6 | `anthropic/claude-sonnet-4-6` | Primary (via direct Anthropic API) |
| GPT-4o | `openai/gpt-4o` | Fallback for tool use |
| Gemini 1.5 Pro | `google/gemini-pro-1.5` | Long context fallback (1M tokens) |
| Deepseek Coder | `deepseek/deepseek-coder` | Free coding model fallback |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b-instruct` | Free tier fallback |

## LiteLLM Integration

OpenRouter is already wired into `integrations/litellm/config.yaml`:
```yaml
- model_name: gpt-4o
  litellm_params:
    model: openrouter/openai/gpt-4o
    api_key: os.environ/OPENROUTER_API_KEY
    api_base: https://openrouter.ai/api/v1
```

## Direct Usage (TypeScript)

```typescript
import OpenAI from "openai";

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://github.com/nabaas/claude-architect-os",
    "X-Title": "Claude Architect OS",
  },
});

const response = await openrouter.chat.completions.create({
  model: "anthropic/claude-sonnet-4-6",
  messages: [{ role: "user", content: "Hello from Claude Architect OS" }],
});
```

## Routing Logic

1. **Primary**: Direct Anthropic API (claude-sonnet-4-6) — lowest latency, best quality
2. **Secondary**: Ollama (hermes3) — zero cost, local
3. **Tertiary**: OpenRouter — when primary API is unavailable or for cost optimization

Route to OpenRouter via LiteLLM by setting header: `x-task-type: openrouter`
