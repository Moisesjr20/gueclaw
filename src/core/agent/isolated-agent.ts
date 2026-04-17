import { ILLMProvider } from '../providers/base-provider';
import { AgentLoop } from '../agent-loop/agent-loop';
import { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Isolated Agent Result
 */
export interface IsolatedAgentResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  taskId: string;
  toolCalls?: number;
  iterations?: number;
}

/**
 * Isolated Agent Configuration
 */
export interface IsolatedAgentConfig {
  task: string;
  provider: ILLMProvider;
  timeout?: number; // milliseconds (default: 60000)
  context?: string; // Optional context for the task
  workspacePath?: string; // Optional workspace path
  allowedTools?: string[]; // Tool permission patterns
  maxIterations?: number; // Override default max iterations
}

/**
 * Blocked Tools for Subagents
 * These tools are not available to subagents for safety and isolation
 */
export const DELEGATE_BLOCKED_TOOLS = [
  'delegate_task',           // Prevent recursion
  'clarify',                 // Subagents can't interact with user
  'MemoryWrite',             // Prevent writing to shared MEMORY.md
  'send_message',            // Prevent side effects
  'CronTool',                // Prevent cron job creation
  'execute_code',            // Optional: prevent code execution for security
];

/**
 * Isolated Agent - Runs tasks in isolation
 * 
 * Key characteristics:
 * - Fresh context (no parent history)
 * - Own task_id for isolation
 * - Restricted toolsets (no delegate, clarify, memory write)
 * - Timeout handling
 * - Error isolation (doesn't propagate to parent)
 * - Result serialization
 * 
 * Use cases:
 * - Parallel task execution
 * - Isolated research/analysis
 * - Multi-step workflows with independent subtasks
 */
export class IsolatedAgent {
  private config: Required<IsolatedAgentConfig>;
  private taskId: string;
  private startTime: number;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(config: IsolatedAgentConfig) {
    this.config = {
      task: config.task,
      provider: config.provider,
      timeout: config.timeout || 60000, // 60s default
      context: config.context || '',
      workspacePath: config.workspacePath || process.cwd(),
      allowedTools: config.allowedTools || ['*'],
      maxIterations: config.maxIterations || 15, // Lower than parent (30)
    };
    
    this.taskId = uuidv4();
    this.startTime = Date.now();
    
    console.log(`🔷 IsolatedAgent created | Task ID: ${this.taskId.slice(0, 8)}`);
    console.log(`⏱️  Timeout: ${this.config.timeout}ms | Max Iterations: ${this.config.maxIterations}`);
  }

  /**
   * Run the isolated agent task
   * 
   * @returns Result with success status, output, and metadata
   */
  async run(): Promise<IsolatedAgentResult> {
    console.log(`\n🔷 Starting IsolatedAgent | Task: ${this.config.task.substring(0, 80)}...`);
    
    try {
      // Create timeout promise
      const timeoutPromise = this.createTimeoutPromise();
      
      // Create execution promise
      const executionPromise = this.execute();
      
      // Race between timeout and execution
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Clear timeout if execution finished first
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }
      
      const executionTime = Date.now() - this.startTime;
      console.log(`✅ IsolatedAgent completed | Time: ${executionTime}ms | Task ID: ${this.taskId.slice(0, 8)}`);
      
      return {
        ...result,
        executionTime,
        taskId: this.taskId,
      };
      
    } catch (error: any) {
      const executionTime = Date.now() - this.startTime;
      console.error(`❌ IsolatedAgent error | Task ID: ${this.taskId.slice(0, 8)}`, error);
      
      // Error isolation: return error as result, don't throw
      return {
        success: false,
        output: '',
        error: error.message || 'Unknown error',
        executionTime,
        taskId: this.taskId,
      };
    } finally {
      // Cleanup timeout
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
      }
    }
  }

  /**
   * Execute the task using AgentLoop
   */
  private async execute(): Promise<Omit<IsolatedAgentResult, 'executionTime' | 'taskId'>> {
    // Build system prompt for subagent
    const systemPrompt = this.buildSystemPrompt();
    
    // Strip blocked tools from allowed tools
    const filteredTools = this.stripBlockedTools(this.config.allowedTools);
    
    // Create fresh AgentLoop with no history
    const agentLoop = new AgentLoop(
      this.config.provider,
      [], // No conversation history (fresh context)
      systemPrompt,
      undefined, // No enrichment
      DELEGATE_BLOCKED_TOOLS, // Blocked tools
      this.taskId, // Use task ID as conversation ID
      filteredTools // Filtered allowed tools
    );
    
    // Override MAX_ITERATIONS environment variable temporarily
    const originalMaxIterations = process.env.MAX_ITERATIONS;
    process.env.MAX_ITERATIONS = this.config.maxIterations.toString();
    
    try {
      // Run the agent loop
      const output = await agentLoop.run(this.config.task);
      
      // Extract metadata from agent loop state (if available)
      const state = (agentLoop as any).state;
      const toolCalls = state?.totalToolExecutions || 0;
      const iterations = state?.turnCount || 0;
      
      return {
        success: true,
        output,
        toolCalls,
        iterations,
      };
      
    } finally {
      // Restore original MAX_ITERATIONS
      if (originalMaxIterations) {
        process.env.MAX_ITERATIONS = originalMaxIterations;
      } else {
        delete process.env.MAX_ITERATIONS;
      }
    }
  }

  /**
   * Build system prompt for subagent
   */
  private buildSystemPrompt(): string {
    let prompt = `You are an isolated subagent working on a specific task delegated to you.

**Your Task:**
${this.config.task}

**Important Guidelines:**
- Focus ONLY on completing the delegated task
- Do NOT assume file paths (e.g., /workspace/...) - use tools to discover
- Provide a concise summary of your findings/results at the end
- If you encounter an error, explain it clearly
- Work independently - you cannot ask questions to the user`;

    if (this.config.context) {
      prompt += `\n\n**Context:**\n${this.config.context}`;
    }

    if (this.config.workspacePath) {
      prompt += `\n\n**Workspace:** ${this.config.workspacePath}`;
    }

    prompt += `\n\n**Restrictions:**
- You cannot delegate tasks to other subagents
- You cannot interact with the user (no clarify/send_message)
- You cannot write to shared memory
- Focus on completing your specific task efficiently`;

    return prompt;
  }

  /**
   * Strip blocked tools from allowed tools list
   */
  private stripBlockedTools(allowedTools: string[]): string[] {
    // If wildcard, return all except blocked
    if (allowedTools.includes('*')) {
      return [`!${DELEGATE_BLOCKED_TOOLS.join(',!')}`];
    }

    // Filter out any patterns that match blocked tools
    return allowedTools.filter(pattern => {
      const toolName = pattern.split('(')[0];
      return !DELEGATE_BLOCKED_TOOLS.includes(toolName);
    });
  }

  /**
   * Create timeout promise that rejects after configured timeout
   */
  private createTimeoutPromise(): Promise<IsolatedAgentResult> {
    return new Promise((_, reject) => {
      this.timeoutHandle = setTimeout(() => {
        reject(new Error(`Task timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  /**
   * Get task ID
   */
  getTaskId(): string {
    return this.taskId;
  }

  /**
   * Get elapsed time
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Utility: Run multiple isolated agents in parallel
 * 
 * @param tasks - Array of task configurations
 * @param maxConcurrent - Maximum number of concurrent agents (default: 3)
 * @returns Array of results in same order as input tasks
 */
export async function runParallelAgents(
  tasks: IsolatedAgentConfig[],
  maxConcurrent: number = 3
): Promise<IsolatedAgentResult[]> {
  console.log(`\n🔷🔷🔷 Running ${tasks.length} parallel agents | Max concurrent: ${maxConcurrent}`);
  
  const results: IsolatedAgentResult[] = [];
  const queue = [...tasks];
  const active: Promise<IsolatedAgentResult>[] = [];

  while (queue.length > 0 || active.length > 0) {
    // Fill up to maxConcurrent
    while (active.length < maxConcurrent && queue.length > 0) {
      const taskConfig = queue.shift()!;
      const agent = new IsolatedAgent(taskConfig);
      const promise = agent.run();
      active.push(promise);
    }

    // Wait for at least one to complete
    if (active.length > 0) {
      const result = await Promise.race(active);
      results.push(result);
      
      // Remove completed from active
      const index = active.findIndex(p => p === Promise.resolve(result));
      if (index > -1) {
        active.splice(index, 1);
      }
    }
  }

  console.log(`✅ All ${tasks.length} parallel agents completed`);
  return results;
}
