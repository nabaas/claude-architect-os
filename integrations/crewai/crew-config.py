"""
CrewAI Configuration — Claude Architect OS
Defines 9 specialist agents mirroring the blueprint architecture.
Run: python integrations/crewai/crew-config.py
"""

import os
from crewai import Agent, Task, Crew, Process
from langchain_anthropic import ChatAnthropic

# Model routing: default to Claude Sonnet, local fallback to Ollama
def get_llm(model_type="default"):
    if model_type == "local":
        from langchain_community.llms import Ollama
        return Ollama(model="hermes3", base_url="http://localhost:11434")
    return ChatAnthropic(
        model="claude-sonnet-4-6",
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=4096,
    )


# ─── 9 Specialist Agents ────────────────────────────────────────────────────

scout_agent = Agent(
    role="Scout Agent",
    goal="Find high-ROI opportunities in markets and repos before others do",
    backstory="Expert in trend detection, marketplace pricing gaps, and emerging AI tool opportunities. Scores every find using (demand+compound+leverage)×ttv_inv×saturation_inv.",
    llm=get_llm(),
    verbose=True,
    allow_delegation=False,
    tools=[],  # attach SerperDev, BrowserTools, etc.
)

builder_agent = Agent(
    role="Builder Agent",
    goal="Create production-ready AI tools, repos, and automations",
    backstory="Full-stack AI engineer. Specializes in TypeScript, Python, Raycast extensions, n8n workflows. Every output is deploy-ready.",
    llm=get_llm(),
    verbose=True,
    allow_delegation=True,
)

research_agent = Agent(
    role="Research Agent",
    goal="Aggregate deep intelligence from web, docs, and market data",
    backstory="Expert researcher using Perplexity-style aggregation. Synthesizes into actionable intelligence reports.",
    llm=get_llm("default"),  # claude-opus-4-7 for long context
    verbose=True,
    allow_delegation=False,
)

arbitrage_agent = Agent(
    role="Arbitrage Agent",
    goal="Find pricing gaps between marketplaces and convert to profit",
    backstory="Specialist in eBay↔Amazon↔local Denver marketplace pricing. Identifies items with >40% margin potential.",
    llm=get_llm("local"),  # hermes3 for speed
    verbose=True,
    allow_delegation=False,
)

trend_agent = Agent(
    role="Trend Agent",
    goal="Detect emerging markets and viral products before saturation",
    backstory="Monitors TikTok virality, Google Trends spikes, Amazon BSR movements. Alerts when ttv < 30 days.",
    llm=get_llm("local"),
    verbose=True,
    allow_delegation=False,
)

automation_agent = Agent(
    role="Automation Agent",
    goal="Convert repetitive tasks into n8n workflows and shell scripts",
    backstory="n8n expert. Creates trigger→action→alert pipelines. Every manual task gets automated within one session.",
    llm=get_llm(),
    verbose=True,
    allow_delegation=False,
)

monetization_agent = Agent(
    role="Monetization Agent",
    goal="Optimize revenue from every asset, tool, and opportunity",
    backstory="Revenue optimization specialist. LTV/CAC analysis, pricing strategy, freemium→paid conversion flows.",
    llm=get_llm(),
    verbose=True,
    allow_delegation=False,
)

audit_agent = Agent(
    role="Audit Agent",
    goal="Catch errors, security issues, and inefficiencies before they compound",
    backstory="Adversarial reviewer. Checks code, workflows, and strategies for failure modes. Blocks deployment until all Blockers resolved.",
    llm=get_llm(),
    verbose=True,
    allow_delegation=False,
)

memory_agent = Agent(
    role="Memory Agent",
    goal="Extract, store, and retrieve high-value patterns from every session",
    backstory="Maintains the knowledge graph. Writes to ChromaDB and ~/.amsa/memory/. Surfaces relevant context for every new task.",
    llm=get_llm("local"),
    verbose=True,
    allow_delegation=False,
)


# ─── Example Crew: Market Opportunity Discovery ──────────────────────────────

def run_opportunity_crew(query: str) -> str:
    scan_task = Task(
        description=f"Scan for market opportunities related to: {query}. Score each using the blueprint formula.",
        agent=scout_agent,
        expected_output="List of 5 opportunities with scores, market size, and first action step",
    )

    research_task = Task(
        description="Deep-dive the top 2 opportunities from the scan. Find: competitors, pricing, demand proof, build time.",
        agent=research_agent,
        expected_output="Detailed research report for top 2 opportunities",
        context=[scan_task],
    )

    build_task = Task(
        description="Create an implementation plan for the highest-ROI opportunity. Include: repo structure, tech stack, deployment steps.",
        agent=builder_agent,
        expected_output="Implementation plan ready to hand to Loki Mode",
        context=[research_task],
    )

    memory_task = Task(
        description="Extract the most valuable patterns from this research and save to ~/.amsa/memory/patterns.json",
        agent=memory_agent,
        expected_output="Confirmation of patterns saved with count",
        context=[research_task, build_task],
    )

    crew = Crew(
        agents=[scout_agent, research_agent, builder_agent, memory_agent],
        tasks=[scan_task, research_task, build_task, memory_task],
        process=Process.sequential,
        verbose=True,
    )

    return crew.kickoff()


if __name__ == "__main__":
    result = run_opportunity_crew("AI tools for small business automation")
    print(result)
