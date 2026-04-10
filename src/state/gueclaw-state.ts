/**
 * GueClaw State - In-Memory State Management (dvace-style)
 * 
 * Migrado do TaskTracker database-based para in-memory state.
 * Tasks não precisam persistir entre restarts (agent conversacional).
 * 
 * Baseado em: tmp/dvace/src/bootstrap/state.ts
 * Resolve: Phase 4 Database UPDATE Bug (PHASE-4-DATABASE-ISSUE.md)
 */

import { AgentTask, TaskStatus, PhaseStatus } from '../core/task-tracker';

/**
 * Estado global da aplicação GueClaw
 */
export interface GueclawState {
  /**
   * Tasks ativas indexadas por ID
   * Map permite lookups O(1) e é mais performático que array
   */
  tasks: Map<string, AgentTask>;

  /**
   * Metadados de sessões ativas
   * Usado para rastrear conversas do Telegram
   */
  sessions: Map<string, SessionInfo>;

  /**
   * Contadores gerais
   */
  counters: {
    totalTasksCreated: number;
    totalToolExecutions: number;
    totalPhasesCompleted: number;
  };

  /**
   * Flags de estado temporário
   * Session-only (não persistem)
   */
  flags: {
    isMaintenanceMode: boolean;
    debugMode: boolean;
  };
}

/**
 * Informação de sessão do Telegram
 */
export interface SessionInfo {
  conversationId: string;
  userId: number;
  username?: string;
  createdAt: number;
  lastActivity: number;
}

/**
 * Gerenciador de estado in-memory (Singleton)
 */
export class StateManager {
  private static instance: StateManager;
  private state: GueclawState;

  private constructor() {
    this.state = this.createInitialState();
  }

  /**
   * Obter instância singleton
   */
  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Criar estado inicial limpo
   */
  private createInitialState(): GueclawState {
    return {
      tasks: new Map<string, AgentTask>(),
      sessions: new Map<string, SessionInfo>(),
      counters: {
        totalTasksCreated: 0,
        totalToolExecutions: 0,
        totalPhasesCompleted: 0,
      },
      flags: {
        isMaintenanceMode: false,
        debugMode: false,
      },
    };
  }

  /**
   * Reset state para testes (dvace-style)
   * CRÍTICO: Usado em beforeEach() dos testes
   */
  public reset(): void {
    console.log(`🔄 StateManager.reset(): Clearing ${this.state.tasks.size} tasks`);
    this.state = this.createInitialState();
  }

  /**
   * Obter estado completo (read-only)
   */
  public getState(): Readonly<GueclawState> {
    return this.state;
  }

  // ==================== TASK OPERATIONS ====================

  /**
   * Adiciona task ao state
   */
  public setTask(task: AgentTask): void {
    this.state.tasks.set(task.id, task);
    this.state.counters.totalTasksCreated++;
    console.log(`📋 Task added to state: ${task.id} (total: ${this.state.tasks.size})`);
  }

  /**
   * Busca task por ID
   */
  public getTask(taskId: string): AgentTask | undefined {
    return this.state.tasks.get(taskId);
  }

  /**
   * Atualiza task existente
   */
  public updateTask(taskId: string, updates: Partial<AgentTask>): void {
    const task = this.state.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in state`);
    }

    Object.assign(task, updates, { updated_at: Date.now() });
    console.log(`📝 Task updated in state: ${taskId}`);
  }

  /**
   * Remove task do state
   */
  public deleteTask(taskId: string): boolean {
    const deleted = this.state.tasks.delete(taskId);
    if (deleted) {
      console.log(`🗑️ Task deleted from state: ${taskId}`);
    }
    return deleted;
  }

  /**
   * Busca tasks por conversation ID
   */
  public getTasksByConversationId(conversationId: string): AgentTask[] {
    const tasks: AgentTask[] = [];
    for (const task of this.state.tasks.values()) {
      if (task.conversation_id === conversationId) {
        tasks.push(task);
      }
    }
    return tasks.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Busca tasks pendentes ou em progresso
   */
  public getPendingTasks(conversationId?: string): AgentTask[] {
    const tasks: AgentTask[] = [];
    for (const task of this.state.tasks.values()) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        if (!conversationId || task.conversation_id === conversationId) {
          tasks.push(task);
        }
      }
    }
    return tasks.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Verifica se há tasks incompletas
   */
  public hasIncompleteTasks(conversationId: string): boolean {
    return this.getPendingTasks(conversationId).length > 0;
  }

  /**
   * Lista todas as tasks (para debug)
   */
  public getAllTasks(): AgentTask[] {
    return Array.from(this.state.tasks.values());
  }

  /**
   * Conta total de tasks
   */
  public getTaskCount(): number {
    return this.state.tasks.size;
  }

  /**
   * Incrementa contador de tool executions
   */
  public incrementToolExecutions(): void {
    this.state.counters.totalToolExecutions++;
  }

  /**
   * Incrementa contador de phases completadas
   */
  public incrementPhasesCompleted(): void {
    this.state.counters.totalPhasesCompleted++;
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Adiciona ou atualiza sessão
   */
  public setSession(session: SessionInfo): void {
    this.state.sessions.set(session.conversationId, session);
  }

  /**
   * Busca sessão por conversation ID
   */
  public getSession(conversationId: string): SessionInfo | undefined {
    return this.state.sessions.get(conversationId);
  }

  /**
   * Remove sessão
   */
  public deleteSession(conversationId: string): boolean {
    return this.state.sessions.delete(conversationId);
  }

  /**
   * Atualiza última atividade da sessão
   */
  public touchSession(conversationId: string): void {
    const session = this.state.sessions.get(conversationId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  // ==================== FLAGS OPERATIONS ====================

  /**
   * Define flag de manutenção
   */
  public setMaintenanceMode(enabled: boolean): void {
    this.state.flags.isMaintenanceMode = enabled;
    console.log(`🚧 Maintenance mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Verifica se está em modo manutenção
   */
  public isMaintenanceMode(): boolean {
    return this.state.flags.isMaintenanceMode;
  }

  /**
   * Define flag de debug
   */
  public setDebugMode(enabled: boolean): void {
    this.state.flags.debugMode = enabled;
    console.log(`🐛 Debug mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Verifica se está em modo debug
   */
  public isDebugMode(): boolean {
    return this.state.flags.debugMode;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Obtém estatísticas gerais
   */
  public getStats(): {
    totalTasks: number;
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    killedTasks: number;
    totalToolExecutions: number;
    totalPhasesCompleted: number;
  } {
    const tasks = Array.from(this.state.tasks.values());
    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      killedTasks: tasks.filter(t => t.status === 'killed').length,
      totalToolExecutions: this.state.counters.totalToolExecutions,
      totalPhasesCompleted: this.state.counters.totalPhasesCompleted,
    };
  }

  /**
   * Limpa tasks antigas (completed/failed/killed) com mais de X horas
   */
  public cleanupOldTasks(maxAgeHours: number = 24): number {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.state.tasks.entries()) {
      const isOld = (now - task.updated_at) > maxAgeMs;
      const isTerminal = task.status === 'completed' || task.status === 'failed' || task.status === 'killed';
      
      if (isOld && isTerminal) {
        this.state.tasks.delete(taskId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} old tasks (older than ${maxAgeHours}h)`);
    }

    return cleaned;
  }
}

/**
 * Função helper para obter state manager (convenience)
 */
export function getState(): StateManager {
  return StateManager.getInstance();
}

/**
 * Função helper para reset state (usado em testes)
 */
export function resetStateForTests(): void {
  StateManager.getInstance().reset();
}
