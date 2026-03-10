import { Bot, Context } from 'grammy';
import { AgentController } from './AgentController';

export class TelegramInputHandler {
  private bot: Bot;
  private agentController: AgentController;

  constructor(bot: Bot, agentController: AgentController) {
    this.bot = bot;
    this.agentController = agentController;
  }

  public register() {
    this.bot.use(this.whitelistMiddleware.bind(this));

    this.bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    // Aqui podemos adicionar suporte a arquivos/áudios no futuro
    this.bot.on('message:document', async (ctx) => {
        await ctx.reply("Ainda não suporto receber de documentos, mas estou aprendendo!");
    });
  }

  private async whitelistMiddleware(ctx: Context, next: () => Promise<void>) {
    const userId = ctx.from?.id.toString();
    const whitelist = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',') || [];

    if (!userId || !whitelist.includes(userId)) {
      console.warn(`[Segurança] Usuário bloqueado tentou acessar: ${userId}`);
      return; // Ignora o fluxo silenciosamente
    }
    await next();
  }

  private async handleTextMessage(ctx: Context) {
    try {
      if (!ctx.message?.text || !ctx.from?.id) return;
      
      const userId = ctx.from.id.toString();
      const text = ctx.message.text;

      // Chama o Facade para lidar com a intenção
      await this.agentController.handleInput(userId, text, ctx);
    } catch (error) {
      console.error('[InputHandler] Erro ao processar texto:', error);
      await ctx.reply("Desculpe, ocorreu um erro interno.");
    }
  }
}
