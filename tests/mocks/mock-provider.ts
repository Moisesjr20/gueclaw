/**
 * Mock LLM Provider for Testing
 */

import { ILLMProvider, CompletionOptions, ToolDefinition } from '../../src/core/providers/base-provider';
import { LLMResponse, Message } from '../../src/types';

export function createMockProvider() {
  let mockResponses: LLMResponse[] = [];
  let callIndex = 0;

  const provider: ILLMProvider = {
    name: 'MockProvider',
    supportsToolCalls: true,
    supportsStreaming: false,
    
    async generateCompletion(
      messages: Message[],
      options?: CompletionOptions
    ): Promise<LLMResponse> {
      if (callIndex >= mockResponses.length) {
        // Default response if no more mocks
        return {
          content: 'Mock response',
          finishReason: 'stop',
          toolCalls: [],
        };
      }
      
      const response = mockResponses[callIndex];
      callIndex++;
      return response;
    },
  };

  function mockResponse(response: Partial<LLMResponse>) {
    mockResponses.push({
      content: response.content || '',
      finishReason: response.finishReason || 'stop',
      toolCalls: response.toolCalls || [],
    });
  }

  function reset() {
    mockResponses = [];
    callIndex = 0;
  }

  return {
    provider,
    mockResponse,
    reset,
  };
}
