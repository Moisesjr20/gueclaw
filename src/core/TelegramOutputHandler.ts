import { Context } from 'grammy';

const MAX_CHUNK = 4000; // Telegram limita 4096, usamos 4000 com margem

export class TelegramOutputHandler {

  /**
   * Envia uma resposta final pro chat, dividindo em chunks se necessário.
   */
  public async sendResponse(ctx: Context, responseText: string) {
    if (!responseText || responseText.trim() === '') {
      await ctx.reply('(sem resposta)');
      return;
    }

    const chunks = this.chunkString(responseText, MAX_CHUNK);

    for (const chunk of chunks) {
      await this.sendChunk(ctx, chunk);
      if (chunks.length > 1) {
        // Pequena pausa entre chunks para respeitar rate limit do Telegram
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  /**
   * Envia um único chunk: tenta Markdown primeiro, fallback para texto puro.
   */
  private async sendChunk(ctx: Context, text: string) {
    try {
      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch {
      // Markdown quebrado (ex: ``` não fechado) — envia como texto puro
      try {
        await ctx.reply(text);
      } catch (err: any) {
        console.error('[OutputHandler] Falha ao enviar chunk:', err.message);
        // Último recurso: envia aviso de erro
        await ctx.reply(`⚠️ Resposta gerada mas erro ao enviar: ${err.message}`).catch(() => {});
      }
    }
  }

  /**
   * Divide o texto em blocos de `size` caracteres respeitando quebras de linha.
   */
  private chunkString(text: string, size: number): string[] {
    if (text.length <= size) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= size) {
        chunks.push(remaining);
        break;
      }

      // Tenta cortar na última quebra de linha dentro do limite
      let cutAt = remaining.lastIndexOf('\n', size);
      if (cutAt <= 0) cutAt = size; // Sem quebra de linha? Corta no limite

      chunks.push(remaining.substring(0, cutAt));
      remaining = remaining.substring(cutAt).trimStart();
    }

    return chunks;
  }
}
