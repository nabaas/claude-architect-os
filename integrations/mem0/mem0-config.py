"""
Mem0 Configuration — Claude Architect OS
Persistent AI memory layer that enriches every Claude interaction.
"""

import os
from mem0 import Memory

# Configure Mem0 with Claude + ChromaDB
config = {
    "llm": {
        "provider": "anthropic",
        "config": {
            "model": "claude-sonnet-4-6",
            "api_key": os.environ["ANTHROPIC_API_KEY"],
            "temperature": 0.1,
            "max_tokens": 1000,
        },
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text",
            "ollama_base_url": "http://localhost:11434",
        },
    },
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "claude-architect-os",
            "host": "localhost",
            "port": 8000,
        },
    },
    "history_db_path": os.path.expanduser("~/.amsa/memory/mem0-history.db"),
    "version": "v1.1",
}

memory = Memory.from_config(config)


def remember(user_id: str, content: str, metadata: dict = None) -> dict:
    """Store a memory for a user."""
    return memory.add(content, user_id=user_id, metadata=metadata or {})


def recall(user_id: str, query: str, limit: int = 5) -> list:
    """Retrieve relevant memories for a query."""
    results = memory.search(query, user_id=user_id, limit=limit)
    return [r["memory"] for r in results]


def recall_all(user_id: str) -> list:
    """Get all memories for a user."""
    return memory.get_all(user_id=user_id)


def forget(memory_id: str) -> None:
    """Delete a specific memory."""
    memory.delete(memory_id)


def build_context_block(user_id: str, query: str) -> str:
    """Build a context block for injection into prompts."""
    memories = recall(user_id, query)
    if not memories:
        return ""
    lines = "\n".join(f"- {m}" for m in memories)
    return f"\n<prior_context>\n{lines}\n</prior_context>\n"


# ─── Integration with Claude API ─────────────────────────────────────────────

def claude_with_memory(user_id: str, message: str) -> str:
    """Send a message to Claude with memory-augmented context."""
    import anthropic

    client = anthropic.Anthropic()
    context = build_context_block(user_id, message)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=f"""You are the Claude Architect OS intelligence layer.
{context}
Use prior context above to give more relevant, compounding responses.""",
        messages=[{"role": "user", "content": message}],
    )

    result = response.content[0].text

    # Auto-save this interaction to memory
    remember(user_id, f"User asked: {message}\nAssistant answered: {result[:200]}...")

    return result


if __name__ == "__main__":
    # Test memory system
    user = "nabaas"
    remember(user, "The opportunity scorer formula is (demand+compound+leverage)×ttv_inv×saturation_inv")
    remember(user, "Loki Mode uses 37 agents across 7 phases to build products autonomously")
    remember(user, "Default model is claude-sonnet-4-6, local fallback is ollama/hermes3")

    context = recall(user, "what formula do we use for scoring opportunities")
    print("Recalled:", context)
