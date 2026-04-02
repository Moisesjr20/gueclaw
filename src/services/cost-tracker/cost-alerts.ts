/**
 * Cost Alerts - Alertas de gastos excessivos
 * 
 * Monitora custos e envia notificação Telegram se ultrapassar threshold (Phase 2.3)
 */

import { costTracker } from './cost-tracker';
import { TelegramNotifier } from '../telegram-notifier';
import { formatCost } from './pricing';

export interface CostAlertConfig {
  dailyThresholdUSD: number; // Default: 5.0
  weeklyThresholdUSD: number; // Default: 30.0
  monthlyThresholdUSD: number; // Default: 100.0
  enableAlerts: boolean; // Default: true
}

export class CostAlerts {
  private config: CostAlertConfig;
  private lastDailyCheck: Date | null = null;

  constructor(config: Partial<CostAlertConfig> = {}) {
    this.config = {
      dailyThresholdUSD: config.dailyThresholdUSD || 5.0,
      weeklyThresholdUSD: config.weeklyThresholdUSD || 30.0,
      monthlyThresholdUSD: config.monthlyThresholdUSD || 100.0,
      enableAlerts: config.enableAlerts ?? true,
    };
  }

  /**
   * Verifica se houve excesso de gastos hoje
   * Verifica apenas 1x por dia
   */
  public async checkDailyThreshold(userId: string): Promise<void> {
    if (!this.config.enableAlerts) return;

    const now = new Date();
    
    // Verifica apenas 1x por dia
    if (this.lastDailyCheck && 
        this.lastDailyCheck.toDateString() === now.toDateString()) {
      return;
    }

    const summary = costTracker.getTodayCosts(userId);

    if (summary.totalCostUSD > this.config.dailyThresholdUSD) {
      await this.sendAlert(
        userId,
        'daily',
        summary.totalCostUSD,
        this.config.dailyThresholdUSD,
      );
    }

    this.lastDailyCheck = now;
  }

  /**
   * Envia alerta via Telegram
   */
  private async sendAlert(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    currentCost: number,
    threshold: number,
  ): Promise<void> {
    // Envia notificação via Telegram
    const notifier = new TelegramNotifier(
      process.env.TELEGRAM_BOT_TOKEN!,
      process.env.TELEGRAM_ALLOWED_USER_IDS!
    );

    const periodLabels = {
      daily: 'hoje',
      weekly: 'esta semana',
      monthly: 'este mês',
    };

    const message = 
      `⚠️ *ALERTA DE CUSTO LLM*\n\n` +
      `Gastos ${periodLabels[period]} ultrapassaram o limite!\n\n` +
      `💰 *Atual:* ${formatCost(currentCost)}\n` +
      `🚨 *Limite:* ${formatCost(threshold)}\n` +
      `📊 *Excesso:* ${formatCost(currentCost - threshold)}\n\n` +
      `Use \`/cost\` para detalhes.`;

    await notifier.sendToUser(parseInt(userId, 10), message, { parse_mode: 'Markdown' });

    console.warn(
      `[CostAlerts] Threshold exceeded for user ${userId}: ` +
      `${formatCost(currentCost)} > ${formatCost(threshold)}`
    );
  }
}

// Singleton
export const costAlerts = new CostAlerts({
  dailyThresholdUSD: parseFloat(process.env.COST_ALERT_DAILY_USD || '5.0'),
  weeklyThresholdUSD: parseFloat(process.env.COST_ALERT_WEEKLY_USD || '30.0'),
  monthlyThresholdUSD: parseFloat(process.env.COST_ALERT_MONTHLY_USD || '100.0'),
  enableAlerts: process.env.COST_ALERTS_ENABLED !== 'false',
});
