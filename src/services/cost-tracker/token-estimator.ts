/**
 * Token Estimator
 * 
 * Estimativa de tokens para diferentes providers
 * Baseado em: 1 token ≈ 4 chars em inglês, ~3-4 chars em português
 */

export interface TokenEstimate {
  tokens: number;
  method: 'exact' | 'estimated';
}

/**
 * Estima número de tokens em um texto
 * Usa heurística simples: ~4 caracteres por token
 * Para contagem exata, use tiktoken (GPT) ou claude-tokenizer
 */
export function estimateTokens(text: string): TokenEstimate {
  if (!text) {
    return { tokens: 0, method: 'exact' };
  }

  // Heurística: 1 token ≈ 4 caracteres
  // Mais conservador para português (3.5 chars/token)
  const hasNonASCII = /[^\x00-\x7F]/.test(text);
  const charsPerToken = hasNonASCII ? 3.5 : 4;
  
  const estimatedTokens = Math.ceil(text.length / charsPerToken);

  return {
    tokens: estimatedTokens,
    method: 'estimated',
  };
}

/**
 * Estima tokens de um array de mensagens (chat format)
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>,
): TokenEstimate {
  let totalChars = 0;
  
  for (const msg of messages) {
    // Overhead do formato: role + delimitadores
    totalChars += msg.role.length + 10; // <|role|>...<|end|>
    totalChars += msg.content.length;
  }

  const hasNonASCII = messages.some(m => /[^\x00-\x7F]/.test(m.content));
  const charsPerToken = hasNonASCII ? 3.5 : 4;
  
  const estimatedTokens = Math.ceil(totalChars / charsPerToken);

  return {
    tokens: estimatedTokens,
    method: 'estimated',
  };
}

/**
 * Calcula tokens de resposta do LLM baseado no texto retornado
 */
export function countOutputTokens(responseText: string): number {
  return estimateTokens(responseText).tokens;
}

/**
 * Modelo-specific token counting (futuro: integrar tiktoken/claude-tokenizer)
 */
export function estimateTokensForModel(
  text: string,
  model: string,
): TokenEstimate {
  // Por enquanto usa estimativa genérica
  // TODO: Implementar contadores específicos:
  // - GPT models: tiktoken
  // - Claude models: @anthropic-ai/tokenizer
  // - DeepSeek: similar ao GPT (BPE)
  // - Gemini: sentencepiece
  
  return estimateTokens(text);
}

/**
 * Helper para extrair uso de tokens de resposta LLM
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

/**
 * Normaliza objeto de usage de diferentes providers
 */
export function normalizeUsage(
  rawUsage: any,
  provider: string,
): LLMUsage | null {
  if (!rawUsage) return null;

  // OpenAI format
  if (rawUsage.prompt_tokens !== undefined) {
    return {
      promptTokens: rawUsage.prompt_tokens || 0,
      completionTokens: rawUsage.completion_tokens || 0,
      totalTokens: rawUsage.total_tokens || 0,
      cachedTokens: rawUsage.prompt_tokens_details?.cached_tokens,
    };
  }

  // Anthropic/Claude format
  if (rawUsage.input_tokens !== undefined) {
    return {
      promptTokens: rawUsage.input_tokens || 0,
      completionTokens: rawUsage.output_tokens || 0,
      totalTokens: (rawUsage.input_tokens || 0) + (rawUsage.output_tokens || 0),
      cachedTokens: rawUsage.cache_read_input_tokens,
    };
  }

  // DeepSeek format (similar ao OpenAI)
  if (rawUsage.total_tokens !== undefined) {
    return {
      promptTokens: rawUsage.prompt_cache_miss_tokens || rawUsage.prompt_tokens || 0,
      completionTokens: rawUsage.completion_tokens || 0,
      totalTokens: rawUsage.total_tokens || 0,
      cachedTokens: rawUsage.prompt_cache_hit_tokens,
    };
  }

  // Gemini format
  if (rawUsage.promptTokenCount !== undefined) {
    return {
      promptTokens: rawUsage.promptTokenCount || 0,
      completionTokens: rawUsage.candidatesTokenCount || 0,
      totalTokens: rawUsage.totalTokenCount || 0,
      cachedTokens: rawUsage.cachedContentTokenCount,
    };
  }

  console.warn(`[TokenEstimator] Formato de usage desconhecido para ${provider}:`, rawUsage);
  return null;
}
