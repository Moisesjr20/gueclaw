/**
 * Cost Tracker Manager
 * 
 * Rastreia custos de LLM por provider/model/usuário
 * Armazena em SQLite para analytics de longo prazo
 */

import { DatabaseConnection } from '../../core/memory/database';
import { calculateCost, isProviderFree, formatCost } from './pricing';
import { normalizeUsage, type LLMUsage } from './token-estimator';

export interface CostRecord {
  id: string;
  timestamp: number;
  provider: string;
  model: string;
  userId: string;
  operation: string; // 'chat', 'skill-execution', 'tool-call', etc
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUSD: number;
  metadata?: string; // JSON com info extra
}

export interface CostSummary {
  totalCostUSD: number;
  totalTokens: number;
  requestCount: number;
  byProvider: Record<string, {
    costUSD: number;
    tokens: number;
    requests: number;
  }>;
  byModel: Record<string, {
    costUSD: number;
    tokens: number;
    requests: number;
  }>;
}

export class CostTracker {
  private static instance: CostTracker | null = null;

  private constructor() {
    this.initializeSchema();
  }

  public static getInstance(): CostTracker {
    if (!CostTracker.instance) {
      CostTracker.instance = new CostTracker();
    }
    return CostTracker.instance;
  }

  /**
   * Cria tabela de cost_tracking no SQLite
   */
  private initializeSchema(): void {
    const db = DatabaseConnection.getInstance();

    db.exec(`
      CREATE TABLE IF NOT EXISTS cost_tracking (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        user_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cached_tokens INTEGER DEFAULT 0,
        cost_usd REAL NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Índices para queries rápidas
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_tracking(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cost_user ON cost_tracking(user_id);
      CREATE INDEX IF NOT EXISTS idx_cost_provider ON cost_tracking(provider);
      CREATE INDEX IF NOT EXISTS idx_cost_model ON cost_tracking(model);
    `);

    console.log('✅ Cost tracking schema initialized');
  }

  /**
   * Registra uma chamada LLM
   */
  public async trackLLMCall(params: {
    provider: string;
    model: string;
    userId: string;
    operation: string;
    usage: LLMUsage;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { provider, model, userId, operation, usage, metadata } = params;

    // Se provider for FREE (Copilot), não registra custo mas registra uso
    const costUSD = calculateCost(provider, model, {
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cachedInputTokens: usage.cachedTokens,
    });

    const record: CostRecord = {
      id: this.generateId(),
      timestamp: Date.now(),
      provider,
      model,
      userId,
      operation,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens || 0,
      costUSD,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    };

    this.insertRecord(record);

    // Log apenas se tiver custo real
    if (costUSD > 0) {
      console.log(
        `💰 Cost: ${formatCost(costUSD)} | ${provider}/${model} | ` +
        `${usage.promptTokens + usage.completionTokens} tokens`
      );
    }
  }

  /**
   * Insere registro no banco
   */
  private insertRecord(record: CostRecord): void {
    const db = DatabaseConnection.getInstance();

    const stmt = db.prepare(`
      INSERT INTO cost_tracking (
        id, timestamp, provider, model, user_id, operation,
        input_tokens, output_tokens, cached_tokens, cost_usd, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.timestamp,
      record.provider,
      record.model,
      record.userId,
      record.operation,
      record.inputTokens,
      record.outputTokens,
      record.cachedTokens,
      record.costUSD,
      record.metadata,
    );
  }

  /**
   * Busca custos de um período específico
   */
  public getCostsByPeriod(
    userId: string,
    startTimestamp: number,
    endTimestamp: number,
  ): CostSummary {
    const db = DatabaseConnection.getInstance();

    const records = db.prepare(`
      SELECT * FROM cost_tracking
      WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp DESC
    `).all(userId, startTimestamp, endTimestamp) as any[];

    return this.aggregateRecords(records);
  }

  /**
   * Custo de hoje
   */
  public getTodayCosts(userId: string): CostSummary {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.getCostsByPeriod(userId, startOfDay.getTime(), endOfDay.getTime());
  }

  /**
   * Custo da semana
   */
  public getWeekCosts(userId: string): CostSummary {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    return this.getCostsByPeriod(userId, startOfWeek.getTime(), now.getTime());
  }

  /**
   * Custo do mês
   */
  public getMonthCosts(userId: string): CostSummary {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.getCostsByPeriod(userId, startOfMonth.getTime(), now.getTime());
  }

  /**
   * Agrega registros em summary
   */
  private aggregateRecords(records: any[]): CostSummary {
    const summary: CostSummary = {
      totalCostUSD: 0,
      totalTokens: 0,
      requestCount: records.length,
      byProvider: {},
      byModel: {},
    };

    for (const record of records) {
      const tokens = record.input_tokens + record.output_tokens;
      
      summary.totalCostUSD += record.cost_usd;
      summary.totalTokens += tokens;

      // By provider
      if (!summary.byProvider[record.provider]) {
        summary.byProvider[record.provider] = {
          costUSD: 0,
          tokens: 0,
          requests: 0,
        };
      }
      summary.byProvider[record.provider].costUSD += record.cost_usd;
      summary.byProvider[record.provider].tokens += tokens;
      summary.byProvider[record.provider].requests += 1;

      // By model
      const modelKey = `${record.provider}/${record.model}`;
      if (!summary.byModel[modelKey]) {
        summary.byModel[modelKey] = {
          costUSD: 0,
          tokens: 0,
          requests: 0,
        };
      }
      summary.byModel[modelKey].costUSD += record.cost_usd;
      summary.byModel[modelKey].tokens += tokens;
      summary.byModel[modelKey].requests += 1;
    }

    return summary;
  }

  /**
   * Formata summary para exibição no Telegram
   */
  public formatSummaryForTelegram(summary: CostSummary, period: string): string {
    let message = `📊 *Custo LLM - ${period}*\n\n`;

    message += `💰 *Total:* ${formatCost(summary.totalCostUSD)}\n`;
    message += `🔢 *Tokens:* ${summary.totalTokens.toLocaleString()}\n`;
    message += `📞 *Chamadas:* ${summary.requestCount}\n\n`;

    if (Object.keys(summary.byProvider).length > 0) {
      message += `*Por Provider:*\n`;
      for (const [provider, data] of Object.entries(summary.byProvider)) {
        message += `• ${provider}: ${formatCost(data.costUSD)} (${data.requests} calls)\n`;
      }
      message += '\n';
    }

    if (Object.keys(summary.byModel).length > 0) {
      message += `*Por Modelo:*\n`;
      for (const [model, data] of Object.entries(summary.byModel)) {
        message += `• ${model}: ${formatCost(data.costUSD)} (${data.tokens.toLocaleString()} tokens)\n`;
      }
    }

    return message;
  }

  /**
   * Gera ID único para registro
   */
  private generateId(): string {
    return `cost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper: Track from raw LLM response
   */
  public async trackFromResponse(params: {
    provider: string;
    model: string;
    userId: string;
    operation: string;
    rawUsage: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const usage = normalizeUsage(params.rawUsage, params.provider);
    if (!usage) {
      console.warn('[CostTracker] Could not normalize usage from response');
      return;
    }

    await this.trackLLMCall({
      ...params,
      usage,
    });
  }
}

// Export singleton instance
export const costTracker = CostTracker.getInstance();
