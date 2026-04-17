/**
 * Command Executor for Telegram (DVACE Architecture - Phase 1.4)
 * 
 * Integrates CommandRegistry with Telegram bot.
 * Routes commands to appropriate handlers (Local vs Prompt).
 */

import { Context } from 'grammy';
import { TelegramInput } from '../types';
import { CommandContext, CommandResult } from '../types/command-types';
import { TelegramOutputHandler } from './telegram-output-handler';
import { commandRegistry } from '../commands/command-initializer';
import { isLocalCommand, isPromptCommand, isToolCommand } from '../types/command-types';
import { MemoryManager } from '../core/memory/memory-manager';

/**
 * Command Executor - Bridges Telegram with Command System
 */
export class CommandExecutor {
  /**
   * Execute a command from CommandRegistry
   * 
   * @param commandName - Command name (without leading slash)
   * @param args - Command arguments
   * @param ctx - Telegram context
   * @param input - Processed telegram input
   * @param memoryManager - Memory manager instance
   * @returns true if command was handled
   */
  public static async execute(
    commandName: string,
    args: string[],
    ctx: Context,
    input: TelegramInput,
    memoryManager?: MemoryManager
  ): Promise<boolean> {
    // Lookup command in registry
    const command = commandRegistry.get(commandName);
    
    if (!command) {
      // Command not found - return false to fall through to LLM
      return false;
    }
    
    // Build command context
    const commandContext: CommandContext = {
      userId: input.userId,
      conversationId: input.userId, // For now, userId = conversationId
      messageHistory: [], // Will be populated if needed
      metadata: input.metadata || {},
      memoryManager,
      ctx
    };
    
    console.log(`🎯 Executing command: /${commandName} (${command.type})`);
    
    try {
      // Route based on command type
      if (isLocalCommand(command)) {
        return await this.executeLocalCommand(command, args, ctx, commandContext);
        
      } else if (isPromptCommand(command)) {
        return await this.executePromptCommand(command, args, ctx, commandContext);
        
      } else if (isToolCommand(command)) {
        // ToolCommand execution (direct tool invocation)
        console.log(`⚙️  ToolCommand not yet implemented: ${command.name}`);
        await TelegramOutputHandler.sendError(
          ctx,
          `ToolCommand execution not yet implemented. Please use the agent loop instead.`
        );
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      console.error(`❌ Command execution error (/${commandName}):`, error);
      await TelegramOutputHandler.sendError(
        ctx,
        `Error executing command /${commandName}: ${error.message}`
      );
      return true; // Mark as handled even on error
    }
  }
  
  /**
   * Execute LocalCommand (immediate, no LLM)
   */
  private static async executeLocalCommand(
    command: any,
    args: string[],
    ctx: Context,
    context: CommandContext
  ): Promise<boolean> {
    console.log(`⚡ LocalCommand: ${command.name}`);
    
    // Execute the command
    const result: CommandResult = await command.run(args, context);
    
    // Send response
    if (result.success) {
      if (result.message) {
        await ctx.reply(result.message, { parse_mode: 'Markdown' });
      }
      
      // Handle special actions (e.g., reload_skills)
      if (result.metadata?.action === 'reload_skills') {
        // Signal to reload skills (will be handled by caller)
        // For now, just log it
        console.log('🔄 Reload skills requested');
      }
      
    } else {
      // Command failed
      const errorMessage = result.error || result.message || 'Command failed';
      await ctx.reply(errorMessage, { parse_mode: 'Markdown' });
    }
    
    return true;
  }
  
  /**
   * Execute PromptCommand (invokes agent loop with restricted tools)
   */
  private static async executePromptCommand(
    command: any,
    args: string[],
    ctx: Context,
    context: CommandContext
  ): Promise<boolean> {
    console.log(`🧠 PromptCommand: ${command.name}`);
    console.log(`   Allowed tools: ${command.allowedTools.join(', ')}`);
    
    // TODO: Implement agent loop integration in Phase 2
    // For now, show a message
    await ctx.reply(
      `🚧 PromptCommand /${command.name} coming soon!\n\n` +
      `This command will invoke the agent loop with restricted tool permissions:\n` +
      `• ${command.allowedTools.join('\n• ')}\n\n` +
      `Phase 2 will implement the query loop integration.`,
      { parse_mode: 'Markdown' }
    );
    
    return true;
  }
}
