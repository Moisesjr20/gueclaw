import { ILLMProvider } from './base-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { DeepSeekReasonerProvider } from './deepseek-reasoner-provider';
import { GitHubCopilotProvider } from './github-copilot-provider';
import { GitHubCopilotOAuthProvider } from './github-copilot-oauth-provider';
import { AnthropicProvider } from './anthropic-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { GeminiProvider } from './gemini-provider';
import { OllamaCloudProvider } from './ollama-cloud-provider';
import { TelegramNotifier } from '../../services/telegram-notifier';
import {
  chooseModel,
  getDefaultRoutingConfig,
  logRoutingDecision,
  RouteConfig,
} from './smart-routing';

/**
 * Provider Factory - Creates and manages LLM provider instances with smart routing
 */
export class ProviderFactory {
  private static providers: Map<string, ILLMProvider> = new Map();
  private static telegramNotifier: TelegramNotifier | null = null;
  private static routingConfig: RouteConfig;
  private static defaultProvider: string = 'github-copilot';
  private static defaultModel: string = 'claude-sonnet-4.5';

  /**
   * Initialize all available providers based on environment variables
   */
  public static initialize(): void {
    // Initialize smart routing config
    this.routingConfig = getDefaultRoutingConfig();
    
    // Initialize Telegram Notifier (for OAuth notifications)
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALLOWED_USER_IDS) {
      this.telegramNotifier = new TelegramNotifier(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.TELEGRAM_ALLOWED_USER_IDS
      );
    }

    // GitHub Copilot OAuth (Primary - recommended for Copilot Pro)
    const useOAuth = process.env.GITHUB_COPILOT_USE_OAUTH === 'true';
    
    if (useOAuth) {
      const model = process.env.GITHUB_COPILOT_MODEL || 'claude-sonnet-4.5';
      const copilotOAuthProvider = new GitHubCopilotOAuthProvider(
        model,
        './data/github-token.json',
        this.telegramNotifier || undefined
      );
      
      this.providers.set('github-copilot', copilotOAuthProvider);
      this.providers.set('copilot', copilotOAuthProvider);
      this.providers.set('github', copilotOAuthProvider);
      
      this.defaultProvider = 'github-copilot';
      this.defaultModel = model;
      
      console.log(`✅ GitHub Copilot OAuth provider initialized (model: ${model})`);
      
      if (!copilotOAuthProvider.isAuthenticated()) {
        console.warn('⚠️  GitHub Copilot não autenticado! Execute: npm run copilot:auth');
      }
    }
    // GitHub Copilot / OpenAI (API Key method)
    else if (process.env.GITHUB_COPILOT_API_KEY || process.env.OPENAI_API_KEY) {
      const apiKey = process.env.GITHUB_COPILOT_API_KEY || process.env.OPENAI_API_KEY || '';
      const baseURL = process.env.GITHUB_COPILOT_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const model = process.env.GITHUB_COPILOT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
      const apiType = (process.env.GITHUB_COPILOT_API_TYPE || 'openai') as 'openai' | 'github' | 'azure';

      const copilotProvider = new GitHubCopilotProvider(apiKey, baseURL, model, apiType);
      this.providers.set('github-copilot', copilotProvider);
      this.providers.set('copilot', copilotProvider);
      this.providers.set('openai', copilotProvider);
      this.providers.set('gpt', copilotProvider);

      this.defaultProvider = 'github-copilot';
      this.defaultModel = model;

      console.log(`✅ GitHub Copilot provider initialized (${apiType}, model: ${model})`);
    }

    // DeepSeek (fast reasoning)
    if (process.env.DEEPSEEK_API_KEY) {
      const deepseekFast = new DeepSeekProvider(
        process.env.DEEPSEEK_API_KEY,
        process.env.DEEPSEEK_BASE_URL,
        process.env.DEEPSEEK_MODEL_FAST || 'deepseek-chat'
      );
      this.providers.set('deepseek', deepseekFast);
      this.providers.set('deepseek-fast', deepseekFast);

      // DeepSeek Reasoner (extended reasoning for programming)
      const deepseekReasoner = new DeepSeekReasonerProvider(
        process.env.DEEPSEEK_API_KEY,
        process.env.DEEPSEEK_BASE_URL,
        process.env.DEEPSEEK_MODEL_REASONING || 'deepseek-reasoner'
      );
      this.providers.set('deepseek-reasoner', deepseekReasoner);
      this.providers.set('reasoner', deepseekReasoner);

      console.log('✅ DeepSeek providers initialized (fast + reasoner)');
      
      // Set DeepSeek as default if no Copilot
      if (!this.hasProvider('github-copilot')) {
        this.defaultProvider = 'deepseek';
        this.defaultModel = 'deepseek-chat';
      }
    }

    // Anthropic Claude (direct)
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicProvider = new AnthropicProvider(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        process.env.ANTHROPIC_BASE_URL
      );
      this.providers.set('anthropic', anthropicProvider);
      this.providers.set('claude', anthropicProvider);

      console.log(`✅ Anthropic provider initialized (model: ${anthropicProvider.getModel()})`);
    }

    // OpenRouter (200+ models)
    if (process.env.OPENROUTER_API_KEY) {
      const openrouterProvider = new OpenRouterProvider(
        process.env.OPENROUTER_API_KEY,
        process.env.OPENROUTER_MODEL || 'anthropic/claude-3-opus-200k',
        process.env.OPENROUTER_APP_NAME || 'GueClaw-Agent'
      );
      this.providers.set('openrouter', openrouterProvider);
      this.providers.set('router', openrouterProvider);

      // Define OpenRouter as the default LLM provider
      this.defaultProvider = 'openrouter';
      this.defaultModel = openrouterProvider.getModel();

      console.log(`✅ OpenRouter provider initialized (model: ${openrouterProvider.getModel()})`);
    }

    // Google Gemini
    if (process.env.GEMINI_API_KEY) {
      const geminiProvider = new GeminiProvider(
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_MODEL || 'gemini-3-pro-preview'
      );
      this.providers.set('gemini', geminiProvider);
      this.providers.set('google', geminiProvider);

      console.log(`✅ Gemini provider initialized (model: ${geminiProvider.getModel()})`);
    }

    // Ollama Cloud (Multi-model - deepseek-v4-flash, llama-3.2, etc.)
    if (process.env.OLLAMA_CLOUD_API_KEY) {
      const ollamaProvider = new OllamaCloudProvider(
        process.env.OLLAMA_CLOUD_API_KEY,
        process.env.OLLAMA_CLOUD_BASE_URL,
        process.env.OLLAMA_CLOUD_MODEL || 'deepseek-v4-flash',
        parseInt(process.env.OLLAMA_CLOUD_MAX_TOKENS || '4096'),
        parseFloat(process.env.OLLAMA_CLOUD_TEMPERATURE || '0.7')
      );
      this.providers.set('ollama', ollamaProvider);
      this.providers.set('ollama-cloud', ollamaProvider);

      console.log(`✅ Ollama Cloud provider initialized (model: ${ollamaProvider.getModel()})`);
    }

    if (this.providers.size === 0) {
      throw new Error(
        'No LLM providers configured. Please set at least one API key:\n' +
        '  - GITHUB_COPILOT_API_KEY or GITHUB_COPILOT_USE_OAUTH=true\n' +
        '  - DEEPSEEK_API_KEY\n' +
        '  - OPENROUTER_API_KEY\n' +
        '  - ANTHROPIC_API_KEY\n' +
        '  - GEMINI_API_KEY'
      );
    }
    
    // Log smart routing status
    if (this.routingConfig.enabled) {
      console.log(
        `🔀 Smart routing enabled: ` +
        `${this.routingConfig.cheapModel.provider}/${this.routingConfig.cheapModel.model} ` +
        `→ ${this.defaultProvider}/${this.defaultModel}`
      );
    }
  }

  /**
   * Get a provider by name
   */
  public static getProvider(name?: string): ILLMProvider {
    // If no name specified, use intelligent default
    if (!name) {
      name = this.defaultProvider;
    }

    const provider = this.providers.get(name);

    if (!provider) {
      // Fallback to first available provider
      const firstProvider = Array.from(this.providers.values())[0];
      console.warn(`⚠️  Provider '${name}' not found, using '${firstProvider.name}' as fallback`);
      return firstProvider;
    }

    return provider;
  }

  /**
   * Get provider for a specific message using smart routing
   * This automatically chooses between cheap/fast model and powerful model
   */
  public static getProviderForMessage(message: string): {
    provider: ILLMProvider;
    reason: 'simple' | 'complex' | 'default';
  } {
    const decision = chooseModel(
      message,
      this.routingConfig,
      this.defaultProvider,
      this.defaultModel
    );

    logRoutingDecision(message, decision);

    const provider = this.getProvider(decision.provider);
    
    // Update model if needed
    if (provider.setModel && provider.getModel && decision.model !== provider.getModel()) {
      provider.setModel(decision.model);
    }

    return {
      provider,
      reason: decision.reason,
    };
  }

  /**
   * Get the reasoning provider (for complex programming tasks)
   */
  public static getReasoningProvider(): ILLMProvider {
    // Prioritize GitHub Copilot if configured, otherwise use DeepSeek Reasoner
    if (this.hasProvider('github-copilot')) {
      return this.getProvider('github-copilot');
    }
    return this.getProvider('deepseek-reasoner');
  }

  /**
   * Get the fast provider (for quick responses and tool calls)
   */
  public static getFastProvider(): ILLMProvider {
    // Prioritize GitHub Copilot if configured, otherwise use DeepSeek Fast
    if (this.hasProvider('github-copilot')) {
      return this.getProvider('github-copilot');
    }
    return this.getProvider('deepseek-fast');
  }

  /**
   * Check if a provider exists
   */
  public static hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * List all available providers
   */
  public static listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider stats (name, model, status)
   */
  public static getProviderStats(): Array<{
    name: string;
    model: string;
    isDefault: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      model: provider.getModel?.() || 'unknown',
      isDefault: name === this.defaultProvider,
    }));
  }

  /**
   * Update smart routing configuration
   */
  public static updateRoutingConfig(config: Partial<RouteConfig>): void {
    this.routingConfig = {
      ...this.routingConfig,
      ...config,
    };
    
    console.log('✅ Smart routing config updated');
  }

  /**
   * Get current routing configuration
   */
  public static getRoutingConfig(): RouteConfig {
    return this.routingConfig;
  }

  /**
   * Set default provider
   */
  public static setDefaultProvider(name: string, model?: string): void {
    if (!this.hasProvider(name)) {
      throw new Error(`Provider '${name}' not found`);
    }
    
    this.defaultProvider = name;
    
    if (model) {
      this.defaultModel = model;
      const provider = this.getProvider(name);
      if (provider.setModel) {
        provider.setModel(model);
      }
    }
    
    console.log(`✅ Default provider set to: ${name}${model ? `/${model}` : ''}`);
  }
}
