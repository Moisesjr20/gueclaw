/**
 * Smart Model Routing - Automatically choose the best model based on task complexity
 * 
 * Inspired by Hermes Agent's smart routing system:
 * - Simple tasks (greetings, quick questions) → Fast/cheap model
 * - Complex tasks (code, debugging, long analysis) → Powerful model
 */

export interface RouteConfig {
  enabled: boolean;
  cheapModel: {
    provider: string;
    model: string;
    apiKey?: string;
    baseURL?: string;
  };
  maxSimpleChars: number;
  maxSimpleWords: number;
}

// Keywords that indicate complex tasks
const COMPLEX_KEYWORDS = new Set([
  'debug',
  'debugging',
  'implement',
  'implementation',
  'refactor',
  'patch',
  'traceback',
  'stacktrace',
  'exception',
  'error',
  'analyze',
  'analysis',
  'investigate',
  'architecture',
  'design',
  'compare',
  'benchmark',
  'optimize',
  'optimise',
  'review',
  'terminal',
  'shell',
  'tool',
  'tools',
  'pytest',
  'test',
  'tests',
  'plan',
  'planning',
  'delegate',
  'subagent',
  'cron',
  'docker',
  'kubernetes',
  'container',
  'deploy',
  'deployment',
  'migrate',
  'migration',
  'database',
  'sql',
  'query',
  'api',
  'endpoint',
  'function',
  'class',
  'method',
  'variable',
  'algorithm',
  'performance',
  'security',
  'vulnerability',
  'bug',
  'fix',
  'issue',
  'problem',
]);

// URL pattern
const URL_REGEX = /https?:\/\/|www\./i;

/**
 * Determine if a message looks like a simple task
 */
export function isSimpleTask(message: string, config: RouteConfig): boolean {
  if (!config.enabled) return false;
  
  const text = message.trim();
  if (!text) return false;
  
  // Length checks
  if (text.length > config.maxSimpleChars) return false;
  if (text.split(/\s+/).length > config.maxSimpleWords) return false;
  
  // Multiple lines = likely complex
  if (text.split('\n').length > 2) return false;
  
  // Code blocks = definitely complex
  if (text.includes('```') || text.match(/`[^`]+`/)) return false;
  
  // URLs = likely complex (needs research/analysis)
  if (URL_REGEX.test(text)) return false;
  
  // Check for complex keywords
  const lowered = text.toLowerCase();
  const words = lowered.split(/\W+/).filter(w => w.length > 2);
  
  for (const word of words) {
    if (COMPLEX_KEYWORDS.has(word)) {
      return false;
    }
  }
  
  // Passed all checks - looks simple!
  return true;
}

/**
 * Choose the appropriate model based on task complexity
 */
export function chooseModel(
  message: string,
  config: RouteConfig,
  defaultProvider: string,
  defaultModel: string
): {
  provider: string;
  model: string;
  reason: 'simple' | 'complex' | 'default';
} {
  if (!config.enabled) {
    return {
      provider: defaultProvider,
      model: defaultModel,
      reason: 'default',
    };
  }
  
  if (isSimpleTask(message, config)) {
    return {
      provider: config.cheapModel.provider,
      model: config.cheapModel.model,
      reason: 'simple',
    };
  }
  
  return {
    provider: defaultProvider,
    model: defaultModel,
    reason: 'complex',
  };
}

/**
 * Get default routing configuration
 */
export function getDefaultRoutingConfig(): RouteConfig {
  const enabled = process.env.SMART_ROUTING_ENABLED === 'true';
  
  return {
    enabled,
    cheapModel: {
      provider: process.env.SMART_ROUTING_CHEAP_PROVIDER || 'deepseek',
      model: process.env.SMART_ROUTING_CHEAP_MODEL || 'deepseek-chat',
      apiKey: process.env.SMART_ROUTING_CHEAP_API_KEY,
      baseURL: process.env.SMART_ROUTING_CHEAP_BASE_URL,
    },
    maxSimpleChars: parseInt(process.env.SMART_ROUTING_MAX_CHARS || '160', 10),
    maxSimpleWords: parseInt(process.env.SMART_ROUTING_MAX_WORDS || '28', 10),
  };
}

/**
 * Log routing decision (for debugging)
 */
export function logRoutingDecision(
  message: string,
  decision: { provider: string; model: string; reason: string }
): void {
  if (process.env.DEBUG_ROUTING === 'true') {
    const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
    console.log(
      `🔀 Route: ${decision.reason} → ${decision.provider}/${decision.model}` +
      ` | "${preview}"`
    );
  }
}
