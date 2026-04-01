/**
 * Forked Executor
 * 
 * Executes skills in isolated context to prevent pollution of parent conversation.
 * Inspired by Claude Code's runForkedAgent architecture.
 */

import { ILLMProvider } from '../providers/base-provider';
import { Message } from '../../types';
import { AgentLoop } from '../agent-loop/agent-loop';
import { ForkedExecutionOptions, ForkedExecutionResult } from '../../types/skill';
import {
  cloneConversationHistory,
  extractForkedResult,
  createIsolatedContext,
  calculateTotalTokens,
  validateForkedOptions,
  executeWithTimeout,
} from '../../utils/forked-agent-utils';

/**
 * ForkedExecutor - Isolated skill execution
 * 
 * Key features:
 * - Clones conversation history (parent history remains untouched)
 * - Creates isolated AgentLoop instance
 * - Tracks execution metrics (tokens, duration)
 * - Handles timeouts and errors gracefully
 */
export class ForkedExecutor {
  /**
   * Execute a skill in isolated (forked) context
   * 
   * @param skillName - Name of the skill being executed
   * @param userInput - User input/prompt for the skill
   * @param parentHistory - Parent conversation history (will be cloned)
   * @param provider - LLM provider to use
   * @param systemPrompt - System prompt for the skill
   * @param options - Execution options
   * @returns ForkedExecutionResult with output and metrics
   */
  public static async execute(
    skillName: string,
    userInput: string,
    parentHistory: Message[],
    provider: ILLMProvider,
    systemPrompt: string,
    options: ForkedExecutionOptions = {}
  ): Promise<ForkedExecutionResult> {
    const startTime = Date.now();
    
    console.log(`🔀 ForkedExecutor: Starting forked execution for skill "${skillName}"`);
    console.log(`   Isolation: FULL | Parent history: ${parentHistory.length} messages`);

    // Validate options
    const validation = validateForkedOptions(options);
    if (!validation.valid) {
      return {
        success: false,
        output: '',
        messages: [],
        duration: Date.now() - startTime,
        error: `Invalid options: ${validation.errors.join(', ')}`,
      };
    }

    try {
      // Create isolated context
      const isolatedContext = createIsolatedContext({
        conversationHistory: parentHistory,
        systemPrompt,
        maxIterations: options.maxIterations,
      });

      console.log(`   Isolated context created: ${isolatedContext.conversationHistory.length} messages cloned`);

      // Create isolated AgentLoop
      const agentLoop = new AgentLoop(
        provider,
        isolatedContext.conversationHistory,
        isolatedContext.systemPrompt,
        options.extraContext,
        undefined, // no blocked tools in forked context
        options.conversationId
      );

      // Execute with optional timeout
      const executionPromise = agentLoop.run(userInput);
      
      const output = options.timeout
        ? await executeWithTimeout(executionPromise, options.timeout)
        : await executionPromise;

      const duration = Date.now() - startTime;

      // Extract messages from isolated loop (if accessible)
      // Note: Current AgentLoop doesn't expose history, so we can't capture all messages
      // This is a simplified implementation focusing on the output
      const resultMessages: Message[] = [
        {
          conversationId: options.conversationId || 'forked',
          role: 'assistant',
          content: output,
        },
      ];

      // Calculate tokens (rough estimate)
      const tokensUsed = calculateTotalTokens(resultMessages);

      console.log(`✅ ForkedExecutor: Completed in ${duration}ms (~${tokensUsed} tokens)`);
      console.log(`   Parent history: UNCHANGED (${parentHistory.length} messages)`);

      return {
        success: true,
        output,
        messages: resultMessages,
        tokensUsed,
        duration,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      console.error(`❌ ForkedExecutor: Failed after ${duration}ms:`, error.message);

      return {
        success: false,
        output: '',
        messages: [],
        duration,
        error: error.message || 'Unknown error during forked execution',
      };
    }
  }

  /**
   * Execute with automatic cleanup
   * Ensures resources are released even if execution fails
   */
  public static async executeWithCleanup(
    skillName: string,
    userInput: string,
    parentHistory: Message[],
    provider: ILLMProvider,
    systemPrompt: string,
    options: ForkedExecutionOptions = {}
  ): Promise<ForkedExecutionResult> {
    try {
      return await this.execute(
        skillName,
        userInput,
        parentHistory,
        provider,
        systemPrompt,
        options
      );
    } finally {
      // Cleanup: Force garbage collection hint (no-op in most cases, but explicit intent)
      // In a more sophisticated implementation, we might release provider connections here
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Validate parent history before forking
   * Ensures history is in valid state for cloning
   */
  private static validateParentHistory(history: Message[]): boolean {
    if (!Array.isArray(history)) return false;
    
    // Basic validation: all messages should have required fields
    return history.every(msg =>
      msg.role && 
      msg.content !== undefined &&
      (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
    );
  }

  /**
   * Get forked execution statistics
   */
  public static getExecutionStats(result: ForkedExecutionResult): string {
    const stats = [
      `Success: ${result.success ? '✅' : '❌'}`,
      `Duration: ${result.duration}ms`,
      `Messages: ${result.messages.length}`,
    ];

    if (result.tokensUsed) {
      stats.push(`Tokens: ~${result.tokensUsed}`);
    }

    if (result.error) {
      stats.push(`Error: ${result.error}`);
    }

    return stats.join(' | ');
  }
}
