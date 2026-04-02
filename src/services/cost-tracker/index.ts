/**
 * Cost Tracker Service
 * 
 * Rastreamento automático de custos LLM
 * Exporta API unificada
 */

export { CostTracker, costTracker, type CostRecord, type CostSummary } from './cost-tracker';
export { 
  getModelPricing, 
  isProviderFree, 
  calculateCost, 
  formatCost,
  type ModelPricing,
  type ProviderPricing,
} from './pricing';
export {
  estimateTokens,
  estimateMessagesTokens,
  countOutputTokens,
  normalizeUsage,
  type TokenEstimate,
  type LLMUsage,
} from './token-estimator';
export {
  CostAlerts,
  costAlerts,
  type CostAlertConfig,
} from './cost-alerts';
