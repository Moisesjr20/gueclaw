/**
 * Telegram Delivery Channel
 * 
 * Delivers cron job outputs via Telegram Bot.
 */

import type { Bot } from 'grammy';
import type { CronJob, CronJobOutput } from '../cron-types';

export class TelegramDelivery {
  private bot: Bot | null = null;

  constructor(bot?: Bot) {
    this.bot = bot || null;
  }

  /**
   * Send job output via Telegram
   */
  public async send(job: CronJob, output: CronJobOutput): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    const chatId = job.deliverTo || job.userId;
    if (!chatId) {
      throw new Error('No chat ID specified for Telegram delivery');
    }

    // Format message
    const message = this.formatMessage(job, output);

    // Send message
    await this.bot.api.sendMessage(chatId, message, {
      parse_mode: 'Markdown'
    });

    console.log(`[TelegramDelivery] ✅ Sent to chat ${chatId}`);
  }

  /**
   * Format output as Telegram message
   */
  private formatMessage(job: CronJob, output: CronJobOutput): string {
    if (output.success) {
      const emoji = output.recovered ? '🔄' : '🤖';
      const title = output.recovered 
        ? `**${emoji} Cron Job (Recovered): ${job.name}**`
        : `**${emoji} Cron Job: ${job.name}**`;

      let message = `${title}\n\n${output.output}`;

      if (output.recovered && output.originalScheduledTime) {
        const delay = this.calculateDelay(output.originalScheduledTime, output.timestamp);
        message += `\n\n_⏱️ Originally scheduled: ${output.originalScheduledTime} (delayed by ${delay})_`;
      }

      message += `\n\n_✅ Executed in ${output.duration}ms_`;

      return message;
    } else {
      const emoji = output.recovered ? '🔄❌' : '❌';
      const title = output.recovered
        ? `**${emoji} Cron Job Failed (Recovered): ${job.name}**`
        : `**${emoji} Cron Job Failed: ${job.name}**`;

      let message = `${title}\n\n**Error:** ${output.error}`;

      if (output.recovered && output.originalScheduledTime) {
        message += `\n\n_Originally scheduled: ${output.originalScheduledTime}_`;
      }

      message += `\n\n_Execution time: ${output.duration}ms_`;

      return message;
    }
  }

  /**
   * Calculate delay between scheduled and actual execution
   */
  private calculateDelay(scheduledTime: string, actualTime: string): string {
    const scheduled = new Date(scheduledTime).getTime();
    const actual = new Date(actualTime).getTime();
    const delayMs = actual - scheduled;

    const hours = Math.floor(delayMs / (1000 * 60 * 60));
    const minutes = Math.floor((delayMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
