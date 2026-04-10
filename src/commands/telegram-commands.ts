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
      `**Available Commands:**\n` +
      `• \`/start\` - Welcome message\n` +
      `• \`/help\` - Show this help\n` +
      `• \`/stats\` - Show agent statistics\n` +
      `• \`/reload\` - Reload skills (hot-reload)\n` +
      `• \`/cost [today|week|month]\` - Show LLM usage costs\n` +
      `• \`/tasks\` - List active tasks\n` +
      `• \`/task <id>\` - Show task details\n\n` +
      `**Supported File Types:**\n` +
      `• PDF documents\n` +
      `• CSV files\n` +
      `• Text files\n` +
      `• Images\n` +
      `• Audio/voice messages\n\n` +
      `**Examples:**\n` +
      `• "List all Docker containers"\n` +
      `• "Create a new skill for database management"\n` +
      `• "Execute: df -h"\n` +
      `• "Read the file /var/log/nginx/access.log"\n` +
      `• "Make a GET request to https://api.github.com/repos/gueclaw/agent"\n\n` +
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
  
  // PromptCommands
  reviewCommand,
  commitCommand,
  deployCommand
];
