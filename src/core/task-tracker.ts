/**
 * Task Tracker - Sistema de rastreamento de tarefas multi-fase
 * 
 * Garante que promessas do agente sejam cumpridas e rastreadas.
 * Previne falsos positivos de "success" sem execução real.
 */

import { DatabaseConnection } from './memory/database';
import { Database } from 'better-sqlite3';

export interface AgentTask {
  id: string;
  conversation_id: string;
  description: string;
  phases: TaskPhase[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
  metadata?: Record<string, any>;
}

export interface TaskPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool_executions: number;
  started_at?: number;
  completed_at?: number;
  error_message?: string;
}

export class TaskTracker {
  private db: Database;
  private static instance: TaskTracker;

  private constructor() {
    this.db = DatabaseConnection.getInstance();
    this.initializeTables();
  }

  public static getInstance(): TaskTracker {
    if (!TaskTracker.instance) {
      TaskTracker.instance = new TaskTracker();
    }
    return TaskTracker.instance;
  }

  /**
   * Cria tabelas de tarefas se não existirem
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        description TEXT NOT NULL,
        phases TEXT NOT NULL, -- JSON array
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT -- JSON
      );

      CREATE INDEX IF NOT EXISTS idx_agent_tasks_conversation 
        ON agent_tasks(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_status 
        ON agent_tasks(status);
    `);
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

    const stmt = this.db.prepare(`
      INSERT INTO agent_tasks (id, conversation_id, description, phases, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.conversation_id,
      task.description,
      JSON.stringify(task.phases),
      task.status,
      task.created_at,
      task.updated_at
    );

    console.log(`📋 Task created: ${task.id} (${phases.length} phases)`);
    return task;
  }

  /**
   * Atualiza status de uma fase
   */
  public updatePhaseStatus(
    taskId: string,
    phaseId: string,
    status: TaskPhase['status'],
    toolExecutions?: number,
    errorMessage?: string
  ): void {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const phase = task.phases.find(p => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase ${phaseId} not found in task ${taskId}`);
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

    const stmt = this.db.prepare(`
      UPDATE agent_tasks 
      SET phases = ?, status = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(task.phases), task.status, task.updated_at, task.id);

    console.log(`📝 Phase updated: ${phaseId} → ${status} (${toolExecutions || 0} tools)`);
  }

  /**
   * Busca tarefas pendentes ou em progresso
   */
  public getPendingTasks(conversationId?: string): AgentTask[] {
    let query = `
      SELECT * FROM agent_tasks 
      WHERE status IN ('pending', 'in_progress')
    `;
    const params: any[] = [];

    if (conversationId) {
      query += ` AND conversation_id = ?`;
      params.push(conversationId);
    }

    query += ` ORDER BY created_at DESC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.deserializeTask(row));
  }

  /**
   * Busca uma tarefa específica
   */
  public getTask(taskId: string): AgentTask | null {
    const stmt = this.db.prepare(`SELECT * FROM agent_tasks WHERE id = ?`);
    const row = stmt.get(taskId) as any;
    return row ? this.deserializeTask(row) : null;
  }

  /**
   * Verifica se há tarefas não concluídas
   */
  public hasIncompleteTasks(conversationId: string): boolean {
    const tasks = this.getPendingTasks(conversationId);
    return tasks.length > 0;
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
   * Deserializa registro do banco
   */
  private deserializeTask(row: any): AgentTask {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      description: row.description,
      phases: JSON.parse(row.phases),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
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
