/**
 * Tool-Use Validator (DVACE Architecture - Phase 2.3)
 * 
 * Validates tool execution sequences to prevent false positives.
 * Ensures that tool_use messages are ALWAYS followed by tool_result messages.
 * 
 * CRITICAL: This prevents the bug where the agent claims "success" without
 * actually executing the requested tools.
 */

import { QueryState, ToolExecution } from '../../types/query-state';
import { Message } from '../../types';

/**
 * Validation error thrown when tool-use sequence is invalid
 */
export class ToolUseValidationError extends Error {
  constructor(message: string, public readonly state: QueryState) {
    super(message);
    this.name = 'ToolUseValidationError';
  }
}

/**
 * Validate tool-use sequence in query state
 * 
 * Checks:
 * 1. If last assistant message has tool_calls, next message MUST be tool_result
 * 2. If tool_calls.length > 0, toolExecutions.length MUST grow
 * 3. No 'tool_use' → 'end_turn' transitions without tool_result
 * 
 * @param state - Current query state
 * @returns true if sequence is valid
 * @throws ToolUseValidationError if sequence is invalid
 */
export function validateToolUseSequence(state: QueryState): boolean {
  const { messages, toolExecutions, transition, turnCount } = state;
  
  if (messages.length === 0) {
    return true; // No messages yet
  }
  
  // Find last assistant message
  const lastAssistantIndex = findLastIndexByRole(messages, 'assistant');
  
  if (lastAssistantIndex === -1) {
    return true; // No assistant messages yet
  }
  
  const lastAssistantMsg = messages[lastAssistantIndex];
  
  // Check if assistant requested tools
  if (lastAssistantMsg.toolCalls && lastAssistantMsg.toolCalls.length > 0) {
    const toolCallCount = lastAssistantMsg.toolCalls.length;
    
    console.log(`🔍 Validating tool-use: ${toolCallCount} tool(s) requested`);
    
    // Rule 1: Must have tool_result messages after assistant message
    const toolResultMessages = messages.slice(lastAssistantIndex + 1).filter((m: Message) => m.role === 'tool');
    
    if (toolResultMessages.length < toolCallCount) {
      // Check if this is mid-execution (transition === 'tool_use')
      if (transition === 'tool_use') {
        // This is OK - we're about to execute tools
        console.log(`✅ Tool-use in progress: ${toolResultMessages.length}/${toolCallCount} results received`);
        return true;
      }
      
      // ERROR: Completed without tool results
      throw new ToolUseValidationError(
        `VALIDATION FAILED: Assistant requested ${toolCallCount} tool(s) but only ` +
        `${toolResultMessages.length} tool_result message(s) found. ` +
        `Turn: ${turnCount}, Transition: ${transition}. ` +
        `This indicates tool execution was skipped or incomplete.`,
        state
      );
    }
    
    // Rule 2: toolExecutions array must have grown
    const expectedMinExecutions = toolCallCount;
    const actualExecutions = toolExecutions.length;
    
    if (actualExecutions < expectedMinExecutions) {
      // Check if we have any executions for these specific tool calls
      const toolCallIds = lastAssistantMsg.toolCalls.map((tc: any) => tc.id);
      const matchingExecutions = toolExecutions.filter((te: ToolExecution) =>
        toolCallIds.includes(te.toolCallId || '')
      );
      
      if (matchingExecutions.length < toolCallCount) {
        throw new ToolUseValidationError(
          `VALIDATION FAILED: Expected at least ${expectedMinExecutions} tool execution(s), ` +
          `but only ${matchingExecutions.length} matching execution(s) found. ` +
          `Total executions: ${actualExecutions}, Turn: ${turnCount}. ` +
          `This indicates tool execution was not properly recorded.`,
          state
        );
      }
    }
    
    console.log(`✅ Tool-use validation passed: ${toolCallCount} tool(s) executed`);
  }
  
  // Rule 3: Check for forbidden transition pattern
  if (transition === 'tool_use') {
    // Current transition is 'tool_use' - this is only valid if:
    // - We haven't processed the tool results yet (mid-execution)
    // - This should NEVER be the final state
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'tool' && lastMessage.toolCalls) {
      // Last message is assistant with tool_calls, no tool_result yet
      // This is OK - we're in the middle of execution
      return true;
    }
  }
  
  return true;
}

/**
 * Validate that a query can safely complete
 * 
 * Stricter validation than validateToolUseSequence - only called when finishing query.
 * 
 * @param state - Current query state
 * @returns true if query can complete
 * @throws ToolUseValidationError if query cannot complete safely
 */
export function validateQueryCanComplete(state: QueryState): boolean {
  const { messages, transition, turnCount, toolExecutions } = state;
  
  // Rule 1: NEVER complete with transition === 'tool_use'
  if (transition === 'tool_use') {
    throw new ToolUseValidationError(
      `CRITICAL: Query cannot complete with transition='tool_use'. ` +
      `This would skip tool execution. ` +
      `Turn: ${turnCount}, Tools executed: ${toolExecutions.length}`,
      state
    );
  }
  
  // Rule 2: If last message is assistant with tool_calls, we need tool results
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'assistant' && lastMessage.toolCalls && lastMessage.toolCalls.length > 0) {
    throw new ToolUseValidationError(
      `CRITICAL: Query cannot complete with pending tool calls. ` +
      `Last message is assistant with ${lastMessage.toolCalls.length} tool call(s). ` +
      `Expected tool_result messages. ` +
      `Turn: ${turnCount}`,
      state
    );
  }
  
  // Run full sequence validation
  validateToolUseSequence(state);
  
  console.log(`✅ Query completion validated: Turn ${turnCount}, ${toolExecutions.length} tool(s) executed`);
  return true;
}

/**
 * Detect tool-use anomalies (for logging/alerting)
 * 
 * Returns warnings that don't block execution but should be investigated.
 */
export function detectToolUseAnomalies(state: QueryState): string[] {
  const anomalies: string[] = [];
  const { messages, toolExecutions, transition } = state;
  
  // Anomaly 1: tool_use without tool_result in message history
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    const nextMsg = messages[i + 1];
    
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      if (nextMsg.role !== 'tool') {
        anomalies.push(
          `Anomaly at message ${i}: Assistant requested tools but next message is ${nextMsg.role} (expected 'tool')`
        );
      }
    }
  }
  
  // Anomaly 2: "success" claim with 0 executions
  const finalMessage = messages[messages.length - 1];
  if (finalMessage?.role === 'assistant' && toolExecutions.length === 0) {
    const content = finalMessage.content.toLowerCase();
    if (content.includes('success') || content.includes('completed') || content.includes('done')) {
      anomalies.push(
        `Anomaly: Assistant claims success/completion but 0 tools were executed`
      );
    }
  }
  
  // Anomaly 3: High number of failed executions
  const failedExecutions = toolExecutions.filter((te: ToolExecution) => !te.success).length;
  if (failedExecutions > 3) {
    anomalies.push(
      `Anomaly: High failure rate: ${failedExecutions}/${toolExecutions.length} tool executions failed`
    );
  }
  
  return anomalies;
}

/**
 * Helper: Find last index of message with specific role
 */
function findLastIndexByRole(messages: Message[], role: string): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) {
      return i;
    }
  }
  return -1;
}

/**
 * Get validation summary for debugging
 */
export function getValidationSummary(state: QueryState): string {
  const { messages, toolExecutions, transition, turnCount } = state;
  
  const assistantMessages = messages.filter((m: Message) => m.role === 'assistant');
  const toolMessages = messages.filter((m: Message) => m.role === 'tool');
  const toolCallsRequested = assistantMessages.reduce(
    (sum: number, m: Message) => sum + (m.toolCalls?.length || 0),
    0
  );
  
  const successfulExecutions = toolExecutions.filter((te: ToolExecution) => te.success).length;
  const failedExecutions = toolExecutions.filter((te: ToolExecution) => !te.success).length;
  
  return [
    `📋 Validation Summary`,
    `   Turn: ${turnCount}`,
    `   Transition: ${transition || 'INIT'}`,
    `   Tool Calls Requested: ${toolCallsRequested}`,
    `   Tool Result Messages: ${toolMessages.length}`,
    `   Tool Executions: ${toolExecutions.length} (${successfulExecutions} success, ${failedExecutions} failed)`,
    `   Messages: ${messages.length} (${assistantMessages.length} assistant, ${toolMessages.length} tool)`,
  ].join('\n');
}
