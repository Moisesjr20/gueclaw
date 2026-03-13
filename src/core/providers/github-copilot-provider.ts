import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse, ToolCall } from '../../types';

/**
 * GitHub Copilot Provider - Uses OpenAI-compatible API
 * 
 * This provider supports:
 * - Direct OpenAI API (with your API key)
 * - GitHub Models API (with GitHub token)
 * - Azure OpenAI (with Azure credentials)
 */
export class GitHubCopilotProvider implements ILLMProvider {
  public readonly name = 'github-copilot';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = true;

  private client: AxiosInstance;
  private model: string;
  private apiType: 'openai' | 'github' | 'azure';

  constructor(
    apiKey: string,
    baseURL: string = 'https://api.openai.com/v1',
    model: string = 'gpt-4o',
    apiType: 'openai' | 'github' | 'azure' = 'openai'
  ) {
    this.model = model;
    this.apiType = apiType;

    // Configure headers based on API type
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiType === 'github') {
      // GitHub Models API uses Bearer token
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiType === 'azure') {
      // Azure OpenAI uses api-key header
      headers['api-key'] = apiKey;
    } else {
      // OpenAI uses Bearer token
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    this.client = axios.create({
      baseURL,
      headers,
      timeout: 180000, // 3 minutes for complex reasoning
    });

    console.log(`✅ GitHub Copilot Provider initialized (${apiType}, model: ${model})`);
  }

  public async generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse> {
    try {
      // Format messages for OpenAI-compatible API
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      // Build request payload
      const payload: any = {
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      };

      // Add stop sequences if provided
      if (options?.stopSequences && options.stopSequences.length > 0) {
        payload.stop = options.stopSequences;
      }

      // Add tools if provided (function calling)
      if (options?.tools && options.tools.length > 0) {
        payload.tools = options.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));

        // Tool choice configuration
        if (options.toolChoice) {
          if (options.toolChoice === 'auto' || options.toolChoice === 'none') {
            payload.tool_choice = options.toolChoice;
          } else if (typeof options.toolChoice === 'object') {
            payload.tool_choice = {
              type: 'function',
              function: { name: options.toolChoice.name }
            };
          }
        }
      }

      // Call API
      const endpoint = this.apiType === 'azure' ? '/chat/completions' : '/chat/completions';
      const response = await this.client.post(endpoint, payload);

      // Parse and return response
      return this.parseResponse(response.data);

    } catch (error: any) {
      console.error('❌ GitHub Copilot API error:', error.response?.data || error.message);
      
      // Return error response
      return {
        content: `Error from GitHub Copilot: ${error.response?.data?.error?.message || error.message}`,
        finishReason: 'error',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  /**
   * Generate streaming completion (for real-time responses)
   */
  public async *generateStreamingCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      const payload: any = {
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true,
      };

      if (options?.tools && options.tools.length > 0) {
        payload.tools = options.tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
      }

      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream',
      });

      // Process stream
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter((line: string) => line.trim() !== '');
        
        for (const line of lines) {
          const message = line.replace(/^data: /, '');
          if (message === '[DONE]') return;

          try {
            const parsed = JSON.parse(message);
            const delta = parsed.choices[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch (e) {
            // Skip malformed JSON
            continue;
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Streaming error:', error.message);
      yield `Error: ${error.message}`;
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

    // Convert messages to OpenAI format
    for (const msg of messages) {
      const formattedMsg: any = {
        role: msg.role,
        content: msg.content,
      };

      // Add tool calls if present
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formattedMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        }));
      }

      // Add tool call ID for tool responses
      if (msg.role === 'tool' && msg.toolCallId) {
        formattedMsg.tool_call_id = msg.toolCallId;
      }

      formatted.push(formattedMsg);
    }

    return formatted;
  }

  private parseResponse(data: any): LLMResponse {
    const choice = data.choices[0];
    const message = choice.message;

    const response: LLMResponse = {
      content: message.content || '',
      finishReason: choice.finish_reason,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };

    // Parse tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      response.toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        },
      }));
    }

    return response;
  }
}
