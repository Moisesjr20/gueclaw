import { ILLMProvider, ProviderResponse } from './ILLMProvider';
import { Tool } from './ToolRegistry';
import { GoogleGenAI } from '@google/genai';

// ================================================================
// OpenRouter Provider - Hub universal (Claude, DeepSeek, Llama...)
// ================================================================
export class OpenRouterProvider implements ILLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(modelOverride?: string) {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = modelOverride || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:beta';
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

    if (!this.apiKey) {
      console.warn('[OpenRouterProvider] Alerta: OPENROUTER_API_KEY não configurada!');
    }
    console.log(`[OpenRouterProvider] Modelo: ${this.model}`);
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
        formattedMessages.push({ role: 'user', content: `[Observation]: \n\n${msg.content}` });
      } else if (msg.role === 'system') {
        continue;
      } else {
        formattedMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      // OpenRouter repassa temperature aos provedores nativos
      temperature: 0.3,
    };

    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }));
      body.tool_choice = 'auto'; // Suportado por Sonnet, Deepseek V3, GPTs, etc.
    }

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://gueclaw.com', // Obrigatório no OpenRouter
          'X-Title': 'GueClaw Agent' // Obrigatório no OpenRouter
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];
      const msg = choice?.message;

      // Tool call support via OpenAI Standard
      if (msg?.tool_calls?.length > 0) {
        const tc = msg.tool_calls[0];
        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments); } catch { parsedArgs = {}; }
        return {
          content: '',
          toolCalls: [{ name: tc.function.name, arguments: parsedArgs }]
        };
      }

      // FALLBACK: Parser de emergência para alucinações textuais de ReAct
      const textContent = msg?.content || '';
      if (textContent) {
         // Tenta capturar formatos como: 
         // Action: tool_name
         // Parameters: {"arg": "val"} OU Command: ls -la
         const actionMatch = textContent.match(/(?:Action|\[Action\]):\s*([a-zA-Z0-9_]+)/i);
         if (actionMatch) {
            const toolName = actionMatch[1].trim();
            let parsedArgs: Record<string, any> = {};
            
            // Tenta achar JSON Parameters
            const paramsMatch = textContent.match(/(?:Parameters|\[Parameters\]):\s*(\{.*?\})/is);
            if (paramsMatch) {
               try { parsedArgs = JSON.parse(paramsMatch[1]); } catch { /* ignora erro */ }
            } else {
               // Tenta achar Command direto (muito comum em execute_shell_command)
               const cmdMatch = textContent.match(/(?:Command|\[Command\]):\s*(.+)/i);
               if (cmdMatch) {
                  if (toolName === 'execute_shell_command') parsedArgs = { command: cmdMatch[1].trim() };
                  if (toolName === 'execute_python') parsedArgs = { scriptName: cmdMatch[1].trim() };
               }
            }

            console.warn(`[OpenRouterProvider] Fallback Parser ativado para converter texto isolado em ToolCall: ${toolName}`);
            return {
               content: '',
               toolCalls: [{ name: toolName, arguments: parsedArgs }]
            };
         }
      }

      return { content: textContent || 'Sem resposta gerada.' };

    } catch (err: any) {
      console.error('[OpenRouterProvider] Erro:', err.message);
      return { content: `[OpenRouter Error: ${err.message}]` };
    }
  }
}

// ================================================================
// Moonshot (Kimi) Provider - fetch nativo (OpenAI-compatible)
// ================================================================
export class MoonshotProvider implements ILLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.KIMI_API_KEY || '';
    this.model = process.env.MOONSHOT_MODEL || 'moonshot-v1-32k';
    this.baseUrl = 'https://api.moonshot.cn/v1/chat/completions';

    if (!this.apiKey) {
      console.warn('[MoonshotProvider] Alerta: KIMI_API_KEY não configurada!');
    }
    console.log(`[MoonshotProvider] Modelo: ${this.model}`);
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
        formattedMessages.push({ role: 'user', content: `[Observation]: \n\n${msg.content}` });
      } else if (msg.role === 'system') {
        continue;
      } else {
        formattedMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body: Record<string, any> = {
      model: this.model,
      messages: formattedMessages,
      temperature: 0.3,
    };

    if (tools.length > 0) {
      body.tools = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }));
      body.tool_choice = 'auto'; // Kimi suporta tool_choice
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
        throw new Error(`Moonshot ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;
      const choice = data.choices?.[0];
      const msg = choice?.message;

      // Tool call support via OpenAI Standard
      if (msg?.tool_calls?.length > 0) {
        const tc = msg.tool_calls[0];
        let parsedArgs: Record<string, any> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments); } catch { parsedArgs = {}; }
        return {
          content: '',
          toolCalls: [{ name: tc.function.name, arguments: parsedArgs }]
        };
      }

      // FALLBACK: Parser de emergência para alucinações textuais de ReAct
      const textContent = msg?.content || '';
      if (textContent) {
         // Tenta capturar formatos como: Action: tool_name
         const actionMatch = textContent.match(/(?:Action|\[Action\]):\s*([a-zA-Z0-9_]+)/i);
         if (actionMatch) {
            const toolName = actionMatch[1].trim();
            let parsedArgs: Record<string, any> = {};
            
            // Tenta achar JSON Parameters
            const paramsMatch = textContent.match(/(?:Parameters|\[Parameters\]):\s*(\{.*?\})/is);
            if (paramsMatch) {
               try { parsedArgs = JSON.parse(paramsMatch[1]); } catch { /* ignora erro */ }
            } else {
               // Tenta achar Command direto
               const cmdMatch = textContent.match(/(?:Command|\[Command\]):\s*(.+)/i);
               if (cmdMatch) {
                  if (toolName === 'execute_shell_command') parsedArgs = { command: cmdMatch[1].trim() };
                  if (toolName === 'execute_python') parsedArgs = { scriptName: cmdMatch[1].trim() };
               }
            }

            console.warn(`[MoonshotProvider] Fallback Parser ativado para converter texto isolado em ToolCall: ${toolName}`);
            return {
               content: '',
               toolCalls: [{ name: toolName, arguments: parsedArgs }]
            };
         }
      }

      return { content: textContent || 'Sem resposta gerada.' };

    } catch (err: any) {
      console.error('[MoonshotProvider] Erro:', err.message);
      return { content: `[Moonshot Error: ${err.message}]` };
    }
  }
}

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

      // FALLBACK: Parser de emergência para alucinações textuais de ReAct
      const textContent = msg?.content || '';
      if (!this.isReasoner && textContent) {
         // Tenta capturar formatos como: Action: tool_name
         const actionMatch = textContent.match(/(?:Action|\[Action\]):\s*([a-zA-Z0-9_]+)/i);
         if (actionMatch) {
            const toolName = actionMatch[1].trim();
            let parsedArgs: Record<string, any> = {};
            
            // Tenta achar JSON Parameters
            const paramsMatch = textContent.match(/(?:Parameters|\[Parameters\]):\s*(\{.*?\})/is);
            if (paramsMatch) {
               try { parsedArgs = JSON.parse(paramsMatch[1]); } catch { /* ignora erro */ }
            } else {
               // Tenta achar Command direto
               const cmdMatch = textContent.match(/(?:Command|\[Command\]):\s*(.+)/i);
               if (cmdMatch) {
                  if (toolName === 'execute_shell_command') parsedArgs = { command: cmdMatch[1].trim() };
                  if (toolName === 'execute_python') parsedArgs = { scriptName: cmdMatch[1].trim() };
               }
            }

            console.warn(`[DeepSeekProvider] Fallback Parser ativado para converter texto isolado em ToolCall: ${toolName}`);
            return {
               content: '',
               toolCalls: [{ name: toolName, arguments: parsedArgs }]
            };
         }
      }

      return { content: textContent || 'Sem resposta gerada.' };

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
  static create(providerName: string, modelOverride?: string): ILLMProvider {
    switch (providerName.toLowerCase()) {
      case 'openrouter':
        return new OpenRouterProvider(modelOverride);
      case 'moonshot':
      case 'kimi':
        return new MoonshotProvider();
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
