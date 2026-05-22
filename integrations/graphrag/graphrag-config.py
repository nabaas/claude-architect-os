"""
GraphRAG Configuration — Claude Architect OS
Microsoft GraphRAG builds a knowledge graph from documents for community-level reasoning.
Goes beyond semantic search: finds relationships, themes, and compound insights.
"""

import os
from pathlib import Path

# GraphRAG output directory
GRAPHRAG_ROOT = Path.home() / ".amsa" / "graphrag"
GRAPHRAG_INPUT = GRAPHRAG_ROOT / "input"
GRAPHRAG_OUTPUT = GRAPHRAG_ROOT / "output"

GRAPHRAG_SETTINGS = """
encoding_model: cl100k_base
skip_workflows: []
llm:
  api_key: ${ANTHROPIC_API_KEY}
  type: openai_chat  # GraphRAG uses OpenAI format via LiteLLM proxy
  model: claude-sonnet-4-6
  model_supports_json: true
  max_tokens: 4000
  temperature: 0.0
  concurrent_requests: 5
  api_base: http://localhost:4000  # LiteLLM proxy routes to Claude

embeddings:
  async_mode: threaded
  llm:
    api_key: ollama
    type: openai_embedding
    model: nomic-embed-text
    api_base: http://localhost:11434/v1

chunks:
  size: 1200
  overlap: 100
  group_by_columns: [id]

input:
  type: file
  file_type: text
  base_dir: "input"
  file_encoding: utf-8
  file_pattern: ".*\\.txt$"

entity_extraction:
  entity_types: [Repo, Tool, Agent, Market, Signal, Workflow, Product, Revenue]
  max_gleanings: 1

community_reports:
  max_length: 2000
  max_input_length: 8000

claim_extraction:
  enabled: true
  description: "Extract actionable claims about market opportunities and system capabilities"
  max_gleanings: 1

output:
  type: file
  base_dir: "output"
"""


def setup_graphrag():
    """Initialize GraphRAG workspace and sync CMNDCENTER docs."""
    GRAPHRAG_ROOT.mkdir(parents=True, exist_ok=True)
    GRAPHRAG_INPUT.mkdir(exist_ok=True)
    GRAPHRAG_OUTPUT.mkdir(exist_ok=True)

    # Write settings
    settings_file = GRAPHRAG_ROOT / "settings.yaml"
    settings_file.write_text(GRAPHRAG_SETTINGS)

    # Copy docs to input
    import shutil
    CAO = Path.home() / "CMNDCENTER" / "repos" / "claude-architect-os"
    sources = [
        CAO / "brain" / "core_identity" / "system.md",
        CAO / "brain" / "prompt_layers" / "stack.md",
        CAO / "docs" / "ARCHITECTURE.md",
        CAO / "docs" / "WIRING.md",
        CAO / "prompts" / "base" / "master-prompts.md",
    ]
    for src in sources:
        if src.exists():
            dest = GRAPHRAG_INPUT / src.name.replace(".md", ".txt")
            shutil.copy(src, dest)
            print(f"  ✓ {src.name} → graphrag/input/")

    print(f"""
GraphRAG workspace ready at: {GRAPHRAG_ROOT}

Run indexing:
  cd {GRAPHRAG_ROOT}
  python -m graphrag.index --root .

Run global query (best for "what are all our capabilities?"):
  python -m graphrag.query --root . --method global "What compound opportunities exist in this system?"

Run local query (best for specific topics):
  python -m graphrag.query --root . --method local "How does the opportunity scorer connect to Loki Mode?"
""")


def query_graphrag(question: str, method: str = "global") -> str:
    """Query GraphRAG for compound/relational insights."""
    import subprocess
    result = subprocess.run(
        ["python", "-m", "graphrag.query", "--root", str(GRAPHRAG_ROOT), "--method", method, question],
        capture_output=True, text=True, cwd=str(GRAPHRAG_ROOT),
    )
    return result.stdout


if __name__ == "__main__":
    setup_graphrag()
