/**
 * Delivery Router
 * 
 * Central router for dispatching cron job outputs to different delivery channels.
 */

import type { Bot } from 'grammy';
import type { CronJob, CronJobOutput } from '../cron-types';
import { TelegramDelivery } from './telegram-delivery';
import { WhatsAppDelivery } from './whatsapp-delivery';
import { EmailDelivery } from './email-delivery';
import { WebhookDelivery } from './webhook-delivery';
import { DiscordDelivery } from './discord-delivery';

/**
 * Delivery Router
 * 
 * Routes job outputs to the appropriate delivery channel based on job configuration.
 */
export class DeliveryRouter {
  private telegramDelivery: TelegramDelivery;
  private whatsappDelivery: WhatsAppDelivery;
  private emailDelivery: EmailDelivery;
  private webhookDelivery: WebhookDelivery;
  private discordDelivery: DiscordDelivery;

  constructor(telegramBot?: Bot) {
    this.telegramDelivery = new TelegramDelivery(telegramBot);
    this.whatsappDelivery = new WhatsAppDelivery();
    this.emailDelivery = new EmailDelivery();
    this.webhookDelivery = new WebhookDelivery();
    this.discordDelivery = new DiscordDelivery();
  }

  /**
   * Deliver job output to configured channel
   */
  public async deliver(job: CronJob, output: CronJobOutput): Promise<void> {
    try {
      console.log(`[DeliveryRouter] Delivering via ${job.deliver}`);

      switch (job.deliver) {
        case 'telegram':
          await this.telegramDelivery.send(job, output);
          break;

        case 'whatsapp':
          await this.whatsappDelivery.send(job, output);
          break;

        case 'email':
          await this.emailDelivery.send(job, output);
          break;

        case 'webhook':
          await this.webhookDelivery.send(job, output);
          break;

        case 'discord':
          await this.discordDelivery.send(job, output);
          break;

        case 'local':
          console.log('[DeliveryRouter] Output saved to local file');
          break;

        case 'none':
          console.log('[DeliveryRouter] No delivery configured');
          break;

        default:
          console.warn(`[DeliveryRouter] Unknown delivery target: ${job.deliver}`);
      }

      console.log(`[DeliveryRouter] ✅ Delivery completed via ${job.deliver}`);
    } catch (error) {
      console.error(`[DeliveryRouter] ❌ Failed to deliver via ${job.deliver}:`, error);
      throw error;
    }
  }
}
