import { Context } from 'grammy';
import * as fs from 'fs';

export class TelegramOutputHandler {
  
  /**
   * Envia uma resposta final pro chat
   */
  public async sendResponse(ctx: Context, responseText: string) {
    
    try {
      // Chunking para mensagens muito grandes do Telegram (>4096 chars)
      const MAX_LENGTH = 4000;
      
      if (responseText.length <= MAX_LENGTH) {
        await ctx.reply(responseText, { parse_mode: 'Markdown' });
      } else {
        // Envia em pedaços (chunks)
        const chunks = this.chunkString(responseText, MAX_LENGTH);
        for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: 'Markdown' });
            // Rate limit sleep pequeno
            await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
       console.error('[OutputHandler] Erro ao enviar. Limpando formatação e reenviando texto puro:', error);
       // Fallback sem markdown caso tenha tido sintaxe MD quebrada
       await ctx.reply(responseText);
    }
  }

  /**
   * Fragmenta uma string baseada em tamanho seguro
   */
  private chunkString(str: string, size: number): string[] {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      chunks[i] = str.substr(o, size);
    }
    return chunks;
  }
}
