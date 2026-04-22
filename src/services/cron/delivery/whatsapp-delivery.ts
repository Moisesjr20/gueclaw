/**
 * WhatsApp Delivery Channel
 * 
 * Delivers cron job outputs via WhatsApp using UazAPI.
 */

import type { CronJob, CronJobOutput } from '../cron-types';

export class WhatsAppDelivery {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.UAIZAPI_BASE_URL || '';
    this.token = process.env.UAIZAPI_TOKEN || '';

    if (!this.baseUrl || !this.token) {
      console.warn('[WhatsAppDelivery] UazAPI not configured (missing UAIZAPI_BASE_URL or UAIZAPI_TOKEN)');
    }
  }

  /**
   * Send job output via WhatsApp
   */
  public async send(job: CronJob, output: CronJobOutput): Promise<void> {
    if (!this.baseUrl || !this.token) {
      throw new Error('WhatsApp delivery not configured (missing UazAPI credentials)');
    }

    const chatId = job.deliverTo || job.metadata?.whatsappNumber;
    if (!chatId) {
      throw new Error('No WhatsApp chat ID specified');
    }

    // Format message
    const message = this.formatMessage(job, output);

    // Send via UazAPI
    const response = await fetch(`${this.baseUrl}/message/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        chatId,
        text: message
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp delivery failed: ${error}`);
    }

    console.log(`[WhatsAppDelivery] ✅ Sent to ${chatId}`);
  }

  /**
   * Format output as WhatsApp message
   */
  private formatMessage(job: CronJob, output: CronJobOutput): string {
    if (output.success) {
      const emoji = output.recovered ? '🔄' : '🤖';
      const title = output.recovered 
        ? `*${emoji} Cron Job (Recovered): ${job.name}*`
        : `*${emoji} Cron Job: ${job.name}*`;

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
        ? `*${emoji} Cron Job Failed (Recovered): ${job.name}*`
        : `*${emoji} Cron Job Failed: ${job.name}*`;

      let message = `${title}\n\n*Error:* ${output.error}`;

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
