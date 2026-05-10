// src/core/providers/openrouter-provider.ts
import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse, ToolCall } from '../../types';
import { CostTracker } from '../../services/cost-tracker';

/**
 * OpenRouter Provider – free‑use models (e.g., mistralai/mistral-7b-instruct, meta-llama/llama-2-7b-chat)
 * Utiliza a API pública de OpenRouter (https://openrouter.ai).
 * A key fornecida pelo usuário deve ser armazenada em `OPENROUTER_API_KEY`.
 */
export class OpenRouterProvider implements ILLMProvider {
  readonly name = 'openrouter';
  readonly supportsToolCalls = true;
  readonly supportsStreaming = false; // Not implemented for free tier
  private client: AxiosInstance;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://openrouter.ai/api/v1',
    model: string = 'anthropic/claude-3-opus-200k', // default to large context free model
    maxTokens: number = 4096,
    temperature: number = 0.7,
  ) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
  }

  getModel(): string {
    return this.model;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async generateCompletion(messages: Message[], opts?: CompletionOptions): Promise<LLMResponse> {
    const payload: Record<string, any> = {
      model: this.model,
      messages,
      max_tokens: opts?.maxTokens ?? this.maxTokens,
      temperature: opts?.temperature ?? this.temperature,
    };

    if (opts?.tools?.length) {
      payload.tools = opts.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      payload.tool_choice = 'auto';
    }
    const start = Date.now();
    const resp = await this.client.post('/chat/completions', payload);
    const duration = (Date.now() - start) / 1000;
    // OpenRouter returns usage in "usage" field (prompt & completion tokens)
    const usage = resp.data.usage || {};
     // Record cost using CostTracker
     await CostTracker.getInstance().trackLLMCall({
       provider: 'openrouter',
       model: this.model,
       userId: 'gueclaw-agent', // or could be extracted from context; using static for now
       operation: 'chat',
       usage: {
         promptTokens: usage?.prompt_tokens ?? 0,
         completionTokens: usage?.completion_tokens ?? 0,
         totalTokens: usage?.total_tokens ?? ((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)),
         cachedTokens: 0, // OpenRouter does not provide cached tokens
       },
     });
    return {
      content: resp.data.choices?.[0]?.message?.content ?? '',
      toolCalls: resp.data.choices?.[0]?.message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: tc.function,
      })) as ToolCall[],
      usage,
    } as LLMResponse;
  }

  // Streaming not implemented for free tier – fallback to normal completion
  async *generateStreamingCompletion(messages: Message[], opts?: CompletionOptions): AsyncGenerator<string, void, unknown> {
    // For simplicity, we yield the full completion as a single chunk.
    const response = await this.generateCompletion(messages, opts);
    yield response.content;
  }
}
