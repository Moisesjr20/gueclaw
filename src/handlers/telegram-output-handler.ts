import { Context, InputFile } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { TelegramFormatter } from '../utils/telegram-formatter';

/**
 * Telegram Output Handler - Sends responses back to users
 */
export class TelegramOutputHandler {
  private static readonly MAX_MESSAGE_LENGTH = TelegramFormatter.MAX_MESSAGE_LENGTH;
  private static readonly CHUNK_SIZE = TelegramFormatter.CHUNK_SIZE;

  /**
   * Send a formatted text response to the user.
   * Converts Markdown produced by the LLM to Telegram HTML before sending.
   * Uses parse_mode='HTML' so bold, italic, code blocks, links, etc. render correctly.
   */
  public static async sendText(ctx: Context, text: string): Promise<void> {
    try {
      const html = TelegramFormatter.toHtml(text);

      if (html.length <= this.MAX_MESSAGE_LENGTH) {
        await ctx.reply(html, { parse_mode: 'HTML' });
        return;
      }

      console.log(`📝 Response too long (${html.length} chars), splitting into chunks...`);
      await this.sendInChunks(ctx, html);

    } catch (error: any) {
      console.error('❌ Error sending formatted text response:', error);
      // Last-resort fallback: strip formatting and send plain text
      try {
        await ctx.reply(text);
      } catch {
        await ctx.reply('❌ Erro ao enviar resposta. A mensagem pode conter formatação inválida.');
      }
    }
  }

  /**
   * Send raw text as a monospace <pre> block (for shell/terminal output).
   * Content is HTML-escaped but NOT processed for Markdown, preserving
   * prompts, indentation and special characters exactly as-is.
   */
  public static async sendAsCode(ctx: Context, text: string): Promise<void> {
    try {
      const maxCodeLength = TelegramFormatter.CHUNK_SIZE; // conservative limit

      if (text.length <= maxCodeLength) {
        await ctx.reply(`<pre>${TelegramFormatter.escapeHtml(text)}</pre>`, { parse_mode: 'HTML' });
        return;
      }

      // Split into multiple blocks
      console.log(`📝 Code response too long (${text.length} chars), splitting into chunks...`);
      const lines = text.split('\n');
      let current = '';

      const flush = async (chunk: string, partLabel: string) => {
        await ctx.reply(`${partLabel}<pre>${TelegramFormatter.escapeHtml(chunk)}</pre>`, { parse_mode: 'HTML' });
        await this.sleep(150);
      };

      let part = 1;
      for (const line of lines) {
        if (current.length + line.length + 1 > maxCodeLength) {
          await flush(current, part > 1 ? `<i>📄 Parte ${part}</i>\n` : '');
          current = line;
          part++;
        } else {
          current += (current ? '\n' : '') + line;
        }
      }
      if (current) {
        await flush(current, part > 1 ? `<i>📄 Parte ${part}</i>\n` : '');
      }

    } catch (error: any) {
      console.error('❌ Error sending code response:', error);
      await this.sendText(ctx, text);
    }
  }

  /**
   * Send pre-formatted HTML in chunks, each within Telegram's 4096-char limit.
   * The incoming `html` string must already be formatted by TelegramFormatter.toHtml().
   */
  private static async sendInChunks(ctx: Context, html: string): Promise<void> {
    const chunks = TelegramFormatter.splitHtml(html, this.CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const header = i === 0 ? '' : `<i>📄 Parte ${i + 1}/${chunks.length}</i>\n\n`;
      await ctx.reply(header + chunks[i], { parse_mode: 'HTML' });

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(150);
      }
    }
  }

  /**
   * Send file to user
   */
  public static async sendFile(
    ctx: Context,
    filePath: string,
    caption?: string,
    deleteAfter: boolean = true
  ): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        await ctx.reply('❌ Error: File not found');
        return;
      }

      const fileName = path.basename(filePath);
      const stats = fs.statSync(filePath);

      console.log(`📤 Sending file: ${fileName} (${stats.size} bytes)`);

      // Determine file type and send accordingly
      const extension = path.extname(filePath).toLowerCase();

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
        // Send as photo
        await ctx.replyWithPhoto(new InputFile(filePath), {
          caption: caption?.substring(0, 1024), // Telegram caption limit
        });
      } else if (['.mp4', '.mov', '.avi'].includes(extension)) {
        // Send as video
        await ctx.replyWithVideo(new InputFile(filePath), {
          caption: caption?.substring(0, 1024),
        });
      } else if (['.mp3', '.ogg', '.wav', '.m4a'].includes(extension)) {
        // Send as audio
        await ctx.replyWithAudio(new InputFile(filePath), {
          caption: caption?.substring(0, 1024),
        });
      } else {
        // Send as document
        await ctx.replyWithDocument(new InputFile(filePath), {
          caption: caption?.substring(0, 1024),
        });
      }

      console.log(`✅ File sent successfully: ${fileName}`);

      // Delete file after sending if requested
      if (deleteAfter) {
        this.deleteFileAsync(filePath);
      }

    } catch (error: any) {
      console.error('❌ Error sending file:', error);
      await ctx.reply('❌ Error sending file. The file may be too large or in an unsupported format.');
    }
  }

  /**
   * Send markdown file as document
   */
  public static async sendMarkdownAsFile(
    ctx: Context,
    content: string,
    fileName: string = 'response.md'
  ): Promise<void> {
    try {
      const tempDir = process.env.TEMP_DIR || './tmp';
      const filePath = path.join(tempDir, `${Date.now()}_${fileName}`);

      // Write content to file
      fs.writeFileSync(filePath, content, 'utf8');

      // Send file
      await this.sendFile(ctx, filePath, 'Here\'s the complete response:', true);

    } catch (error: any) {
      console.error('❌ Error sending markdown file:', error);
      await ctx.reply('❌ Error creating file. Sending as text instead...');
      await this.sendText(ctx, content);
    }
  }

  /**
   * Send typing action
   */
  public static async sendTypingAction(ctx: Context): Promise<void> {
    try {
      await ctx.api.sendChatAction(ctx.chat!.id, 'typing');
    } catch (error) {
      // Ignore errors for typing action
    }
  }

  /**
   * Send error message
   */
  public static async sendError(ctx: Context, error: string): Promise<void> {
    const safe = TelegramFormatter.escapeHtml(error);
    await ctx.reply(`❌ <b>Erro:</b> ${safe}`, { parse_mode: 'HTML' });
  }

  /**
   * Send success message
   */
  public static async sendSuccess(ctx: Context, message: string): Promise<void> {
    const safe = TelegramFormatter.escapeHtml(message);
    await ctx.reply(`✅ ${safe}`, { parse_mode: 'HTML' });
  }

  /**
   * Send warning message
   */
  public static async sendWarning(ctx: Context, message: string): Promise<void> {
    const safe = TelegramFormatter.escapeHtml(message);
    await ctx.reply(`⚠️ ${safe}`, { parse_mode: 'HTML' });
  }

  /**
   * Send info message
   */
  public static async sendInfo(ctx: Context, message: string): Promise<void> {
    const safe = TelegramFormatter.escapeHtml(message);
    await ctx.reply(`ℹ️ ${safe}`, { parse_mode: 'HTML' });
  }

  /**
   * Delete file asynchronously (don't wait)
   */
  private static deleteFileAsync(filePath: string): void {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Deleted temp file: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error('❌ Error deleting temp file:', error);
      }
    }, 1000);
  }

  /**
   * Sleep helper
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle Telegram rate limiting
   */
  public static async handleRateLimit(retryAfter: number): Promise<void> {
    console.warn(`⏳ Rate limited. Waiting ${retryAfter} seconds...`);
    await this.sleep(retryAfter * 1000);
  }
}
