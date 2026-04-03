import { Message } from '../../types';
import { ILLMProvider } from '../../core/providers/base-provider';
import { ProviderFactory } from '../../core/providers/provider-factory';
import {
  ExtractedMemory,
  MemoryType,
  MemoryImportance,
  MemoryExtractionConfig,
  DEFAULT_MEMORY_EXTRACTION_CONFIG,
} from './types';

/**
 * Extracts structured memories from conversation messages using LLM
 */
export class MemoryExtractor {
  private provider: ILLMProvider;
  private config: MemoryExtractionConfig;

  constructor(config?: Partial<MemoryExtractionConfig>, provider?: ILLMProvider) {
    this.config = { ...DEFAULT_MEMORY_EXTRACTION_CONFIG, ...config };
    this.provider = provider || ProviderFactory.getFastProvider();
  }

  /**
   * Extract memories from a batch of messages
   */
  public async extractFromMessages(
    messages: Message[],
    userId: string,
    conversationId: string
  ): Promise<ExtractedMemory[]> {
    if (messages.length === 0) return [];

    try {
      // Build conversation transcript
      const transcript = this.buildTranscript(messages);

      // Generate extraction prompt
      const extractionPrompt = this.buildExtractionPrompt(transcript);

      // Call LLM to extract memories
      const response = await this.provider.generateCompletion(
        [
          {
            conversationId: 'memory-extraction',
            role: 'user',
            content: extractionPrompt,
          },
        ],
        {
          temperature: this.config.extractionTemperature,
          maxTokens: this.config.extractionMaxTokens,
        }
      );

      // Parse LLM response
      const extractedData = this.parseLLMResponse(response.content);

      // Convert to ExtractedMemory objects
      const memories = this.buildMemories(
        extractedData,
        userId,
        conversationId,
        messages
      );

      // Filter by confidence threshold
      return memories.filter((m) => m.confidence >= this.config.minConfidence);
    } catch (err) {
      console.error('[MemoryExtractor] Failed to extract memories:', err);
      // Return fallback extraction (simple pattern matching)
      return this.fallbackExtraction(messages, userId, conversationId);
    }
  }

  /**
   * Build conversation transcript for extraction
   */
  private buildTranscript(messages: Message[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'Usuário' : 'Assistente';
        const content = msg.content || '[sem conteúdo]';
        return `${role}: ${content}`;
      })
      .join('\n\n');
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(transcript: string): string {
    return `Você é um especialista em análise de conversas e extração de informações importantes.

Analise a conversa abaixo e extraia informações importantes sobre o usuário, suas preferências, decisões, objetivos e contexto técnico.

**CONVERSA:**
${transcript}

**INSTRUÇÕES:**
1. Extraia apenas informações **explicitamente mencionadas ou fortemente implicadas** na conversa
2. Categorize cada memória em um dos tipos:
   - preference: Preferências do usuário (ex: "prefere Python a JavaScript")
   - decision: Decisões importantes tomadas (ex: "decidiu usar PostgreSQL")
   - fact: Fatos sobre o usuário/projeto (ex: "trabalha na Empresa X")
   - goal: Objetivos e metas (ex: "quer lançar produto no Q2")
   - skill: Habilidades e expertise (ex: "experiente em React")
   - constraint: Restrições do projeto (ex: "orçamento limite: R$ 10K")
   - context: Contexto geral (ex: "construindo plataforma e-commerce")

3. Para cada memória extraída, forneça:
   - type: tipo da memória
   - content: conteúdo conciso (máx 200 caracteres)
   - context: contexto adicional (opcional)
   - importance: low | medium | high | critical
   - confidence: 0.0 a 1.0 (quão confiante você está)
   - tags: lista de tags relevantes para busca

**FORMATO DE SAÍDA (JSON):**
\`\`\`json
[
  {
    "type": "preference",
    "content": "Prefere TypeScript a JavaScript",
    "context": "Mencionado no contexto de desenvolvimento web",
    "importance": "medium",
    "confidence": 0.9,
    "tags": ["typescript", "javascript", "linguagem", "programação"]
  },
  {
    "type": "goal",
    "content": "Quer lançar MVP em 2 meses",
    "context": "Prazo definido para o projeto atual",
    "importance": "high",
    "confidence": 0.95,
    "tags": ["mvp", "prazo", "objetivo", "projeto"]
  }
]
\`\`\`

**IMPORTANTE:**
- NÃO invente informações
- NÃO extraia informações triviais ou temporárias
- FOQUE em informações que serão úteis em conversas futuras
- Máximo 10 memórias por análise

Responda APENAS com o array JSON, sem texto adicional.`;
  }

  /**
   * Parse LLM response to extract structured data
   */
  private parseLLMResponse(responseContent: string): any[] {
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseContent;

      // Parse JSON
      const parsed = JSON.parse(jsonString.trim());

      // Ensure it's an array
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('[MemoryExtractor] Failed to parse LLM response:', err);
      return [];
    }
  }

  /**
   * Convert parsed data to ExtractedMemory objects
   */
  private buildMemories(
    data: any[],
    userId: string,
    conversationId: string,
    sourceMessages: Message[]
  ): ExtractedMemory[] {
    const now = Date.now();
    const sourceMessageIds = sourceMessages.map((m) => m.id).filter(Boolean) as string[];

    return data
      .map((item) => {
        try {
          // Validate required fields
          if (!item.type || !item.content || !item.importance || !item.confidence) {
            return null;
          }

          // Calculate expiration based on importance
          let expiresAt: number | undefined;
          if (item.importance === 'low') {
            expiresAt = now + this.config.lowImportanceExpiryDays * 24 * 60 * 60 * 1000;
          } else if (item.importance === 'medium') {
            expiresAt = now + this.config.mediumImportanceExpiryDays * 24 * 60 * 60 * 1000;
          }
          // high and critical never expire (expiresAt = undefined)

          const memory: ExtractedMemory = {
            conversationId,
            userId,
            type: item.type as MemoryType,
            content: item.content.substring(0, 200), // Limit length
            context: item.context,
            importance: item.importance as MemoryImportance,
            confidence: Math.max(0, Math.min(1, item.confidence)), // Clamp to [0,1]
            sourceMessageIds,
            tags: Array.isArray(item.tags)
              ? item.tags.map((t: string) => t.toLowerCase())
              : [],
            extractedAt: now,
            expiresAt,
          };

          return memory;
        } catch (err) {
          console.error('[MemoryExtractor] Failed to build memory from item:', item, err);
          return null;
        }
      })
      .filter((m): m is ExtractedMemory => m !== null);
  }

  /**
   * Fallback extraction using simple pattern matching
   * Used when LLM extraction fails
   */
  private fallbackExtraction(
    messages: Message[],
    userId: string,
    conversationId: string
  ): ExtractedMemory[] {
    const memories: ExtractedMemory[] = [];
    const now = Date.now();
    const sourceMessageIds = messages.map((m) => m.id).filter(Boolean) as string[];

    // Simple pattern: look for "prefiro X", "vou usar X", "meu objetivo é X"
    const preferencePattern = /(?:prefiro|gosto de|quero usar|vou usar)\s+([^.,!?]+)/gi;
    const goalPattern = /(?:meu objetivo é|quero|preciso)\s+([^.,!?]+)/gi;

    messages.forEach((msg) => {
      if (msg.role !== 'user' || !msg.content) return;

      // Extract preferences
      let match;
      while ((match = preferencePattern.exec(msg.content)) !== null) {
        memories.push({
          conversationId,
          userId,
          type: 'preference',
          content: match[1].trim(),
          importance: 'medium',
          confidence: 0.6, // Lower confidence for pattern matching
          sourceMessageIds,
          tags: [],
          extractedAt: now,
        });
      }

      // Extract goals
      while ((match = goalPattern.exec(msg.content)) !== null) {
        memories.push({
          conversationId,
          userId,
          type: 'goal',
          content: match[1].trim(),
          importance: 'medium',
          confidence: 0.6,
          sourceMessageIds,
          tags: [],
          extractedAt: now,
        });
      }
    });

    return memories;
  }
}
