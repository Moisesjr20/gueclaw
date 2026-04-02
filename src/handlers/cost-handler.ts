/**
 * Cost Handler - Comando /cost
 * 
 * Exibe custos de LLM por período (Phase 2.3)
 */

import { Context } from 'grammy';
import { costTracker } from '../services/cost-tracker';

export interface CostHandlerOptions {
  period?: 'today' | 'week' | 'month';
}

/**
 * Handler do comando /cost
 * 
 * Uso:
 *   /cost          → Custo de hoje
 *   /cost today    → Custo de hoje
 *   /cost week     → Últimos 7 dias
 *   /cost semana   → Últimos 7 dias
 *   /cost month    → Este mês
 *   /cost mês      → Este mês
 */
export class CostHandler {
  public static async handle(ctx: Context, userId: string, text: string): Promise<void> {
    const lowercaseText = text.toLowerCase().trim();

    // Parse período
    let period: 'today' | 'week' | 'month' = 'today';
    
    if (lowercaseText.includes('week') || lowercaseText.includes('semana')) {
      period = 'week';
    } else if (lowercaseText.includes('month') || lowercaseText.includes('mês') || lowercaseText.includes('mes')) {
      period = 'month';
    }

    // Buscar summary por período
    let summary;
    let periodLabel;

    switch (period) {
      case 'today':
        summary = costTracker.getTodayCosts(userId);
        periodLabel = 'Hoje';
        break;
      case 'week':
        summary = costTracker.getWeekCosts(userId);
        periodLabel = 'Últimos 7 dias';
        break;
      case 'month':
        summary = costTracker.getMonthCosts(userId);
        periodLabel = 'Este mês';
        break;
    }

    // Formatar output
    const message = costTracker.formatSummaryForTelegram(summary, periodLabel);

    // Enviar via Telegram
    await ctx.reply(message, { parse_mode: 'Markdown' });

    console.log(`💰 /cost ${period} - User ${userId} - $${summary.totalCostUSD.toFixed(4)}`);
  }
}
