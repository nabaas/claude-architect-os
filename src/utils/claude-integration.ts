/**
 * claude-integration.ts
 * Claude API integration for Claude Architect OS Raycast extension.
 * Reads ANTHROPIC_API_KEY from process.env.
 * Supports prompt caching via cache_control headers on the system turn.
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const CACHE_MIN_TOKENS = 1024; // anthropic cache_control minimum

// ── Client factory (lazy singleton) ───────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to Raycast extension preferences or your shell environment."
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** When true, attaches cache_control: { type: "ephemeral" } to the system turn */
  enableCaching?: boolean;
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

// ── queryClaude ────────────────────────────────────────────────────────────

/**
 * Single-turn query to Claude. Returns the full text response.
 *
 * @param prompt       User message
 * @param systemPrompt Optional system prompt (cached if enableCaching=true and long enough)
 * @param model        Model ID — defaults to claude-sonnet-4-6
 * @param options      Additional options
 */
export async function queryClaude(
  prompt: string,
  systemPrompt?: string,
  model?: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getClient();

  const resolvedModel = model ?? options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const enableCaching = options.enableCaching ?? true;

  // Build system array with optional cache_control
  type SystemBlock = {
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  };

  let systemBlocks: SystemBlock[] | undefined;
  if (systemPrompt) {
    const shouldCache =
      enableCaching && systemPrompt.length >= CACHE_MIN_TOKENS;
    systemBlocks = [
      {
        type: "text",
        text: systemPrompt,
        ...(shouldCache ? { cache_control: { type: "ephemeral" } } : {}),
      },
    ];
  }

  const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: resolvedModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    ...(systemBlocks ? { system: systemBlocks } : {}),
  };

  const response = await client.messages.create(requestParams);

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  return textBlocks.map((b) => b.text).join("");
}

// ── streamClaude ───────────────────────────────────────────────────────────

/**
 * Streaming query to Claude. Calls onChunk for each text delta.
 *
 * @param prompt       User message
 * @param onChunk      Callback for each streamed text chunk
 * @param systemPrompt Optional system prompt
 * @param model        Model ID — defaults to claude-sonnet-4-6
 * @param options      Additional options
 */
export async function streamClaude(
  prompt: string,
  onChunk: (text: string) => void,
  systemPrompt?: string,
  model?: string,
  options: ClaudeOptions = {}
): Promise<void> {
  const client = getClient();

  const resolvedModel = model ?? options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const enableCaching = options.enableCaching ?? true;

  type SystemBlock = {
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  };

  let systemBlocks: SystemBlock[] | undefined;
  if (systemPrompt) {
    const shouldCache =
      enableCaching && systemPrompt.length >= CACHE_MIN_TOKENS;
    systemBlocks = [
      {
        type: "text",
        text: systemPrompt,
        ...(shouldCache ? { cache_control: { type: "ephemeral" } } : {}),
      },
    ];
  }

  const stream = client.messages.stream({
    model: resolvedModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    ...(systemBlocks ? { system: systemBlocks } : {}),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }

  await stream.finalMessage();
}

// ── queryClaudeMultiTurn ───────────────────────────────────────────────────

/**
 * Multi-turn conversation with Claude.
 *
 * @param messages     Conversation history (role + content)
 * @param systemPrompt Optional system prompt
 * @param model        Model ID
 * @param options      Additional options
 */
export async function queryClaudeMultiTurn(
  messages: ClaudeMessage[],
  systemPrompt?: string,
  model?: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getClient();

  const resolvedModel = model ?? options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const enableCaching = options.enableCaching ?? true;

  type SystemBlock = {
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  };

  let systemBlocks: SystemBlock[] | undefined;
  if (systemPrompt) {
    const shouldCache =
      enableCaching && systemPrompt.length >= CACHE_MIN_TOKENS;
    systemBlocks = [
      {
        type: "text",
        text: systemPrompt,
        ...(shouldCache ? { cache_control: { type: "ephemeral" } } : {}),
      },
    ];
  }

  const response = await client.messages.create({
    model: resolvedModel,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...(systemBlocks ? { system: systemBlocks } : {}),
  });

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  return textBlocks.map((b) => b.text).join("");
}
