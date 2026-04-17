import { BaseTool } from './base-tool';
import { ToolResult } from '../types';
import { ToolDefinition } from '../core/providers/base-provider';
import { IsolatedAgent, IsolatedAgentConfig, IsolatedAgentResult, runParallelAgents } from '../core/agent/isolated-agent';
import { ProviderFactory } from '../core/providers/provider-factory';

/**
 * Delegate Tool - Delegate tasks to isolated subagents
 * 
 * Allows the main agent to spawn isolated subagents for:
 * - Parallel task execution
 * - Isolated research/analysis
 * - Multi-step workflows with independent subtasks
 * 
 * Features:
 * - Single task mode: Execute one task sequentially
 * - Batch mode: Execute multiple tasks in parallel
 * - Max concurrent limit: Default 3 agents max
 * - Timeout handling: Per-task timeout
 * - Error isolation: Failed tasks don't affect others
 * - Result consolidation: Aggregates all results
 */
export class DelegateTool extends BaseTool {
  name = 'delegate_task';
  description = 
    'Delegate one or more tasks to isolated subagents. ' +
    'Use for parallel execution, independent research, or multi-step workflows. ' +
    'Each subagent has fresh context and restricted tools (no delegate, clarify, memory write). ' +
    'Returns consolidated results from all tasks.';

  schema = {
    type: 'object' as const,
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'The task description for the subagent. Be specific and clear.',
            },
            context: {
              type: 'string',
              description: 'Optional context to provide to the subagent (e.g., file paths, background info)',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 60000 = 60s)',
            },
            allowedTools: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tool permission patterns (default: ["*"]). Example: ["Bash(git *)", "FileRead(*)"]',
            },
          },
          required: ['task'],
        },
        description: 
          'Array of tasks to delegate. ' +
          'Single task = sequential execution. ' +
          'Multiple tasks = parallel execution (max 3 concurrent).',
      },
      maxConcurrent: {
        type: 'number',
        description: 'Maximum number of concurrent subagents (default: 3, max: 5)',
      },
    },
    required: ['tasks'],
  };

  isConcurrencySafe = false; // Spawns multiple agents, not safe to run concurrently

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.schema,
      isConcurrencySafe: this.isConcurrencySafe,
    };
  }

  async execute(input: Record<string, any>): Promise<ToolResult> {
    const { tasks, maxConcurrent = 3 } = input;

    // Validate input
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return {
        success: false,
        output: 'Error: tasks must be a non-empty array',
      };
    }

    // Validate maxConcurrent
    const effectiveMaxConcurrent = Math.min(Math.max(1, maxConcurrent), 5);

    try {
      console.log(`\n🔷 Delegate Tool: ${tasks.length} task(s) | Max concurrent: ${effectiveMaxConcurrent}`);

      // Get current provider (use default provider)
      const provider = ProviderFactory.getProvider();
      if (!provider) {
        return {
          success: false,
          output: 'Error: No LLM provider available',
        };
      }

      // Build task configurations
      const taskConfigs: IsolatedAgentConfig[] = tasks.map((t: any) => ({
        task: t.task,
        provider,
        context: t.context,
        timeout: t.timeout || 60000,
        allowedTools: t.allowedTools,
      }));

      let results: IsolatedAgentResult[];

      // Single task mode (sequential)
      if (tasks.length === 1) {
        console.log('📝 Single task mode: executing sequentially');
        const agent = new IsolatedAgent(taskConfigs[0]);
        
        // Heartbeat to keep parent alive
        const heartbeat = this.startHeartbeat();
        
        try {
          const result = await agent.run();
          results = [result];
        } finally {
          clearInterval(heartbeat);
        }
      }
      // Batch mode (parallel)
      else {
        console.log(`🔷 Batch mode: executing ${tasks.length} tasks in parallel`);
        
        // Heartbeat to keep parent alive during parallel execution
        const heartbeat = this.startHeartbeat();
        
        try {
          results = await runParallelAgents(taskConfigs, effectiveMaxConcurrent);
        } finally {
          clearInterval(heartbeat);
        }
      }

      // Consolidate results
      const output = this.formatResults(results);

      // Determine overall success
      const allSuccessful = results.every(r => r.success);
      const anySuccessful = results.some(r => r.success);

      return {
        success: allSuccessful || anySuccessful,
        output,
      };

    } catch (error: any) {
      console.error('❌ Delegate Tool error:', error);
      return {
        success: false,
        output: `Delegate error: ${error.message}`,
      };
    }
  }

  /**
   * Format results for output
   */
  private formatResults(results: IsolatedAgentResult[]): string {
    const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
    const avgTime = totalTime / results.length;
    
    let output = `# Subagent Execution Report\n\n`;
    output += `**Total Tasks:** ${results.length}\n`;
    output += `**Successful:** ${results.filter(r => r.success).length}\n`;
    output += `**Failed:** ${results.filter(r => !r.success).length}\n`;
    output += `**Total Time:** ${totalTime}ms\n`;
    output += `**Average Time:** ${Math.round(avgTime)}ms\n\n`;

    output += `---\n\n`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const status = result.success ? '✅ Success' : '❌ Failed';
      
      output += `## Task ${i + 1}: ${status}\n\n`;
      output += `**Task ID:** \`${result.taskId.slice(0, 8)}\`\n`;
      output += `**Execution Time:** ${result.executionTime}ms\n`;
      
      if (result.toolCalls !== undefined) {
        output += `**Tool Calls:** ${result.toolCalls}\n`;
      }
      
      if (result.iterations !== undefined) {
        output += `**Iterations:** ${result.iterations}\n`;
      }
      
      output += `\n`;

      if (result.success) {
        output += `**Output:**\n\`\`\`\n${result.output}\n\`\`\`\n\n`;
      } else {
        output += `**Error:**\n\`\`\`\n${result.error}\n\`\`\`\n\n`;
      }

      output += `---\n\n`;
    }

    return output;
  }

  /**
   * Start heartbeat to keep parent agent alive
   * Logs every 5 seconds to prevent timeout
   */
  private startHeartbeat(): NodeJS.Timeout {
    return setInterval(() => {
      console.log('💓 Delegate Tool heartbeat: subagents still running...');
    }, 5000);
  }
}
