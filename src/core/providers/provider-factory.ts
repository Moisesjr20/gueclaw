import { ILLMProvider } from './base-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { CotTriage } from '../../services/llm-router/cot-triage';
import { logTriageDecision } from '../../services/llm-router/router-logger';

export class ProviderFactory {
  private static provider: OpenRouterProvider | null = null;

  public static initialize(): void {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY não configurada.\n' +
        'Adicione ao .env: OPENROUTER_API_KEY=sk-or-...'
      );
    }

    this.provider = new OpenRouterProvider(
      apiKey,
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      process.env.OPENROUTER_MODEL || 'deepseek/deepseek-r1'
    );

    console.log(`✅ OpenRouter provider initialized (default model: ${this.provider.getModel()})`);
    console.log(`🔀 CoT Routing: ${process.env.ROUTER_COT_ENABLED === 'true' ? 'enabled (DeepSeek R1 triage)' : 'disabled (heuristic)'}`);
  }

  public static getProvider(): ILLMProvider {
    if (!this.provider) throw new Error('ProviderFactory not initialized');
    return this.provider;
  }

  public static hasProvider(_name: string): boolean {
    return this.provider !== null;
  }

  public static async getProviderForMessage(message: string): Promise<{
    provider: ILLMProvider;
    reason: 'cot' | 'heuristic';
  }> {
    if (!this.provider) throw new Error('ProviderFactory not initialized');

    const decision = await CotTriage.classify(message);
    logTriageDecision(message, decision);

    this.provider.setModel(decision.model);

    return { provider: this.provider, reason: decision.usedCot ? 'cot' : 'heuristic' };
  }

  public static listProviders(): string[] {
    return this.provider ? ['openrouter'] : [];
  }
}
