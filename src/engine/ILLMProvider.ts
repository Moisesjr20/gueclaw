import { Tool } from './ToolRegistry';

export interface ProviderResponse {
  content: string;
  toolCalls?: {
    name: string;
    arguments: any;
  }[];
}

export interface ILLMProvider {
  /**
   * Envia o histórico (Message[]) remapeado pro formato do LLM, 
   * embutindo as Tools habilitadas, caso o provedor suporte.
   */
  generateResponse(
    messages: { role: string; content: string }[],
    tools: Tool[],
    systemInstruction?: string
  ): Promise<ProviderResponse>;
}
