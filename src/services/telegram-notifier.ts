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
    const message = `
🔐 **GitHub Copilot - Autenticação Necessária**

O token expirou! Por favor, autorize novamente:

**Código:** \`${userCode}\`

🔗 **Link:** ${verificationUri}

📱 Abra o link, faça login no GitHub e digite o código acima.

⏳ Aguardando sua autorização...
`;

    await this.sendToAllUsers(message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
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
    const message = `
✅ **GitHub Copilot Autenticado!**

🎉 Token renovado com sucesso!

O bot já está funcionando normalmente.
`;

    await this.sendToAllUsers(message, {
      parse_mode: 'Markdown',
    });

    console.log('✅ OAuth success notification sent to Telegram');
  }

  /**
   * Send OAuth failure notification
   */
  async sendOAuthFailure(error: string): Promise<void> {
    const message = `
❌ **Falha na Autenticação GitHub Copilot**

Erro: ${error}

Por favor, execute manualmente:
\`\`\`
ssh root@VPS_IP
cd /opt/gueclaw-agent
npm run copilot:auth
\`\`\`
`;

    await this.sendToAllUsers(message, {
      parse_mode: 'Markdown',
    });

    console.error('❌ OAuth failure notification sent to Telegram');
  }
}
