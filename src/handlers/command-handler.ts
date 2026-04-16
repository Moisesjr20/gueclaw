import { Context } from 'grammy';
import { TelegramInput } from '../types';
import { TelegramOutputHandler } from './telegram-output-handler';
import { MemoryManager } from '../core/memory/memory-manager';
import { Heartbeat } from '../services/heartbeat';
import { TelegramNotifier } from '../services/telegram-notifier';
import { CostHandler } from './cost-handler';
import { MCPCommandHandler } from './mcp-handler';
import { MemoryHandler } from './memory-handler';
import { CommandExecutor } from './command-executor'; // DVACE - Phase 1.4

const VERSION = process.env.npm_package_version || '2.3.0';
const START_TIME = Date.now();

// Lazy singleton Heartbeat (only created when first needed)
let heartbeatInstance: Heartbeat | null = null;
function getHeartbeat(): Heartbeat {
  if (!heartbeatInstance) {
    const notifier = new TelegramNotifier(
      process.env.TELEGRAM_BOT_TOKEN!,
      process.env.TELEGRAM_ALLOWED_USER_IDS!
    );
    heartbeatInstance = new Heartbeat(notifier);
  }
  return heartbeatInstance;
}

/**
 * CommandHandler — processes slash commands (/limpar, /status, /ajuda).
 * Returns true if the command was handled, false if it should fall through to the LLM.
 * 
 * DVACE Phase 1.4: Now integrates with CommandRegistry for structured commands.
 */
export class CommandHandler {
  public static async handle(
    ctx: Context,
    input: TelegramInput,
    memoryManager: MemoryManager
  ): Promise<boolean> {
    const text = input.text?.trim() || '';
    const parts = text.split(/\s+/);
    const rawCmd = parts[0];
    const cmd = rawCmd.toLowerCase();
    const args = parts.slice(1); // Command arguments

    console.log(`⌨️  Command received: ${cmd} from user ${input.userId}`);

    // PHASE 1.4: Try CommandRegistry first (new DVACE architecture)
    const commandName = cmd.replace(/^\//, ''); // Remove leading slash
    const handled = await CommandExecutor.execute(commandName, args, ctx, input, memoryManager);
    
    if (handled) {
      console.log(`✅ Command ${cmd} handled by CommandRegistry`);
      return true;
    }
    
    // Fallback to legacy command handlers (will be gradually migrated)
    console.log(`⚠️  Command ${cmd} not in CommandRegistry, trying legacy handlers`);

    switch (cmd) {
      case '/limpar':
        return this.handleClear(ctx, input, memoryManager);

      case '/status':
        return this.handleStatus(ctx, input, memoryManager);

      case '/ajuda':
      case '/help':
        return this.handleHelp(ctx);

      case '/monitorar':
        return this.handleMonitorar(ctx, text);

      case '/cost':
      case '/custo':
        await CostHandler.handle(ctx, input.userId, text);
        return true;

      case '/mcp':
        await MCPCommandHandler.handle(ctx);
        return true;

      case '/memory':
      case '/memoria':
        await MemoryHandler.handle(ctx, input);
        return true;

      default:
        // Unknown command — let the LLM handle it naturally
        console.log(`ℹ️  Unknown command ${cmd}, falling through to LLM`);
        return false;
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  private static async handleClear(
    ctx: Context,
    input: TelegramInput,
    memoryManager: MemoryManager
  ): Promise<boolean> {
    const conversation = memoryManager.getConversation(input.userId);
    const messagesBefore = memoryManager.getAllMessages(conversation.id).length;

    memoryManager.clearConversation(conversation.id);

    await TelegramOutputHandler.sendSuccess(
      ctx,
      `Histórico limpo! ${messagesBefore} mensagem(ns) removida(s).\nVocê começa uma conversa nova agora.`
    );
    return true;
  }

  private static async handleStatus(
    ctx: Context,
    input: TelegramInput,
    memoryManager: MemoryManager
  ): Promise<boolean> {
    const conversation = memoryManager.getConversation(input.userId);
    const messages = memoryManager.getAllMessages(conversation.id);
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
    const uptimeFormatted = this.formatUptime(uptimeSeconds);

    const provider = process.env.DEFAULT_PROVIDER || process.env.LLM_PROVIDER || 'github-copilot';
    const windowSize = process.env.MEMORY_WINDOW_SIZE || '10';

    const statusText = [
      `⚙️ <b>Status do GueClaw</b>`,
      ``,
      `🤖 Provider: <code>${provider}</code>`,
      `💬 Mensagens no histórico: <code>${messages.length}</code>`,
      `🪟 Janela de memória: <code>${windowSize} msgs</code>`,
      `⏱️ Uptime: <code>${uptimeFormatted}</code>`,
      `📦 Versão: <code>${VERSION}</code>`,
    ].join('\n');

    try {
      await ctx.reply(statusText, { parse_mode: 'HTML' });
    } catch {
      await TelegramOutputHandler.sendInfo(ctx, statusText.replace(/<[^>]+>/g, ''));
    }
    return true;
  }

  private static async handleHelp(ctx: Context): Promise<boolean> {
    const helpText = [
      `🤖 <b>Comandos disponíveis</b>`,
      ``,
      `/limpar — Apaga o histórico desta conversa`,
      `/status — Mostra provider, memória e uptime`,
      `/cost — Mostra custos de uso do LLM`,
      `/mcp — Gerencia integração MCP (115+ tools)`,
      `/monitorar add &lt;tipo&gt; &lt;alvo&gt; [label] — Adiciona monitor`,
      `/monitorar remove &lt;id&gt; — Remove monitor`,
      `/monitorar list — Lista monitores ativos`,
      `/monitorar check — Roda checks agora`,
      `/ajuda  — Esta mensagem`,
      ``,
      `Tipos de monitor: docker | systemd | http | process`,
      ``,
      `Para tudo mais, é só mandar mensagem normalmente.`,
    ].join('\n');

    try {
      await ctx.reply(helpText, { parse_mode: 'HTML' });
    } catch {
      await TelegramOutputHandler.sendInfo(ctx, helpText.replace(/<[^>]+>/g, ''));
    }
    return true;
  }

  private static async handleMonitorar(ctx: Context, rawText: string): Promise<boolean> {
    const parts = rawText.trim().split(/\s+/);
    // parts[0] = '/monitorar', parts[1] = subcommand
    const sub = (parts[1] || 'list').toLowerCase();
    const hb = getHeartbeat();

    if (sub === 'list') {
      const monitors = hb.loadMonitors();
      if (monitors.length === 0) {
        await TelegramOutputHandler.sendInfo(ctx, 'Nenhum monitor configurado. Use /monitorar add <tipo> <alvo> [label]');
        return true;
      }
      const lines = monitors.map(m =>
        `• <b>${m.label}</b> — <code>${m.type}:${m.target}</code> (id: <code>${m.id}</code>)`
      );
      const msg = [`💓 <b>Monitores ativos (${monitors.length})</b>`, '', ...lines].join('\n');
      try {
        await ctx.reply(msg, { parse_mode: 'HTML' });
      } catch {
        await TelegramOutputHandler.sendInfo(ctx, monitors.map(m => `${m.label}: ${m.type}:${m.target}`).join('\n'));
      }
      return true;
    }

    if (sub === 'add') {
      // /monitorar add <type> <target> [label words...]
      const type = parts[2] as 'docker' | 'systemd' | 'http' | 'process' | undefined;
      const target = parts[3];
      const label = parts.slice(4).join(' ') || target;

      if (!type || !target) {
        await TelegramOutputHandler.sendInfo(
          ctx,
          'Uso: /monitorar add <tipo> <alvo> [label]\nTipos: docker | systemd | http | process\nEx: /monitorar add docker nginx Nginx Container'
        );
        return true;
      }

      const validTypes = ['docker', 'systemd', 'http', 'process'];
      if (!validTypes.includes(type)) {
        await TelegramOutputHandler.sendError(ctx, `Tipo inválido: "${type}". Use: ${validTypes.join(', ')}`);
        return true;
      }

      const id = `${type}-${target}`.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
      hb.addMonitor({ id, type, target, label });
      await TelegramOutputHandler.sendSuccess(ctx, `Monitor adicionado: <b>${label}</b> (${type}:${target})\nID: <code>${id}</code>`);
      return true;
    }

    if (sub === 'remove') {
      const id = parts[2];
      if (!id) {
        await TelegramOutputHandler.sendInfo(ctx, 'Uso: /monitorar remove <id>\nVeja IDs com /monitorar list');
        return true;
      }
      const ok = hb.removeMonitor(id);
      if (ok) {
        await TelegramOutputHandler.sendSuccess(ctx, `Monitor <code>${id}</code> removido.`);
      } else {
        await TelegramOutputHandler.sendError(ctx, `Monitor "<code>${id}</code>" não encontrado.`);
      }
      return true;
    }

    if (sub === 'check') {
      await TelegramOutputHandler.sendInfo(ctx, '🔍 Executando checks agora...');
      await hb.runChecks();
      await TelegramOutputHandler.sendSuccess(ctx, 'Checks concluídos. Se tudo OK, nenhum alerta foi enviado.');
      return true;
    }

    await TelegramOutputHandler.sendInfo(
      ctx,
      'Subcomandos: list | add | remove | check\nEx: /monitorar list'
    );
    return true;
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  private static formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
}
