import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse } from '../../types';

/**
 * Anthropic Claude Provider (Direct API)
 * 
 * Supports Claude Opus 4.7, Sonnet 4.6, Haiku 4.5 and newer models
 * https://docs.anthropic.com/en/api/getting-started
 */
export class AnthropicProvider implements ILLMProvider {
  public readonly name = 'anthropic';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;
  private client: Anthropic;
  private model: string;

  constructor(
    apiKey: string,
    model: string = 'claude-sonnet-4-6',
    baseURL?: string
  ) {
    this.model = model;
    this.client = new Anthropic({
      apiKey,
      baseURL,
    });
  }

  async sendMessage(
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    tools?: any[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<any> {
    try {
      const anthropicMessages = messages.map(msg => ({
        role: (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.content,
      }));

      const requestParams: Anthropic.MessageCreateParams = {
        model: this.model,
        max_tokens: options?.maxTokens || 8192,
        temperature: options?.temperature ?? 0.7,
        messages: anthropicMessages,
      };

      if (systemPrompt) {
        requestParams.system = systemPrompt;
      }

      if (tools && tools.length > 0) {
        requestParams.tools = tools.map(tool => ({
          name: tool.function?.name || tool.name,
          description: tool.function?.description || tool.description,
          input_schema: tool.function?.parameters || tool.parameters || {
            type: 'object',
            properties: {},
          },
        }));
      }

      const response = await this.client.messages.create(requestParams) as Anthropic.Message;

      // Transform Anthropic response to OpenAI format
      const content = response.content[0];
      
      if (content.type === 'tool_use') {
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: content.id,
                type: 'function',
                function: {
                  name: content.name,
                  arguments: JSON.stringify(content.input),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      }

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: content.type === 'text' ? content.text : '',
          },
          finish_reason: response.stop_reason || 'stop',
        }],
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error: any) {
      console.error('❌ Anthropic API Error:', error.message);
      throw new Error(`Anthropic API Error: ${error.message}`);
    }
  }

  async getModels(): Promise<string[]> {
    // Anthropic doesn't have a public /models endpoint
    // Return known models
    return [
      'claude-opus-4-7',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
    ];
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<LLMResponse> {
    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const response = await this.sendMessage(
      formattedMessages,
      options?.systemPrompt,
      options?.tools,
      {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens
      }
    );

    return {
      content: response.choices[0].message.content || '',
      toolCalls: response.choices[0].message.tool_calls,
      finishReason: response.choices[0].finish_reason || 'stop',
      usage: response.usage
    };
  }
}
