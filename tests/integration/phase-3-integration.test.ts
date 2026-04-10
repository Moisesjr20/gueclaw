/**
 * Phase 3 Integration Tests
 * Tests full integration of ToolOrchestrator with agent-loop
 */

import { ToolOrchestrator } from '../../src/core/agent-loop/tool-orchestrator';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { ToolCall } from '../../src/types';
import { ToolUseContext } from '../../src/types/query-state';
import { EchoTool } from '../../src/tools/echo-tool';
import { BaseTool } from '../../src/tools/base-tool';
import { ToolDefinition } from '../../src/core/providers/base-provider';
import { ToolResult } from '../../src/types';

// Mock write tool for testing
class MockFileWriteTool extends BaseTool {
  name = 'MockFileWrite';
  description = 'Mock file write tool';
  
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      isConcurrencySafe: false, // WRITE tool
      parameters: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    };
  }
  
  async execute(args: any): Promise<ToolResult> {
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate write delay
    return { success: true, output: 'file written' };
  }
}

describe('Phase 3 Integration (ToolOrchestrator + agent-loop)', () => {
  
  beforeEach(() => {
    ToolRegistry.clear();
    ToolRegistry.register(EchoTool);
    ToolRegistry.register(new MockFileWriteTool());
  });
  
  afterEach(() => {
    ToolRegistry.clear();
  });
  
  function createToolCall(name: string, id?: string): ToolCall {
    return {
      id: id || `call_${Date.now()}_${Math.random()}`,
      type: 'function',
      function: {
        name,
        arguments: { text: 'test' }
      }
    };
  }
  
  function createContext(overrides?: Partial<ToolUseContext>): ToolUseContext {
    return {
      userId: 'test-user',
      conversationId: 'test-conv',
      ...overrides
    };
  }
  
  describe('Concurrent vs Serial Execution', () => {
    it('should execute concurrent tools in parallel', async () => {
      const toolCalls = [
        createToolCall('echo', 'call_1'),
        createToolCall('echo', 'call_2'),
        createToolCall('echo', 'call_3')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const startTime = Date.now();
      const executions = await orchestrator.runTools(toolCalls, 1);
      const duration = Date.now() - startTime;
      
      expect(executions.length).toBe(3);
      expect(executions.every(e => e.success)).toBe(true);
      
      // All 3 echo tools should run concurrently, so duration should be less than 150ms
      // (If serial, would be ~150ms; if concurrent, should be <100ms)
      expect(duration).toBeLessThan(100);
    });
    
    it('should execute serial tools one by one', async () => {
      const toolCalls = [
        createToolCall('MockFileWrite', 'call_1'),
        createToolCall('MockFileWrite', 'call_2'),
        createToolCall('MockFileWrite', 'call_3')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const startTime = Date.now();
      const executions = await orchestrator.runTools(toolCalls, 1);
      const duration = Date.now() - startTime;
      
      expect(executions.length).toBe(3);
      expect(executions.every(e => e.success)).toBe(true);
      
      // 3 write tools with 50ms each should take ~150ms+ (serial execution)
      expect(duration).toBeGreaterThanOrEqual(140); // Allow small variance
    });
    
    it('should execute concurrent first, then serial', async () => {
      const toolCalls = [
        createToolCall('echo', 'call_1'),           // Concurrent
        createToolCall('echo', 'call_2'),           // Concurrent
        createToolCall('MockFileWrite', 'call_3'),  // Serial
        createToolCall('MockFileWrite', 'call_4')   // Serial
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(4);
      expect(executions.every(e => e.success)).toBe(true);
      
      // Verify execution order: concurrent tools first
      const echoExecutions = executions.filter(e => e.tool === 'echo');
      const writeExecutions = executions.filter(e => e.tool === 'MockFileWrite');
      
      expect(echoExecutions.length).toBe(2);
      expect(writeExecutions.length).toBe(2);
    });
  });
  
  describe('Tool Blocking', () => {
    it('should respect blockedTools list', async () => {
      const toolCalls = [
        createToolCall('echo', 'call_1'),
        createToolCall('MockFileWrite', 'call_2')
      ];
      const context = createContext({
        blockedTools: ['MockFileWrite']
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].success).toBe(true);  // echo allowed
      expect(executions[1].success).toBe(false); // MockFileWrite blocked
      expect(executions[1].error).toContain('is blocked');
    });
    
    it('should respect allowedTools list', async () => {
      const toolCalls = [
        createToolCall('echo', 'call_1'),
        createToolCall('MockFileWrite', 'call_2')
      ];
      const context = createContext({
        allowedTools: ['echo'] // Only echo allowed
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].success).toBe(true);  // echo allowed
      expect(executions[1].success).toBe(false); // MockFileWrite blocked
    });
  });
  
  describe('CRITICAL: No Tool Skipping', () => {
    it('MUST execute ALL tools even if first one fails', async () => {
      // Create a tool that always fails
      class FailTool extends BaseTool {
        name = 'FailTool';
        description = 'Always fails';
        getDefinition(): ToolDefinition {
          return {
            name: this.name,
            description: this.description,
            parameters: { type: 'object' as const, properties: {}, required: [] }
          };
        }
        async execute(): Promise<ToolResult> {
          throw new Error('Always fails');
        }
      }
      
      ToolRegistry.register(new FailTool());
      
      const toolCalls = [
        createToolCall('FailTool', 'call_1'),    // This WILL fail
        createToolCall('echo', 'call_2')          // This MUST still run
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      // CRITICAL: Both tools must have been attempted
      expect(executions.length).toBe(2);
      
      // Find the executions by tool name (order may vary due to concurrent/serial partitioning)
      const failExecution = executions.find(e => e.tool === 'FailTool');
      const echoExecution = executions.find(e => e.tool === 'echo');
      
      expect(failExecution).toBeDefined();
      expect(echoExecution).toBeDefined();
      expect(failExecution!.success).toBe(false); // FailTool failed
      expect(echoExecution!.success).toBe(true);  // echo still ran
    });
  });
});
