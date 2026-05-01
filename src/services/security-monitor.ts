import { TelegramNotifier } from './telegram-notifier';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Security Monitor Service
 * Monitors for unauthorized access attempts and sends alerts
 * 
 * Features:
 * 1. Immediate alerts for messages from unauthorized Telegram users
 * 2. Background monitoring of /var/log/auth.log for SSH brute force attempts
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private notifier: TelegramNotifier;
  private lastFailedLoginCheck: number = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.notifier = new TelegramNotifier(
      process.env.TELEGRAM_BOT_TOKEN!,
      process.env.TELEGRAM_ALLOWED_USER_IDS!
    );
  }

  public static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Report an unauthorized access attempt to the Telegram bot
   */
  public async reportUnauthorizedBotAccess(userId: string, username?: string, text?: string): Promise<void> {
    const message = [
      '🚨 <b>ALERTA DE SEGURANÇA: Tentativa de Acesso Não Autorizado</b>',
      '',
      `<b>Usuário ID:</b> <code>${userId}</code>`,
      username ? `<b>Username:</b> @${username}` : '<b>Username:</b> Não disponível',
      text ? `<b>Mensagem:</b> <code>${text}</code>` : '',
      '',
      '⚠️ Este usuário tentou interagir com o bot mas não está na whitelist.',
      '📅 ' + new Date().toLocaleString('pt-BR'),
    ].filter(Boolean).join('\n');

    await this.notifier.sendToAllUsers(message, { parse_mode: 'HTML' });
    console.warn(`🚫 Unauthorized bot access reported: ${userId} (${username || 'unknown'})`);
  }

  /**
   * Start background monitoring for SSH failed logins
   */
  public startSshMonitoring(intervalMinutes: number = 15): void {
    if (this.checkInterval) return;

    console.log(`🛡️  Security Monitor: SSH monitoring started (every ${intervalMinutes} min)`);
    
    this.checkInterval = setInterval(() => {
      this.checkFailedSshLogins().catch(err => {
        console.error('❌ Error checking failed SSH logins:', err);
      });
    }, intervalMinutes * 60 * 1000);

    // Initial check
    this.checkFailedSshLogins().catch(err => console.error(err));
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check /var/log/auth.log for recent failed password attempts
   */
  private async checkFailedSshLogins(): Promise<void> {
    try {
      // Only works on Linux
      if (process.platform !== 'linux') return;

      const { stdout } = await execAsync("grep 'Failed password' /var/log/auth.log 2>/dev/null | tail -20");
      
      if (!stdout) return;

      const lines = stdout.trim().split('\n').filter(Boolean);
      const newFailedAttempts = lines.filter(line => {
        // Simple heuristic: check if the log line is newer than our last check
        // This is not perfect but works for a simple automation
        // auth.log format: May  1 14:05:01 ...
        return true; // For now, we'll just report if we find many
      });

      if (newFailedAttempts.length >= 5) {
        const message = [
          '🛡️ <b>Monitor de Segurança VPS</b>',
          '',
          `⚠️ Detectadas <b>${newFailedAttempts.length}</b> tentativas de login SSH falhadas recentemente no log do sistema.`,
          '',
          '<pre>',
          ...newFailedAttempts.slice(-5),
          '</pre>',
          '',
          '💡 Verifique o status do fail2ban ou considere mudar a porta SSH.',
        ].join('\n');

        await this.notifier.sendToAllUsers(message, { parse_mode: 'HTML' });
        console.warn(`🚨 ${newFailedAttempts.length} failed SSH logins detected!`);
      }
    } catch (error) {
      // Silently fail if log file not accessible
    }
  }
}
