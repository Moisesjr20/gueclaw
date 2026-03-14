import { SkillLoader } from './skill-loader';
import { AgentLoop } from '../agent-loop/agent-loop';
import { ToolRegistry } from '../../tools/tool-registry';
import { ILLMProvider } from '../providers/base-provider';
import { ProviderFactory } from '../providers/provider-factory';

/**
 * Skill Executor - Executes a skill with the Agent Loop
 */
export class SkillExecutor {
  /**
   * Execute a skill with the given user input
   */
  public static async execute(
    skillName: string,
    userInput: string,
    conversationHistory: any[],
    useReasoning: boolean = false,
    extraContext?: string
  ): Promise<string> {
    try {
      console.log(`🎯 Executing skill: ${skillName}`);

      // Load skill content
      const skillContent = SkillLoader.loadSkillContent(skillName);

      if (!skillContent) {
        return `Error: Skill "${skillName}" not found or could not be loaded.`;
      }

      // Determine which provider to use
      const provider: ILLMProvider = useReasoning
        ? ProviderFactory.getReasoningProvider()
        : ProviderFactory.getFastProvider();

      console.log(`🧠 Using provider: ${provider.name} (reasoning: ${useReasoning})`);

      // Get available tools for this skill
      const availableTools = ToolRegistry.getAllDefinitions();

      // Build enhanced system prompt with skill content
      const systemPrompt = `${skillContent}

Ferramentas disponíveis:
Você tem acesso às seguintes ferramentas:
${availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

REGRAS CRÍTICAS DE EXECUÇÃO:
1. NUNCA diga "vou fazer X" ou "irei fazer X" sem REALMENTE FAZER usando as ferramentas disponíveis primeiro.
2. SEMPRE chame as ferramentas necessárias para concluir a tarefa ANTES de escrever sua resposta final.
3. Sua resposta final deve ser um RESUMO do que foi realmente feito — nunca uma promessa ou plano futuro.
4. Se uma ferramenta falhar, tente uma abordagem alternativa. Reporte o erro real no resumo.
5. Seja honesto: só afirme sucesso se a chamada da ferramenta realmente retornou sucesso.
6. PROIBIDO: Nunca escreva texto simulando resultados de ferramentas como "[Tool Result - ...]" ou invente IDs, status ou outputs. Esses dados só existem se a ferramenta foi realmente executada e retornou esse valor.
7. Se não tiver certeza do resultado, execute a ferramenta de verificação também (ex: listar agendamentos após criar um).

FORMATO OBRIGATÓRIO DE RESPOSTA para qualquer tarefa com ação:
📥 SOLICITAÇÃO: [Descrição breve do que foi pedido]
🔍 ANÁLISE: [O que você entendeu e como abordou]
⚡ EXECUÇÃO: [Quais ferramentas/ações foram executadas — inclua resultados relevantes, status codes ou respostas da API]
✅ RESULTADO: [Resultado final — sucesso com detalhes de confirmação, ou falha com mensagem de erro]

Instruções adicionais:
- Responda sempre em Português (Brasil)
- Use texto simples com emojis. NÃO use Markdown (**, __, \`\`\`, ##)
- Siga as diretrizes e especificações da documentação da skill acima
- Para perguntas simples que não precisam de ação: responda diretamente sem o formato estruturado
`;

      // Initialize Agent Loop (pass extraContext as enrichment)
      const agentLoop = new AgentLoop(provider, conversationHistory, systemPrompt, extraContext);

      // Execute the loop
      const result = await agentLoop.run(userInput);

      console.log(`✅ Skill execution completed: ${skillName}`);

      return result;

    } catch (error: any) {
      console.error(`❌ Skill execution error:`, error.message);
      return `Error executing skill "${skillName}": ${error.message}`;
    }
  }

  /**
   * Execute with automatic reasoning detection
   * Uses reasoning provider for programming/complex tasks
   */
  public static async executeAuto(
    skillName: string,
    userInput: string,
    conversationHistory: any[],
    extraContext?: string
  ): Promise<string> {
    // Keywords that indicate need for deep reasoning
    const reasoningKeywords = [
      'code', 'program', 'develop', 'implement', 'algorithm',
      'debug', 'refactor', 'optimize', 'architecture', 'design',
      'complex', 'analyze', 'solve', 'calculate', 'plan'
    ];

    const needsReasoning = reasoningKeywords.some(keyword =>
      userInput.toLowerCase().includes(keyword) ||
      skillName.toLowerCase().includes(keyword)
    );

    return this.execute(skillName, userInput, conversationHistory, needsReasoning, extraContext);
  }
}
