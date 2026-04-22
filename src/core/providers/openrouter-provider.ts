import OpenAI from 'openai';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse } from '../../types';

/**
 * OpenRouter Provider - Access 200+ AI models through one API
 * 
 * https://openrouter.ai/docs
 * 
 * Supported models include:
 * - Anthropic Claude (all versions)
 * - OpenAI GPT (all versions)
 * - Google Gemini
 * - Meta Llama
 * - Mistral
 * - DeepSeek
 * - Qwen
 * - And many more...
 */
export class OpenRouterProvider implements ILLMProvider {
  public readonly name = 'openrouter';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;
  private client: OpenAI;
  private model: string;
  private appName: string;

  constructor(
    apiKey: string,
    model: string = 'anthropic/claude-sonnet-4.5',
    appName: string = 'GueClaw-Agent'
  ) {
    this.model = model;
    this.appName = appName;
    
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/Moisesjr20/gueclaw',
        'X-Title': appName,
      },
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
      const formattedMessages = [];
      
      if (systemPrompt) {
        formattedMessages.push({
          role: 'system',
          content: systemPrompt,
        });
      }
      
      formattedMessages.push(...messages);

      const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: this.model,
        messages: formattedMessages as any,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
      };

      if (tools && tools.length > 0) {
        requestParams.tools = tools as any;
        requestParams.tool_choice = 'auto';
      }

      const response = await this.client.chat.completions.create(requestParams);
      
      return response;
    } catch (error: any) {
      console.error('❌ OpenRouter API Error:', error.message);
      
      // Handle common OpenRouter errors
      if (error.status === 402) {
        throw new Error('OpenRouter: Insufficient credits. Please add credits at https://openrouter.ai/credits');
      }
      if (error.status === 429) {
        throw new Error('OpenRouter: Rate limit exceeded. Please try again later.');
      }
      if (error.status === 400 && error.message?.includes('model')) {
        throw new Error(`OpenRouter: Model "${this.model}" not found or not supported. Check https://openrouter.ai/models`);
      }
      
      throw new Error(`OpenRouter API Error: ${error.message}`);
    }
  }

  async getModels(): Promise<string[]> {
    try {
      // OpenRouter models endpoint
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const data = await response.json() as any;
      
      if (data?.data) {
        return data.data.map((model: any) => model.id);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      
      // Return popular models as fallback
      return [
        'anthropic/claude-opus-4.7',
        'anthropic/claude-opus-4.6',
        'anthropic/claude-sonnet-4.6',
        'anthropic/claude-sonnet-4.5',
        'anthropic/claude-haiku-4.5',
        'openai/gpt-5.4',
        'openai/gpt-5.4-mini',
        'openai/gpt-5.3-codex',
        'google/gemini-3-pro-preview',
        'google/gemini-3-flash-preview',
        'qwen/qwen3.5-plus',
        'qwen/qwen3.5-35b-a3b',
        'deepseek/deepseek-chat',
        'deepseek/deepseek-reasoner',
        'meta-llama/llama-4-nemotron-70b',
        'mistralai/mistral-large',
        'x-ai/grok-4.20',
        'openrouter/elephant-alpha', // Free model
      ];
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }
  
  /**
   * Get model info including pricing
   */
  async getModelInfo(modelId?: string): Promise<any> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const data = await response.json() as any;
      
      if (data?.data && modelId) {
        return data.data.find((m: any) => m.id === modelId);
      }
      
      return data?.data || [];
    } catch (error) {
      console.error('Failed to fetch model info:', error);
      return null;
    }
  }

  async generateCompletion(messages: Message[], options?: CompletionOptions): Promise<LLMResponse> {
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
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
