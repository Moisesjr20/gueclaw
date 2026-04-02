import { Context } from 'grammy';
import { TelegramInput, NO_REPLY, Message } from '../types';
import { TelegramInputHandler } from '../handlers/telegram-input-handler';
import { TelegramOutputHandler } from '../handlers/telegram-output-handler';
import { CommandHandler } from '../handlers/command-handler';
import { MemoryManager } from '../core/memory/memory-manager';
import { PersistentMemory } from '../core/memory/persistent-memory';
import { SkillLoader } from '../core/skills/skill-loader';
import { SkillRouter } from '../core/skills/skill-router';
import { SkillExecutor } from '../core/skills/skill-executor';
import { AgentLoop } from '../core/agent-loop/agent-loop';
import { IdentityLoader } from '../utils/identity-loader';
import { ProviderFactory } from '../core/providers/provider-factory';
import { ContextCompressor } from '../services/context-compressor';
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
  private contextCompressor: ContextCompressor;

  constructor() {
    this.inputHandler = new TelegramInputHandler();
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    this.availableSkills = [];

    // Initialize context compressor with env config
    const maxMessages = parseInt(process.env.CONTEXT_COMPACT_THRESHOLD || '30', 10);
    this.contextCompressor = new ContextCompressor({
      maxMessages,
      recentMessagesWindow: parseInt(process.env.CONTEXT_RECENT_WINDOW || '10', 10),
      initialMessagesKeep: parseInt(process.env.CONTEXT_INITIAL_KEEP || '2', 10),
      strategy: (process.env.CONTEXT_COMPRESSION_STRATEGY as any) || 'sliding-window',
    });

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

      // Handle slash commands before any LLM processing
      if (input.text?.startsWith('/')) {
        const handled = await CommandHandler.handle(ctx, input, this.memoryManager);
        if (handled) return;
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
            // Provide the image path so the LLM can call analyze_image tool
            if (attachment.filePath) {
              userInputText += `\n\n[Imagem recebida: ${attachment.fileName} — caminho: ${attachment.filePath}]\nUse a ferramenta analyze_image com o caminho acima para analisar a imagem.`;
            } else {
              userInputText += `\n\n[Imagem recebida: ${attachment.fileName}]`;
            }
          } else if (attachment.type === 'audio') {
            // Use pre-transcription from Whisper if available, otherwise provide path for manual tool call
            const meta = (attachment as any).metadata as { transcription?: string } | undefined;
            if (meta?.transcription) {
              userInputText += `\n\n[Áudio transcrito (${attachment.fileName})]:\n${meta.transcription}`;
            } else if (attachment.filePath) {
              userInputText += `\n\n[Áudio recebido: ${attachment.fileName} — caminho: ${attachment.filePath}]\nUse a ferramenta transcribe_audio com o caminho acima para transcrever.`;
            } else {
              userInputText += `\n\n[Áudio recebido: ${attachment.fileName}]`;
            }
          }
        }
      }

      // Send immediate acknowledgment so user knows the bot is working
      await TelegramOutputHandler.sendText(ctx, '🔍 Analisando sua solicitação...');

      // Get or create conversation
      const conversation = this.memoryManager.getConversation(input.userId);

      // Add user message to memory
      this.memoryManager.addUserMessage(conversation.id, userInputText);

      // Compact old messages if threshold exceeded
      await this.compactIfNeeded(conversation.id, input.userId);

      // Get conversation history
      const history = this.memoryManager.getRecentMessages(conversation.id);

      // Build enriched system prompt context (memory + skills manifest)
      const enrichment = this.buildEnrichment(input.userId);

      // Route to appropriate skill
      const skillName = await this.skillRouter.route(userInputText, this.availableSkills);

      let response: string;

      if (skillName && SkillLoader.skillExists(skillName)) {
        // Execute skill — pass enrichment so the skill loop is also memory-aware
        console.log(`🎯 Using skill: ${skillName}`);
        response = await SkillExecutor.executeAuto(skillName, userInputText, history, enrichment, conversation.id);
      } else {
        // Use general agent loop
        console.log(`💭 Using general reasoning (no specific skill)`);
        
        const provider = ProviderFactory.getFastProvider();
        const agentLoop = new AgentLoop(provider, history, undefined, enrichment, undefined, conversation.id);
        response = await agentLoop.run(userInputText);
      }

      // Save assistant response to memory (skip NO_REPLY sentinel)
      if (response !== NO_REPLY) {
        this.memoryManager.addAssistantMessage(conversation.id, response);
        // Send response
        await this.sendResponse(ctx, response);
      } else {
        console.log('🔕 Skipping Telegram send — NO_REPLY');
      }

      console.log(`✅ Response sent successfully`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    } catch (error: any) {
      console.error('❌ Error in AgentController:', error);
      await TelegramOutputHandler.sendError(ctx, 'An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Send response to user (formatted HTML text, raw code block, or file)
   */
  private async sendResponse(ctx: Context, response: string): Promise<void> {
    // Very long technical docs → send as file to avoid truncation
    if (this.shouldSendAsFile(response)) {
      await TelegramOutputHandler.sendMarkdownAsFile(ctx, response, 'response.md');
      return;
    }

    // Raw shell/terminal output (no markdown) → preserve as-is inside <pre>
    if (this.shouldSendAsRawCode(response)) {
      await TelegramOutputHandler.sendAsCode(ctx, response);
      return;
    }

    // Default: use typewriter streaming effect if enabled, otherwise send all at once
    const streamingEnabled = process.env.STREAMING_ENABLED === 'true';
    if (streamingEnabled) {
      await TelegramOutputHandler.sendTypewriter(ctx, response);
    } else {
      await TelegramOutputHandler.sendText(ctx, response);
    }
  }

  /**
   * Returns true only for raw terminal/shell output that contains no Markdown.
   * LLM responses that happen to contain code blocks are handled by sendText()
   * via TelegramFormatter, which renders them as proper <pre><code> blocks.
   */
  private shouldSendAsRawCode(response: string): boolean {
    const trimmed = response.trim();
    const startsWithShellPrompt = /^(\$\s|#\s|\[?root@|\[root\]|>)/.test(trimmed);
    const hasNoMarkdown = !trimmed.includes('**') &&
                          !trimmed.includes('```') &&
                          !trimmed.includes('_') &&
                          !trimmed.includes('[');
    return startsWithShellPrompt && hasNoMarkdown;
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
   * Build an enrichment block injected at the top of the system prompt.
   * Contains: USER_ID for memory tool, persistent memory, and skill manifest.
   */
  private buildEnrichment(userId: string): string {
    const parts: string[] = [];

    // USER_ID so the LLM can pass it to memory_write tool
    parts.push(`USER_ID (use em chamadas à ferramenta memory_write): ${userId}`);

    // Persistent memory (MEMORY.md + today's log)
    const memory = PersistentMemory.read(userId);
    if (memory) {
      parts.push(`## Memória do Usuário\n${memory}`);
    }

    // Last compaction summary
    const compact = PersistentMemory.loadLastCompact(userId);
    if (compact) {
      parts.push(`## Resumo de Contexto Anterior\n${compact}`);
    }

    // Skill manifest — lightweight list so LLM knows what skills exist
    const manifest = SkillLoader.loadManifest();
    if (manifest.length > 0) {
      const lines = manifest
        .map(s => `- **${s.name}** (dirName: "${s.dirName}"): ${s.description}`)
        .join('\n');
      parts.push(
        `## Skills Disponíveis\nUse a ferramenta \`read_skill\` com o dirName para carregar as instruções completas de uma skill antes de executá-la.\n${lines}`
      );
    }

    return parts.join('\n\n');
  }

  /**
   * Compact old messages if the conversation exceeds configured threshold.
   * Uses the Context Compression service (Phase 3.1) for intelligent summarization.
   */
  private async compactIfNeeded(conversationId: string, userId: string): Promise<void> {
    // Get all messages for this conversation
    const messages = this.memoryManager.getAllMessages(conversationId);

    if (messages.length === 0) return;

    // Check if compression needed and compress
    const { messages: compressed, result } = await this.contextCompressor.compressIfNeeded(messages);

    if (!result.compressed) return;

    // Update memory with compressed messages
    console.log(`🗜️  Updating conversation with compressed context...`);

    // Find which messages were removed (not in compressed set)
    const compressedIds = new Set(compressed.map((m: Message) => m.id));
    const removedIds = messages
      .map((m: Message) => m.id)
      .filter((id: string | undefined) => id && !compressedIds.has(id))
      .filter(Boolean) as string[];

    // Delete old messages
    if (removedIds.length > 0) {
      this.memoryManager.deleteMessages(removedIds);
    }

    // Add summary if needed (new message with summary)
    if (result.summary) {
      this.memoryManager.addCompactSummary(conversationId, result.summary);
      
      // Persist summary to disk for backup
      PersistentMemory.saveCompact(userId, result.summary);
    }

    console.log(`✅ Compression complete: ${result.originalCount} → ${result.newCount} messages (saved ~${result.tokensSaved} tokens)`);
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
