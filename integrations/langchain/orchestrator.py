"""
LangChain + LangGraph Orchestrator — Claude Architect OS
Routes tasks through the correct chain and feeds results into memory + profit systems.
"""

import os
from typing import TypedDict, Annotated, Literal
from langchain_anthropic import ChatAnthropic
from langchain_community.llms import Ollama
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# ─── Models ──────────────────────────────────────────────────────────────────

claude = ChatAnthropic(
    model="claude-sonnet-4-6",
    api_key=os.environ["ANTHROPIC_API_KEY"],
    max_tokens=4096,
)
hermes = Ollama(model="hermes3", base_url="http://localhost:11434")
embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url="http://localhost:11434")

# ─── Vector Store (ChromaDB) ──────────────────────────────────────────────────

vectorstore = Chroma(
    collection_name="claude-architect-os",
    embedding_function=embeddings,
    client_settings={"host": "localhost", "port": 8000},
)
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})


# ─── LangGraph State ──────────────────────────────────────────────────────────

class AgentState(TypedDict):
    task: str
    task_type: Literal["coding", "research", "market", "automation", "memory"]
    context: list[str]
    result: str
    memory_saved: bool
    profit_opportunity: dict | None


# ─── Node Functions ───────────────────────────────────────────────────────────

def retrieve_context(state: AgentState) -> AgentState:
    """Pull relevant memories from ChromaDB before processing."""
    docs = retriever.get_relevant_documents(state["task"])
    state["context"] = [d.page_content for d in docs]
    return state


def route_task(state: AgentState) -> str:
    """Decide which node handles this task."""
    task = state["task"].lower()
    if any(w in task for w in ["code", "build", "implement", "function", "class"]):
        return "coding"
    if any(w in task for w in ["market", "opportunity", "arbitrage", "price", "trend"]):
        return "market"
    if any(w in task for w in ["automate", "workflow", "schedule", "trigger", "webhook"]):
        return "automation"
    return "research"


def coding_node(state: AgentState) -> AgentState:
    """Claude handles all coding tasks."""
    context_str = "\n".join(state["context"])
    prompt = f"""Prior context:\n{context_str}\n\nTask: {state["task"]}

Write production TypeScript code. Include types, error handling.
Always use claude-sonnet-4-6 for any AI calls. Include prompt caching."""
    state["result"] = claude.invoke([HumanMessage(content=prompt)]).content
    state["task_type"] = "coding"
    return state


def market_node(state: AgentState) -> AgentState:
    """Analyze market opportunities and score them."""
    context_str = "\n".join(state["context"])
    prompt = f"""Market Intelligence Analysis

Prior signals:\n{context_str}\n\nRequest: {state["task"]}

Score using formula: (demand + compound + leverage) × ttv_inv × saturation_inv
Output JSON with: product, score (0-1), margin_pct, ttv_days, action_required, first_step"""
    result = claude.invoke([HumanMessage(content=prompt)]).content

    # Try to extract profit opportunity
    import json, re
    try:
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            state["profit_opportunity"] = json.loads(json_match.group())
    except Exception:
        pass

    state["result"] = result
    state["task_type"] = "market"
    return state


def research_node(state: AgentState) -> AgentState:
    """Deep research with Claude Opus for long context."""
    from langchain_anthropic import ChatAnthropic as Opus
    opus = Opus(model="claude-opus-4-7", api_key=os.environ["ANTHROPIC_API_KEY"], max_tokens=8192)
    context_str = "\n".join(state["context"])
    prompt = f"Prior knowledge:\n{context_str}\n\nResearch request: {state['task']}\n\nProvide comprehensive, actionable intelligence."
    state["result"] = opus.invoke([HumanMessage(content=prompt)]).content
    state["task_type"] = "research"
    return state


def automation_node(state: AgentState) -> AgentState:
    """Design n8n workflows and automation logic."""
    prompt = f"""Design automation for: {state["task"]}

Output:
1. n8n workflow JSON (trigger → steps → output)
2. Webhook URLs needed
3. Schedule (cron expression if applicable)
4. Expected output format
5. Alert/notification method (Telegram/Discord)"""
    state["result"] = claude.invoke([HumanMessage(content=prompt)]).content
    state["task_type"] = "automation"
    return state


def save_memory(state: AgentState) -> AgentState:
    """Save valuable patterns to ChromaDB and ~/.amsa/memory/."""
    import json
    from pathlib import Path
    from datetime import datetime

    # Save to ChromaDB
    vectorstore.add_texts(
        texts=[f"Task: {state['task']}\nResult: {state['result'][:500]}"],
        metadatas=[{"type": state["task_type"], "timestamp": datetime.now().isoformat()}],
    )

    # Save to local patterns file
    patterns_path = Path.home() / ".amsa" / "memory" / "patterns.json"
    patterns_path.parent.mkdir(parents=True, exist_ok=True)
    patterns = json.loads(patterns_path.read_text()) if patterns_path.exists() else []
    patterns.append({
        "task": state["task"],
        "type": state["task_type"],
        "result_preview": state["result"][:200],
        "timestamp": datetime.now().isoformat(),
    })
    # Keep last 200
    patterns_path.write_text(json.dumps(patterns[-200:], indent=2))

    # If profit opportunity found, write to linear queue
    if state.get("profit_opportunity"):
        queue_path = Path.home() / ".amsa" / "linear-queue" / f"opportunity-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        queue_path.parent.mkdir(parents=True, exist_ok=True)
        queue_path.write_text(json.dumps(state["profit_opportunity"], indent=2))

    state["memory_saved"] = True
    return state


# ─── Build the Graph ──────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("retrieve_context", retrieve_context)
    graph.add_node("coding", coding_node)
    graph.add_node("market", market_node)
    graph.add_node("research", research_node)
    graph.add_node("automation", automation_node)
    graph.add_node("save_memory", save_memory)

    graph.set_entry_point("retrieve_context")
    graph.add_conditional_edges("retrieve_context", route_task, {
        "coding": "coding",
        "market": "market",
        "research": "research",
        "automation": "automation",
    })
    for node in ["coding", "market", "research", "automation"]:
        graph.add_edge(node, "save_memory")
    graph.add_edge("save_memory", END)

    return graph.compile(checkpointer=MemorySaver())


# ─── Main ─────────────────────────────────────────────────────────────────────

app = build_graph()


def run(task: str, user_id: str = "nabaas") -> str:
    config = {"configurable": {"thread_id": user_id}}
    result = app.invoke(
        {"task": task, "context": [], "result": "", "memory_saved": False, "profit_opportunity": None},
        config=config,
    )
    return result["result"]


if __name__ == "__main__":
    output = run("Find arbitrage opportunity between eBay and Amazon for Stanley cups")
    print(output)
