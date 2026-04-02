import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, CompletionOptions } from './base-provider';
import { Message, LLMResponse } from '../../types';
import { costTracker } from '../../services/cost-tracker';

/**
 * DeepSeek Reasoner Provider - Extended reasoning model for complex programming tasks
 */
export class DeepSeekReasonerProvider implements ILLMProvider {
  public readonly name = 'deepseek-reasoner';
  public readonly supportsToolCalls = false; // Reasoner focuses on deep thinking
  public readonly supportsStreaming = false;

  private client: AxiosInstance;
  private model: string;

  constructor(
    apiKey: string,
    baseURL: string = 'https://api.deepseek.com/v1',
    model: string = 'deepseek-reasoner'
  ) {
    this.model = model;
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 300000, // 5 minutes for deep reasoning
    });
  }

  public async generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse> {
    try {
      // Format messages
      const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

      // Build request payload
      const payload: any = {
        model: this.model,
        messages: formattedMessages,
        temperature: options?.temperature ?? 0.3, // Lower temp for reasoning
        max_tokens: options?.maxTokens ?? 8192,
      };

      // Call DeepSeek Reasoner API
      const response = await this.client.post('/chat/completions', payload);

      // Parse response
      const llmResponse = this.parseResponse(response.data);

      // Track cost (DeepSeek Reasoner é PAGO)
      try {
        if (llmResponse.usage) {
          const userId = (options as any)?.userId || 
                        process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',')[0] || 
                        'system';
          
          await costTracker.trackLLMCall({
            provider: 'deepseek',
            model: this.model,
            userId,
            operation: 'reasoning',
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
            console.warn('[CostAlerts] Check failed:', err);
          });
        }
      } catch (trackError) {
        console.warn('[CostTracker] Failed to track DeepSeek Reasoner:', trackError);
      }

      return llmResponse;

    } catch (error: any) {
      console.error('❌ DeepSeek Reasoner API error:', error.response?.data || error.message);
      
      return {
        content: `Error from DeepSeek Reasoner: ${error.response?.data?.error?.message || error.message}`,
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

    // Add system prompt with reasoning instructions
    const reasoningSystemPrompt = systemPrompt 
      ? `${systemPrompt}\n\nIMPORTANT: Use extended reasoning and deep analysis for this task. Think step by step.`
      : 'You are an expert AI assistant with deep reasoning capabilities. Think carefully and methodically about complex problems.';

    formatted.push({
      role: 'system',
      content: reasoningSystemPrompt,
    });

    // Convert messages
    for (const msg of messages) {
      formatted.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    return formatted;
  }

  private parseResponse(data: any): LLMResponse {
    const choice = data.choices?.[0];
    
    if (!choice) {
      throw new Error('No completion choice returned from DeepSeek Reasoner');
    }

    const message = choice.message;

    return {
      content: message.content || '',
      finishReason: choice.finish_reason === 'length' ? 'length' : 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}
