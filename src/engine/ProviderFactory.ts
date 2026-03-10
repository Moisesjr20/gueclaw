import { ILLMProvider, ProviderResponse } from './ILLMProvider';
import { Tool } from './ToolRegistry';
import { GoogleGenAI } from '@google/genai';

// ================================================================
// Gemini Provider
// ================================================================
export class GeminiProvider implements ILLMProvider {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'INSERIR_KEY_AQUI') {
      console.warn('[GeminiProvider] Alerta: GEMINI_API_KEY não configurada!');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateResponse(
    messages: { role: string; content: string }[],
    tools: Tool[],
    systemInstruction?: string
  ): Promise<ProviderResponse> {

    const formattedHistory = messages.map(msg => ({
      role: msg.role === 'assistant' || msg.role === 'tool' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const geminiTools = tools.length > 0 ? [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, any>
      }))
    }] : undefined;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedHistory,
        config: {
          systemInstruction,
          tools: geminiTools as any,
          temperature: 0.3
        }
      });

      const call = response.functionCalls ? response.functionCalls[0] : null;
      if (call) {
        return {
          content: '',
          toolCalls: [{ name: call.name as string, arguments: call.args as Record<string, any> }]
        };
      }

      return { content: response.text || 'Sem resposta gerada.' };

    } catch (err: any) {
      console.error('[GeminiProvider] Erro:', err.message);
      return { content: `[Gemini Error: ${err.message}]` };
    }
  }
}

// ================================================================
// DeepSeek Provider - fetch nativo (OpenAI-compatible)
// Suporta deepseek-chat (com tool calls) e deepseek-reasoner/R1 (sem tool calls)
// ================================================================
export class DeepSeekProvider implements ILLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private isReasoner: boolean;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    // deepseek-reasoner (R1) não suporta tool calls e exige temperature=1
    this.isReasoner = this.model === 'deepseek-reasoner';

    if (!this.apiKey) {
      console.warn('[DeepSeekProvider] Alerta: DEEPSEEK_API_KEY não configurada!');
    }
    console.log(`[DeepSeekProvider] Modelo: ${this.model}${this.isReasoner ? ' (R1 Reasoner - sem tool calls, temp=1)' : ''}`);
  }

  async generateResponse(
    messages: { role: string; content: string }[],
    tools: Tool[],
    systemInstruction?: string
  ): Promise<ProviderResponse> {

    const formattedMessages: { role: string; content: string }[] = [];

    if (systemInstruction) {
      formattedMessages.push({ role: 'system', content: systemInstruction });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        formattedMessages.push({ role: 'user', content: `[Observation]: ${msg.content}` });
      } else if (msg.role === 'system') {
        continue;
      } else {
        formattedMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      temperature: this.isReasoner ? 1 : 0.3,
    };

    // R1 não suporta tool calls — apenas deepseek-chat suporta
    if (!this.isReasoner && tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }));
      body.tool_choice = 'auto';
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`DeepSeek ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];
      const msg = choice?.message;

      // Loga raciocínio interno do R1 (útil para debug)
      if (msg?.reasoning_content) {
        console.log(`[R1 Thinking] ${String(msg.reasoning_content).substring(0, 300)}...`);
      }

      // Tool call? (apenas deepseek-chat)
      if (!this.isReasoner && msg?.tool_calls?.length > 0) {
        const tc = msg.tool_calls[0];
        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments); } catch { parsedArgs = {}; }
        return {
          content: '',
          toolCalls: [{ name: tc.function.name, arguments: parsedArgs }]
        };
      }

      return { content: msg?.content || 'Sem resposta gerada.' };

    } catch (err: any) {
      console.error('[DeepSeekProvider] Erro:', err.message);
      return { content: `[DeepSeek Error: ${err.message}]` };
    }
  }
}

// ================================================================
// Factory
// ================================================================
export class ProviderFactory {
  static create(providerName: string): ILLMProvider {
    switch (providerName.toLowerCase()) {
      case 'deepseek':
        return new DeepSeekProvider();
      case 'gemini':
        return new GeminiProvider();
      default:
        console.warn(`[Factory] Provedor "${providerName}" desconhecido. Usando DeepSeek.`);
        return new DeepSeekProvider();
    }
  }
}
