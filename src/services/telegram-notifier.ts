import axios from 'axios';

/**
 * Telegram Notification Service
 * Sends notifications to specific users via Telegram
 */
export class TelegramNotifier {
  private botToken: string;
  private allowedUserIds: number[];

  constructor(botToken: string, allowedUserIds: string) {
    this.botToken = botToken;
    this.allowedUserIds = allowedUserIds.split(',').map(id => parseInt(id.trim()));
  }

  /**
   * Send a message to all allowed users
   */
  async sendToAllUsers(message: string, options?: {
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
  }): Promise<void> {
    const promises = this.allowedUserIds.map(userId =>
      this.sendToUser(userId, message, options)
    );
    await Promise.all(promises);
  }

  /**
   * Send a message to a specific user
   */
  async sendToUser(userId: number, message: string, options?: {
    parse_mode?: 'Markdown' | 'HTML';
    disable_web_page_preview?: boolean;
  }): Promise<void> {
    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: userId,
        text: message,
        parse_mode: options?.parse_mode || 'Markdown',
        disable_web_page_preview: options?.disable_web_page_preview || false,
      });
    } catch (error: any) {
      console.error(`❌ Failed to send Telegram notification to ${userId}:`, error.message);
    }
  }

  /**
   * Send GitHub Copilot OAuth authentication request
   */
  async sendOAuthRequest(deviceCode: string, userCode: string, verificationUri: string): Promise<void> {
    const message = [
      '🔐 <b>GitHub Copilot - Autenticação Necessária</b>',
      '',
      'O token expirou! Por favor, autorize novamente:',
      '',
      `<b>Código:</b> <code>${userCode}</code>`,
      '',
      `<b>Link:</b> <a href="${verificationUri}">${verificationUri}</a>`,
      '',
      '📱 Abra o link, faça login no GitHub e digite o código acima.',
      '',
      '⏳ Aguardando sua autorização...',
    ].join('\n');

    await this.sendToAllUsers(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    console.log(`📲 OAuth request sent to Telegram users`);
    console.log(`🔑 Device Code: ${deviceCode}`);
    console.log(`📱 User Code: ${userCode}`);
    console.log(`🔗 Verification URI: ${verificationUri}`);
  }

  /**
   * Send OAuth success notification
   */
  async sendOAuthSuccess(): Promise<void> {
    const message = [
      '✅ <b>GitHub Copilot Autenticado!</b>',
      '',
      '🎉 Token renovado com sucesso!',
      '',
      'O bot já está funcionando normalmente.',
    ].join('\n');

    await this.sendToAllUsers(message, {
      parse_mode: 'HTML',
    });

    console.log('✅ OAuth success notification sent to Telegram');
  }

  /**
   * Send OAuth failure notification
   */
  async sendOAuthFailure(error: string): Promise<void> {
    const safeError = error.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const message = [
      '❌ <b>Falha na Autenticação GitHub Copilot</b>',
      '',
      `Erro: ${safeError}`,
      '',
      'Por favor, execute manualmente:',
      '<pre>ssh root@VPS_IP\ncd /opt/gueclaw-agent\nnpm run copilot:auth</pre>',
    ].join('\n');

    await this.sendToAllUsers(message, {
      parse_mode: 'HTML',
    });

    console.error('❌ OAuth failure notification sent to Telegram');
  }
}
