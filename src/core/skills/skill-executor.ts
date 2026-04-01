import { SkillLoader } from './skill-loader';
import { AgentLoop } from '../agent-loop/agent-loop';
import { ForkedExecutor } from './forked-executor';
import { ToolRegistry } from '../../tools/tool-registry';
import { ILLMProvider } from '../providers/base-provider';
import { ProviderFactory } from '../providers/provider-factory';
import { SkillExecutionMode, ForkedExecutionOptions } from '../../types/skill';

/**
 * Skill Executor - Executes a skill with the Agent Loop
 * Supports both normal and forked execution modes
 */
export class SkillExecutor {
  /**
   * Execute a skill with the given user input
   * 
   * @param mode - Execution mode: 'normal' (default) or 'forked' (isolated)
   */
  public static async execute(
    skillName: string,
    userInput: string,
    conversationHistory: any[],
    useReasoning: boolean = false,
    extraContext?: string,
    conversationId?: string,
    mode: SkillExecutionMode = 'normal',
    forkedOptions?: ForkedExecutionOptions
  ): Promise<string> {
    try {
      console.log(`🎯 Executing skill: ${skillName} (mode: ${mode})`);

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

      // Get available tools for this skill — filter out any tools blocked by the skill
      const metadata = SkillLoader.getMetadata(skillName);
      const blockedTools = new Set(metadata?.blocked_tools ?? []);
      const allTools = ToolRegistry.getAllDefinitions();
      const availableTools = blockedTools.size > 0
        ? allTools.filter(t => !blockedTools.has(t.name))
        : allTools;
      if (blockedTools.size > 0) {
        console.log(`🚫 Skill "${skillName}" blocked tools: ${[...blockedTools].join(', ')}`);
      }

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

      // FORK DECISION: Execute in isolated context if mode is 'forked'
      if (mode === 'forked') {
        console.log(`🔀 Using FORKED execution (isolated context)`);
        
        // Check feature flag
        const forkedEnabled = process.env.ENABLE_FORKED_SKILLS === 'true';
        if (!forkedEnabled) {
          console.warn(`⚠️  ENABLE_FORKED_SKILLS=false, falling back to normal mode`);
        } else {
          // Execute in forked context
          const forkedResult = await ForkedExecutor.execute(
            skillName,
            userInput,
            conversationHistory,
            provider,
            systemPrompt,
            {
              ...forkedOptions,
              useReasoning,
              extraContext,
              conversationId,
            }
          );

          if (forkedResult.success) {
            console.log(`✅ Forked execution completed: ${ForkedExecutor.getExecutionStats(forkedResult)}`);
            return forkedResult.output;
          } else {
            console.error(`❌ Forked execution failed: ${forkedResult.error}`);
            // Fall back to normal mode on error
            console.log(`   Falling back to normal execution mode`);
          }
        }
      }

      // NORMAL EXECUTION (default or fallback from forked error)
      console.log(`🔄 Using NORMAL execution (shared context)`);
      
      // Initialize Agent Loop — pass blockedTools so the schema never exposes them
      const agentLoop = new AgentLoop(provider, conversationHistory, systemPrompt, extraContext, metadata?.blocked_tools, conversationId);

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
    extraContext?: string,
    conversationId?: string
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

    return this.execute(skillName, userInput, conversationHistory, needsReasoning, extraContext, conversationId);
  }
}
