/**
 * Tool-Use Validator Tests (DVACE Architecture - Phase 2.3)
 */

import {
  validateToolUseSequence,
  validateQueryCanComplete,
  detectToolUseAnomalies,
  getValidationSummary,
  ToolUseValidationError
} from '../../src/core/agent-loop/tool-use-validator';
import {
  QueryState,
  ToolExecution,
  ContinueReason,
  createInitialQueryState,
  QueryParams
} from '../../src/types/query-state';
import { Message } from '../../src/types';

describe('Tool-Use Validator (Phase 2.3)', () => {
  
  // Helper to create test state
  function createTestState(overrides?: Partial<QueryState>): QueryState {
    const baseParams: QueryParams = {
      prompt: 'test',
      provider: null as any,
      toolUseContext: {
        userId: 'test-user',
        conversationId: 'test-conv'
      }
    };
    
    const baseState = createInitialQueryState(baseParams);
    
    return {
      ...baseState,
      ...overrides
    };
  }
  
  // Helper to create tool execution
  function createToolExecution(overrides?: Partial<ToolExecution>): ToolExecution {
    return {
      tool: 'TestTool',
      input: {},
      output: 'success',
      success: true,
      timestamp: Date.now(),
      duration: 100,
      iteration: 1,
      ...overrides
    };
  }
  
  describe('validateToolUseSequence', () => {
    it('should pass validation for empty state', () => {
      const state = createTestState();
      
      expect(() => validateToolUseSequence(state)).not.toThrow();
    });
    
    it('should pass validation for normal conversation', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', conversationId: 'test' },
        { role: 'assistant', content: 'Hi there', conversationId: 'test' }
      ];
      
      const state = createTestState({ messages });
      
      expect(() => validateToolUseSequence(state)).not.toThrow();
    });
    
    it('should pass validation when tool_use is in progress', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file.txt', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Reading file',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'FileRead', arguments: { path: 'file.txt' } }
          }]
        }
      ];
      
      const state = createTestState({
        messages,
        transition: 'tool_use' // Still in progress
      });
      
      expect(() => validateToolUseSequence(state)).not.toThrow();
    });
    
    it('should FAIL when tool_calls made but no tool_result messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file.txt', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Reading file',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'FileRead', arguments: { path: 'file.txt' } }
          }]
        }
      ];
      
      const state = createTestState({
        messages,
        transition: 'end_turn', // Completed without tool results!
        turnCount: 1
      });
      
      expect(() => validateToolUseSequence(state)).toThrow(ToolUseValidationError);
      expect(() => validateToolUseSequence(state)).toThrow(/tool_result/i);
    });
    
    it('should pass validation when tool_result messages present', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file.txt', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Reading file',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'FileRead', arguments: { path: 'file.txt' } }
          }]
        },
        {
          role: 'tool',
          content: 'File contents: Hello',
          conversationId: 'test',
          toolCallId: 'call_1'
        }
      ];
      
      const toolExecutions = [createToolExecution({ toolCallId: 'call_1' })];
      
      const state = createTestState({
        messages,
        toolExecutions,
        transition: 'end_turn'
      });
      
      expect(() => validateToolUseSequence(state)).not.toThrow();
    });
    
    it('should FAIL when tool executions not recorded', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file.txt', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Reading file',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'FileRead', arguments: { path: 'file.txt' } }
          }]
        },
        {
          role: 'tool',
          content: 'File contents',
          conversationId: 'test',
          toolCallId: 'call_1'
        }
      ];
      
      const state = createTestState({
        messages,
        toolExecutions: [], // No executions recorded!
        transition: 'end_turn'
      });
      
      expect(() => validateToolUseSequence(state)).toThrow(ToolUseValidationError);
      expect(() => validateToolUseSequence(state)).toThrow(/execution.*not properly recorded/i);
    });
  });
  
  describe('validateQueryCanComplete', () => {
    it('should FAIL if transition is tool_use', () => {
      const state = createTestState({
        transition: 'tool_use',
        turnCount: 1
      });
      
      expect(() => validateQueryCanComplete(state)).toThrow(ToolUseValidationError);
      expect(() => validateQueryCanComplete(state)).toThrow(/cannot complete.*tool_use/i);
    });
    
    it('should FAIL if last message is assistant with pending tool_calls', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Do something', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Executing',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'SomeTool', arguments: {} }
          }]
        }
      ];
      
      const state = createTestState({
        messages,
        transition: 'end_turn'
      });
      
      expect(() => validateQueryCanComplete(state)).toThrow(ToolUseValidationError);
      expect(() => validateQueryCanComplete(state)).toThrow(/pending tool calls/i);
    });
    
    it('should pass when query completed normally', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello', conversationId: 'test' },
        { role: 'assistant', content: 'Hi', conversationId: 'test' }
      ];
      
      const state = createTestState({
        messages,
        transition: 'end_turn',
        turnCount: 1
      });
      
      expect(() => validateQueryCanComplete(state)).not.toThrow();
    });
    
    it('should pass when tools were executed and completed', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'Reading',
          conversationId: 'test',
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'FileRead', arguments: {} }
          }]
        },
        {
          role: 'tool',
          content: 'File contents',
          conversationId: 'test',
          toolCallId: 'call_1'
        },
        { role: 'assistant', content: 'Done!', conversationId: 'test' }
      ];
      
      const toolExecutions = [createToolExecution({ toolCallId: 'call_1' })];
      
      const state = createTestState({
        messages,
        toolExecutions,
        transition: 'end_turn',
        turnCount: 2
      });
      
      expect(() => validateQueryCanComplete(state)).not.toThrow();
    });
  });
  
  describe('detectToolUseAnomalies', () => {
    it('should detect "success" claim with 0 executions', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Create file', conversationId: 'test' },
        { role: 'assistant', content: '✅ Success! File created.', conversationId: 'test' }
      ];
      
      const state = createTestState({
        messages,
        toolExecutions: [] // No tools executed!
      });
      
      const anomalies = detectToolUseAnomalies(state);
      
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some(a => a.includes('0 tools were executed'))).toBe(true);
    });
    
    it('should detect high failure rate', () => {
      const toolExecutions: ToolExecution[] = [
        createToolExecution({ success: false }),
        createToolExecution({ success: false }),
        createToolExecution({ success: false }),
        createToolExecution({ success: false }),
        createToolExecution({ success: true })
      ];
      
      const state = createTestState({ toolExecutions });
      
      const anomalies = detectToolUseAnomalies(state);
      
      expect(anomalies.some(a => a.includes('failure rate'))).toBe(true);
    });
    
    it('should return empty array for normal execution', () => {
      const messages: Message[] = [
        { role: 'user', content: 'List files', conversationId: 'test' },
        { role: 'assistant', content: 'Listing files', conversationId: 'test', toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'ListDir', arguments: {} } }] },
        { role: 'tool', content: 'file1.txt', conversationId: 'test', toolCallId: 'call_1' },
        { role: 'assistant', content: 'Here are the files', conversationId: 'test' }
      ];
      
      const toolExecutions = [createToolExecution()];
      
      const state = createTestState({ messages, toolExecutions });
      
      const anomalies = detectToolUseAnomalies(state);
      
      expect(anomalies.length).toBe(0);
    });
  });
  
  describe('getValidationSummary', () => {
    it('should generate readable summary', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Test', conversationId: 'test' },
        { role: 'assistant', content: 'Testing', conversationId: 'test', toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'Tool1', arguments: {} } }] },
        { role: 'tool', content: 'Result', conversationId: 'test', toolCallId: 'call_1' }
      ];
      
      const toolExecutions = [
        createToolExecution({ success: true }),
        createToolExecution({ success: false })
      ];
      
      const state = createTestState({
        messages,
        toolExecutions,
        turnCount: 2,
        transition: 'end_turn'
      });
      
      const summary = getValidationSummary(state);
      
      expect(summary).toContain('Turn: 2');
      expect(summary).toContain('Transition: end_turn');
      expect(summary).toContain('Tool Executions: 2');
      expect(summary).toContain('1 success, 1 failed');
    });
  });
  
  describe('Critical Phase 2 Validations', () => {
    it('MUST block finish_reason=tool_calls → end_turn without tool execution', () => {
      // This is the CORE BUG we're preventing
      const messages: Message[] = [
        { role: 'user', content: 'FASE 1: Create X, FASE 2: Create Y', conversationId: 'test' },
        {
          role: 'assistant',
          content: 'I will create the files',
          conversationId: 'test',
          toolCalls: [
            { id: 'call_1', type: 'function', function: { name: 'FileWrite', arguments: { path: 'X' } } },
            { id: 'call_2', type: 'function', function: { name: 'FileWrite', arguments: { path: 'Y' } } }
          ]
        }
      ];
      
      const state = createTestState({
        messages,
        toolExecutions: [], // BUG: No executions!
        transition: 'end_turn', // BUG: Marked as complete!
        turnCount: 1
      });
      
      // This MUST throw
      expect(() => validateToolUseSequence(state)).toThrow(ToolUseValidationError);
      expect(() => validateQueryCanComplete(state)).toThrow(ToolUseValidationError);
    });
  });
});
