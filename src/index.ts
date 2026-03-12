import 'dotenv/config';
import { Bot } from 'grammy';
import { DatabaseConnection } from './core/memory/database';
import { ProviderFactory } from './core/providers/provider-factory';
import { ToolRegistry } from './tools/tool-registry';
import { AgentController } from './core/agent-controller';

// Import tools
import { VPSCommandTool } from './tools/vps-command-tool';
import { DockerTool } from './tools/docker-tool';
import { FileOperationsTool } from './tools/file-operations-tool';
import { APIRequestTool } from './tools/api-request-tool';

/**
 * GueClaw Agent - Main Entry Point
 */
class GueClaw {
  private bot: Bot;
  private controller: AgentController;

  constructor() {
    this.validateEnvironment();
    
    // Initialize database
    DatabaseConnection.getInstance();

    // Initialize LLM providers
    ProviderFactory.initialize();

    // Register tools
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
    console.log('║        Powered by DeepSeek & Telegram           ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ALLOWED_USER_IDS',
      'DEEPSEEK_API_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(key => console.error(`   - ${key}`));
      console.error('\nPlease create a .env file based on .env.example');
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
        `• \`/reload\` - Reload skills (hot-reload)\n\n` +
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
      console.log(`📡 Telegram polling started`);
      console.log(`🧠 LLM Provider: ${process.env.DEFAULT_PROVIDER || 'deepseek'}`);
      console.log(`💾 Database: ${process.env.DATABASE_PATH || './data/gueclaw.db'}`);
      console.log(`🔧 Tools: ${ToolRegistry.getAllNames().join(', ')}`);
      console.log('\n✅ Bot is running! Send a message to get started.\n');

      await this.bot.start();

    } catch (error: any) {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down GueClaw Agent...');
    
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
