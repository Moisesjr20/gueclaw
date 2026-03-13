/**
 * TelegramFormatter
 *
 * Converte o texto em Markdown gerado pelos LLMs em HTML seguro para o Telegram.
 * Use parse_mode='HTML' em todas as chamadas ctx.reply() após processar o texto com toHtml().
 *
 * Conversões suportadas (em ordem de processamento):
 *   ```lang\ncode\n```  →  <pre><code class="language-lang">…</code></pre>
 *   `inline`            →  <code>inline</code>
 *   [texto](url)        →  <a href="url">texto</a>   (somente http/https/tg)
 *   ||spoiler||         →  <tg-spoiler>spoiler</tg-spoiler>
 *   **negrito**         →  <b>negrito</b>
 *   *itálico*           →  <i>itálico</i>
 *   ~~tachado~~         →  <s>tachado</s>
 *   __sublinhado__      →  <u>sublinhado</u>
 *   _itálico_           →  <i>itálico</i>
 *   > citação           →  <blockquote>citação</blockquote>
 *
 * Segurança: todo texto sem tag é escapado em HTML antes das transformações,
 * e as URLs são validadas para permitir apenas protocolos seguros.
 */
export class TelegramFormatter {
  // Limite máximo de caracteres por mensagem no Telegram
  static readonly MAX_MESSAGE_LENGTH = 4096;
  // Tamanho conservador por chunk para deixar margem para as tags HTML
  static readonly CHUNK_SIZE = 3500;

  // ─── API Pública ───────────────────────────────────────────────────────────

  /**
   * Converte a saída bruta do LLM (Markdown) em HTML para o Telegram.
   * Seguro contra injeção de HTML — o texto bruto é sempre escapado antes de inserir tags.
   */
  public static toHtml(rawText: string): string {
    // Array de slots: fragmentos extraídos são substituídos por tokens \x00{n}\x00
    const slots: string[] = [];
    const protect = (html: string): string => {
      const id = slots.length;
      slots.push(html);
      return `\x00${id}\x00`;
    };

    let text = rawText;

    // Passo 1 — extrair blocos de código (``` … ```) antes de escapar o HTML
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang: string, code: string) => {
      const safeCode = TelegramFormatter.escapeHtml(code.replace(/^\n+|\n+$/g, ''));
      const cls = lang ? ` class="language-${TelegramFormatter.escapeHtml(lang)}"` : '';
      return protect(`<pre><code${cls}>${safeCode}</code></pre>`);
    });

    // Passo 2 — extrair código inline (` … `) antes de escapar o HTML
    text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
      return protect(`<code>${TelegramFormatter.escapeHtml(code)}</code>`);
    });

    // Passo 3 — extrair links Markdown [texto](url) antes de escapar o HTML
    text = text.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_match, linkText: string, url: string) => {
      const safeUrl = TelegramFormatter.sanitizeUrl(url.trim());
      const safeText = TelegramFormatter.escapeHtml(linkText);
      return safeUrl ? protect(`<a href="${safeUrl}">${safeText}</a>`) : safeText;
    });

    // Passo 4 — escapar HTML em todo o texto restante (não protegido)
    text = TelegramFormatter.escapeHtml(text);

    // Passo 5 — spoiler: ||texto|| → <tg-spoiler>
    text = text.replace(/\|\|([^|\n]+(?:\n[^|\n]+)*?)\|\|/g, '<tg-spoiler>$1</tg-spoiler>');

    // Passo 6 — negrito: **texto** → <b>
    text = text.replace(/\*\*([^*\n]+(?:\n[^*\n]+)*?)\*\*/g, '<b>$1</b>');

    // Passo 7 — itálico: *texto* (asterisco simples, sem tocar outro *)
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<i>$1</i>');

    // Passo 8 — tachado: ~~texto~~ → <s>
    text = text.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');

    // Passo 9 — sublinhado: __texto__ → <u>
    text = text.replace(/__([^_\n]+)__/g, '<u>$1</u>');

    // Passo 10 — itálico: _texto_ (underscore simples, sem tocar outro _)
    text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<i>$1</i>');

    // Passo 11 — citações (blockquote): linhas que começam com > (agora &gt; após escape)
    text = text.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>');

    // Passo 12 — restaurar slots protegidos
    text = text.replace(/\x00(\d+)\x00/g, (_match, i: string) => slots[parseInt(i, 10)]);

    return text;
  }

  /**
   * Divide uma string HTML já formatada em chunks que cabem no limite de
   * 4096 caracteres do Telegram, quebrando apenas em parágrafos.
   */
  public static splitHtml(html: string, maxLength: number = TelegramFormatter.CHUNK_SIZE): string[] {
    if (html.length <= maxLength) return [html];

    const chunks: string[] = [];
    const paragraphs = html.split(/\n{2,}/);
    let current = '';

    for (const para of paragraphs) {
      const joiner = current ? '\n\n' : '';

      if (current.length + joiner.length + para.length > maxLength) {
        if (current) {
          chunks.push(current);
          current = '';
        }

        // Parágrafo muito grande — dividir por linhas
        if (para.length > maxLength) {
          for (const line of para.split('\n')) {
            const sep = current ? '\n' : '';
            if (current.length + sep.length + line.length > maxLength) {
              if (current) chunks.push(current);
              current = line;
            } else {
              current += sep + line;
            }
          }
        } else {
          current = para;
        }
      } else {
        current += joiner + para;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  /**
   * Escapa os caracteres especiais HTML em texto simples.
   * Exposto publicamente para que outros módulos (ex: sendAsCode) possam reutilizá-lo.
   */
  public static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Helpers Privados ─────────────────────────────────────────────────────

  /**
   * Retorna a URL somente se usar um protocolo seguro; caso contrário, retorna null.
   * Bloqueia esquemas perigosos como javascript:, data: e vbscript:.
   */
  private static sanitizeUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'tg:'].includes(parsed.protocol)) {
        return parsed.href;
      }
      return null;
    } catch {
      // URLs relativas ou malformadas são descartadas
      return null;
    }
  }
}
