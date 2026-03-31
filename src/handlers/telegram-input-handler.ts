import { Context } from 'grammy';
import { TelegramInput, FileAttachment } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as Papa from 'papaparse';
import { AudioTool } from '../tools/audio-tool';

/**
 * Telegram Input Handler - Processes incoming messages and files
 */
export class TelegramInputHandler {
  private tempDir: string;
  private allowedUserIds: Set<string>;
  private maxFileSize: number;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || './tmp';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;
    
    // Parse allowed user IDs from environment
    const userIds = process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',') || [];
    this.allowedUserIds = new Set(userIds.map(id => id.trim()));

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Check if user is authorized
   */
  public isAuthorized(userId: string): boolean {
    if (this.allowedUserIds.size === 0) {
      console.warn('⚠️  No user IDs configured in whitelist!');
      return false;
    }

    return this.allowedUserIds.has(userId);
  }

  /**
   * Process incoming message from Telegram
   */
  public async processMessage(ctx: Context): Promise<TelegramInput | null> {
    try {
      const userId = ctx.from?.id.toString();
      
      if (!userId) {
        return null;
      }

      // Authorization check
      if (!this.isAuthorized(userId)) {
        console.warn(`🚫 Unauthorized access attempt from user ${userId}`);
        await ctx.reply('⛔ Access denied. You are not authorized to use this bot.');
        return null;
      }

      const input: TelegramInput = {
        userId,
        messageId: ctx.message?.message_id || 0,
        chatId: ctx.chat?.id || 0,
        text: '',
        attachments: [],
      };

      // Extract text
      if (ctx.message?.text) {
        input.text = ctx.message.text;
      }

      if (ctx.message?.caption) {
        input.text = ctx.message.caption;
      }

      // Process document (PDF, CSV, etc.)
      if (ctx.message?.document) {
        const attachment = await this.processDocument(ctx);
        if (attachment) {
          input.attachments?.push(attachment);
        }
      }

      // Process photo
      if (ctx.message?.photo) {
        const attachment = await this.processPhoto(ctx);
        if (attachment) {
          input.attachments?.push(attachment);
        }
      }

      // Process voice/audio
      if (ctx.message?.voice || ctx.message?.audio) {
        const attachment = await this.processAudio(ctx);
        if (attachment) {
          input.attachments?.push(attachment);
        }
      }

      // Validate that we have some content
      if (!input.text && (!input.attachments || input.attachments.length === 0)) {
        await ctx.reply('⚠️ Please send a text message or supported file (PDF, CSV, image, audio).');
        return null;
      }

      return input;

    } catch (error: any) {
      console.error('❌ Error processing Telegram input:', error);
      await ctx.reply('❌ Error processing your message. Please try again.');
      return null;
    }
  }

  /**
   * Process document attachment (PDF, CSV, etc.)
   */
  private async processDocument(ctx: Context): Promise<FileAttachment | null> {
    try {
      const document = ctx.message?.document;
      if (!document) return null;

      // Check file size
      if (document.file_size && document.file_size > this.maxFileSize) {
        await ctx.reply(`⚠️ File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
        return null;
      }

      console.log(`📄 Processing document: ${document.file_name} (${document.mime_type})`);

      const file = await ctx.api.getFile(document.file_id);
      const filePath = path.join(this.tempDir, `${Date.now()}_${document.file_name}`);

      // Download file
      await this.downloadFile(file.file_path!, filePath);

      // Extract content based on type
      let extractedText = '';

      if (document.mime_type === 'application/pdf') {
        extractedText = await this.extractPDF(filePath);
      } else if (document.mime_type === 'text/csv' || document.file_name?.endsWith('.csv')) {
        extractedText = await this.extractCSV(filePath);
      } else if (document.mime_type?.startsWith('text/')) {
        extractedText = fs.readFileSync(filePath, 'utf8');
      }

      return {
        type: 'document',
        fileId: document.file_id,
        filePath,
        mimeType: document.mime_type,
        fileName: document.file_name,
        fileSize: document.file_size,
      };

    } catch (error: any) {
      console.error('❌ Error processing document:', error);
      await ctx.reply('❌ Error processing document. Please try again.');
      return null;
    }
  }

  /**
   * Process photo attachment
   */
  private async processPhoto(ctx: Context): Promise<FileAttachment | null> {
    try {
      const photos = ctx.message?.photo;
      if (!photos || photos.length === 0) return null;

      // Get highest resolution photo
      const photo = photos[photos.length - 1];

      console.log(`📷 Processing photo: ${photo.file_id}`);

      const file = await ctx.api.getFile(photo.file_id);
      const filePath = path.join(this.tempDir, `${Date.now()}_photo.jpg`);

      // Download file
      await this.downloadFile(file.file_path!, filePath);

      return {
        type: 'image',
        fileId: photo.file_id,
        filePath,
        mimeType: 'image/jpeg',
        fileName: 'photo.jpg',
        fileSize: photo.file_size,
      };

    } catch (error: any) {
      console.error('❌ Error processing photo:', error);
      return null;
    }
  }

  /**
   * Process audio/voice attachment
   */
  private async processAudio(ctx: Context): Promise<FileAttachment | null> {
    try {
      const voice = ctx.message?.voice;
      const audio = ctx.message?.audio;
      const fileData = voice || audio;

      if (!fileData) return null;

      console.log(`🎤 Processing audio: ${fileData.file_id}`);

      const file = await ctx.api.getFile(fileData.file_id);
      const extension = voice ? 'ogg' : (audio?.file_name?.split('.').pop() || 'mp3');
      const filePath = path.join(this.tempDir, `${Date.now()}_audio.${extension}`);

      // Download file
      await this.downloadFile(file.file_path!, filePath);

      // Auto-transcribe if enabled
      let transcription: string | undefined;
      if (process.env.AUDIO_TRANSCRIPTION_ENABLED !== 'false') {
        console.log(`🔊 Auto-transcribing audio with Whisper...`);
        const text = await AudioTool.transcribeFile(filePath);
        if (text) {
          transcription = text;
          console.log(`📝 Transcription: ${text.substring(0, 80)}...`);
        }
      }

      return {
        type: 'audio',
        fileId: fileData.file_id,
        filePath,
        mimeType: fileData.mime_type || 'audio/ogg',
        fileName: audio?.file_name || 'voice.ogg',
        fileSize: fileData.file_size,
        // Store transcription in metadata so AgentController can use it
        ...(transcription ? { metadata: { transcription } } : {}),
      } as FileAttachment & { metadata?: { transcription: string } };

    } catch (error: any) {
      console.error('❌ Error processing audio:', error);
      return null;
    }
  }

  /**
   * Download file from Telegram servers
   */
  private async downloadFile(telegramPath: string, localPath: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    fs.writeFileSync(localPath, Buffer.from(buffer));
  }

  /**
   * Extract text from PDF
   */
  private async extractPDF(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  /**
   * Extract and format CSV
   */
  private async extractCSV(filePath: string): Promise<string> {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
    });

    // Format as markdown table (first 100 rows)
    const rows = parsed.data.slice(0, 100) as any[];
    
    if (rows.length === 0) {
      return 'Empty CSV file';
    }

    const headers = Object.keys(rows[0]);
    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      markdown += '| ' + headers.map(h => row[h] || '').join(' | ') + ' |\n';
    }

    if (parsed.data.length > 100) {
      markdown += `\n... (${parsed.data.length - 100} more rows)`;
    }

    // Append JSON data for import_csv tool
    markdown += '\n\n[CSV_JSON_DATA]\n';
    markdown += JSON.stringify(parsed.data);
    markdown += '\n[/CSV_JSON_DATA]';

    return markdown;
  }

  /**
   * Cleanup temporary files
   */
  public cleanupTempFiles(olderThanMinutes: number = 60): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);

        const ageMinutes = (now - stats.mtimeMs) / 1000 / 60;

        if (ageMinutes > olderThanMinutes) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} temporary files`);
      }

    } catch (error: any) {
      console.error('❌ Error cleaning temp files:', error);
    }
  }
}
