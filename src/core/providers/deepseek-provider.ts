import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse, ToolCall } from '../../types';

/**
 * DeepSeek Provider - Fast reasoning model
 */
export class DeepSeekProvider implements ILLMProvider {
  public readonly name = 'deepseek';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;

  private client: AxiosInstance;
  private model: string;

  constructor(
    apiKey: string,
    baseURL: string = 'https://api.deepseek.com/v1',
    model: string = 'deepseek-chat'
  ) {
    this.model = model;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes
    });
  }

  public async generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse> {
    try {
      // Format messages for DeepSeek API
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      // Build request payload
      const payload: any = {
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
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

      // Call DeepSeek API
      const response = await this.client.post('/chat/completions', payload);

      // Parse response
      return this.parseResponse(response.data);

    } catch (error: any) {
      console.error('❌ DeepSeek API error:', error.response?.data || error.message);
      
      // Return error response
      return {
        content: `Error from DeepSeek: ${error.response?.data?.error?.message || error.message}`,
        finishReason: 'error',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
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
      throw new Error('No completion choice returned from DeepSeek');
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
