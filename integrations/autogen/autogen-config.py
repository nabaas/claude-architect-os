"""
AutoGen Multi-Agent Configuration — Claude Architect OS
Mirrors the 37-agent Loki Mode using AutoGen's conversation framework.
"""

import os
import autogen

# LLM config with Claude as primary, Ollama as fallback
llm_config = {
    "config_list": [
        {
            "model": "claude-sonnet-4-6",
            "api_key": os.environ.get("ANTHROPIC_API_KEY"),
            "base_url": "https://api.anthropic.com/v1",
            "api_type": "anthropic",
        },
        {
            "model": "hermes3",
            "base_url": "http://localhost:11434/v1",
            "api_key": "ollama",  # Ollama doesn't require a real key
        },
    ],
    "temperature": 0.1,
    "cache_seed": 42,
}

# ─── Core Agents ─────────────────────────────────────────────────────────────

user_proxy = autogen.UserProxyAgent(
    name="UserProxy",
    system_message="A human user proxy that can run code and approve actions.",
    human_input_mode="NEVER",
    code_execution_config={
        "work_dir": os.path.expanduser("~/CMNDCENTER/repos/claude-architect-os"),
        "use_docker": False,
        "last_n_messages": 3,
    },
    max_consecutive_auto_reply=10,
)

architect = autogen.AssistantAgent(
    name="ArchitectAgent",
    system_message="""You are the Strategic Systems Architect for Claude Architect OS.
You think in systems, leverage, and compounding ROI.
For any request: decompose into smallest leverage point, identify which existing system absorbs it,
surface kill switches before optimizations.
Output format: Goal · Leverage · Integration Steps · Kill Switch · ROI (0-100)""",
    llm_config=llm_config,
)

builder = autogen.AssistantAgent(
    name="BuilderAgent",
    system_message="""You are a senior full-stack engineer specialized in TypeScript, Python,
and AI integrations. You write production-ready code. You prefer existing patterns in
src/utils/ before creating new ones. You always include proper error handling and type safety.""",
    llm_config=llm_config,
)

reviewer = autogen.AssistantAgent(
    name="ReviewerAgent",
    system_message="""You are an adversarial code reviewer. You check for: security vulnerabilities,
logic bugs, performance issues, and missing error handling. You block merges until all
Blocker-level issues are resolved. You never approve code with hardcoded secrets.""",
    llm_config=llm_config,
)

memory_keeper = autogen.AssistantAgent(
    name="MemoryAgent",
    system_message="""You extract high-value patterns from conversations and save them to
~/.amsa/memory/patterns.json. You identify: reusable prompts, successful workflows,
architectural decisions, and market insights. You keep memory concise and searchable.""",
    llm_config=llm_config,
)


# ─── GroupChat for Complex Tasks ─────────────────────────────────────────────

def run_loki_style_build(requirement: str):
    """Run a multi-agent build session similar to Loki Mode."""
    groupchat = autogen.GroupChat(
        agents=[user_proxy, architect, builder, reviewer, memory_keeper],
        messages=[],
        max_round=20,
        speaker_selection_method="round_robin",
    )

    manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)

    user_proxy.initiate_chat(
        manager,
        message=f"""Build request: {requirement}

Architect: provide the design.
Builder: implement it.
Reviewer: check it.
MemoryAgent: extract patterns.
""",
    )


if __name__ == "__main__":
    run_loki_style_build("Raycast extension that scans eBay for arbitrage opportunities")
