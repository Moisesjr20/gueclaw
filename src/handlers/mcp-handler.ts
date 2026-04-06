/**
 * MCP Command Handler
 * Telegram commands for interacting with MCP servers
 * 
 * Commands:
 *   /mcp - Show MCP status and available servers
 *   /mcp list - List all available MCP tools
 *   /mcp <server> - Show tools for a specific server
 * 
 * Phase 2.5 - MCP Integration
 */

import { Context } from 'grammy';
import { MCPManager } from '../tools/mcp-manager';

export class MCPCommandHandler {
  /**
   * Handle /mcp command
   */
  public static async handle(ctx: Context): Promise<void> {
    try {
      const message = ctx.message?.text || '';
      const parts = message.split(/\s+/).slice(1); // Remove /mcp

      if (parts.length === 0) {
        await this.showStatus(ctx);
      } else if (parts[0] === 'list') {
        await this.listAllTools(ctx);
      } else {
        await this.showServerTools(ctx, parts[0]);
      }
    } catch (error) {
      console.error('MCP command error:', error);
      await ctx.reply('❌ Erro ao processar comando MCP');
    }
  }

  /**
   * Show MCP status
   */
  private static async showStatus(ctx: Context): Promise<void> {
    const manager = MCPManager.getInstance();
    const tools = manager.getTools();

    // Group tools by server
    const serverTools: Record<string, number> = {};
    for (const tool of tools) {
      serverTools[tool.serverName] = (serverTools[tool.serverName] || 0) + 1;
    }

    let response = '🔧 **MCP Integration Status**\n\n';
    response += `**Total Tools:** ${tools.length}\n\n`;
    response += '**Servers:**\n';

    for (const [server, count] of Object.entries(serverTools)) {
      response += `✅ **${server}**: ${count} tools\n`;
    }

    response += '\n**Commands:**\n';
    response += '• `/mcp list` - List all tools\n';
    response += '• `/mcp <server>` - Show server tools\n';
    response += '\n**Examples:**\n';
    response += '• `/mcp github` - GitHub tools\n';
    response += '• `/mcp n8n` - n8n tools\n';
    response += '• `/mcp filesystem` - Filesystem tools\n';

    await ctx.reply(response, { parse_mode: 'Markdown' });
  }

  /**
   * List all MCP tools
   */
  private static async listAllTools(ctx: Context): Promise<void> {
    const manager = MCPManager.getInstance();
    const tools = manager.getTools();

    if (tools.length === 0) {
      await ctx.reply('Nenhuma tool MCP disponível');
      return;
    }

    // Group by server
    const byServer: Record<string, Array<{ name: string; description: string }>> = {};

    for (const tool of tools) {
      if (!byServer[tool.serverName]) {
        byServer[tool.serverName] = [];
      }

      // Extract tool name (remove serverName__ prefix)
      const sep = tool.name.indexOf('__');
      const shortName = sep > -1 ? tool.name.slice(sep + 2) : tool.name;

      byServer[tool.serverName].push({
        name: shortName,
        description: tool.description,
      });
    }

    let response = '🔧 **All MCP Tools**\n\n';

    for (const [server, serverTools] of Object.entries(byServer)) {
      response += `**${server}** (${serverTools.length} tools):\n`;

      for (const tool of serverTools.slice(0, 10)) {
        response += `• \`${tool.name}\``;
        if (tool.description) {
          response += ` - ${tool.description.slice(0, 50)}`;
          if (tool.description.length > 50) response += '...';
        }
        response += '\n';
      }

      if (serverTools.length > 10) {
        response += `• ... and ${serverTools.length - 10} more\n`;
      }

      response += '\n';
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  }

  /**
   * Show tools for a specific server
   */
  private static async showServerTools(ctx: Context, serverName: string): Promise<void> {
    const manager = MCPManager.getInstance();
    const tools = manager.getTools();

    const serverTools = tools.filter(t => t.serverName === serverName);

    if (serverTools.length === 0) {
      await ctx.reply(`Servidor MCP "${serverName}" não encontrado ou sem tools disponíveis`);
      return;
    }

    let response = `🔧 **${serverName} MCP Tools** (${serverTools.length} tools)\n\n`;

    for (const tool of serverTools) {
      // Extract tool name (remove serverName__ prefix)
      const sep = tool.name.indexOf('__');
      const shortName = sep > -1 ? tool.name.slice(sep + 2) : tool.name;

      // Escape underscores for Telegram Markdown (fix bug B12)
      const escapedName = shortName.replace(/_/g, '\\_');
      response += `**${escapedName}**\n`;

      if (tool.description) {
        response += `${tool.description}\n`;
      }

      // Show input schema
      const schema = tool.inputSchema;
      if (schema?.properties) {
        const props = Object.keys(schema.properties);
        if (props.length > 0) {
          response += `Args: \`${props.join('`, `')}\`\n`;
        }
      }

      response += '\n';
    }

    response += `\n**Usage via LLM:** Tools are automatically available to the AI agent.\n`;
    response += `The agent will use them when needed based on your requests.`;

    await ctx.reply(response, { parse_mode: 'Markdown' });
  }
}

