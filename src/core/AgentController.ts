import { Context } from 'grammy';
import { TelegramOutputHandler } from './TelegramOutputHandler';
import { MemoryManager } from '../memory/MemoryManager';
import { AgentLoop } from '../engine/AgentLoop';
import { ToolRegistry } from '../engine/ToolRegistry';
import { SkillRouter } from '../skills/SkillRouter';
import { PythonExecutorTool } from '../tools/PythonExecutorTool';
import { SshExecutorTool } from '../tools/SshExecutorTool';
import { LocalShellTool } from '../tools/LocalShellTool';

export class AgentController {
  private outputHandler: TelegramOutputHandler;
  private memoryManager: MemoryManager;
  private skillRouter: SkillRouter;
  private agentLoop: AgentLoop;
  private defaultRegistry: ToolRegistry;

  constructor() {
    this.outputHandler = new TelegramOutputHandler();
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    
    this.defaultRegistry = new ToolRegistry();
    this.defaultRegistry.register(new PythonExecutorTool());
    this.defaultRegistry.register(LocalShellTool);
    if (process.env.VPS_HOST) {
      this.defaultRegistry.register(SshExecutorTool);
      console.log(`[AgentController] SSH Tool ativa -> ${process.env.VPS_USER}@${process.env.VPS_HOST}`);
    }
    
    this.agentLoop = new AgentLoop(this.defaultRegistry);
  }

  /**
   * Sanitiza histórico do SQLite garantindo alternância user/assistant.
   * Protege contra dados corrompidos de sessões anteriores.
   */
  private sanitizeHistory(raw: { role: string; content: string }[]): { role: string; content: string }[] {
    // Normaliza roles: 'tool' e 'system' tornam-se 'user'
    const normalized = raw
      .filter(m => m.content?.trim())
      .map(m => ({
        role: (m.role === 'tool' || m.role === 'system') ? 'user' : m.role,
        content: m.content
      }));

    // Remove consecutivos do mesmo role (colapsa em um)
    const result: { role: string; content: string }[] = [];
    for (const msg of normalized) {
      if (result.length > 0 && result[result.length - 1].role === msg.role) {
        result[result.length - 1].content += '\n' + msg.content;
      } else {
        result.push({ ...msg });
      }
    }

    // Garante que termina com 'user' (mensagem atual do usuário)
    while (result.length > 0 && result[result.length - 1].role === 'assistant') {
      result.pop();
    }

    return result;
  }

  /**
   * Ponto de entrada (Facade) para as requisições do Telegram
   */
  public async handleInput(userId: string, message: string, ctx: Context) {
    console.log(`[AgentController] Processando input: ${userId}`);
    await ctx.replyWithChatAction('typing');

    try {
      const providerName = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
      const conversation = this.memoryManager.getOrCreateConversation(userId, providerName);
      this.memoryManager.saveMessage(conversation.id, 'user', message);
      
      // Janela de 12 mensagens + sanitização contra dados corrompidos
      const rawHistory = this.memoryManager.getMessages(conversation.id, 12);
      const history = this.sanitizeHistory(rawHistory.map(m => ({ role: m.role, content: m.content })));

      const selectedSkill = await this.skillRouter.determineSkill(message);
      let systemPrompt = "Você é GueClaw, assistente do usuário. Responda em Português-BR. Quando solicitado a executar ações no servidor, use a tool execute_shell_command.";
      
      if (selectedSkill) {
        console.log(`[Router] Skill: ${selectedSkill.name}`);
        systemPrompt += `\n\nATENÇÃO — Skill ativa: ${selectedSkill.name}\n${selectedSkill.content}`;
      }

      const finalAnswer = await this.agentLoop.run(history, systemPrompt);

      this.memoryManager.saveMessage(conversation.id, 'assistant', finalAnswer);
      await this.outputHandler.sendResponse(ctx, finalAnswer);

    } catch (err: any) {
      console.error('[AgentController] Error:', err);
      await this.outputHandler.sendResponse(ctx, "Desculpe, ocorreu uma exceção: " + err.message);
    }
  }
}
