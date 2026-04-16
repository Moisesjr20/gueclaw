import 'dotenv/config';
import { Bot } from 'grammy';
import { DatabaseConnection } from './core/memory/database';
import { ProviderFactory } from './core/providers/provider-factory';
import { ToolRegistry } from './tools/tool-registry';
import { AgentController } from './core/agent-controller';
import { DebugAPI } from './api/debug-api';

// Import tools
import { VPSCommandTool } from './tools/vps-command-tool';
import { DockerTool } from './tools/docker-tool';
import { FileOperationsTool } from './tools/file-operations-tool';
import { APIRequestTool } from './tools/api-request-tool';
import { MemoryWriteTool } from './tools/memory-write-tool';
import { ReadSkillTool } from './tools/read-skill-tool';
import { AnalyzeImageTool } from './tools/analyze-image-tool';
import { AudioTool } from './tools/audio-tool';
import { FinancialTool } from './tools/financial-tool';
import { MCPManager } from './tools/mcp-manager';
import { MCPTool } from './tools/mcp-tool';
import { createSkillTool } from './tools/skill-tool';
import { GrepTool } from './tools/grep-tool';
import { GlobTool } from './tools/glob-tool';
import { SaveToRepositoryTool } from './tools/save-to-repository-tool';
import { CronTool } from './tools/cron-tool';

// Import services
import { Heartbeat } from './services/heartbeat';
import { TelegramNotifier } from './services/telegram-notifier';
import { TaskTracker } from './core/task-tracker';
import { CronScheduler } from './services/cron/cron-scheduler';
import { initializeCommands } from './commands/command-initializer'; // DVACE - Phase 1.4
import * as path from 'path';

/**
 * GueClaw Agent - Main Entry Point
 */
class GueClaw {
  private bot: Bot;
  private controller: AgentController;
  private heartbeat?: Heartbeat;
  private cronScheduler?: CronScheduler;

  constructor() {
    this.validateEnvironment();
    
    // Initialize database
    DatabaseConnection.getInstance();

    // Initialize LLM providers
    ProviderFactory.initialize();

    // DVACE Phase 1.4: Initialize Command System
    initializeCommands();

    // Register built-in tools
    this.registerTools();

    // Initialize Telegram bot
    const botToken = process.env.TELEGRAM_BOT_TOKEN!;
    this.bot = new Bot(botToken);

    // Initialize controller
    this.controller = new AgentController();

    // Setup bot handlers
    this.setupHandlers();

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║        🤖 GueClaw Agent - VPS Edition           ║');
    console.log('║          AI-Powered Telegram Assistant          ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ALLOWED_USER_IDS',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\nPlease create a .env file based on .env.example');
      process.exit(1);
    }

    // Validate that the whitelist has at least one valid Telegram numeric ID
    const allowedIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => /^\d{1,20}$/.test(id));

    if (allowedIds.length === 0) {
      console.error('❌ TELEGRAM_ALLOWED_USER_IDS está vazio ou não contém IDs numéricos válidos.');
      console.error('   Adicione pelo menos um Telegram user ID (só dígitos) para liberar acesso ao bot.');
      process.exit(1);
    }

    // Check if at least one LLM provider is configured
    const hasGitHubCopilot = process.env.GITHUB_COPILOT_USE_OAUTH === 'true' || 
                             process.env.GITHUB_COPILOT_API_KEY || 
                             process.env.OPENAI_API_KEY;
    const hasDeepSeek = process.env.DEEPSEEK_API_KEY;

    if (!hasGitHubCopilot && !hasDeepSeek) {
      console.error('❌ No LLM provider configured!');
      console.error('   Please configure at least one of:');
      console.error('   - GitHub Copilot (GITHUB_COPILOT_USE_OAUTH=true)');
      console.error('   - OpenAI (OPENAI_API_KEY)');
      console.error('   - DeepSeek (DEEPSEEK_API_KEY)');
      process.exit(1);
    }

    console.log('✅ Environment variables validated');
  }

  /**
   * Register all available tools
   */
  private registerTools(): void {
    console.log('🔧 Registering tools...');

    ToolRegistry.registerAll([
      new VPSCommandTool(),
      new DockerTool(),
      new FileOperationsTool(),
      new APIRequestTool(),
      new MemoryWriteTool(),
      new ReadSkillTool(),
      new AnalyzeImageTool(),
      new AudioTool(),
      new FinancialTool(),
      new CronTool(), // CronTool: Schedule and manage automated tasks
      createSkillTool(), // SkillTool: LLM can invoke skills proactively
      new GrepTool(), // GrepTool: Fast regex search with ripgrep
      new GlobTool(), // GlobTool: Fast file pattern matching
      new SaveToRepositoryTool(), // Save files to centralized repository
    ]);

    console.log(`✅ Registered ${ToolRegistry.getAllNames().length} tools`);
  }

  /**
   * Setup Telegram bot handlers
   */
  private setupHandlers(): void {
    // Handle all text messages
    this.bot.on('message', async (ctx) => {
      await this.controller.handleMessage(ctx);
    });

    // Handle /start command
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
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
        `/help - Show this message\n\n` +
        `Just send me a message and I'll help you!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        `📚 **GueClaw Agent Help**\n\n` +
        `**Available Commands:**\n` +
        `• \`/start\` - Welcome message\n` +
        `• \`/help\` - Show this help\n` +
        `• \`/stats\` - Show agent statistics\n` +
        `• \`/reload\` - Reload skills (hot-reload)\n` +
        `• \`/cost [today|week|month]\` - Show LLM usage costs\n\n` +
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
        `Send any message or file and I'll process it!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /stats command
    this.bot.command('stats', async (ctx) => {
      const stats = this.controller.getStats();
      
      const skillsList = stats.skills.length > 0
        ? stats.skills.map((s: any) => `• **${s.name}**: ${s.description}`).join('\n')
        : '• No skills loaded';

      await ctx.reply(
        `📊 **Agent Statistics**\n\n` +
        `**Skills Loaded:** ${stats.skillsLoaded}\n\n` +
        `${skillsList}`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle /reload command
    this.bot.command('reload', async (ctx) => {
      await ctx.reply('🔄 Reloading skills...');
      this.controller.reloadSkills();
      const stats = this.controller.getStats();
      await ctx.reply(`✅ Reloaded! ${stats.skillsLoaded} skills available.`);
    });

    // Handle /cost command - Show LLM usage and costs
    this.bot.command('cost', async (ctx) => {
      const userId = ctx.from?.id.toString() || 'unknown';
      const messageText = ctx.message?.text || '/cost';
      const args = messageText.split(' ').slice(1);
      const period = args[0] || 'today';

      let summary;
      let periodLabel: string;

      switch (period.toLowerCase()) {
        case 'week':
        case 'semana':
          summary = require('./services/cost-tracker').costTracker.getWeekCosts(userId);
          periodLabel = 'Últimos 7 dias';
          break;
        case 'month':
        case 'mes':
        case 'mês':
          summary = require('./services/cost-tracker').costTracker.getMonthCosts(userId);
          periodLabel = 'Este mês';
          break;
        case 'today':
        case 'hoje':
        default:
          summary = require('./services/cost-tracker').costTracker.getTodayCosts(userId);
          periodLabel = 'Hoje';
          break;
      }

      const message = require('./services/cost-tracker').costTracker.formatSummaryForTelegram(
        summary,
        periodLabel
      );

      await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // Handle /tasks command - List active tasks
    this.bot.command('tasks', async (ctx) => {
      const tracker = TaskTracker.getInstance();
      const tasks = tracker.getPendingTasks();
      const message = tracker.formatTaskList(tasks);
      await ctx.reply(message, { parse_mode: 'Markdown' });
    });

    // Handle /task <id> command - Show task details              
    this.bot.command('task', async (ctx) => {
      const messageText = ctx.message?.text || '/task';
      const args = messageText.split(' ').slice(1);
      
      if (args.length === 0) {
        await ctx.reply('❌ Use: /task <ID>\n\nExemplo: /task task_1234567890_abc123');
        return;
      }

      const taskId = args[0];
      const tracker = TaskTracker.getInstance();
      const summary = tracker.getTaskSummary(taskId);
      await ctx.reply(summary, { parse_mode: 'Markdown' });
    });

    // Handle errors
    this.bot.catch((err) => {
      console.error('❌ Bot error:', err);
    });
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting GueClaw Agent...');

      // Initialize MCP servers and register their tools
      const mcpConfigPath = path.resolve(
        process.env.WORKSPACE_ROOT ?? process.cwd(),
        'config/mcp-servers.json'
      );
      await MCPManager.getInstance().initialize(mcpConfigPath);
      const mcpTools = MCPTool.buildAll();
      if (mcpTools.length > 0) {
        ToolRegistry.registerAll(mcpTools);
        console.log(`🔌 MCP tools registered: ${mcpTools.map(t => t.name).join(', ')}`);
      }

      // Initialize and start Cron Scheduler
      this.cronScheduler = CronScheduler.getInstance();
      this.cronScheduler.initialize(this.controller, this.bot);
      this.cronScheduler.start();
      console.log('⏰ Cron Scheduler started');

      console.log(`📡 Telegram polling started`);
      
      // Determine active provider
      const activeProvider = process.env.GITHUB_COPILOT_USE_OAUTH === 'true' ? 'github-copilot' :
                            process.env.GITHUB_COPILOT_API_KEY ? 'github-copilot' :
                            process.env.OPENAI_API_KEY ? 'openai' :
                            'deepseek';
      
      console.log(`🧠 LLM Provider: ${activeProvider}`);
      console.log(`💾 Database: ${process.env.DATABASE_PATH || './data/gueclaw.db'}`);
      console.log(`🔧 Tools: ${ToolRegistry.getAllNames().join(', ')}`);
      console.log('\n✅ Bot is running! Send a message to get started.\n');

      // Start heartbeat monitor
      const notifier = new TelegramNotifier(
        process.env.TELEGRAM_BOT_TOKEN!,
        process.env.TELEGRAM_ALLOWED_USER_IDS!
      );
      this.heartbeat = new Heartbeat(notifier);
      this.heartbeat.start();

      // Start Debug API (local only, port 3742)
      if (process.env.DISABLE_DEBUG_API !== 'true') {
        const debugApi = new DebugAPI();
        await debugApi.start();
      }

      await this.bot.start();

    } catch (error: any) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  public async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down GueClaw Agent...');
    
    this.heartbeat?.stop();
    this.cronScheduler?.stop();
    await MCPManager.getInstance().shutdown();
    await this.bot.stop();
    DatabaseConnection.close();
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  }
}

// Create and start the agent
const gueclaw = new GueClaw();

// Handle graceful shutdown
process.on('SIGINT', () => gueclaw.shutdown());
process.on('SIGTERM', () => gueclaw.shutdown());

// Start the bot
gueclaw.start().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
