import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../types';

/**
 * Estrutura de uma tarefa interrompida
 */
export interface InterruptedTask {
  taskId: string;
  userId: string;
  chatId: number;
  conversationId: string;
  errorType: 'MAX_ITERATIONS' | 'UNEXPECTED_ERROR' | 'TOOL_ERROR';
  errorMessage: string;
  timestamp: string;
  conversationHistory: Message[];
  attemptedTools?: string;
  metadata?: Record<string, any>;
  retryCount: number;
}

/**
 * Error Recovery Manager
 * Gerencia o estado de tarefas interrompidas e permite retomá-las
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private storageDir: string;
  private tasksFile: string;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly TASK_EXPIRY_HOURS = 24;

  private constructor() {
    this.storageDir = path.join(process.cwd(), 'data', 'recovery');
    this.tasksFile = path.join(this.storageDir, 'interrupted-tasks.json');
    this.ensureStorageExists();
  }

  public static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  /**
   * Garante que o diretório de armazenamento existe
   */
  private ensureStorageExists(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.tasksFile)) {
      fs.writeFileSync(this.tasksFile, JSON.stringify({}), 'utf-8');
    }
  }

  /**
   * Salva uma tarefa interrompida
   */
  public saveInterruptedTask(task: Omit<InterruptedTask, 'taskId' | 'timestamp' | 'retryCount'>): string {
    const taskId = this.generateTaskId(task.userId, task.chatId);
    const timestamp = new Date().toISOString();
    
    const existingTask = this.getTask(taskId);
    const retryCount = existingTask ? existingTask.retryCount + 1 : 0;

    const fullTask: InterruptedTask = {
      ...task,
      taskId,
      timestamp,
      retryCount,
    };

    const tasks = this.loadTasks();
    tasks[taskId] = fullTask;
    this.saveTasks(tasks);

    console.log(`💾 Saved interrupted task: ${taskId} (retry: ${retryCount}/${this.MAX_RETRY_COUNT})`);
    return taskId;
  }

  /**
   * Recupera uma tarefa interrompida
   */
  public getTask(taskId: string): InterruptedTask | null {
    const tasks = this.loadTasks();
    const task = tasks[taskId];

    if (!task) {
      return null;
    }

    // Verifica se a tarefa expirou
    const taskDate = new Date(task.timestamp);
    const now = new Date();
    const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > this.TASK_EXPIRY_HOURS) {
      console.log(`⏱️ Task ${taskId} expired (${hoursDiff.toFixed(1)}h old)`);
      this.deleteTask(taskId);
      return null;
    }

    return task;
  }

  /**
   * Recupera a última tarefa interrompida de um usuário
   */
  public getLastTaskByUser(userId: string, chatId: number): InterruptedTask | null {
    const tasks = this.loadTasks();
    const userTasks = Object.values(tasks).filter(
      (task: any) => task.userId === userId && task.chatId === chatId
    );

    if (userTasks.length === 0) {
      return null;
    }

    // Retorna a mais recente
    return userTasks.reduce((latest: any, current: any) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });
  }

  /**
   * Remove uma tarefa do armazenamento
   */
  public deleteTask(taskId: string): void {
    const tasks = this.loadTasks();
    delete tasks[taskId];
    this.saveTasks(tasks);
    console.log(`🗑️ Deleted task: ${taskId}`);
  }

  /**
   * Verifica se uma tarefa pode ser retomada
   */
  public canRetry(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task) {
      return false;
    }
    return task.retryCount < this.MAX_RETRY_COUNT;
  }

  /**
   * Lista todas as tarefas interrompidas de um usuário
   */
  public getUserTasks(userId: string): InterruptedTask[] {
    const tasks = this.loadTasks();
    return Object.values(tasks)
      .filter((task: any) => task.userId === userId)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Limpa tarefas expiradas
   */
  public cleanupExpiredTasks(): number {
    const tasks = this.loadTasks();
    const now = new Date();
    let cleaned = 0;

    Object.keys(tasks).forEach(taskId => {
      const task = tasks[taskId];
      const taskDate = new Date(task.timestamp);
      const hoursDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > this.TASK_EXPIRY_HOURS) {
        delete tasks[taskId];
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.saveTasks(tasks);
      console.log(`🧹 Cleaned ${cleaned} expired recovery tasks`);
    }

    return cleaned;
  }

  /**
   * Gera um ID único para a tarefa
   */
  private generateTaskId(userId: string, chatId: number): string {
    const timestamp = Date.now();
    return `recovery_${userId}_${chatId}_${timestamp}`;
  }

  /**
   * Carrega todas as tarefas do arquivo
   */
  private loadTasks(): Record<string, InterruptedTask> {
    try {
      const content = fs.readFileSync(this.tasksFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ Error loading interrupted tasks:', error);
      return {};
    }
  }

  /**
   * Salva todas as tarefas no arquivo
   */
  private saveTasks(tasks: Record<string, InterruptedTask>): void {
    try {
      fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ Error saving interrupted tasks:', error);
    }
  }

  /**
   * Obtém estatísticas das tarefas interrompidas
   */
  public getStats(): { total: number; byType: Record<string, number>; avgRetries: number } {
    const tasks = Object.values(this.loadTasks());
    const byType: Record<string, number> = {};
    let totalRetries = 0;

    tasks.forEach((task: any) => {
      byType[task.errorType] = (byType[task.errorType] || 0) + 1;
      totalRetries += task.retryCount;
    });

    return {
      total: tasks.length,
      byType,
      avgRetries: tasks.length > 0 ? totalRetries / tasks.length : 0,
    };
  }
}
