/**
 * Telegram Commands (DVACE Architecture - Phase 1.3)
 * 
 * Migrated commands from traditional bot.command() to structured Command System.
 * - LocalCommands: Execute immediately without LLM
 * - PromptCommands: Invoke agent loop with restricted tools
 */

import {
  LocalCommand,
  PromptCommand,
  CommandContext,
  CommandResult
} from '../types/command-types';
import { TaskTracker } from '../core/task-tracker';
import { costTracker } from '../services/cost-tracker';
import { getContextLoader } from '../core/context';

/**
 * /start - Welcome message
 */
export const startCommand: LocalCommand = {
  type: 'local',
  name: 'start',
  description: 'Welcome message with agent capabilities',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const message =
      `🤖 **Welcome to GueClaw Agent!**\n\n` +
      `I'm your personal AI assistant with full control over this VPS.\n\n` +
      `**Capabilities:**\n` +
      `• Execute shell commands\n` +
      `• Manage Docker containers\n` +
      `• File operations\n` +
      `• HTTP API requests\n` +
      `• Process PDFs, CSVs, images\n` +
      `• Create and manage skills\n\n` +
      `**Commands:**\n` +
      `/stats - Show agent statistics\n` +
      `/reload - Reload skills\n` +
      `/cost - Show LLM usage and costs\n` +
      `/tasks - List active tasks\n` +
      `/help - Show this message\n\n` +
      `Just send me a message and I'll help you!`;

    return {
      success: true,
      message
    };
  }
};

/**
 * /help - Show available commands
 */
export const helpCommand: LocalCommand = {
  type: 'local',
  name: 'help',
  description: 'Show help and available commands',
  aliases: ['h', '?'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const message =
      `📚 **GueClaw Agent Help**\n\n` +
      `**Control Commands:**\n` +
      `• \`/start\` - Welcome message\n` +
      `• \`/help\` - Show this help\n` +
      `• \`/retry\` - Retry last message with new response\n` +
      `• \`/undo\` - Delete last interaction\n\n` +
      `**Information Commands:**\n` +
      `• \`/stats\` - Show agent statistics\n` +
      `• \`/cost [period]\` - Show LLM usage costs\n` +
      `• \`/insights [days]\` - Show conversation insights\n` +
      `• \`/tasks\` - List active tasks\n` +
      `• \`/task <id>\` - Show task details\n\n` +
      `**Management Commands:**\n` +
      `• \`/reload\` - Reload skills (hot-reload)\n` +
      `• \`/context [show|create|reload]\` - Manage user context\n` +
      `• \`/compress\` - Force compress history\n` +
      `• \`/personality [name]\` - Change communication style\n\n` +
      `**Supported File Types:**\n` +
      `• PDF documents, CSV files, Text files\n` +
      `• Images, Audio/voice messages\n\n` +
      `**Examples:**\n` +
      `• "List all Docker containers"\n` +
      `• "Create a new skill for database management"\n` +
      `• "Execute: df -h"\n` +
      `• "Make a GET request to https://api.github.com"\n\n` +
      `Send any message or file and I'll process it!`;

    return {
      success: true,
      message
    };
  }
};

/**
 * /version - Show agent version
 */
export const versionCommand: LocalCommand = {
  type: 'local',
  name: 'version',
  description: 'Show GueClaw Agent version',
  aliases: ['v'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const packageJson = require('../../package.json');
    const version = packageJson.version || '2.0.0';

    const message =
      `🤖 **GueClaw Agent**\n\n` +
      `Version: \`${version}\`\n` +
      `Architecture: DVACE (Directives, Orchestration, Execution)\n` +
      `Node.js: \`${process.version}\`\n` +
      `Platform: \`${process.platform}\``;

    return {
      success: true,
      message,
      data: { version }
    };
  }
};

/**
 * /status - Show system status
 */
export const statusCommand: LocalCommand = {
  type: 'local',
  name: 'status',
  description: 'Show agent health and system status',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);

    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    const message =
      `💚 **Agent Status: Online**\n\n` +
      `⏱️ **Uptime:** ${uptimeHours}h ${uptimeMinutes}m\n` +
      `🧠 **Memory:** ${heapUsedMB}MB / ${heapTotalMB}MB\n` +
      `📊 **CPU:** ${process.cpuUsage().user}μs\n\n` +
      `All systems operational.`;

    return {
      success: true,
      message,
      data: {
        uptime,
        memory: memUsage,
        cpu: process.cpuUsage()
      }
    };
  }
};

/**
 * /tasks - List active tasks
 */
export const tasksCommand: LocalCommand = {
  type: 'local',
  name: 'tasks',
  description: 'List all active tasks',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const tracker = TaskTracker.getInstance();
    const tasks = tracker.getPendingTasks();
    const message = tracker.formatTaskList(tasks);

    return {
      success: true,
      message,
      data: { tasks }
    };
  }
};

/**
 * /task <id> - Show task details
 */
export const taskCommand: LocalCommand = {
  type: 'local',
  name: 'task',
  description: 'Show details of a specific task',
  usage: '/task <task_id>',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        error: '❌ Use: /task <ID>\n\nExemplo: /task task_1234567890_abc123'
      };
    }

    const taskId = args[0];
    const tracker = TaskTracker.getInstance();
    const task = tracker.getTask(taskId);

    if (!task) {
      return {
        success: false,
        error: `❌ Task "${taskId}" not found.`
      };
    }

    const message = tracker.getTaskSummary(taskId);

    return {
      success: true,
      message,
      data: { task }
    };
  }
};

/**
 * /clear - Clear conversation history
 */
export const clearCommand: LocalCommand = {
  type: 'local',
  name: 'clear',
  description: 'Clear conversation history',
  aliases: ['reset'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    // Note: actual clearing logic will be implemented in the handler
    // This command just returns a confirmation message
    return {
      success: true,
      message: '🗑️ Conversation history cleared!'
    };
  }
};

/**
 * /cost [period] - Show LLM usage costs
 */
export const costCommand: LocalCommand = {
  type: 'local',
  name: 'cost',
  description: 'Show LLM usage and costs',
  usage: '/cost [today|week|month]',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const userId = context.userId;
    const period = args[0] || 'today';

    let summary;
    let periodLabel: string;

    switch (period.toLowerCase()) {
      case 'week':
      case 'semana':
        summary = costTracker.getWeekCosts(userId);
        periodLabel = 'Últimos 7 dias';
        break;
      case 'month':
      case 'mes':
      case 'mês':
        summary = costTracker.getMonthCosts(userId);
        periodLabel = 'Este mês';
        break;
      case 'today':
      case 'hoje':
      default:
        summary = costTracker.getTodayCosts(userId);
        periodLabel = 'Hoje';
        break;
    }

    const message = costTracker.formatSummaryForTelegram(summary, periodLabel);

    return {
      success: true,
      message,
      data: { summary, period: periodLabel }
    };
  }
};

/**
 * /stats - Show agent statistics
 */
export const statsCommand: LocalCommand = {
  type: 'local',
  name: 'stats',
  description: 'Show agent statistics and loaded skills',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    // Note: stats will be injected via metadata when this command is executed
    const stats = context.metadata?.agentStats;

    if (!stats) {
      return {
        success: false,
        error: '❌ Stats not available'
      };
    }

    const skillsList = stats.skills.length > 0
      ? stats.skills.map((s: any) => `• **${s.name}**: ${s.description}`).join('\n')
      : '• No skills loaded';

    const message =
      `📊 **Agent Statistics**\n\n` +
      `**Skills Loaded:** ${stats.skillsLoaded}\n\n` +
      `${skillsList}`;

    return {
      success: true,
      message,
      data: { stats }
    };
  }
};

/**
 * /reload - Reload skills
 */
export const reloadCommand: LocalCommand = {
  type: 'local',
  name: 'reload',
  description: 'Reload all skills (hot-reload)',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    // Note: actual reload logic will be handled by the bot
    // This command signals the need to reload
    return {
      success: true,
      message: '🔄 Reloading skills...',
      metadata: { action: 'reload_skills' }
    };
  }
};

/**
 * /review - AI code review with git integration
 */
export const reviewCommand: PromptCommand = {
  type: 'prompt',
  name: 'review',
  description: 'AI code review with git integration',
  allowedTools: [
    'Bash(git *)',      // Only git commands
    'FileRead(*)',      // Read any file
    'FileEdit(*)',      // Edit any file
    'ListDirectory(*)', // List directories
    'GrepTool(*)'       // Search in files
  ],
  getPrompt: async (args: string[], context: CommandContext): Promise<string> => {
    return 'Review the staged changes in git (git diff --staged). ' +
           'Analyze code quality, suggest improvements, check for bugs, ' +
           'and verify best practices. Provide a detailed review.';
  },
  beforeExecution: async (args: string[], context: CommandContext): Promise<void> => {
    // Optional: check if git repo exists
    // This will be implemented in the integration phase
  }
};

/**
 * /commit - Commit changes with AI-generated message
 */
export const commitCommand: PromptCommand = {
  type: 'prompt',
  name: 'commit',
  description: 'Commit changes with AI-generated message',
  allowedTools: [
    'Bash(git commit *)',
    'Bash(git push *)',
    'Bash(git status)',
    'Bash(git diff *)',
    'FileRead(*)'
  ],
  getPrompt: async (args: string[], context: CommandContext): Promise<string> => {
    const customMessage = args.join(' ');
    
    if (customMessage) {
      return `Review the changes (git diff --staged) and commit with this message: "${customMessage}"`;
    }
    
    return 'Review the staged changes (git diff --staged), generate a semantic commit message ' +
           'following conventional commits format (feat:, fix:, docs:, etc), and commit the changes.';
  }
};

/**
 * /deploy - Deploy to VPS with Docker
 */
export const deployCommand: PromptCommand = {
  type: 'prompt',
  name: 'deploy',
  description: 'Deploy application to VPS',
  allowedTools: [
    'SSHExec(*)',
    'DockerCommand(*)',
    'Bash(git pull)',
    'Bash(git fetch)',
    'FileRead(*)'
  ],
  getPrompt: async (args: string[], context: CommandContext): Promise<string> => {
    return 'Deploy the application to VPS. Steps:\n' +
           '1. Pull latest changes from git\n' +
           '2. Rebuild Docker images if needed\n' +
           '3. Restart containers\n' +
           '4. Verify deployment health\n\n' +
           'Report any errors or warnings.';
  },
  maxIterations: 20 // Deploy may need more iterations
};

/**
 * /context - Manage user context files
 */
export const contextCommand: LocalCommand = {
  type: 'local',
  name: 'context',
  description: 'Manage user context from .gueclaw/ directory',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const subcommand = args[0]?.toLowerCase() || 'show';
    const loader = getContextLoader();

    switch (subcommand) {
      case 'show': {
        // Show current context
        const info = loader.getContextInfo();
        
        if (info.files.length === 0) {
          return {
            success: true,
            message: '📄 **Context Files**\n\nNo context files found in .gueclaw/\n\nUse `/context create` to create a template.'
          };
        }

        const filesList = info.files
          .map(f => `  • ${f.path} (${f.size} chars, priority ${f.priority})`)
          .join('\n');

        const message = 
          `📄 **Context Files**\n\n` +
          `**Loaded Files:**\n${filesList}\n\n` +
          `**Total Size:** ${info.totalSize} characters\n\n` +
          `These files are automatically injected into every conversation.\n` +
          `Edit them in .gueclaw/ directory to update your context.`;

        return { success: true, message };
      }

      case 'create': {
        // Create template context file
        try {
          loader.ensureDefaultContext();
          return {
            success: true,
            message: 
              `✅ **Context Template Created**\n\n` +
              `Created default context.md in .gueclaw/\n\n` +
              `Edit this file to add your personal context:\n` +
              `• Who you are\n` +
              `• Your preferences\n` +
              `• Active projects\n` +
              `• VPS information\n` +
              `• Communication style\n\n` +
              `The context will be loaded automatically in the next conversation.`
          };
        } catch (error) {
          return {
            success: false,
            message: `❌ Failed to create context template: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }

      case 'reload': {
        // Force reload context (clear cache)
        loader.clearCache();
        const info = loader.getContextInfo();
        
        return {
          success: true,
          message: 
            `🔄 **Context Reloaded**\n\n` +
            `Loaded ${info.files.length} file(s), ${info.totalSize} characters.\n\n` +
            `The new context will be used in the next message.`
        };
      }

      default: {
        return {
          success: false,
          message: 
            `❌ **Unknown subcommand:** \`${subcommand}\`\n\n` +
            `**Available subcommands:**\n` +
            `/context show - Show current context files\n` +
            `/context create - Create template context file\n` +
            `/context reload - Force reload context cache`
        };
      }
    }
  }
};

/**
 * /retry - Retry last user message (delete last response and re-process)
 */
export const retryCommand: LocalCommand = {
  type: 'local',
  name: 'retry',
  description: 'Retry last user message with a new response',
  aliases: ['tentar-novamente'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const { memoryManager, ctx, conversationId } = context;

    if (!memoryManager || !ctx) {
      return {
        success: false,
        message: '❌ Memory manager not available'
      };
    }

    try {
      // Get all messages
      const allMessages = memoryManager.getAllMessages(conversationId);
      
      if (allMessages.length < 2) {
        return {
          success: false,
          message: '❌ Not enough messages to retry. Send a message first!'
        };
      }

      // Find last user message and last assistant message
      let lastUserMsg: any = null;
      let lastAssistantMsg: any = null;

      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === 'user' && !lastUserMsg) {
          lastUserMsg = msg;
        }
        if (msg.role === 'assistant' && !lastAssistantMsg) {
          lastAssistantMsg = msg;
        }
        if (lastUserMsg && lastAssistantMsg) break;
      }

      if (!lastUserMsg || !lastAssistantMsg) {
        return {
          success: false,
          message: '❌ Could not find last user/assistant message pair'
        };
      }

      // Delete last assistant message (and any subsequent tool messages)
      const messagesToDelete: string[] = [];
      let foundAssistant = false;
      
      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        if (msg.role === 'assistant' && !foundAssistant) {
          if (msg.id) messagesToDelete.push(msg.id);
          foundAssistant = true;
        } else if (foundAssistant && msg.role === 'tool') {
          if (msg.id) messagesToDelete.push(msg.id);
        } else if (foundAssistant && msg.role !== 'tool') {
          break;
        }
      }

      memoryManager.deleteMessages(messagesToDelete);

      // Notify and trigger re-processing
      return {
        success: true,
        message: `🔄 **Retrying...**\n\nDeleted last response. Processing your message again:\n\n"${lastUserMsg.content.substring(0, 100)}${lastUserMsg.content.length > 100 ? '...' : ''}"\n\n_Note: The agent will re-process automatically._`,
        metadata: { retry: true, originalMessage: lastUserMsg.content }
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to retry: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * /undo - Delete last complete turn (user message + assistant response + tools)
 */
export const undoCommand: LocalCommand = {
  type: 'local',
  name: 'undo',
  description: 'Delete last complete interaction (user + assistant)',
  aliases: ['desfazer'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const { memoryManager, conversationId } = context;

    if (!memoryManager) {
      return {
        success: false,
        message: '❌ Memory manager not available'
      };
    }

    try {
      const allMessages = memoryManager.getAllMessages(conversationId);
      
      if (allMessages.length === 0) {
        return {
          success: false,
          message: '❌ No messages to undo'
        };
      }

      // Find last turn (user + assistant + tools)
      const messagesToDelete: string[] = [];
      let deletedTurn = false;

      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];
        
        // Delete assistant and tool messages
        if (msg.role === 'assistant' || msg.role === 'tool') {
          if (msg.id) messagesToDelete.push(msg.id);
        }
        // When we hit a user message, delete it and stop
        else if (msg.role === 'user') {
          if (msg.id) messagesToDelete.push(msg.id);
          deletedTurn = true;
          break;
        }
      }

      if (!deletedTurn || messagesToDelete.length === 0) {
        return {
          success: false,
          message: '❌ Could not find complete turn to undo'
        };
      }

      memoryManager.deleteMessages(messagesToDelete);

      return {
        success: true,
        message: `✅ **Undone!**\n\nDeleted ${messagesToDelete.length} message(s) from last turn.\n\nYou can continue the conversation from the previous state.`
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to undo: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * /compress - Force compress conversation history
 */
export const compressCommand: LocalCommand = {
  type: 'local',
  name: 'compress',
  description: 'Force compress conversation history',
  aliases: ['compactar'],
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const { memoryManager, conversationId } = context;

    if (!memoryManager) {
      return {
        success: false,
        message: '❌ Memory manager not available'
      };
    }

    try {
      const messagesBefore = memoryManager.getAllMessages(conversationId).length;

      if (messagesBefore < 10) {
        return {
          success: false,
          message: `❌ Not enough messages to compress (need 10+, have ${messagesBefore})`
        };
      }

      // Import ContextCompressor
      const { ContextCompressor } = await import('../services/context-compressor/context-compressor');
      const compressor = new ContextCompressor();

      // Get all messages
      const allMessages = memoryManager.getAllMessages(conversationId);

      // Perform compression
      const compressed = await compressor.compressIfNeeded(allMessages);
      const result = compressed.result;

      if (!result.compressed) {
        return {
          success: false,
          message: '⚠️ Compression not needed or failed'
        };
      }

      return {
        success: true,
        message: 
          `✅ **Compression Complete!**\n\n` +
          `📊 **Stats:**\n` +
          `• Before: ${result.originalCount} messages\n` +
          `• After: ${result.newCount} messages\n` +
          `• Reduction: ${result.messagesCompressed} messages\n` +
          `• Tokens saved: ~${result.tokensSaved}\n\n` +
          `_Note: This creates a summary. DB update not implemented yet._`
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to compress: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * /insights - Show conversation insights and statistics
 */
export const insightsCommand: LocalCommand = {
  type: 'local',
  name: 'insights',
  description: 'Show conversation insights and usage statistics',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const { memoryManager, conversationId, userId } = context;

    if (!memoryManager) {
      return {
        success: false,
        message: '❌ Memory manager not available'
      };
    }

    try {
      // Get period (default: 7 days)
      const period = parseInt(args[0]) || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - period);

      // Get all messages
      const allMessages = memoryManager.getAllMessages(conversationId);
      
      // Filter by period
      const recentMessages = allMessages.filter(msg => {
        if (!msg.timestamp) return false;
        return new Date(msg.timestamp) >= cutoffDate;
      });

      // Count by role
      const userCount = recentMessages.filter(m => m.role === 'user').length;
      const assistantCount = recentMessages.filter(m => m.role === 'assistant').length;
      const toolCount = recentMessages.filter(m => m.role === 'tool').length;

      // Get tool usage stats
      const toolUsage: Record<string, number> = {};
      recentMessages
        .filter(m => m.role === 'tool' && m.metadata?.toolName)
        .forEach(m => {
          const toolName = m.metadata?.toolName || 'unknown';
          toolUsage[toolName] = (toolUsage[toolName] || 0) + 1;
        });

      const topTools = Object.entries(toolUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tool, count]) => `  • ${tool}: ${count} uses`)
        .join('\n');

      // Get cost data
      const { costTracker } = await import('../services/cost-tracker/cost-tracker');
      const costs = costTracker.getWeekCosts(userId);

      const message = 
        `📊 **Insights (Last ${period} days)**\n\n` +
        `**Messages:**\n` +
        `• User: ${userCount}\n` +
        `• Assistant: ${assistantCount}\n` +
        `• Tool calls: ${toolCount}\n` +
        `• Total: ${recentMessages.length}\n\n` +
        (topTools ? `**Top Tools:**\n${topTools}\n\n` : '') +
        `**LLM Costs:**\n` +
        `• Total: $${costs.totalCostUSD.toFixed(4)}\n` +
        `• Tokens: ${costs.totalTokens.toLocaleString()}\n` +
        `• Requests: ${costs.requestCount}\n\n` +
        `_Use \`/insights <days>\` to change period_`;

      return {
        success: true,
        message
      };

    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to get insights: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

/**
 * /personality - Change agent personality/tone
 */
export const personalityCommand: LocalCommand = {
  type: 'local',
  name: 'personality',
  description: 'Change agent personality and communication style',
  run: async (args: string[], context: CommandContext): Promise<CommandResult> => {
    const personalities = {
      default: {
        name: 'Default',
        description: 'Balanced, professional yet friendly',
        prompt: ''
      },
      professional: {
        name: 'Professional',
        description: 'Formal, concise, business-oriented',
        prompt: 'COMMUNICATION STYLE: Be extremely professional, formal, and concise. Use business language. Avoid emojis and casual expressions.'
      },
      casual: {
        name: 'Casual',
        description: 'Friendly, relaxed, conversational',
        prompt: 'COMMUNICATION STYLE: Be casual, friendly, and conversational. Use emojis naturally. Be warm and approachable.'
      },
      concise: {
        name: 'Concise',
        description: 'Brief, direct, minimal explanations',
        prompt: 'COMMUNICATION STYLE: Be extremely concise. Give shortest possible answers. No unnecessary explanations. Direct and to the point.'
      },
      verbose: {
        name: 'Verbose',
        description: 'Detailed, educational, explanatory',
        prompt: 'COMMUNICATION STYLE: Be detailed and thorough. Explain concepts fully. Provide context and examples. Be educational.'
      }
    };

    const selectedPersonality = args[0]?.toLowerCase();

    // No argument - show available personalities
    if (!selectedPersonality) {
      const list = Object.entries(personalities)
        .map(([key, p]) => `  • \`${key}\` - ${p.description}`)
        .join('\n');

      return {
        success: true,
        message: 
          `🎭 **Available Personalities:**\n\n${list}\n\n` +
          `**Usage:** \`/personality <name>\`\n\n` +
          `_Note: Personality change affects future messages in this conversation._`
      };
    }

    // Invalid personality
    if (!personalities[selectedPersonality as keyof typeof personalities]) {
      return {
        success: false,
        message: `❌ Unknown personality: \`${selectedPersonality}\`\n\nUse \`/personality\` to see available options.`
      };
    }

    const personality = personalities[selectedPersonality as keyof typeof personalities];

    // Store personality in conversation metadata (would need DB support for persistence)
    // For now, just acknowledge
    return {
      success: true,
      message: 
        `✅ **Personality Changed!**\n\n` +
        `🎭 **${personality.name}**\n` +
        `${personality.description}\n\n` +
        `_This change will affect my responses going forward._\n\n` +
        `⚠️ **Note:** Personality persistence across restarts not yet implemented. ` +
        `The change will apply to this session only.`,
      metadata: { personality: selectedPersonality }
    };
  }
};

/**
 * Export all commands as an array for registration
 */
export const allTelegramCommands = [
  // LocalCommands
  startCommand,
  helpCommand,
  versionCommand,
  statusCommand,
  tasksCommand,
  taskCommand,
  clearCommand,
  costCommand,
  statsCommand,
  reloadCommand,
  contextCommand,
  retryCommand,
  undoCommand,
  compressCommand,
  insightsCommand,
  personalityCommand,
  
  // PromptCommands
  reviewCommand,
  commitCommand,
  deployCommand
];
