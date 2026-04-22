/**
 * Discord Delivery Channel
 * 
 * Delivers cron job outputs via Discord webhooks.
 */

import type { CronJob, CronJobOutput } from '../cron-types';

export class DiscordDelivery {
  /**
   * Send job output via Discord webhook
   */
  public async send(job: CronJob, output: CronJobOutput): Promise<void> {
    const webhookUrl = job.deliverTo;
    if (!webhookUrl) {
      throw new Error('No Discord webhook URL specified');
    }

    // Build Discord embed
    const embed = this.buildEmbed(job, output);

    // Send to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`Discord delivery failed (${response.status}): ${error}`);
    }

    console.log(`[DiscordDelivery] ✅ Sent to Discord webhook`);
  }

  /**
   * Build Discord embed message
   */
  private buildEmbed(job: CronJob, output: CronJobOutput): any {
    const statusColor = output.success ? 0x4CAF50 : 0xf44336; // Green or Red
    const statusEmoji = output.success ? '✅' : '❌';
    const recoveryEmoji = output.recovered ? '🔄 ' : '';

    const embed: any = {
      title: `${recoveryEmoji}${statusEmoji} ${job.name}`,
      description: output.success ? this.truncate(output.output, 2000) : `**Error:** ${output.error}`,
      color: statusColor,
      timestamp: output.timestamp,
      fields: [
        {
          name: 'Job ID',
          value: `\`${job.id}\``,
          inline: true
        },
        {
          name: 'Duration',
          value: `${output.duration}ms`,
          inline: true
        },
        {
          name: 'Status',
          value: output.success ? 'Success' : 'Failed',
          inline: true
        }
      ]
    };

    // Add recovery info
    if (output.recovered && output.originalScheduledTime) {
      embed.fields.push({
        name: 'Recovery',
        value: `Originally scheduled: ${output.originalScheduledTime}\nDelay: ${this.calculateDelay(output.originalScheduledTime, output.timestamp)}`,
        inline: false
      });
    }

    // Add tools used
    if (output.toolsUsed && output.toolsUsed.length > 0) {
      embed.fields.push({
        name: 'Tools Used',
        value: output.toolsUsed.join(', '),
        inline: false
      });
    }

    // Add tokens
    if (output.tokens) {
      embed.fields.push({
        name: 'Tokens',
        value: `${output.tokens.total} (prompt: ${output.tokens.prompt}, completion: ${output.tokens.completion})`,
        inline: false
      });
    }

    return embed;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
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
