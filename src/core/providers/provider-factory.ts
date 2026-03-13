import { ILLMProvider } from './base-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { DeepSeekReasonerProvider } from './deepseek-reasoner-provider';
import { GitHubCopilotProvider } from './github-copilot-provider';
import { GitHubCopilotOAuthProvider } from './github-copilot-oauth-provider';

/**
 * Provider Factory - Creates and manages LLM provider instances
 */
export class ProviderFactory {
  private static providers: Map<string, ILLMProvider> = new Map();

  /**
   * Initialize all available providers based on environment variables
   */
  public static initialize(): void {
    // GitHub Copilot OAuth (Primary - recommended for Copilot Pro)
    const useOAuth = process.env.GITHUB_COPILOT_USE_OAUTH === 'true';
    
    if (useOAuth) {
      const model = process.env.GITHUB_COPILOT_MODEL || 'claude-sonnet-4.5';
      const copilotOAuthProvider = new GitHubCopilotOAuthProvider(model);
      
      this.providers.set('github-copilot', copilotOAuthProvider);
      this.providers.set('copilot', copilotOAuthProvider);
      this.providers.set('github', copilotOAuthProvider);
      
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

      console.log(`✅ GitHub Copilot provider initialized (${apiType}, model: ${model})`);
    }

    // DeepSeek (primary - fast reasoning)
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
    }

    // Add fallback providers here (Gemini, Groq, etc.)
    // if (process.env.GEMINI_API_KEY) { ... }

    if (this.providers.size === 0) {
      throw new Error('No LLM providers configured. Please set DEEPSEEK_API_KEY in .env');
    }
  }

  /**
   * Get a provider by name
   */
  public static getProvider(name?: string): ILLMProvider {
    // If no name specified, use intelligent default
    if (!name) {
      // Prioritize GitHub Copilot if configured
      if (this.hasProvider('github-copilot')) {
        name = 'github-copilot';
      } else if (this.hasProvider('deepseek-fast')) {
        name = 'deepseek-fast';
      } else {
        // Use first available provider
        name = Array.from(this.providers.keys())[0];
      }
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
}
