/**
 * Task Tracker - Sistema de rastreamento de tarefas multi-fase
 * 
 * Garante que promessas do agente sejam cumpridas e rastreadas.
 * Previne falsos positivos de "success" sem execução real.
 * 
 * MIGRADO PARA IN-MEMORY STATE (Phase 4 - Opção A)
 * Resolve: Database UPDATE Bug (PHASE-4-DATABASE-ISSUE.md)
 * Baseado em: dvace architecture (tmp/dvace)
 */

import { StateManager } from '../state/gueclaw-state';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';

export interface AgentTask {
  id: string;
  conversation_id: string;
  description: string;
  phases: TaskPhase[];
  status: TaskStatus;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, any>;
}

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';

export interface TaskPhase {
  id: string;
  name: string;
  description: string;
  status: PhaseStatus;
  tool_executions: number;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

/**
 * Verifica se um status é terminal (não pode ser alterado)
 */
export function isTerminalTaskStatus(status: TaskStatus | PhaseStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed';
}

export class TaskTracker {
  private stateManager: StateManager;
  private static instance: TaskTracker;

  private constructor() {
    this.stateManager = StateManager.getInstance();
  }

  public static getInstance(): TaskTracker {
    if (!TaskTracker.instance) {
      TaskTracker.instance = new TaskTracker();
    }
    return TaskTracker.instance;
  }

  /**
   * Reset singleton instance (for testing) (DVACE Phase 4.5)
   * Migrado para state reset (in-memory)
   */
  public static reset(): void {
    if (TaskTracker.instance) {
      const count = TaskTracker.instance.stateManager.getTaskCount();
      console.log(`🔄 Reset: Clearing ${count} tasks from state`);
      TaskTracker.instance.stateManager.reset();
    }
    TaskTracker.instance = null as any;
  }

  /**
   * Cria uma nova tarefa multi-fase
   */
  public createTask(
    conversationId: string,
    description: string,
    phases: Omit<TaskPhase, 'id' | 'status' | 'tool_executions'>[]
  ): AgentTask {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    const taskPhases: TaskPhase[] = phases.map((p, idx) => ({
      id: `${taskId}_phase_${idx + 1}`,
      name: p.name,
      description: p.description,
      status: 'pending',
      tool_executions: 0,
    }));

    const task: AgentTask = {
      id: taskId,
      conversation_id: conversationId,
      description,
      phases: taskPhases,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };

    // Salvar no state in-memory
    this.stateManager.setTask(task);

    console.log(`📋 Task created: ${task.id} (${phases.length} phases)`);
    return task;
  }

  /**
   * Atualiza status de uma fase
   */
  public updatePhaseStatus(
    taskId: string,
    phaseId: string,
    status: PhaseStatus,
    toolExecutions?: number,
    errorMessage?: string
  ): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Não permitir atualização se task está em estado terminal
    if (isTerminalTaskStatus(task.status)) {
      console.warn(`⚠️ Cannot update task ${taskId} - already in terminal state: ${task.status}`);
      return;
    }

    const phase = task.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found in task ${taskId}`);
    }

    // Não permitir atualização se phase está em estado terminal
    if (isTerminalTaskStatus(phase.status)) {
      console.warn(`⚠️ Cannot update phase ${phaseId} - already in terminal state: ${phase.status}`);
      return;
    }

    phase.status = status;
    if (toolExecutions !== undefined) {
      phase.tool_executions = toolExecutions;
    }
    if (errorMessage) {
      phase.error_message = errorMessage;
    }

    if (status === 'in_progress' && !phase.started_at) {
      phase.started_at = Date.now();
    }
    if (status === 'completed' || status === 'failed') {
      phase.completed_at = Date.now();
    }

    // Atualizar status da task se todas as fases estiverem completas
    const allCompleted = task.phases.every(p => p.status === 'completed');
    const anyFailed = task.phases.some(p => p.status === 'failed');

    if (allCompleted) {
      task.status = 'completed';
    } else if (anyFailed) {
      task.status = 'failed';
    } else if (status === 'in_progress') {
      task.status = 'in_progress';
    }

    task.updated_at = Date.now();

    // Atualizar in-memory state - RESOLVE UPDATE BUG!
    this.stateManager.updateTask(taskId, {
      phases: task.phases,
      status: task.status,
      updated_at: task.updated_at
    });

    console.log(`📝 Phase updated: ${phaseId} → ${status} (${toolExecutions || 0} tools)`);
  }

  /**
   * Busca tarefas pendentes ou em progresso
   */
  public getPendingTasks(conversationId?: string): AgentTask[] {
    return this.stateManager.getPendingTasks(conversationId);
  }

  /**
   * Busca uma tarefa específica
   */
  public getTask(taskId: string): AgentTask | null {
    return this.stateManager.getTask(taskId) || null;
  }

  /**
   * Busca todas as tarefas de uma conversa (DVACE Phase 4.3)
   */
  public getTasksByConversationId(conversationId: string): AgentTask[] {
    return this.stateManager.getTasksByConversationId(conversationId);
  }

  /**
   * Verifica se há tarefas não concluídas
   */
  public hasIncompleteTasks(conversationId: string): boolean {
    return this.stateManager.hasIncompleteTasks(conversationId);
  }

  /**
   * Gera resumo de tarefas para exibição
   */
  public getTaskSummary(taskId: string): string {
    const task = this.getTask(taskId);
    if (!task) return 'Tarefa não encontrada';

    const statusEmoji = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌',
      killed: '🛑',
    };

    let summary = `${statusEmoji[task.status]} **${task.description}**\n\n`;
    
    task.phases.forEach((phase, idx) => {
      const phaseEmoji = statusEmoji[phase.status];
      const progress = phase.tool_executions > 0 ? ` (${phase.tool_executions} ações)` : '';
      summary += `${idx + 1}. ${phaseEmoji} ${phase.name}${progress}\n`;
      if (phase.error_message) {
        summary += `   ⚠️ ${phase.error_message}\n`;
      }
    });

    return summary;
  }

  /**
   * Incrementa contador de execuções de tools em uma fase (DVACE Phase 4.2)
   */
  public incrementToolExecutions(taskId: string, phaseIndex: number): void {
    const task = this.getTask(taskId);
    if (!task) {
      console.warn(`⚠️ Task ${taskId} not found - cannot increment tool executions`);
      return;
    }

    if (phaseIndex < 0 || phaseIndex >= task.phases.length) {
      console.warn(`⚠️ Invalid phase index ${phaseIndex} for task ${taskId}`);
      return;
    }

    const phase = task.phases[phaseIndex];
    
    // Não incrementar se phase está em estado terminal
    if (isTerminalTaskStatus(phase.status)) {
      return;
    }

    phase.tool_executions++;
    task.updated_at = Date.now();

    // Atualizar in-memory state - RESOLVE UPDATE BUG!
    this.stateManager.updateTask(task.id, {
      phases: task.phases,
      updated_at: task.updated_at
    });

    // Incrementar contador global
    this.stateManager.incrementToolExecutions();

    console.log(`📊 Tool execution incremented: ${phase.name} → ${phase.tool_executions} tools`);
  }

  /**
   * Valida se uma fase pode ser marcada como completa (DVACE Phase 4.2)
   * Fase só completa se tool_executions > 0 (para fases de execução)
   */
  public validatePhaseCompletion(phase: TaskPhase, phaseType: 'execution' | 'planning' = 'execution'): boolean {
    // Fases de planning podem completar sem tool executions
    if (phaseType === 'planning') {
      return true;
    }

    // Fases de execução DEVEM ter tool_executions > 0
    if (phaseType === 'execution' && phase.tool_executions === 0) {
      console.warn(`⚠️ Phase "${phase.name}" cannot complete - no tool executions detected (DVACE validation)`);
      return false;
    }

    return true;
  }

  /**
   * Atualiza status da task completa (usado para /kill command) (DVACE Phase 4.4)
   */
  public updateTaskStatus(taskId: string, status: TaskStatus, errorMessage?: string): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Não permitir atualização se já está em estado terminal
    if (isTerminalTaskStatus(task.status)) {
      console.warn(`⚠️ Cannot update task ${taskId} - already in terminal state: ${task.status}`);
      return;
    }

    task.status = status;
    task.updated_at = Date.now();

    // Se killer, marcar todas as phases como killed também
    if (status === 'killed') {
      task.phases.forEach(phase => {
        if (!isTerminalTaskStatus(phase.status)) {
          phase.status = 'killed';
          phase.completed_at = Date.now();
          if (errorMessage) {
            phase.error_message = errorMessage;
          }
        }
      });
    }

    // Atualizar in-memory state - RESOLVE UPDATE BUG!
    this.stateManager.updateTask(task.id, {
      phases: task.phases,
      status: task.status,
      updated_at: task.updated_at
    });

    console.log(`🛑 Task status updated: ${taskId} → ${status}`);
  }

  /**
   * Formata lista de tarefas para /tasks command
   */
  public formatTaskList(tasks: AgentTask[]): string {
    if (tasks.length === 0) {
      return '✅ Nenhuma tarefa pendente!';
    }

    let output = `📋 **Tarefas Ativas** (${tasks.length})\n\n`;
    
    tasks.forEach((task, idx) => {
      const completedPhases = task.phases.filter(p => p.status === 'completed').length;
      const totalPhases = task.phases.length;
      const progress = Math.round((completedPhases / totalPhases) * 100);

      output += `${idx + 1}. ${task.description}\n`;
      output += `   Progresso: ${progress}% (${completedPhases}/${totalPhases} fases)\n`;
      output += `   ID: \`${task.id}\`\n\n`;
    });

    output += `\nUse /task <ID> para ver detalhes`;
    return output;
  }

  /**
   * Detecta se uma mensagem contém promessa de múltiplas fases
   */
  public static detectMultiPhasePromise(thought: string): {
    detected: boolean;
    phases: Array<{ name: string; description: string }>;
  } {
    // Padrões de detecção
    const phasePatterns = [
      /FASE\s+(\d+)[:\s]+(.+?)(?=FASE\s+\d+|$)/gis,
      /Passo\s+(\d+)[:\s]+(.+?)(?=Passo\s+\d+|$)/gis,
      /Etapa\s+(\d+)[:\s]+(.+?)(?=Etapa\s+\d+|$)/gis,
      /(\d+)\.\s+(.+?)(?=\n\d+\.|$)/gis,
    ];

    for (const pattern of phasePatterns) {
      const matches = Array.from(thought.matchAll(pattern));
      if (matches.length >= 2) {
        const phases = matches.map(m => ({
          name: `Fase ${m[1]}`,
          description: m[2].trim().split('\n')[0].slice(0, 100),
        }));

        return { detected: true, phases };
      }
    }

    // Palavras de ação que indicam promessa de execução
    const actionWords = [
      /vou criar/i,
      /vou implementar/i,
      /farei/i,
      /executarei/i,
      /iniciar\w* (fase|etapa|passo)/i,
    ];

    const hasActionPromise = actionWords.some(word => word.test(thought));
    
    if (hasActionPromise && thought.split('\n').length > 10) {
      // Promessa genérica detectada mas sem fases claras
      return {
        detected: true,
        phases: [{ name: 'Execução', description: 'Tarefa prometida' }],
      };
    }

    return { detected: false, phases: [] };
  }
}
