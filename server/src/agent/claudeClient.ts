// Native Node 22 fetch client for the Anthropic Messages API with tool_use loop support

import type { ClaudeModelId, TestKeyResponse } from '../../../shared/types.js';
import type { AgentContext } from './types.js';
import { SETTING_KEYS } from './types.js';

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-sonnet-4-20250514';

export const SUPPORTED_CLAUDE_MODELS: readonly ClaudeModelId[] = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-haiku-20241022',
] as const;

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AnthropicApiResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeApiError extends Error {
  readonly status: number;
  readonly errorType?: string;

  constructor(message: string, status: number, errorType?: string) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
    this.errorType = errorType;
  }
}

export interface ClaudeRuntimeConfig {
  apiKey: string | null;
  model: ClaudeModelId;
  configured: boolean;
}

export function normalizeClaudeModel(model?: string | null): ClaudeModelId {
  const cleaned = (model ?? '').trim();
  if (
    cleaned === 'claude-sonnet-4-20250514' ||
    cleaned === 'claude-opus-4-20250514' ||
    cleaned === 'claude-3-5-haiku-20241022'
  ) {
    return cleaned;
  }
  return DEFAULT_CLAUDE_MODEL;
}

export async function resolveClaudeConfig(
  ctx: AgentContext
): Promise<ClaudeRuntimeConfig> {
  const rawKey =
    (await ctx.getSetting(SETTING_KEYS.ANTHROPIC_API_KEY)) ??
    (await ctx.getSetting('anthropic_api_key')) ??
    process.env.ANTHROPIC_API_KEY ??
    null;

  const trimmedKey = rawKey ? rawKey.trim() : '';
  const apiKey = trimmedKey.length > 0 ? trimmedKey : null;

  const rawModel =
    (await ctx.getSetting(SETTING_KEYS.CLAUDE_MODEL)) ??
    (await ctx.getSetting('claude_model')) ??
    DEFAULT_CLAUDE_MODEL;

  return {
    apiKey,
    model: normalizeClaudeModel(rawModel),
    configured: apiKey !== null,
  };
}

export function sanitizeNoEmDashes(text: string): string {
  return text.replace(/\u2014/g, ' - ').replace(/\u2013/g, '-');
}

export function extractTextFromBlocks(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

export interface SendClaudeMessageParams {
  apiKey: string;
  model?: string;
  system?: string;
  messages: AnthropicMessage[];
  tools?: AnthropicToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function sendClaudeMessage(
  params: SendClaudeMessageParams
): Promise<AnthropicApiResponse> {
  const model = normalizeClaudeModel(params.model);
  const body: Record<string, unknown> = {
    model,
    max_tokens: params.maxTokens ?? 1400,
    messages: params.messages,
  };

  if (params.system) {
    body.system = params.system;
  }
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
  }
  if (typeof params.temperature === 'number') {
    body.temperature = params.temperature;
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(params.timeoutMs ?? 45000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Network error';
    throw new ClaudeApiError(
      `Failed to reach Anthropic API: ${detail}`,
      0,
      'network_error'
    );
  }

  if (!response.ok) {
    let errorMessage = `Anthropic API returned HTTP ${response.status}`;
    let errorType: string | undefined;
    try {
      const parsed = (await response.json()) as {
        error?: { type?: string; message?: string };
      };
      if (parsed.error?.message) {
        errorMessage = parsed.error.message;
      }
      errorType = parsed.error?.type;
    } catch {
      // Ignore unparseable error body
    }

    if (response.status === 401) {
      throw new ClaudeApiError(
        'Invalid Anthropic API key. Check your key in Settings.',
        401,
        errorType ?? 'authentication_error'
      );
    }
    if (response.status === 429) {
      throw new ClaudeApiError(
        'Anthropic rate limit reached. Please retry in a moment.',
        429,
        errorType ?? 'rate_limit_error'
      );
    }
    if (response.status === 529) {
      throw new ClaudeApiError(
        'Anthropic API is temporarily overloaded. Falling back cleanly.',
        529,
        errorType ?? 'overloaded_error'
      );
    }

    throw new ClaudeApiError(errorMessage, response.status, errorType);
  }

  return (await response.json()) as AnthropicApiResponse;
}

export interface ToolLoopParams {
  apiKey: string;
  model?: string;
  system: string;
  messages: AnthropicMessage[];
  tools: AnthropicToolDefinition[];
  maxIterations?: number;
  maxTokens?: number;
  onToolCall: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<{ result: unknown; isError?: boolean }>;
}

export interface ToolLoopResult {
  text: string;
  model: string;
  iterations: number;
  toolCallsExecuted: { name: string; input: Record<string, unknown> }[];
}

export async function runClaudeToolLoop(
  params: ToolLoopParams
): Promise<ToolLoopResult> {
  const conversation: AnthropicMessage[] = [...params.messages];
  const maxIterations = params.maxIterations ?? 5;
  const toolCallsExecuted: { name: string; input: Record<string, unknown> }[] =
    [];
  let finalText = '';
  let usedModel = normalizeClaudeModel(params.model);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await sendClaudeMessage({
      apiKey: params.apiKey,
      model: usedModel,
      system: params.system,
      messages: conversation,
      tools: params.tools,
      maxTokens: params.maxTokens ?? 1600,
    });

    usedModel = normalizeClaudeModel(response.model);
    const textChunk = extractTextFromBlocks(response.content);
    if (textChunk) {
      finalText = textChunk;
    }

    const toolUses = response.content.filter(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use'
    );

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return {
        text: sanitizeNoEmDashes(finalText),
        model: usedModel,
        iterations: iteration + 1,
        toolCallsExecuted,
      };
    }

    conversation.push({
      role: 'assistant',
      content: response.content,
    });

    const toolResults: AnthropicToolResultBlock[] = [];
    for (const toolUse of toolUses) {
      toolCallsExecuted.push({ name: toolUse.name, input: toolUse.input });
      try {
        const outcome = await params.onToolCall(toolUse.name, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(outcome.result),
          is_error: outcome.isError,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Tool execution error';
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: message }),
          is_error: true,
        });
      }
    }

    conversation.push({
      role: 'user',
      content: toolResults,
    });
  }

  return {
    text: sanitizeNoEmDashes(
      finalText ||
        'Completed the requested inbox analysis. Review the citations and actions below.'
    ),
    model: usedModel,
    iterations: maxIterations,
    toolCallsExecuted,
  };
}

export async function sendClaudeJson<T>(
  params: Omit<SendClaudeMessageParams, 'tools'>
): Promise<T | null> {
  const response = await sendClaudeMessage(params);
  const raw = extractTextFromBlocks(response.content);
  if (!raw) return null;

  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const startObj = candidate.indexOf('{');
    const endObj = candidate.lastIndexOf('}');
    if (startObj !== -1 && endObj > startObj) {
      try {
        return JSON.parse(candidate.slice(startObj, endObj + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function testAnthropicKey(
  apiKey: string,
  model?: string
): Promise<TestKeyResponse> {
  const cleanedKey = (apiKey ?? '').trim();
  const targetModel = normalizeClaudeModel(model);

  if (!cleanedKey) {
    return {
      ok: false,
      message: 'Please paste an Anthropic API key before testing.',
      model: targetModel,
    };
  }

  if (!cleanedKey.startsWith('sk-ant-')) {
    return {
      ok: false,
      message: 'Anthropic API keys normally start with "sk-ant-". Double-check the pasted value.',
      model: targetModel,
    };
  }

  try {
    const res = await sendClaudeMessage({
      apiKey: cleanedKey,
      model: targetModel,
      messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      maxTokens: 16,
      timeoutMs: 15000,
    });
    return {
      ok: true,
      message: `Connected to ${res.model} successfully.`,
      model: res.model,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unable to verify Anthropic API key.';
    return {
      ok: false,
      message: sanitizeNoEmDashes(msg),
      model: targetModel,
    };
  }
}
