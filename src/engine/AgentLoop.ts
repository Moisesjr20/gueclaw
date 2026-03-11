import { ProviderFactory } from './ProviderFactory';
import { ToolRegistry } from './ToolRegistry';
import { processAndExecuteCodeBlocks } from './CodeBlockExecutor';

interface LoopContext {
   role: 'user' | 'assistant' | 'system' | 'tool';
   content: string;
}

export class AgentLoop {
  private maxIterations: number;
  private providerName: string;
  private modelOverride?: string;
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry, options?: { providerName?: string; modelOverride?: string }) {
    this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5');
    this.providerName = options?.providerName || process.env.DEFAULT_LLM_PROVIDER || 'gemini';
    this.modelOverride = options?.modelOverride;
    this.registry = registry;
  }

  /**
   * Converte o thread interno para o formato aceito pela API do DeepSeek/Gemini.
   * - Mensagens 'tool' viram 'user' com prefixo [Observation]
   * - Nunca envia dois 'assistant' consecutivos (colapsa em um)
   */
  private normalizeThread(thread: LoopContext[]): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [];

    for (const msg of thread) {
      let role = msg.role === 'tool' ? 'user' : msg.role;
      const content = msg.role === 'tool' ? `[Observation]: ${msg.content}` : msg.content;

      // Colapsa dois 'assistant' consecutivos — junta conteúdo com quebra de linha
      if (role === 'assistant' && result.length > 0 && result[result.length - 1].role === 'assistant') {
        result[result.length - 1].content += '\n' + content;
        continue;
      }

      // Colapsa dois 'user' consecutivos também (pode acontecer com tool results seguidos)
      if (role === 'user' && result.length > 0 && result[result.length - 1].role === 'user') {
        result[result.length - 1].content += '\n' + content;
        continue;
      }

      result.push({ role, content });
    }

    return result;
  }

  /**
   * Executa o Motor ReAct usando o histórico do DB
   */
  public async run(
    history: { role: string; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    
    let iterations = 0;
    const provider = ProviderFactory.create(this.providerName, this.modelOverride);
    
    // Thread efêmero — não salvo no SQLite, só vive durante esta execução
    const thread: LoopContext[] = history.map(h => ({ role: h.role as any, content: h.content }));

    while (iterations < this.maxIterations) {
      iterations++;
      console.log(`[ReAct] Iteração ${iterations} de ${this.maxIterations}...`);

      try {
        // Normaliza o thread antes de enviar para garantir alternância correta
        const normalizedThread = this.normalizeThread(thread);

        const response = await provider.generateResponse(
          normalizedThread,
          this.registry.getAll(),
          systemPrompt
        );

        // Final Answer — LLM quer apenas responder
        if (!response.toolCalls || response.toolCalls.length === 0) {
          // Para modelos sem tool calls (ex: deepseek-reasoner),
          // tenta detectar e executar blocos shell no texto
          const model = process.env.DEEPSEEK_MODEL || '';
          const isReasoner = model === 'deepseek-reasoner';
          if (isReasoner && response.content) {
            console.log('[AgentLoop] Modo Reasoner: processando blocos de código...');
            // Tenta pegar a última mensagem do usuário para saber se ele quer logs
            const lastUserMsgRaw = history.filter(m => m.role === 'user').map(m => m.content).pop();
            const lastUserMsg = typeof lastUserMsgRaw === 'string' ? lastUserMsgRaw : JSON.stringify(lastUserMsgRaw || '');
            const enriched = await processAndExecuteCodeBlocks(response.content, lastUserMsg);
            return enriched;
          }
          return response.content;
        }

        // Action — LLM quer chamar uma Tool
        for (const call of response.toolCalls) {
           console.log(`[ReAct Action] Tool: ${call.name}`);
           // Registra a intenção do assistant
           thread.push({ role: 'assistant', content: `[Action]: ${call.name}` });

           const tool = this.registry.get(call.name);
           if (!tool) {
               const errorMsg = `Tool "${call.name}" não encontrada no registry.`;
               console.warn(errorMsg);
               thread.push({ role: 'tool', content: errorMsg });
               continue;
           }

           // Executa a Tool e registra o resultado como 'tool'
           try {
             const result = await tool.execute(call.arguments);
             console.log(`[ReAct Obs] ${call.name}: ${result.substring(0, 80)}...`);
             thread.push({ role: 'tool', content: result });
           } catch (err: any) {
             console.error(`[ReAct Error] ${call.name}:`, err.message);
             thread.push({ role: 'tool', content: `[Error]: ${err.message}` });
           }
        }
      } catch (err) {
         console.error('[AgentLoop] Falha na inferência:', err);
         return 'Desculpe, ocorreu uma falha ao contatar a API de IA.';
      }
    }

    return `Atingi o limite de ${this.maxIterations} iterações sem chegar a uma resposta final.`;
  }
}
