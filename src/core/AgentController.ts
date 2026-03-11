import { Context } from 'grammy';
import { TelegramOutputHandler } from './TelegramOutputHandler';
import { MemoryManager } from '../memory/MemoryManager';
import { AgentLoop } from '../engine/AgentLoop';
import { ToolRegistry } from '../engine/ToolRegistry';
import { SkillRouter } from '../skills/SkillRouter';
import { PythonExecutorTool } from '../tools/PythonExecutorTool';
import { SshExecutorTool } from '../tools/SshExecutorTool';
import { LocalShellTool } from '../tools/LocalShellTool';
import { SendFileTool } from '../tools/SendFileTool';
import { DOELoader } from './DOELoader';
import { SubAgentManager } from '../subagents/SubAgentManager';
import { createSpawnSubAgentTool } from '../tools/SpawnSubAgentTool';
import { createSubAgentStatusTool } from '../tools/SubAgentStatusTool';
import { createSubAgentReportTool } from '../tools/SubAgentReportTool';

export class AgentController {
  private outputHandler: TelegramOutputHandler;
  private memoryManager: MemoryManager;
  private skillRouter: SkillRouter;
  private agentLoop: AgentLoop;
  private defaultRegistry: ToolRegistry;
  private subAgentManager: SubAgentManager;

  constructor() {
    this.outputHandler = new TelegramOutputHandler();
    this.memoryManager = new MemoryManager();
    this.skillRouter = new SkillRouter();
    this.subAgentManager = new SubAgentManager(this.memoryManager);
    
    
    this.defaultRegistry = new ToolRegistry();
    this.defaultRegistry.register(new PythonExecutorTool());
    this.defaultRegistry.register(LocalShellTool);
    this.defaultRegistry.register(SendFileTool);
    if (process.env.VPS_HOST) {
      this.defaultRegistry.register(SshExecutorTool);
      console.log(`[AgentController] SSH Tool ativa -> ${process.env.VPS_USER}@${process.env.VPS_HOST}`);
    }

    // ─── Sub-Agent Tools (DOE Layer 3) ───
    // createdBy placeholder: substituído dinamicamente no handleInput
    this.defaultRegistry.register(createSpawnSubAgentTool(this.subAgentManager, 'system'));
    this.defaultRegistry.register(createSubAgentStatusTool(this.subAgentManager));
    this.defaultRegistry.register(createSubAgentReportTool(this.subAgentManager));
    console.log('[AgentController] Sub-Agent tools registradas: spawn_sub_agent, get_sub_agent_status, generate_sub_agent_report');
    
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

    // CRÍTICO: Invalida cache do DOE para garantir que mudanças sejam carregadas
    DOELoader.invalidateCache();

    try {
      const providerName = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
      const conversation = this.memoryManager.getOrCreateConversation(userId, providerName);
      this.memoryManager.saveMessage(conversation.id, 'user', message);
      
      // Janela de 12 mensagens + sanitização contra dados corrompidos
      const rawHistory = this.memoryManager.getMessages(conversation.id, 12);
      const history = this.sanitizeHistory(rawHistory.map(m => ({ role: m.role, content: m.content })));

      const selectedSkill = await this.skillRouter.determineSkill(message);
      // System Prompt base vem do DOELoader (lê os arquivos DOE/ em runtime)
      let systemPrompt = DOELoader.buildSystemPrompt();
      
      if (selectedSkill) {
        console.log(`[Router] Skill: ${selectedSkill.name}`);
        systemPrompt += `\n\nATENÇÃO — Skill ativa: ${selectedSkill.name}\n${selectedSkill.content}`;
      }

      const finalAnswer = await this.agentLoop.run(history, systemPrompt);

      this.memoryManager.saveMessage(conversation.id, 'assistant', finalAnswer);
      
      // Interceptação nativa de envio de documentos
      if (finalAnswer.includes('[INTERNAL_ACTION:SEND_DOCUMENT]')) {
        const matches = finalAnswer.match(/\[INTERNAL_ACTION:SEND_DOCUMENT\]\s*(\{.*\})/);
        if (matches && matches[1]) {
          try {
            const data = JSON.parse(matches[1]);
            // Remove a tag interna da resposta pro usuário
            const cleanText = finalAnswer.replace(matches[0], '').trim();
            if (cleanText) {
              await this.outputHandler.sendResponse(ctx, cleanText);
            }
            // Envia o arquivo de fato
            await this.outputHandler.sendDocument(ctx, data.file_path, data.caption);
            return;
          } catch (e) {
            console.error('[AgentController] Erro no parsing de documento enviado pelo Agent:', e);
          }
        }
      }

      await this.outputHandler.sendResponse(ctx, finalAnswer);

    } catch (err: any) {
      console.error('[AgentController] Error:', err);
      await this.outputHandler.sendResponse(ctx, "Desculpe, ocorreu uma exceção: " + err.message);
    }
  }
}
