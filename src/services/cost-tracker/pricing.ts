/**
 * Pricing Configuration for LLM Providers
 * 
 * GueClaw Cost Tracker - Fase 2.3
 * 
 * Copilot é o provider principal (FREE)
 * Outros providers só trackados quando ativados
 */

export interface ModelPricing {
  /** USD per 1M input tokens */
  inputPer1M: number;
  /** USD per 1M output tokens */
  outputPer1M: number;
  /** USD per 1M cached input tokens (prompt cache) */
  cachedInputPer1M?: number;
}

export interface ProviderPricing {
  provider: string;
  models: Record<string, ModelPricing>;
  /** Se true, não faz tracking de custo (ex: Copilot FREE) */
  isFree?: boolean;
}

/**
 * ===== GITHUB COPILOT (FREE) =====
 * Provider principal - sem custo
 */
export const COPILOT_PRICING: ProviderPricing = {
  provider: 'github-copilot',
  isFree: true,
  models: {
    'claude-sonnet-4.5': { inputPer1M: 0, outputPer1M: 0 },
    'gpt-4o': { inputPer1M: 0, outputPer1M: 0 },
    'gpt-4o-mini': { inputPer1M: 0, outputPer1M: 0 },
    'o1-preview': { inputPer1M: 0, outputPer1M: 0 },
    'o1-mini': { inputPer1M: 0, outputPer1M: 0 },
  },
};

/**
 * ===== OPENAI (GPT-4o, GPT-4, etc) =====
 * Pricing atualizado: https://openai.com/api/pricing/
 * Copilot FREE tem acesso a esses modelos via GitHub Models
 * Se usar API Key direta OpenAI, tem custo
 */
export const OPENAI_PRICING: ProviderPricing = {
  provider: 'openai',
  models: {
    'gpt-4o': {
      inputPer1M: 2.5,      // $2.50 / 1M input tokens
      outputPer1M: 10.0,    // $10.00 / 1M output tokens
      cachedInputPer1M: 1.25, // 50% discount for cached
    },
    'gpt-4o-mini': {
      inputPer1M: 0.15,     // $0.15 / 1M input
      outputPer1M: 0.60,    // $0.60 / 1M output
      cachedInputPer1M: 0.075,
    },
    'gpt-4-turbo': {
      inputPer1M: 10.0,
      outputPer1M: 30.0,
      cachedInputPer1M: 5.0,
    },
    'gpt-4': {
      inputPer1M: 30.0,
      outputPer1M: 60.0,
    },
    'gpt-3.5-turbo': {
      inputPer1M: 0.5,
      outputPer1M: 1.5,
    },
    'o1-preview': {
      inputPer1M: 15.0,
      outputPer1M: 60.0,
    },
    'o1-mini': {
      inputPer1M: 3.0,
      outputPer1M: 12.0,
    },
  },
};

/**
 * ===== DEEPSEEK (DEEPSEEK-CHAT, DEEPSEEK-REASONER) =====
 * Pricing extremamente competitivo
 * https://platform.deepseek.com/api-docs/pricing/
 */
export const DEEPSEEK_PRICING: ProviderPricing = {
  provider: 'deepseek',
  models: {
    'deepseek-chat': {
      inputPer1M: 0.14,     // $0.14 / 1M input tokens (cache-miss)
      outputPer1M: 0.28,    // $0.28 / 1M output tokens
      cachedInputPer1M: 0.014, // $0.014 / 1M cached input (90% discount)
    },
    'deepseek-reasoner': {
      inputPer1M: 0.55,     // $0.55 / 1M input
      outputPer1M: 2.19,    // $2.19 / 1M output
      cachedInputPer1M: 0.055,
    },
  },
};

/**
 * ===== MOONSHOT AI (MOONSHOT-V1, MOONSHOT-V1-32K) =====
 * Provider chinês com bons preços
 * https://platform.moonshot.cn/docs/pricing
 */
export const MOONSHOT_PRICING: ProviderPricing = {
  provider: 'moonshot',
  models: {
    'moonshot-v1-8k': {
      inputPer1M: 1.0,      // ¥12/1M tokens ≈ $1.65 USD (estimado)
      outputPer1M: 1.0,
    },
    'moonshot-v1-32k': {
      inputPer1M: 2.0,
      outputPer1M: 2.0,
    },
    'moonshot-v1-128k': {
      inputPer1M: 5.0,
      outputPer1M: 5.0,
    },
  },
};

/**
 * ===== GOOGLE GEMINI =====
 * https://ai.google.dev/pricing
 */
export const GEMINI_PRICING: ProviderPricing = {
  provider: 'gemini',
  models: {
    'gemini-2.0-flash-exp': {
      inputPer1M: 0,        // FREE durante preview
      outputPer1M: 0,
    },
    'gemini-1.5-pro': {
      inputPer1M: 1.25,     // $1.25 / 1M input (até 128K context)
      outputPer1M: 5.0,     // $5.00 / 1M output
      cachedInputPer1M: 0.3125, // $0.3125 / 1M cached
    },
    'gemini-1.5-flash': {
      inputPer1M: 0.075,    // $0.075 / 1M input (até 128K)
      outputPer1M: 0.30,    // $0.30 / 1M output
      cachedInputPer1M: 0.01875,
    },
    'gemini-1.0-pro': {
      inputPer1M: 0.5,
      outputPer1M: 1.5,
    },
  },
};

/**
 * Registry de todos os providers
 */
export const ALL_PROVIDERS: ProviderPricing[] = [
  COPILOT_PRICING,
  OPENAI_PRICING,
  DEEPSEEK_PRICING,
  MOONSHOT_PRICING,
  GEMINI_PRICING,
];

/**
 * Busca pricing de um modelo específico
 * @param provider Nome do provider (github-copilot, openai, deepseek, moonshot, gemini)
 * @param model Nome do modelo
 * @returns Pricing ou undefined se não encontrado
 */
export function getModelPricing(
  provider: string,
  model: string,
): ModelPricing | undefined {
  const providerConfig = ALL_PROVIDERS.find(p => p.provider === provider);
  if (!providerConfig) return undefined;

  return providerConfig.models[model];
}

/**
 * Checa se um provider é gratuito
 */
export function isProviderFree(provider: string): boolean {
  const providerConfig = ALL_PROVIDERS.find(p => p.provider === provider);
  return providerConfig?.isFree ?? false;
}

/**
 * Calcula custo de uma chamada LLM
 * @returns Custo em USD, ou 0 se provider for FREE
 */
export function calculateCost(
  provider: string,
  model: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  },
): number {
  // Copilot é sempre FREE
  if (isProviderFree(provider)) {
    return 0;
  }

  const pricing = getModelPricing(provider, model);
  if (!pricing) {
    console.warn(`[CostTracker] Pricing não encontrado: ${provider}/${model}`);
    return 0;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  
  let cachedCost = 0;
  if (usage.cachedInputTokens && pricing.cachedInputPer1M) {
    cachedCost = (usage.cachedInputTokens / 1_000_000) * pricing.cachedInputPer1M;
  }

  return inputCost + outputCost + cachedCost;
}

/**
 * Formata custo USD para exibição
 */
export function formatCost(costUSD: number): string {
  if (costUSD === 0) return 'FREE';
  if (costUSD < 0.01) return `< $0.01`;
  return `$${costUSD.toFixed(4)}`;
}
