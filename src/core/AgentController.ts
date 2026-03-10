import { Context } from 'grammy';
import { TelegramOutputHandler } from './TelegramOutputHandler';
import { MemoryManager } from '../memory/MemoryManager';
import { AgentLoop } from '../engine/AgentLoop';
import { ToolRegistry } from '../engine/ToolRegistry';
import { SkillRouter } from '../skills/SkillRouter';
import { PythonExecutorTool } from '../tools/PythonExecutorTool';
import { SshExecutorTool } from '../tools/SshExecutorTool';

export class AgentController {
  private outputHandler: TelegramOutputHandler;
  private memoryManager: MemoryManager;
  private skillRouter: SkillRouter;
  private agentLoop: AgentLoop;
  private defaultRegistry: ToolRegistry; // Futuramente podemos registrar Tools (Python executions) aqui

  constructor() {
    this.outputHandler = new TelegramOutputHandler();
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    
    this.defaultRegistry = new ToolRegistry();
    // DOE Layer 3: Python execution
    this.defaultRegistry.register(new PythonExecutorTool());
    // SSH Tool: acesso remoto à VPS (ativa apenas se VPS_HOST estiver configurado)
    if (process.env.VPS_HOST) {
      this.defaultRegistry.register(SshExecutorTool);
      console.log(`[AgentController] SSH Tool ativa -> ${process.env.VPS_USER}@${process.env.VPS_HOST}`);
    }
    
    this.agentLoop = new AgentLoop(this.defaultRegistry);
  }

  /**
   * Ponto de entrada (Facade) para as requisições do Telegram
   */
  public async handleInput(userId: string, message: string, ctx: Context) {
    console.log(`[AgentController] Processando input: ${userId}`);
    await ctx.replyWithChatAction('typing');

    try {
        // 1. Histórico e contexto
        const providerName = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
        const conversation = this.memoryManager.getOrCreateConversation(userId, providerName);
        this.memoryManager.saveMessage(conversation.id, 'user', message);
        const history = this.memoryManager.getMessages(conversation.id, 20); // Janela do SQLite

        // 2. Tentar invocar Skill
        const selectedSkill = await this.skillRouter.determineSkill(message);
        let systemPrompt = "Você é GueClaw, o assistente local restrito do usuário (Sandeco). Fale estritamente em Português-BR.";
        
        if (selectedSkill) {
            console.log(`[Router] Skill identificada: ${selectedSkill.name}`);
            systemPrompt += `\n\nATENÇÃO: Você está sob influência do modo Skill: ${selectedSkill.name}.\nDIRETIVAS ADICIONAIS:\n${selectedSkill.content}`;
        }

        // 3. Submeter ao motor ReAct
        const finalAnswer = await this.agentLoop.run(
           history.map(m => ({ role: m.role, content: m.content })),
           systemPrompt
        );

        // 4. Salvar resposta
        this.memoryManager.saveMessage(conversation.id, 'assistant', finalAnswer);

        // 5. Responder
        await this.outputHandler.sendResponse(ctx, finalAnswer);

    } catch (err: any) {
        console.error('[AgentController] Error Handler:', err);
        await this.outputHandler.sendResponse(ctx, "Desculpe, ocorreu uma exceção no Motor Core: " + err.message);
    }
  }
}
