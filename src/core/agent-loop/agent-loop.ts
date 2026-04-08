import { ILLMProvider, CompletionOptions } from '../providers/base-provider';
import { Message, AgentAction, ToolCall, NO_REPLY } from '../../types';
import { ToolRegistry } from '../../tools/tool-registry';
import { IdentityLoader } from '../../utils/identity-loader';
import { TraceRepository } from '../../api/trace-repository';

/**
 * Agent Loop - ReAct Pattern Implementation
 * Implements Reasoning and Acting loop for agent behavior
 */
export class AgentLoop {
  private provider: ILLMProvider;
  private conversationHistory: Message[];
  private systemPrompt: string;
  private maxIterations: number;
  private blockedTools: Set<string>;
  private trackedConversationId?: string;
  
  // Loop detection: Track failed tool call attempts to prevent infinite retries
  private toolCallAttempts: Map<string, number>;
  private readonly MAX_TOOL_ATTEMPTS = 3;

  constructor(
    provider: ILLMProvider,
    conversationHistory: Message[] = [],
    systemPrompt?: string,
    /** Optional context block prepended to the system prompt (memory, skill manifest, etc.) */
    enrichment?: string,
    /** Tool names that must not be offered to the LLM for this loop instance */
    blockedTools?: string[],
    /** Conversation ID for trace recording (optional) */
    conversationId?: string
  ) {
    this.provider = provider;
    this.conversationHistory = [...conversationHistory];
    const base = systemPrompt || this.getDefaultSystemPrompt();
    const full = enrichment ? `${enrichment}\n\n${base}` : base;
    this.systemPrompt = IdentityLoader.prepend(full);
    this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5', 10);
    this.blockedTools = new Set(blockedTools ?? []);
    this.trackedConversationId = conversationId;
    this.toolCallAttempts = new Map();
  }

  /**
   * Run the agent loop with the given user input
   */
  public async run(userInput: string): Promise<string> {
    console.log('\n🔄 Starting Agent Loop (ReAct Pattern)');
    console.log(`📝 User Input: ${userInput.substring(0, 100)}${userInput.length > 100 ? '...' : ''}`);

    // Add user message to history
    this.conversationHistory.push({
      conversationId: 'temp',
      role: 'user',
      content: userInput,
    });

    let iteration = 0;
    let finalResponse = '';

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n🔁 Iteration ${iteration}/${this.maxIterations}`);

      try {
        // Get available tools — respect blockedTools list
        const allTools = ToolRegistry.getAllDefinitions();
        const tools = this.blockedTools.size > 0
          ? allTools.filter(t => !this.blockedTools.has(t.name))
          : allTools;

        // Generate completion
        const options: CompletionOptions = {
          systemPrompt: this.systemPrompt,
          temperature: 0.7,
          maxTokens: 16384, // Increased from 4096 to support large HTML/file generation
        };

        // Add tools if provider supports them
        if (this.provider.supportsToolCalls && tools.length > 0) {
          options.tools = tools;
          options.toolChoice = 'auto';
        }

        const response = await this.provider.generateCompletion(
          this.conversationHistory,
          options
        );

        console.log(`💭 Thought: ${response.content.substring(0, 100)}${response.content.length > 100 ? '...' : ''}`);

        // Record trace for this iteration (thought + finish reason)
        if (this.trackedConversationId) {
          try {
            TraceRepository.getInstance().addTrace({
              conversationId: this.trackedConversationId,
              iteration,
              thought: response.content.substring(0, 2000) || undefined,
              finishReason: response.finishReason,
            });
          } catch { /* non-critical */ }
        }

        // Check if we have tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Add the assistant message with tool_calls to history BEFORE executing
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'assistant',
            content: response.content || '',
            toolCalls: response.toolCalls,
          });

          // Execute all tool calls
          await this.executeToolCalls(response.toolCalls, iteration);
          
          // Continue loop
          continue;
        }

        // API said tool_calls but no actual tool calls were returned (model hallucination guard)
        if (response.finishReason === 'tool_calls') {
          console.warn('⚠️  finish_reason=tool_calls but no tool_calls in response — forcing retry');
          if (iteration < this.maxIterations) {
            this.conversationHistory.push({
              conversationId: 'temp',
              role: 'user',
              content: '[Sistema]: Você indicou querer usar ferramentas mas não chamou nenhuma. Use as ferramentas disponíveis via function calling para executar a ação solicitada.',
            });
            continue;
          }
          finalResponse = 'Não consegui executar a ação necessária com as ferramentas disponíveis. Por favor, tente novamente.';
          break;
        }

        // Check finish reason
        if (response.finishReason === 'stop') {
          // LLM already replied via tool — skip sending to Telegram
          if (response.content === NO_REPLY) {
            console.log('🔕 NO_REPLY received — response already delivered via tool');
            finalResponse = NO_REPLY;
            break;
          }

          // We have a final answer
          finalResponse = response.content;

          // Add assistant response to history
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'assistant',
            content: finalResponse,
          });

          console.log('\n✅ Agent Loop completed successfully');
          break;
        }

        if (response.finishReason === 'length') {
          console.warn('⚠️  Response truncated due to length limit');
          finalResponse = response.content + '\n\n[Response was truncated due to length limit]';
          break;
        }

        if (response.finishReason === 'error') {
          console.error('❌ LLM returned error');
          finalResponse = 'I encountered an error while processing your request. Please try again.';
          break;
        }

        // If we get here with no tool calls and no stop, treat as final response
        // Guard against empty content — retry with guidance instead of sending blank
        if (!response.content || response.content.trim() === '') {
          if (iteration < this.maxIterations) {
            this.conversationHistory.push({
              conversationId: 'temp',
              role: 'user',
              content: '[Sistema]: Sua resposta foi vazia. Por favor, analise os resultados das ferramentas e forneça uma resposta completa ao usuário.',
            });
            continue;
          }
          finalResponse = 'Desculpe, não consegui processar a resposta. Por favor, tente novamente.';
          break;
        }
        finalResponse = response.content;
        break;

      } catch (error: any) {
        console.error(`❌ Error in iteration ${iteration}:`, error.message);
        
        if (iteration >= this.maxIterations) {
          finalResponse = 'I encountered too many errors while processing your request. Please try again or rephrase your question.';
          break;
        }

        // Add error as observation and continue
        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'user',
          content: `[System Error]: ${error.message}. Please try a different approach.`,
        });
      }
    }

    // Check if max iterations reached
    if (iteration >= this.maxIterations && !finalResponse) {
      console.warn('⚠️  Max iterations reached without final answer');
      finalResponse = 'I apologize, but I reached the maximum number of reasoning steps without completing the task. The task may be too complex or require clarification. Please try breaking it down into smaller steps.';
    }

    return finalResponse;
  }

  /**
   * Create unique key for tracking tool call attempts
   * Format: toolName:normalized_args_hash
   */
  private getToolCallKey(toolName: string, args: any): string {
    // For filename-based tools, use filename as key
    // For other tools, use stringified args
    const keyData = args.filename 
      ? `${toolName}:${args.filename}` 
      : `${toolName}:${JSON.stringify(args)}`;
    return keyData;
  }

  /**
   * Execute tool calls and add results to conversation history
   */
  private async executeToolCalls(toolCalls: ToolCall[], iteration: number = 0): Promise<void> {
    console.log(`🔧 Executing ${toolCalls.length} tool call(s)...`);

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;
        
        console.log(`   → ${toolName}(${JSON.stringify(toolArgs).substring(0, 50)}...)`);

        // Reject if tool is blocked for this skill
        if (this.blockedTools.has(toolName)) {
          const errorMsg = `Tool "${toolName}" is not allowed in this context.`;
          console.warn(`   🚫 Blocked tool call attempt: ${toolName}`);
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'tool',
            content: `Error: ${errorMsg} Use an alternative tool.`,
            metadata: { toolName, toolCallId: toolCall.id },
          });
          continue;
        }

        // Get the tool from registry
        const tool = ToolRegistry.get(toolName);

        if (!tool) {
          const errorMsg = `Tool "${toolName}" not found in registry`;
          console.error(`   ❌ ${errorMsg}`);
          
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'tool',
            content: `Error: ${errorMsg}`,
            metadata: { toolName, toolCallId: toolCall.id },
          });
          continue;
        }

        // Check for loop detection BEFORE executing
        const toolKey = this.getToolCallKey(toolName, toolArgs);
        const attemptCount = this.toolCallAttempts.get(toolKey) || 0;
        
        if (attemptCount >= this.MAX_TOOL_ATTEMPTS) {
          const errorMsg = (
            `❌ LOOP DETECTED: Tool "${toolName}" has failed ${attemptCount} times with the same arguments.\n\n` +
            `This indicates a repeated error pattern. DO NOT call this tool again with the same parameters.\n\n` +
            `**What went wrong:**\n` +
            `You tried calling ${toolName} ${attemptCount} times and it failed each time.\n\n` +
            `**What to do instead:**\n` +
            `1. If this is save_to_repository: Ensure you include BOTH filename AND content parameters\n` +
            `2. If generating content: Check that the content variable is not empty\n` +
            `3. Try a completely different approach to accomplish the task\n` +
            `4. If unsure, explain to the user what you tried and ask for clarification\n\n` +
            `**DO NOT retry this exact same tool call.**`
          );
          
          console.error(`   🔁 ${errorMsg}`);
          
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'tool',
            content: errorMsg,
            metadata: { toolName, toolCallId: toolCall.id, loopDetected: true },
          });
          
          // Record loop detection event
          if (this.trackedConversationId) {
            try {
              TraceRepository.getInstance().addTrace({
                conversationId: this.trackedConversationId,
                iteration,
                toolName,
                toolArgs: JSON.stringify(toolArgs),
                toolResult: 'LOOP_DETECTED',
              });
            } catch { /* non-critical */ }
          }
          
          continue; // Skip execution, move to next tool
        }

        // Execute the tool
        const result = await tool.execute(toolArgs);

        if (result.success) {
          console.log(`   ✅ Success: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`);
          // Reset attempt counter on success
          this.toolCallAttempts.delete(toolKey);
        } else {
          console.error(`   ❌ Failed: ${result.error}`);
          // Increment attempt counter on failure
          this.toolCallAttempts.set(toolKey, attemptCount + 1);
          console.log(`   🔁 Attempt ${attemptCount + 1}/${this.MAX_TOOL_ATTEMPTS} for this tool call`);
        }

        // Add tool result to history
        const observation = result.success
          ? `[Tool Result - ${toolName}]:\n${result.output}`
          : `[Tool Error - ${toolName}]:\n${result.error}`;

        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'tool',
          content: observation,
          toolCallId: toolCall.id,
          metadata: { toolName, toolCallId: toolCall.id, success: result.success },
        });

        // Record trace for this tool call
        if (this.trackedConversationId) {
          try {
            TraceRepository.getInstance().addTrace({
              conversationId: this.trackedConversationId,
              iteration,
              toolName,
              toolArgs: toolArgs,
              toolResult: (result.success ? result.output : result.error)?.substring(0, 4000),
              finishReason: result.success ? 'tool_success' : 'tool_error',
            });
          } catch { /* non-critical */ }
        }

      } catch (error: any) {
        console.error(`   ❌ Tool execution error: ${error.message}`);
        
        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'tool',
          content: `[Tool Execution Error - ${toolCall.function.name}]: ${error.message}`,
          toolCallId: toolCall.id,
          metadata: { toolName: toolCall.function.name, toolCallId: toolCall.id, error: true },
        });
      }
    }
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `Você é o GueClaw, um agente de IA avançado com acesso a ferramentas e controle total sobre um ambiente VPS.

Capacidades principais:
- Executar comandos shell no VPS
- Gerenciar containers e imagens Docker
- Realizar operações em arquivos (ler, escrever, criar, deletar)
- Fazer requisições HTTP para APIs externas
- Resolver problemas com raciocínio passo a passo

REGRAS CRÍTICAS DE EXECUÇÃO:
1. NUNCA diga "vou fazer X" ou "irei fazer X" sem REALMENTE FAZER usando as ferramentas disponíveis primeiro.
2. SEMPRE chame as ferramentas necessárias para concluir a tarefa ANTES de escrever sua resposta.
3. Sua resposta final deve ser um RESUMO do que foi realmente feito, nunca uma promessa ou plano futuro.
4. Se uma ferramenta falhar, tente uma abordagem alternativa. Reporte o erro real no resumo.
5. Qualquer tarefa que envolva editar arquivos, alterar configurações, chamar APIs, executar comandos ou criar/deletar recursos DEVE usar as ferramentas correspondentes — nunca responda apenas com texto descrevendo o que faria.

FORMATO OBRIGATÓRIO DE RESPOSTA (use sempre para tarefas com ação):
📥 SOLICITAÇÃO: [Descrição breve do que foi pedido]
🔍 ANÁLISE: [O que você entendeu e como abordou]
⚡ EXECUÇÃO: [Quais ferramentas/ações foram executadas e seus resultados reais]
✅ RESULTADO: [Resultado final — sucesso com detalhes de confirmação, ou falha com o erro]

Instruções adicionais:
- Responda sempre em Português (Brasil)
- Use texto simples com emojis. NÃO use Markdown (**, __, \`\`\`, ##)
- Para perguntas simples que não precisam de ferramentas: responda diretamente sem o formato estruturado
- Para qualquer tarefa que exija ação: SEMPRE use o formato acima APÓS executar
- Seja honesto: só afirme sucesso se a chamada da ferramenta realmente retornou sucesso

Lembre-se: você tem controle total sobre o ambiente VPS. Tome cuidado com operações destrutivas.

REGRA ESPECIAL — NO_REPLY:
Quando você já entregou a resposta completa ao usuário através de uma ferramenta (ex: send_message, envio direto), retorne EXATAMENTE a string "NO_REPLY" como conteúdo da sua mensagem final — sem mais nada. Isso evita respostas duplicadas.`;
  }

  /**
   * Get current conversation history
   */
  public getConversationHistory(): Message[] {
    return this.conversationHistory;
  }
}
