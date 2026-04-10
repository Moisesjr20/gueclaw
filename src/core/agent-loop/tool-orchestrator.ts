/**
 * Tool Orchestrator (DVACE Architecture - Phase 3.1)
 * 
 * Manages tool execution with guaranteed execution of ALL requested tools.
 * Partitions tools into concurrent-safe vs serial execution groups.
 * 
 * CRITICAL: This ensures NO tool execution is skipped, preventing false positives.
 */

import { ToolCall } from '../../types';
import { ToolExecution, ToolUseContext } from '../../types/query-state';
import { ToolRegistry } from '../../tools/tool-registry';
import { BaseTool } from '../../tools/base-tool';

/**
 * Tool execution plan - groups tools by execution strategy
 */
export interface ToolExecutionPlan {
  concurrent: ToolCall[];  // Read-only, can run in parallel
  serial: ToolCall[];      // Write operations, must run sequentially
}

/**
 * Tool metadata with concurrency safety
 */
export interface ToolMetadata {
  name: string;
  isConcurrencySafe: boolean;
  category: 'read' | 'write' | 'network' | 'compute';
  estimatedDuration?: number; // milliseconds
}

/**
 * Tool Orchestrator - Ensures ALL tools are executed
 * 
 * Usage:
 * ```typescript
 * const orchestrator = new ToolOrchestrator(context);
 * const executions = await orchestrator.runTools(toolCalls, iteration);
 * // executions.length === toolCalls.length (ALWAYS)
 * ```
 */
export class ToolOrchestrator {
  private context: ToolUseContext;
  
  constructor(context: ToolUseContext) {
    this.context = context;
  }
  
  /**
   * Execute ALL tools from tool calls
   * 
   * CRITICAL: This function MUST execute every tool in the array.
   * No skipping, no early returns, no exceptions.
   * 
   * @param toolCalls - Array of tool calls from LLM
   * @param iteration - Current iteration number
   * @returns Array of tool executions (same length as toolCalls)
   */
  public async runTools(
    toolCalls: ToolCall[],
    iteration: number
  ): Promise<ToolExecution[]> {
    if (toolCalls.length === 0) {
      return [];
    }
    
    console.log(`🔧 Tool Orchestrator: Executing ${toolCalls.length} tool(s)`);
    
    // Partition into concurrent-safe vs serial
    const plan = this.partitionToolCalls(toolCalls);
    
    console.log(`   Concurrent: ${plan.concurrent.length} tool(s)`);
    console.log(`   Serial: ${plan.serial.length} tool(s)`);
    
    const executions: ToolExecution[] = [];
    
    // Execute concurrent tools in parallel
    if (plan.concurrent.length > 0) {
      const concurrentExecutions = await this.runToolsConcurrently(
        plan.concurrent,
        iteration
      );
      executions.push(...concurrentExecutions);
    }
    
    // Execute serial tools sequentially
    if (plan.serial.length > 0) {
      const serialExecutions = await this.runToolsSerially(
        plan.serial,
        iteration
      );
      executions.push(...serialExecutions);
    }
    
    // VALIDATION: Ensure we executed ALL tools
    if (executions.length !== toolCalls.length) {
      console.error(
        `❌ CRITICAL: Tool execution count mismatch! ` +
        `Expected: ${toolCalls.length}, Executed: ${executions.length}`
      );
      
      // Find missing tools
      const executedToolCallIds = executions.map(e => e.toolCallId);
      const missingToolCalls = toolCalls.filter(
        tc => !executedToolCallIds.includes(tc.id)
      );
      
      // Force execution of missing tools
      console.warn(`⚠️  Force-executing ${missingToolCalls.length} missing tool(s)`);
      const missingExecutions = await this.runToolsSerially(
        missingToolCalls,
        iteration
      );
      executions.push(...missingExecutions);
    }
    
    console.log(`✅ Tool Orchestrator: ${executions.length} execution(s) completed`);
    
    return executions;
  }
  
  /**
   * Partition tool calls into concurrent-safe vs serial
   */
  private partitionToolCalls(toolCalls: ToolCall[]): ToolExecutionPlan {
    const concurrent: ToolCall[] = [];
    const serial: ToolCall[] = [];
    
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const metadata = this.getToolMetadata(toolName);
      
      if (metadata.isConcurrencySafe) {
        concurrent.push(toolCall);
      } else {
        serial.push(toolCall);
      }
    }
    
    return { concurrent, serial };
  }
  
  /**
   * Execute tools concurrently (in parallel)
   */
  private async runToolsConcurrently(
    toolCalls: ToolCall[],
    iteration: number
  ): Promise<ToolExecution[]> {
    console.log(`⚡ Running ${toolCalls.length} tool(s) concurrently...`);
    
    const promises = toolCalls.map(toolCall =>
      this.executeSingleTool(toolCall, iteration)
    );
    
    // Wait for all to complete
    const executions = await Promise.all(promises);
    
    return executions;
  }
  
  /**
   * Execute tools serially (one after another)
   */
  private async runToolsSerially(
    toolCalls: ToolCall[],
    iteration: number
  ): Promise<ToolExecution[]> {
    console.log(`🔗 Running ${toolCalls.length} tool(s) serially...`);
    
    const executions: ToolExecution[] = [];
    
    for (const toolCall of toolCalls) {
      const execution = await this.executeSingleTool(toolCall, iteration);
      executions.push(execution);
    }
    
    return executions;
  }
  
  /**
   * Execute a single tool with full error handling
   * 
   * CRITICAL: This MUST NEVER throw. Always returns a ToolExecution.
   */
  private async executeSingleTool(
    toolCall: ToolCall,
    iteration: number
  ): Promise<ToolExecution> {
    const startTime = Date.now();
    const toolName = toolCall.function.name;
    const args = toolCall.function.arguments;
    
    console.log(`   🔧 Executing: ${toolName}`);
    
    try {
      // Check if tool is blocked
      if (this.isToolBlocked(toolName)) {
        return {
          tool: toolName,
          input: args,
          output: '',
          success: false,
          error: `Tool "${toolName}" is blocked by ToolUseContext`,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          toolCallId: toolCall.id,
          iteration
        };
      }
      
      // Get tool from registry
      const tool = ToolRegistry.get(toolName);
      
      if (!tool) {
        return {
          tool: toolName,
          input: args,
          output: '',
          success: false,
          error: `Tool "${toolName}" not found in registry`,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          toolCallId: toolCall.id,
          iteration
        };
      }
      
      // Execute tool
      const result = await tool.execute(args);
      
      const duration = Date.now() - startTime;
      
      console.log(`   ${result.success ? '✅' : '❌'} ${toolName} (${duration}ms)`);
      
      return {
        tool: toolName,
        input: args,
        output: result.output || '',
        success: result.success,
        error: result.error,
        timestamp: Date.now(),
        duration,
        toolCallId: toolCall.id,
        iteration
      };
      
    } catch (error: any) {
      // CRITICAL: Catch ALL errors to prevent tool execution skipping
      const duration = Date.now() - startTime;
      
      console.error(`   ❌ ${toolName} threw error: ${error.message}`);
      
      return {
        tool: toolName,
        input: args,
        output: '',
        success: false,
        error: `Execution error: ${error.message}`,
        timestamp: Date.now(),
        duration,
        toolCallId: toolCall.id,
        iteration
      };
    }
  }
  
  /**
   * Check if tool is blocked by context
   */
  private isToolBlocked(toolName: string): boolean {
    const { allowedTools, blockedTools } = this.context;
    
    // Check blocked list first
    if (blockedTools && blockedTools.includes(toolName)) {
      return true;
    }
    
    // Check allowed list (if specified)
    if (allowedTools && allowedTools.length > 0) {
      // Check if tool matches any allowed pattern
      const isAllowed = allowedTools.some(pattern => {
        if (pattern === '*') return true; // Allow all
        if (pattern === toolName) return true; // Exact match
        
        // Pattern matching: "Bash(git *)" allows "Bash" with args starting with "git"
        const match = pattern.match(/^(\w+)\((.*)\)$/);
        if (match) {
          const [, toolPattern, argsPattern] = match;
          if (toolName === toolPattern) {
            // TODO: Implement args validation
            return true;
          }
        }
        
        return false;
      });
      
      return !isAllowed;
    }
    
    return false;
  }
  
  /**
   * Get tool metadata (concurrency safety, category)
   */
  private getToolMetadata(toolName: string): ToolMetadata {
    // Try to get tool from registry
    const tool = ToolRegistry.get(toolName);
    
    if (tool) {
      const definition = tool.getDefinition();
      return {
        name: toolName,
        isConcurrencySafe: definition.isConcurrencySafe ?? false, // Default to false for safety
        category: definition.isConcurrencySafe ? 'read' : 'write'
      };
    }
    
    // Fallback: If tool not found in registry, default to SERIAL for safety
    return {
      name: toolName,
      isConcurrencySafe: false,
      category: 'write'
    };
  }
  
  /**
   * Get execution summary for logging
   */
  public static getExecutionSummary(executions: ToolExecution[]): string {
    const successful = executions.filter(e => e.success).length;
    const failed = executions.filter(e => !e.success).length;
    const totalDuration = executions.reduce((sum, e) => sum + e.duration, 0);
    const avgDuration = executions.length > 0 ? totalDuration / executions.length : 0;
    
    return [
      `📊 Tool Execution Summary:`,
      `   Total: ${executions.length}`,
      `   Success: ${successful}`,
      `   Failed: ${failed}`,
      `   Total Duration: ${totalDuration}ms`,
      `   Avg Duration: ${avgDuration.toFixed(0)}ms`
    ].join('\n');
  }
}

/**
 * Convenience function: Execute tools with new orchestrator
 */
export async function executeTools(
  toolCalls: ToolCall[],
  context: ToolUseContext,
  iteration: number
): Promise<ToolExecution[]> {
  const orchestrator = new ToolOrchestrator(context);
  return orchestrator.runTools(toolCalls, iteration);
}
