import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse } from '../../types';

/**
 * Google Gemini Provider
 * 
 * Supports Gemini 3.x Pro/Flash models via Google AI Studio
 * https://ai.google.dev/
 */
export class GeminiProvider implements ILLMProvider {
  public readonly name = 'gemini';
  public readonly supportsToolCalls = true;
  public readonly supportsStreaming = false;
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor(
    apiKey: string,
    model: string = 'gemini-3-pro-preview'
  ) {
    this.modelName = model;
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model });
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
      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = messages[messages.length - 1].content;

      // Create generation config
      const generationConfig: any = {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      };

      // Start chat with history
      const chat = this.model.startChat({
        history,
        generationConfig,
        systemInstruction: systemPrompt,
      });

      const result = await chat.sendMessage(lastMessage);
      const response = result.response;
      
      // Transform to OpenAI format
      const text = response.text();
      
      // Check for function calls (if tools were provided)
      const functionCalls = response.functionCalls?.();
      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0];
        
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: functionCall.name,
                  arguments: JSON.stringify(functionCall.args),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: {
            prompt_tokens: 0, // Gemini doesn't provide token counts in real-time
            completion_tokens: 0,
            total_tokens: 0,
          },
        };
      }

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: text,
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (error: any) {
      console.error('❌ Gemini API Error:', error.message);
      
      // Handle common Gemini errors
      if (error.message?.includes('API key')) {
        throw new Error('Gemini: Invalid API key. Get one at https://aistudio.google.com/apikey');
      }
      if (error.message?.includes('quota')) {
        throw new Error('Gemini: Quota exceeded. Check your usage at https://console.cloud.google.com/');
      }
      if (error.message?.includes('safety')) {
        throw new Error('Gemini: Content blocked by safety filters. Try rephrasing your request.');
      }
      
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }

  async getModels(): Promise<string[]> {
    // Gemini available models (as of 2026)
    return [
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemma-4-31b-it', // Open model via AI Studio
      'gemma-4-26b-it',
    ];
  }

  setModel(model: string): void {
    this.modelName = model;
    this.model = this.client.getGenerativeModel({ model });
  }

  getModel(): string {
    return this.modelName;
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
