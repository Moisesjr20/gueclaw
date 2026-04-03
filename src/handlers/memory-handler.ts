import { Context } from 'grammy';
import { TelegramInput } from '../types';
import { MemoryManagerService } from '../services/memory-extractor';
import { MemoryType } from '../services/memory-extractor/types';

/**
 * Handler for /memory command
 * Displays extracted memories for the user
 */
export class MemoryHandler {
  private static memoryService = MemoryManagerService.getInstance();

  /**
   * Handle /memory command
   * Syntax:
   *   /memory            - Show all memories
   *   /memory stats      - Show memory statistics
   *   /memory [type]     - Show memories of specific type
   *   /memory clear      - Clear all memories
   */
  public static async handle(ctx: Context, input: TelegramInput): Promise<boolean> {
    if (!input.text?.startsWith('/memory')) return false;

    const userId = input.userId;
    const args = input.text.split(' ').slice(1);
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'stats':
          await this.handleStats(ctx, userId);
          break;

        case 'clear':
          await this.handleClear(ctx, userId);
          break;

        case 'preference':
        case 'decision':
        case 'fact':
        case 'goal':
        case 'skill':
        case 'constraint':
        case 'context':
          await this.handleByType(ctx, userId, command as MemoryType);
          break;

        case undefined:
        case '':
          await this.handleList(ctx, userId);
          break;

        default:
          await ctx.reply(
            `❓ Comando desconhecido: /memory ${command}\n\n` +
            `**Uso:**\n` +
            `/memory - Lista todas as memórias\n` +
            `/memory stats - Mostra estatísticas\n` +
            `/memory [tipo] - Filtra por tipo (preference, decision, fact, goal, skill, constraint, context)\n` +
            `/memory clear - Apaga todas as memórias`
          );
      }

      return true;
    } catch (err) {
      console.error('[MemoryHandler] Error:', err);
      await ctx.reply('❌ Erro ao processar comando /memory');
      return true;
    }
  }

  /**
   * Handle /memory (list all memories)
   */
  private static async handleList(ctx: Context, userId: string): Promise<void> {
    const memories = this.memoryService.getUserMemories(userId, 50);

    if (memories.length === 0) {
      await ctx.reply(
        `💭 **Memórias Extraídas**\n\n` +
        `Nenhuma memória encontrada ainda.\n\n` +
        `As memórias são extraídas automaticamente durante as conversas para melhorar o contexto futuro.`
      );
      return;
    }

    // Group by type
    const grouped: Record<string, typeof memories> = {};
    memories.forEach((m) => {
      if (!grouped[m.type]) {
        grouped[m.type] = [];
      }
      grouped[m.type].push(m);
    });

    // Build response
    const lines: string[] = [`💭 **Memórias Extraídas** (${memories.length} total)\n`];

    Object.entries(grouped).forEach(([type, mems]) => {
      const typeLabel = this.getTypeLabel(type as MemoryType);
      const icon = this.getTypeIcon(type as MemoryType);
      lines.push(`\n${icon} **${typeLabel}** (${mems.length}):`);

      mems.forEach((m, i) => {
        const confidence = Math.round(m.confidence * 100);
        const importance = this.getImportanceIcon(m.importance);
        lines.push(`${i + 1}. ${importance} ${m.content} _(${confidence}%)_`);
      });
    });

    lines.push(`\n_Use /memory stats para ver estatísticas_`);
    lines.push(`_Use /memory clear para apagar memórias_`);

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  }

  /**
   * Handle /memory stats
   */
  private static async handleStats(ctx: Context, userId: string): Promise<void> {
    const stats = this.memoryService.getStats(userId);

    if (stats.totalMemories === 0) {
      await ctx.reply('💭 Nenhuma memória registrada ainda.');
      return;
    }

    const lines: string[] = [
      `📊 **Estatísticas de Memórias**\n`,
      `**Total:** ${stats.totalMemories} memórias`,
      `**Confiança média:** ${Math.round(stats.avgConfidence * 100)}%`,
    ];

    // By type
    lines.push(`\n**Por Tipo:**`);
    Object.entries(stats.byType).forEach(([type, count]) => {
      const icon = this.getTypeIcon(type as MemoryType);
      const label = this.getTypeLabel(type as MemoryType);
      lines.push(`${icon} ${label}: ${count}`);
    });

    // By importance
    lines.push(`\n**Por Importância:**`);
    Object.entries(stats.byImportance).forEach(([importance, count]) => {
      const icon = this.getImportanceIcon(importance as any);
      lines.push(`${icon} ${importance}: ${count}`);
    });

    // Most recent extraction
    if (stats.mostRecentExtraction) {
      const date = new Date(stats.mostRecentExtraction);
      lines.push(`\n**Última extração:** ${date.toLocaleString('pt-BR')}`);
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  }

  /**
   * Handle /memory [type]
   */
  private static async handleByType(
    ctx: Context,
    userId: string,
    type: MemoryType
  ): Promise<void> {
    const memories = this.memoryService.getMemoriesByType(userId, type, 20);

    if (memories.length === 0) {
      await ctx.reply(`💭 Nenhuma memória do tipo "${type}" encontrada.`);
      return;
    }

    const typeLabel = this.getTypeLabel(type);
    const icon = this.getTypeIcon(type);
    const lines: string[] = [
      `${icon} **${typeLabel}** (${memories.length} encontradas)\n`,
    ];

    memories.forEach((m, i) => {
      const confidence = Math.round(m.confidence * 100);
      const importance = this.getImportanceIcon(m.importance);
      lines.push(`${i + 1}. ${importance} ${m.content} _(${confidence}%)_`);
      if (m.context) {
        lines.push(`   _${m.context}_`);
      }
    });

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  }

  /**
   * Handle /memory clear
   */
  private static async handleClear(ctx: Context, userId: string): Promise<void> {
    const stats = this.memoryService.getStats(userId);

    if (stats.totalMemories === 0) {
      await ctx.reply('💭 Não há memórias para apagar.');
      return;
    }

    // Delete all user memories
    this.memoryService.deleteUserMemories(userId);

    await ctx.reply(
      `🗑️ **Memórias Apagadas**\n\n` +
      `${stats.totalMemories} memórias foram removidas permanentemente.`
    );
  }

  /**
   * Get human-readable type label
   */
  private static getTypeLabel(type: MemoryType): string {
    const labels: Record<MemoryType, string> = {
      preference: 'Preferências',
      decision: 'Decisões',
      fact: 'Fatos',
      goal: 'Objetivos',
      skill: 'Habilidades',
      constraint: 'Restrições',
      context: 'Contexto',
    };
    return labels[type] || type;
  }

  /**
   * Get icon for memory type
   */
  private static getTypeIcon(type: MemoryType): string {
    const icons: Record<MemoryType, string> = {
      preference: '❤️',
      decision: '✅',
      fact: '📌',
      goal: '🎯',
      skill: '💪',
      constraint: '⚠️',
      context: '📝',
    };
    return icons[type] || '💭';
  }

  /**
   * Get icon for importance level
   */
  private static getImportanceIcon(importance: string): string {
    const icons: Record<string, string> = {
      low: '○',
      medium: '◐',
      high: '●',
      critical: '🔥',
    };
    return icons[importance] || '○';
  }
}
