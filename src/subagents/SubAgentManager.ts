import * as crypto from 'crypto';
import { MemoryManager, SubAgent, SubAgentRun } from '../memory/MemoryManager';
import { AgentLoop } from '../engine/AgentLoop';
import { ToolRegistry } from '../engine/ToolRegistry';
import { DOELoader } from '../core/DOELoader';
import { SubAgentConfig, SubAgentRunResult } from './SubAgent';
import { PythonExecutorTool } from '../tools/PythonExecutorTool';
import { LocalShellTool } from '../tools/LocalShellTool';

/**
 * SubAgentManager — Layer 2 (Orchestration) do framework DOE.
 *
 * Responsável por criar, despachar e monitorar sub-agentes.
 * Cada sub-agente roda com um AgentLoop isolado e registra
 * tudo no SQLite via MemoryManager.
 */
export class SubAgentManager {
  private memoryManager: MemoryManager;

  constructor(memoryManager: MemoryManager) {
    this.memoryManager = memoryManager;
  }

  /**
   * Cria e dispara um sub-agente de forma assíncrona (fire-and-forget).
   * Retorna imediatamente com o ID do sub-agente criado.
   */
  public spawn(config: SubAgentConfig): string {
    const agentId = config.id || crypto.randomUUID();

    // Registra o sub-agente no banco
    this.memoryManager.createSubAgent(agentId, config.name, config.createdBy);
    this.memoryManager.updateSubAgentStatus(agentId, 'running');

    console.log(`[SubAgentManager] Spawning sub-agente "${config.name}" (${agentId})`);

    // Executa de forma assíncrona sem bloquear
    this._execute(agentId, config).catch(err => {
      console.error(`[SubAgentManager] Falha crítica no sub-agente ${agentId}:`, err);
    });

    return agentId;
  }

  /**
   * Execução interna do sub-agente — corre em background.
   */
  private async _execute(agentId: string, config: SubAgentConfig): Promise<void> {
    const runId = this.memoryManager.createSubAgentRun(agentId, config.task);
    const startedAt = Date.now();

    try {
      const registry = this._buildRegistry();
      
      const cheapProvider = process.env.CHEAP_LLM_PROVIDER || process.env.DEFAULT_LLM_PROVIDER;
      const cheapModel = process.env.CHEAP_LLM_MODEL || 'google/gemini-2.5-flash';
      
      const loop = new AgentLoop(registry, { 
        providerName: cheapProvider, 
        modelOverride: cheapModel 
      });

      // System prompt: usa override ou o DOE padrão + Hard Rules
      const baseSystem = DOELoader.buildSystemPrompt();
      const enforceRules = `\n\n[REGRAS RÍGIDAS DO SUB-AGENTE]\nVocê está operando em background. Ao usar ferramentas que precisam de arquivos (como execute_python ou execute_shell_command):\n1. NUNCA invente caminhos como '/opt/gueclaw/execution/...'.\n2. Se pedirem para executar código de uma skill, você DEVE acessar o caminho exato relativo a ela: '.agents/skills/<nome-da-skill>/...'. Ex: '.agents/skills/advocacia-ce-scraper/scripts/pipeline_completo.py'.\n3. Jamais bloqueie numa Task; se falhar, retorne um aviso e dê por concluído.`;
      
      const systemPrompt = config.systemPromptOverride
        ? `${baseSystem}\n\n## Sub-Agente Override\n${config.systemPromptOverride}${enforceRules}`
        : `${baseSystem}${enforceRules}`;

      // Thread inicial: apenas a tarefa como "user"
      const history = [{ role: 'user', content: config.task }];

      const result = await loop.run(history, systemPrompt);
      const durationMs = Date.now() - startedAt;

      console.log(`[SubAgentManager] Sub-agente "${config.name}" concluído em ${durationMs}ms`);

      this.memoryManager.finishSubAgentRun(runId, 'completed', result);
      this.memoryManager.updateSubAgentStatus(agentId, 'completed');

    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      console.error(`[SubAgentManager] Sub-agente "${config.name}" falhou após ${durationMs}ms:`, err.message);

      this.memoryManager.finishSubAgentRun(runId, 'failed', undefined, err.message);
      this.memoryManager.updateSubAgentStatus(agentId, 'failed');
    }
  }

  /**
   * Retorna o status detalhado de um sub-agente.
   * Se agent_id for omitido, retorna todos.
   */
  public getStatus(agentId?: string): { agent: SubAgent | null; runs: SubAgentRun[] } | SubAgent[] {
    if (!agentId) {
      return this.memoryManager.getAllSubAgents();
    }

    const agent = this.memoryManager.getSubAgentById(agentId);
    const runs = agent ? this.memoryManager.getSubAgentRuns(agentId, 10) : [];
    return { agent, runs };
  }

  /**
   * Gera relatório Markdown detalhado dos runs.
   */
  public generateReport(agentId?: string, limit = 20): string {
    const agents = this.memoryManager.getAllSubAgents();
    const runs = agentId
      ? this.memoryManager.getSubAgentRuns(agentId, limit)
      : this.memoryManager.getAllRuns(limit);

    if (runs.length === 0) {
      return '📊 **Relatório de Sub-Agentes**\n\nNenhum run registrado ainda.';
    }

    const agentMap = new Map(agents.map(a => [a.id, a.name]));

    let report = `# 📊 Relatório de Sub-Agentes DOE\n`;
    report += `*Gerado em: ${new Date().toLocaleString('pt-BR')}*\n\n`;

    // Resumo executivo
    const total = runs.length;
    const completed = runs.filter(r => r.status === 'completed').length;
    const failed = runs.filter(r => r.status === 'failed').length;
    const running = runs.filter(r => r.status === 'running').length;

    report += `## Resumo\n`;
    report += `| Métrica | Valor |\n|---|---|\n`;
    report += `| Total de Runs | ${total} |\n`;
    report += `| ✅ Concluídos | ${completed} |\n`;
    report += `| ❌ Falhas | ${failed} |\n`;
    report += `| 🔄 Em execução | ${running} |\n`;
    report += `| Taxa de Sucesso | ${total > 0 ? ((completed / total) * 100).toFixed(1) : 0}% |\n\n`;

    // Tabela de runs
    report += `## Histórico de Execuções\n`;
    report += `| # | Sub-Agente | Tarefa | Status | Duração | Início |\n`;
    report += `|---|---|---|---|---|---|\n`;

    for (const run of runs) {
      const agentName = agentMap.get(run.sub_agent_id) ?? run.sub_agent_id.slice(0, 8) + '...';
      const taskShort = run.task.length > 40 ? run.task.slice(0, 40) + '...' : run.task;
      const statusEmoji = { completed: '✅', failed: '❌', running: '🔄', pending: '⏳' }[run.status] ?? '?';
      const duration = run.finished_at
        ? `${((run.finished_at - run.started_at) / 1000).toFixed(1)}s`
        : '—';
      const startedAt = new Date(run.started_at).toLocaleString('pt-BR');

      report += `| ${run.id} | ${agentName} | ${taskShort} | ${statusEmoji} ${run.status} | ${duration} | ${startedAt} |\n`;
    }

    // Detalhes de falhas
    const failures = runs.filter(r => r.status === 'failed' && r.error);
    if (failures.length > 0) {
      report += `\n## ❌ Detalhes das Falhas\n`;
      for (const fail of failures.slice(0, 5)) {
        const agentName = agentMap.get(fail.sub_agent_id) ?? fail.sub_agent_id;
        report += `\n**Run #${fail.id} — ${agentName}**\n`;
        report += `\`\`\`\n${fail.error}\n\`\`\`\n`;
      }
    }

    return report;
  }

  /**
   * Registry mínimo para sub-agentes: shell + python local.
   * Sub-agentes não herdam SSH por segurança.
   */
  private _buildRegistry(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(new PythonExecutorTool());
    registry.register(LocalShellTool);
    return registry;
  }
}
