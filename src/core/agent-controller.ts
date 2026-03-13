import { Context } from 'grammy';
import { TelegramInput } from '../types';
import { TelegramInputHandler } from '../handlers/telegram-input-handler';
import { TelegramOutputHandler } from '../handlers/telegram-output-handler';
import { MemoryManager } from '../core/memory/memory-manager';
import { SkillLoader } from '../core/skills/skill-loader';
import { SkillRouter } from '../core/skills/skill-router';
import { SkillExecutor } from '../core/skills/skill-executor';
import { AgentLoop } from '../core/agent-loop/agent-loop';
import { ProviderFactory } from '../core/providers/provider-factory';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import * as Papa from 'papaparse';

/**
 * Agent Controller - Main orchestrator (Facade pattern)
 */
export class AgentController {
  private inputHandler: TelegramInputHandler;
  private memoryManager: MemoryManager;
  private skillRouter: SkillRouter;
  private availableSkills: any[];

  constructor() {
    this.inputHandler = new TelegramInputHandler();
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    this.availableSkills = [];

    // Load skills
    this.loadSkills();

    // Schedule periodic cleanup
    this.scheduleCleanup();
  }

  /**
   * Handle incoming message from Telegram
   */
  public async handleMessage(ctx: Context): Promise<void> {
    try {
      // Show typing indicator
      await TelegramOutputHandler.sendTypingAction(ctx);

      // Process input
      const input = await this.inputHandler.processMessage(ctx);

      if (!input) {
        return; // Authorization failed or invalid input
      }

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📨 Message from user ${input.userId}`);
      console.log(`💬 Text: ${input.text?.substring(0, 100)}${input.text && input.text.length > 100 ? '...' : ''}`);
      
      if (input.attachments && input.attachments.length > 0) {
        console.log(`📎 Attachments: ${input.attachments.map((a: any) => `${a.type}:${a.fileName}`).join(', ')}`);
      }

      // Prepare user input text
      let userInputText = input.text || '';

      // Process attachments and append their content to input text
      if (input.attachments && input.attachments.length > 0) {
        for (const attachment of input.attachments) {
          if (attachment.type === 'document') {
            // Try to read document content
            if (attachment.filePath && fs.existsSync(attachment.filePath)) {
              try {
                let content = '';
                
                if (attachment.mimeType === 'application/pdf') {
                  const dataBuffer = fs.readFileSync(attachment.filePath);
                  const data = await pdfParse(dataBuffer);
                  content = data.text;
                } else if (attachment.fileName?.endsWith('.csv')) {
                  const csvContent = fs.readFileSync(attachment.filePath, 'utf8');
                  const parsed = Papa.parse(csvContent, { header: true });
                  content = JSON.stringify(parsed.data, null, 2);
                } else if (attachment.mimeType?.startsWith('text/')) {
                  content = fs.readFileSync(attachment.filePath, 'utf8');
                }

                if (content) {
                  userInputText += `\n\n[Attached File: ${attachment.fileName}]\n${content.substring(0, 10000)}${content.length > 10000 ? '\n... (truncated)' : ''}`;
                }
              } catch (error) {
                console.error(`Error reading attachment ${attachment.fileName}:`, error);
              }
            }
          } else if (attachment.type === 'image') {
            userInputText += `\n\n[Attached Image: ${attachment.fileName}]`;
            // TODO: Implement image analysis with vision API
          } else if (attachment.type === 'audio') {
            userInputText += `\n\n[Attached Audio: ${attachment.fileName}]`;
            // TODO: Implement speech-to-text with Whisper
          }
        }
      }

      // Get or create conversation
      const conversation = this.memoryManager.getConversation(input.userId);

      // Add user message to memory
      this.memoryManager.addUserMessage(conversation.id, userInputText);

      // Get conversation history
      const history = this.memoryManager.getRecentMessages(conversation.id);

      // Route to appropriate skill
      const skillName = await this.skillRouter.route(userInputText, this.availableSkills);

      let response: string;

      if (skillName && SkillLoader.skillExists(skillName)) {
        // Execute skill
        console.log(`🎯 Using skill: ${skillName}`);
        response = await SkillExecutor.executeAuto(skillName, userInputText, history);
      } else {
        // Use general agent loop
        console.log(`💭 Using general reasoning (no specific skill)`);
        
        const provider = ProviderFactory.getFastProvider();
        const agentLoop = new AgentLoop(provider, history);
        response = await agentLoop.run(userInputText);
      }

      // Save assistant response to memory
      this.memoryManager.addAssistantMessage(conversation.id, response);

      // Send response
      await this.sendResponse(ctx, response);

      console.log(`✅ Response sent successfully`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    } catch (error: any) {
      console.error('❌ Error in AgentController:', error);
      await TelegramOutputHandler.sendError(ctx, 'An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Send response to user (text, code, or file)
   */
  private async sendResponse(ctx: Context, response: string): Promise<void> {
    // Check if should send as file (only for very technical documents)
    if (this.shouldSendAsFile(response)) {
      await TelegramOutputHandler.sendMarkdownAsFile(ctx, response, 'response.md');
      return;
    }

    // Check if should send as code block (structured/long responses)
    if (this.shouldSendAsCode(response)) {
      await TelegramOutputHandler.sendAsCode(ctx, response);
      return;
    }

    // Send as plain text for simple conversational responses
    await TelegramOutputHandler.sendText(ctx, response);
  }

  /**
   * Check if response should be sent as preformatted code block.
   * Only when the LLM explicitly returns content that is clearly code/technical output.
   */
  private shouldSendAsCode(response: string): boolean {
    // Only use code block when the response is predominantly code
    const codeBlockPairs = Math.floor((response.match(/```/g) || []).length / 2);
    const looksLikeShellOutput = /^(\$|#|>|root@|\[root)/.test(response.trim());
    const looksLikeCodeOnly = codeBlockPairs >= 2 && response.trim().startsWith('```');

    return looksLikeShellOutput || looksLikeCodeOnly;
  }

  /**
   * Check if response should be sent as file
   */
  private shouldSendAsFile(response: string): boolean {
    // Only send as file for technical documentation with YAML frontmatter
    const hasYamlFrontmatter = response.trim().startsWith('---');
    const isExtremelyLong = response.length > 15000;
    const hasLotsOfCode = (response.match(/```/g) || []).length >= 12;

    // Send as file only for:
    // 1. Technical specs with YAML frontmatter
    // 2. Extremely long responses (>15000 chars)
    // 3. Heavy code documentation (6+ code blocks)
    return hasYamlFrontmatter || (isExtremelyLong && hasLotsOfCode);
  }

  /**
   * Load all available skills
   */
  private loadSkills(): void {
    console.log('📚 Loading skills...');
    this.availableSkills = SkillLoader.loadAll();
    console.log(`✅ Loaded ${this.availableSkills.length} skills`);
  }

  /**
   * Reload skills (hot-reload)
   */
  public reloadSkills(): void {
    console.log('🔄 Reloading skills...');
    this.availableSkills = SkillLoader.loadAll();
  }

  /**
   * Schedule periodic cleanup tasks
   */
  private scheduleCleanup(): void {
    // Cleanup temp files every hour
    setInterval(() => {
      console.log('🧹 Running scheduled cleanup...');
      this.inputHandler.cleanupTempFiles(60);
    }, 60 * 60 * 1000); // Every hour

    // Cleanup old conversations every day
    setInterval(() => {
      console.log('🧹 Cleaning up old conversations...');
      this.memoryManager.cleanup(30); // Older than 30 days
    }, 24 * 60 * 60 * 1000); // Every day
  }

  /**
   * Get controller stats
   */
  public getStats(): any {
    return {
      skillsLoaded: this.availableSkills.length,
      skills: this.availableSkills.map(s => ({ name: s.name, description: s.description })),
    };
  }
}
