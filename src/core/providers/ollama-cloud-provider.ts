import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse, ToolCall } from '../../types';
import { costTracker } from '../../services/cost-tracker';

/**
 * Ollama Cloud Provider - Multi-model via api.ollama.com
 * Models disponíveis: deepseek-v4-flash, llama-3.2, mistral, phi-4, gemma, qwen-2.5
 */
export class OllamaCloudProvider implements ILLMProvider {
  public readonly name = 'ollama-cloud';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = true;

  private client: AxiosInstance;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(
    apiKey: string,
    baseURL: string = 'https://api.ollama.com/v1',
    model: string = 'deepseek-v4-flash',
    maxTokens: number = 4096,
    temperature: number = 0.7
  ) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.temperature = temperature;

    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes
    });
  }

  public setModel(model: string): void {
    this.model = model;
  }

  public getModel(): string {
    return this.model;
  }

  public async generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Format messages for Ollama API
        const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

        // Build request payload
        const payload: any = {
          model: this.model,
          messages: formattedMessages,
          temperature: options?.temperature ?? this.temperature,
          max_tokens: options?.maxTokens ?? this.maxTokens,
        };

        // Add tools if provided
        if (options?.tools && options.tools.length > 0) {
          payload.tools = options.tools.map(tool => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          }));

          if (options.toolChoice) {
            payload.tool_choice = options.toolChoice === 'auto' ? 'auto' :
              options.toolChoice === 'none' ? 'none' :
              { type: 'function', function: { name: options.toolChoice.name } };
          }
        }

        // Call Ollama Cloud API
        const response = await this.client.post('/chat/completions', payload);

        // Parse response
        const llmResponse = this.parseResponse(response.data);

        // Track cost (Ollama Cloud é PAGO)
        try {
          if (llmResponse.usage) {
            const userId = (options as any)?.userId ||
                          process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',')[0] ||
                          'system';

            await costTracker.trackLLMCall({
              provider: 'ollama-cloud',
              model: this.model,
              userId,
              operation: 'chat-completion',
              usage: {
                promptTokens: llmResponse.usage.promptTokens,
                completionTokens: llmResponse.usage.completionTokens,
                totalTokens: llmResponse.usage.totalTokens,
                cachedTokens: llmResponse.usage.cachedTokens || 0,
              },
            });

            // Check daily cost alerts (async, não bloqueia)
            const { costAlerts } = await import('../../services/cost-tracker');
            costAlerts.checkDailyThreshold(userId).catch(err => {
              console.warn('[CostAlerts] Ollama Cloud check failed:', err);
            });
          }
        } catch (trackError) {
          console.warn('[CostTracker] Failed to track Ollama Cloud:', trackError);
        }

        return llmResponse;

      } catch (error: any) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);

        console.error(
          `❌ Ollama Cloud API error (attempt ${attempt}/${maxRetries}):`,
          error.response?.data || error.message
        );

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Return error response after all retries
    return {
      content: `Error from Ollama Cloud: ${lastError.response?.data?.error?.message || lastError.message}`,
      finishReason: 'error',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  public async *generateStreamingCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      const payload: any = {
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? this.temperature,
        max_tokens: options?.maxTokens ?? this.maxTokens,
        stream: true,
      };

      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((l: string) => l.trim() !== '');
        for (const line of lines) {
          const message = line.replace(/^data: /, '');
          if (message === '[DONE]') return;
          try {
            const parsed = JSON.parse(message);
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            continue;
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Ollama Cloud streaming error:', error.message);
      yield `Error: ${error.message}`;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const status = error.response?.status;
    // Retry on 429 (rate limit), 500, 502, 503, 504 (server errors)
    return status === 429 || (status >= 500 && status <= 599);
  }

  private formatMessages(messages: Message[], systemPrompt?: string): any[] {
    const formatted: any[] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Convert messages
    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Tool results go as user messages with special formatting
        formatted.push({
          role: 'user',
          content: `[Tool Result: ${msg.metadata?.toolName || 'unknown'}]\n${msg.content}`,
        });
      } else {
        formatted.push({
          role: msg.role === 'system' ? 'system' : msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    return formatted;
  }

  private parseResponse(data: any): LLMResponse {
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No completion choice returned from Ollama Cloud');
    }

    const message = choice.message;
    let toolCalls: ToolCall[] | undefined;

    // Parse tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));
    }

    return {
      content: message.content || '',
      toolCalls,
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' :
                    choice.finish_reason === 'length' ? 'length' : 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}
