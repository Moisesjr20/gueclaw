import { Bot, Context } from 'grammy';
import { AgentController } from './AgentController';
import { processImage, processDocument, processVoice } from '../tools/MultimodalHandler';

export class TelegramInputHandler {
  private bot: Bot;
  private agentController: AgentController;
  private botToken: string;

  constructor(bot: Bot, agentController: AgentController) {
    this.bot = bot;
    this.agentController = agentController;
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  public register() {
    this.bot.use(this.whitelistMiddleware.bind(this));

    // ── Texto ────────────────────────────────────────────────
    this.bot.on('message:text', async (ctx) => {
      await this.handleTextMessage(ctx);
    });

    // ── Foto / Imagem ─────────────────────────────────────────
    this.bot.on('message:photo', async (ctx) => {
      await ctx.replyWithChatAction('typing');
      try {
        const userId = ctx.from!.id.toString();
        // Pega a maior resolução disponível
        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1];
        const caption = ctx.message.caption || '';

        const analysis = await processImage(this.botToken, bestPhoto.file_id, caption);
        // Passa a análise ao AgentController como se fosse texto
        await this.agentController.handleInput(userId, `[🖼️ Imagem recebida]\n${analysis}`, ctx);
      } catch (err: any) {
        console.error('[InputHandler] Erro ao processar imagem:', err.message);
        await ctx.reply('Desculpe, não consegui processar a imagem. Tente novamente.');
      }
    });

    // ── Documento ─────────────────────────────────────────────
    this.bot.on('message:document', async (ctx) => {
      await ctx.replyWithChatAction('typing');
      try {
        const userId = ctx.from!.id.toString();
        const doc = ctx.message.document;
        const caption = ctx.message.caption || '';
        const fileName = doc.file_name || `arquivo.${doc.mime_type?.split('/')[1] || 'bin'}`;

        const content = await processDocument(this.botToken, doc.file_id, fileName, caption);
        await this.agentController.handleInput(userId, `[📄 Documento: ${fileName}]\n${content}`, ctx);
      } catch (err: any) {
        console.error('[InputHandler] Erro ao processar documento:', err.message);
        await ctx.reply('Desculpe, não consegui processar o documento.');
      }
    });

    // ── Áudio / Voz ───────────────────────────────────────────
    this.bot.on('message:voice', async (ctx) => {
      await ctx.replyWithChatAction('typing');
      try {
        const userId = ctx.from!.id.toString();
        const voice = ctx.message.voice;

        await ctx.reply('🎤 Transcrevendo áudio...');
        const transcription = await processVoice(this.botToken, voice.file_id, 'audio/ogg');

        if (!transcription) {
          await ctx.reply('Não consegui transcrever o áudio. Tente falar mais claramente.');
          return;
        }

        await ctx.reply(`🎤 *Você disse:* ${transcription}`, { parse_mode: 'Markdown' });
        // Processa a transcrição como texto normal
        await this.agentController.handleInput(userId, transcription, ctx);
      } catch (err: any) {
        console.error('[InputHandler] Erro ao processar voz:', err.message);
        await ctx.reply('Desculpe, não consegui processar o áudio.');
      }
    });

    // ── Áudio (arquivos de música/podcast) ────────────────────
    this.bot.on('message:audio', async (ctx) => {
      await ctx.replyWithChatAction('typing');
      try {
        const userId = ctx.from!.id.toString();
        const audio = ctx.message.audio;
        const mimeType = audio.mime_type || 'audio/mpeg';

        await ctx.reply('🎵 Transcrevendo áudio...');
        const transcription = await processVoice(this.botToken, audio.file_id, mimeType);

        if (!transcription) {
          await ctx.reply('Não consegui transcrever este áudio.');
          return;
        }

        await ctx.reply(`🎵 *Transcrição:* ${transcription}`, { parse_mode: 'Markdown' });
        await this.agentController.handleInput(userId, transcription, ctx);
      } catch (err: any) {
        console.error('[InputHandler] Erro ao processar áudio:', err.message);
        await ctx.reply('Desculpe, não consegui processar o áudio.');
      }
    });
  }

  private async whitelistMiddleware(ctx: Context, next: () => Promise<void>) {
    const userId = ctx.from?.id.toString();
    const whitelist = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',') || [];

    if (!userId || !whitelist.includes(userId)) {
      console.warn(`[Segurança] Usuário bloqueado: ${userId}`);
      return;
    }
    await next();
  }

  private async handleTextMessage(ctx: Context) {
    try {
      if (!ctx.message?.text || !ctx.from?.id) return;
      const userId = ctx.from.id.toString();
      await this.agentController.handleInput(userId, ctx.message.text, ctx);
    } catch (error) {
      console.error('[InputHandler] Erro ao processar texto:', error);
      await ctx.reply('Desculpe, ocorreu um erro interno.');
    }
  }
}
