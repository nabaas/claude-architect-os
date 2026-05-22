# LM Studio — Claude Architect OS Integration

LM Studio provides a GUI for managing and running local models with OpenAI-compatible API.
Alternative to Ollama for users who prefer a visual interface.

## Download
https://lmstudio.ai — available for macOS, Windows, Linux

## Recommended Models for This Stack

| Model | Size | Use Case | Download ID |
|-------|------|---------|------------|
| Hermes-3-Llama-3.1-8B | 4.7GB | Fast reasoning, default local | NousResearch/Hermes-3-Llama-3.1-8B-GGUF |
| DeepSeek-Coder-V2-Lite | 8.7GB | Code generation | deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF |
| Qwen2.5-7B-Instruct | 4.7GB | General purpose | Qwen/Qwen2.5-7B-Instruct-GGUF |
| nomic-embed-text | 274MB | Embeddings | nomic-ai/nomic-embed-text-v1.5-GGUF |

## API Configuration

LM Studio runs an OpenAI-compatible server on port 1234:

```
Server URL: http://localhost:1234/v1
```

### Add to LiteLLM config.yaml:
```yaml
- model_name: lmstudio-hermes
  litellm_params:
    model: openai/hermes3  # LM Studio uses OpenAI format
    api_base: http://localhost:1234/v1
    api_key: lm-studio  # Any string works
```

### TypeScript integration:
```typescript
const lmstudio = new OpenAI({
  baseURL: "http://localhost:1234/v1",
  apiKey: "lm-studio",
});
```

## vs Ollama

Use **Ollama** when: running headless/server, scripted model management, Docker integration
Use **LM Studio** when: testing new models visually, comparing outputs, GPU configuration

Both can run simultaneously on different ports (Ollama: 11434, LM Studio: 1234).
