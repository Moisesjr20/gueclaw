import { Context, InputFile } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Telegram Output Handler - Sends responses back to users
 */
export class TelegramOutputHandler {
  private static readonly MAX_MESSAGE_LENGTH = 4096;
  private static readonly CHUNK_SIZE = 4000;

  /**
   * Send text response to user (plain text, no Markdown formatting)
   */
  public static async sendText(ctx: Context, text: string): Promise<void> {
    try {
      // If text is short enough, send directly
      if (text.length <= this.MAX_MESSAGE_LENGTH) {
        await ctx.reply(text);
        return;
      }

      // Split into chunks
      console.log(`📝 Response too long (${text.length} chars), splitting into chunks...`);
      await this.sendInChunks(ctx, text);

    } catch (error: any) {
      console.error('❌ Error sending text response:', error);
      
      // Try without markdown
      try {
        await ctx.reply(text);
      } catch {
        await ctx.reply('❌ Error sending response. The message may be too long or contain invalid formatting.');
      }
    }
  }

  /**
   * Send text as code block (formatted with monospace font)
   */
  public static async sendAsCode(ctx: Context, text: string, language: string = ''): Promise<void> {
    try {
      const maxCodeLength = 4000; // Leave room for markdown backticks

      if (text.length <= maxCodeLength) {
        // Send as single code block
        const formattedText = `\`\`\`${language}\n${text}\n\`\`\``;
        await ctx.reply(formattedText, { parse_mode: 'Markdown' });
        return;
      }

      // Split into multiple code blocks
      console.log(`📝 Code response too long (${text.length} chars), splitting into chunks...`);
      const chunks = this.splitIntoChunks(text, maxCodeLength);
      
      for (let i = 0; i < chunks.length; i++) {
        const prefix = i === 0 ? '' : `📄 Part ${i + 1}/${chunks.length}\n`;
        const formattedChunk = `${prefix}\`\`\`${language}\n${chunks[i]}\n\`\`\``;
        
        await ctx.reply(formattedChunk, { parse_mode: 'Markdown' });
        
        if (i < chunks.length - 1) {
          await this.sleep(100);
        }
      }

    } catch (error: any) {
      console.error('❌ Error sending code response:', error);
      // Fallback to plain text
      await this.sendText(ctx, text);
    }
  }

  /**
   * Send response in chunks
   */
  private static async sendInChunks(ctx: Context, text: string): Promise<void> {
    const chunks = this.splitIntoChunks(text, this.CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const prefix = i === 0 ? '' : `📄 Part ${i + 1}/${chunks.length}\n\n`;
      
      await ctx.reply(prefix + chunks[i]);
      
      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(100);
      }
    }
  }

  /**
   * Split text into chunks respecting word boundaries
   */
  private static splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = text.split('\n');

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If a single line is too long, split it
        if (line.length > chunkSize) {
          const words = line.split(' ');
          for (const word of words) {
            if (currentChunk.length + word.length + 1 > chunkSize) {
              chunks.push(currentChunk.trim());
              currentChunk = word;
            } else {
              currentChunk += (currentChunk ? ' ' : '') + word;
            }
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
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
    await ctx.reply(`❌ Error: ${error}`);
  }

  /**
   * Send success message
   */
  public static async sendSuccess(ctx: Context, message: string): Promise<void> {
    await ctx.reply(`✅ ${message}`);
  }

  /**
   * Send warning message
   */
  public static async sendWarning(ctx: Context, message: string): Promise<void> {
    await ctx.reply(`⚠️ ${message}`);
  }

  /**
   * Send info message
   */
  public static async sendInfo(ctx: Context, message: string): Promise<void> {
    await ctx.reply(`ℹ️ ${message}`);
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
