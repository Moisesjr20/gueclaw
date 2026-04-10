/**
 * Mock LLM Provider for Testing
 */

import { ILLMProvider, CompletionResponse, CompletionOptions, ToolDefinition } from '../../src/core/providers/base-provider';

export function createMockProvider() {
  let mockResponses: CompletionResponse[] = [];
  let callIndex = 0;

  const provider: ILLMProvider = {
    name: 'MockProvider',
    
    async generateCompletion(
      messages: any[],
      options?: CompletionOptions
    ): Promise<CompletionResponse> {
      if (callIndex >= mockResponses.length) {
        // Default response if no more mocks
        return {
          content: 'Mock response',
          finishReason: 'end_turn',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
      
      const response = mockResponses[callIndex];
      callIndex++;
      return response;
    },
    
    formatMessages(messages: any[]): any[] {
      return messages;
    },
    
    extractToolCalls(response: any): any[] | undefined {
      return response.toolCalls;
    },
    
    formatTools(tools: ToolDefinition[]): any[] {
      return [];
    },
  };

  function mockResponse(response: Partial<CompletionResponse>) {
    mockResponses.push({
      content: response.content || '',
      finishReason: response.finishReason || 'end_turn',
      toolCalls: response.toolCalls,
      usage: response.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
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
