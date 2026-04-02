import { Message } from '../../types';
import { ILLMProvider } from '../../core/providers/base-provider';
import { ProviderFactory } from '../../core/providers/provider-factory';
import { CompressionConfig } from './types';

/**
 * Summarizes old messages using LLM
 */
export class MessageSummarizer {
  private provider: ILLMProvider;

  constructor(
    private config: CompressionConfig,
    provider?: ILLMProvider
  ) {
    // Use fast provider (DeepSeek) for summarization to save costs
    this.provider = provider || ProviderFactory.getFastProvider();
  }

  /**
   * Generate a summary of messages
   */
  public async summarize(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    // Build transcript from messages
    const transcript = this.buildTranscript(messages);

    // Generate summary prompt
    const promptMessage: Message = {
      conversationId: 'compress-summary',
      role: 'user',
      content: this.buildSummaryPrompt(transcript, messages.length),
    };

    try {
      const response = await this.provider.generateCompletion([promptMessage], {
        temperature: this.config.summaryTemperature,
        maxTokens: this.config.summaryMaxTokens,
      });

      return response.content.trim();
    } catch (err) {
      console.error('[MessageSummarizer] Failed to generate summary:', err);
      // Fallback: simple concatenation
      return this.fallbackSummary(messages);
    }
  }

  /**
   * Build a plain-text transcript from messages
   */
  private buildTranscript(messages: Message[]): string {
    return messages
      .map(msg => {
        const role = msg.role.toUpperCase();
        // Truncate very long messages
        const content = msg.content?.substring(0, 1000) || '';
        
        // Include tool call info if present
        if (msg.toolCalls?.length) {
          const toolNames = msg.toolCalls.map(tc => tc.function.name).join(', ');
          return `[${role}]: ${content}\n[TOOL CALLS]: ${toolNames}`;
        }

        return `[${role}]: ${content}`;
      })
      .join('\n\n');
  }

  /**
   * Build summary prompt optimized for context compression
   */
  private buildSummaryPrompt(transcript: string, messageCount: number): string {
    return `Você é um assistente especializado em resumir conversas de forma concisa mas completa.

**TAREFA:** Resuma o seguinte trecho de conversa (${messageCount} mensagens) em **português brasileiro**.

**REQUISITOS:**
1. **Máximo 500 palavras**
2. **Preserve todos os fatos importantes:** decisões tomadas, problemas identificados, soluções propostas, dados técnicos
3. **Mantenha contexto técnico:** nomes de arquivos, comandos, configurações, erros
4. **Use linguagem clara e objetiva**
5. **Organize por tópicos** se houver múltiplos assuntos
6. **NÃO invente informações** - apenas resuma o que foi dito

**FORMATO DE SAÍDA:**
- Texto corrido ou bullet points conforme apropriado
- Foque em AÇÕES e DECISÕES (o que foi feito/decidido)
- Minimize saudações/conversas sociais
- Se houver código/comandos importantes, mencione brevemente

---

**CONVERSA ORIGINAL:**

${transcript}

---

**RESUMO CONCISO:**`;
  }

  /**
   * Fallback summary if LLM fails (simple truncation)
   */
  private fallbackSummary(messages: Message[]): string {
    const summaryLines: string[] = [
      `[Resumo automático de ${messages.length} mensagens antigas]`,
    ];

    // Extract key points from first and last messages
    if (messages.length > 0) {
      const first = messages[0];
      summaryLines.push(`Início: ${first.content?.substring(0, 200)}...`);
    }

    if (messages.length > 1) {
      const last = messages[messages.length - 1];
      summaryLines.push(`Fim: ${last.content?.substring(0, 200)}...`);
    }

    return summaryLines.join('\n');
  }

  /**
   * Create a summary system message
   */
  public createSummaryMessage(
    conversationId: string,
    summary: string,
    originalMessageCount: number
  ): Message {
    return {
      conversationId,
      role: 'system',
      content: `[CONTEXTO RESUMIDO - ${originalMessageCount} mensagens anteriores]\n\n${summary}`,
      timestamp: Date.now(),
      metadata: {
        type: 'compression-summary',
        originalCount: originalMessageCount,
        compressedAt: Date.now(),
      },
    };
  }
}
