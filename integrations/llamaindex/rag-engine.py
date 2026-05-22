"""
LlamaIndex RAG Engine — Claude Architect OS
Indexes all CMNDCENTER docs, patterns, and market signals for fast retrieval.
Every Claude query gets context-augmented before sending to the API.
"""

import os
from pathlib import Path
from llama_index.core import (
    VectorStoreIndex,
    SimpleDirectoryReader,
    StorageContext,
    Settings,
    load_index_from_storage,
)
from llama_index.llms.anthropic import Anthropic
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

# ─── Configuration ────────────────────────────────────────────────────────────

Settings.llm = Anthropic(
    model="claude-sonnet-4-6",
    api_key=os.environ["ANTHROPIC_API_KEY"],
    max_tokens=4096,
)
Settings.embed_model = OllamaEmbedding(
    model_name="nomic-embed-text",
    base_url="http://localhost:11434",
)
Settings.chunk_size = 1024
Settings.chunk_overlap = 200

CMNDCENTER = Path.home() / "CMNDCENTER"
CAO = CMNDCENTER / "repos" / "claude-architect-os"
AMSA_MEMORY = Path.home() / ".amsa" / "memory"
INDEX_STORAGE = Path.home() / ".amsa" / "llamaindex-storage"

# ─── ChromaDB Client ──────────────────────────────────────────────────────────

chroma_client = chromadb.HttpClient(host="localhost", port=8000)
chroma_collection = chroma_client.get_or_create_collection("claude-architect-os-rag")
vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
storage_context = StorageContext.from_defaults(vector_store=vector_store)


# ─── Index Builder ────────────────────────────────────────────────────────────

def build_index(force_rebuild: bool = False) -> VectorStoreIndex:
    """Build or load the document index."""
    if INDEX_STORAGE.exists() and not force_rebuild:
        print("Loading existing index...")
        return load_index_from_storage(StorageContext.from_defaults(persist_dir=str(INDEX_STORAGE)))

    print("Building new index from CMNDCENTER docs...")

    # Sources to index
    sources = [
        CAO / "brain",
        CAO / "prompts",
        CAO / "docs",
        CAO / "agents",
        AMSA_MEMORY,
        Path.home() / ".amsa" / "linear-queue",
    ]

    all_docs = []
    for source in sources:
        if source.exists():
            try:
                docs = SimpleDirectoryReader(
                    str(source),
                    recursive=True,
                    required_exts=[".md", ".json", ".txt"],
                ).load_data()
                all_docs.extend(docs)
                print(f"  ✓ Indexed {len(docs)} docs from {source.name}")
            except Exception as e:
                print(f"  ⚠ Skipped {source}: {e}")

    index = VectorStoreIndex.from_documents(
        all_docs,
        storage_context=storage_context,
        show_progress=True,
    )
    index.storage_context.persist(persist_dir=str(INDEX_STORAGE))
    print(f"✅ Index built: {len(all_docs)} documents")
    return index


# ─── Query Engine ─────────────────────────────────────────────────────────────

def get_query_engine(index: VectorStoreIndex):
    return index.as_query_engine(
        similarity_top_k=5,
        response_mode="compact",
        streaming=False,
    )


def augmented_query(question: str, index: VectorStoreIndex = None) -> str:
    """Query Claude with RAG context injected."""
    if index is None:
        index = build_index()

    engine = get_query_engine(index)
    response = engine.query(question)
    return str(response)


# ─── Auto-Sync: Add New Patterns to Index ────────────────────────────────────

def sync_new_patterns(index: VectorStoreIndex) -> int:
    """Add newly created pattern files to the index. Returns count added."""
    import json
    from llama_index.core import Document

    patterns_file = AMSA_MEMORY / "patterns.json"
    if not patterns_file.exists():
        return 0

    patterns = json.loads(patterns_file.read_text())
    new_docs = [
        Document(
            text=f"Pattern: {p.get('task', '')}\nResult: {p.get('result_preview', '')}",
            metadata={"source": "amsa-patterns", "type": p.get("type"), "ts": p.get("timestamp")},
        )
        for p in patterns[-50:]  # last 50 patterns
    ]

    index.insert_nodes(new_docs)
    return len(new_docs)


if __name__ == "__main__":
    idx = build_index()
    answer = augmented_query("What is our opportunity scoring formula and how do we apply it?", idx)
    print(answer)
