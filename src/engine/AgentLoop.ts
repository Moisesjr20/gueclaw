import { ProviderFactory } from './ProviderFactory';
import { ToolRegistry } from './ToolRegistry';

interface LoopContext {
   role: "user" | "assistant" | "system" | "tool";
   content: string;
}

export class AgentLoop {
  private maxIterations: number;
  private providerName: string;
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5');
    this.providerName = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
    this.registry = registry;
  }

  /**
   * Executa o Motor ReAct recursivamente/iterativo usando o histórico do DB
   */
  public async run(
    history: { role: string; content: string }[],
    systemPrompt: string
  ): Promise<string> {
    
    let iterations = 0;
    const provider = ProviderFactory.create(this.providerName);
    
    // Clonamos para injetar a thread local na memória efêmera
    const thread: LoopContext[] = history.map(h => ({ role: h.role as any, content: h.content }));

    while (iterations < this.maxIterations) {
      iterations++;
      console.log(`[ReAct] Iteração ${iterations} de ${this.maxIterations}...`);

      try {
        const response = await provider.generateResponse(
          thread.filter(m => m.role !== 'tool'), // Tratar a sintaxe caso o provedor rejeite `tool` textualmente
          this.registry.getAll(),
          systemPrompt
        );

        // Se o LLM quis apenas "Falar" (Final Answer)
        if (!response.toolCalls || response.toolCalls.length === 0) {
           return response.content; 
        }

        // Se ele decidiu "Agir" (Action via Tool)
        for (const call of response.toolCalls) {
           console.log(`[ReAct Action] Acionou Tool: ${call.name}`);
           thread.push({ role: 'assistant', content: `[Call Tool]: ${call.name}(${JSON.stringify(call.arguments)})` });

           const tool = this.registry.get(call.name);
           if (!tool) {
               const errorMsg = `Tool not found: ${call.name}`;
               console.warn(errorMsg);
               thread.push({ role: 'tool', content: errorMsg });
               continue;
           }

           // Executa a Tool Real (Observation)
           try {
             const result = await tool.execute(call.arguments);
             console.log(`[ReAct Obs] Retorno Tool: ${result.substring(0, 50)}...`);
             thread.push({ role: 'tool', content: `[Tool Result]: ${result}` });
           } catch (err: any) {
             console.error(`[ReAct Error] Falha Tool ${call.name}:`, err);
             thread.push({ role: 'tool', content: `[Error Result]: ${err.message}` });
           }
        }
      } catch (err) {
         console.error('[AgentLoop] Falha na inferência do Provedor:', err);
         return "Desculpe, ocorreu uma falha grave contatando a API da Inteligência Artificial.";
      }
    }

    return `Desculpe, desisti do processamento pois alcancei o teto máximo de ${this.maxIterations} iterações (Timeout de segurança ReAct).`;
  }
}
