import { ILLMProvider } from './base-provider';
import { DeepSeekProvider } from './deepseek-provider';
import { DeepSeekReasonerProvider } from './deepseek-reasoner-provider';

/**
 * Provider Factory - Creates and manages LLM provider instances
 */
export class ProviderFactory {
  private static providers: Map<string, ILLMProvider> = new Map();

  /**
   * Initialize all available providers based on environment variables
   */
  public static initialize(): void {
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
  public static getProvider(name: string = 'deepseek'): ILLMProvider {
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
    return this.getProvider('deepseek-reasoner');
  }

  /**
   * Get the fast provider (for quick responses and tool calls)
   */
  public static getFastProvider(): ILLMProvider {
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
