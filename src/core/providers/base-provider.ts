import { Message, LLMResponse, ToolCall } from '../../types';

/**
 * Base interface for all LLM providers
 */
export interface ILLMProvider {
  readonly name: string;
  readonly supportsToolCalls: boolean;
  readonly supportsStreaming: boolean;

  /**
   * Generate a completion from the LLM
   */
  generateCompletion(
    messages: Message[],
    options?: CompletionOptions
  ): Promise<LLMResponse>;

  /**
   * Generate a streaming completion (optional)
   */
  generateStreamingCompletion?(
    messages: Message[],
    options?: CompletionOptions
  ): AsyncGenerator<string, void, unknown>;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ParameterProperty>;
    required?: string[];
  };
}

export interface ParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: {
    type: string;
  };
}
