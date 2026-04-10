/**
 * Tool Orchestrator Tests (DVACE Architecture - Phase 3.1)
 */

import { ToolOrchestrator, executeTools } from '../../src/core/agent-loop/tool-orchestrator';
import { ToolCall } from '../../src/types';
import { ToolUseContext, ToolExecution } from '../../src/types/query-state';
import { ToolRegistry } from '../../src/tools/tool-registry';
import { BaseTool } from '../../src/tools/base-tool';

// Mock tools for testing
class MockReadTool extends BaseTool {
  name = 'MockReadTool';
  description = 'Mock read-only tool';
  
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    };
  }
  
  async execute(args: any) {
    return { success: true, output: 'read result' };
  }
}

class MockWriteTool extends BaseTool {
  name = 'MockWriteTool';
  description = 'Mock write tool';
  
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    };
  }
  
  async execute(args: any) {
    return { success: true, output: 'write result' };
  }
}

class MockErrorTool extends BaseTool {
  name = 'MockErrorTool';
  description = 'Mock tool that throws error';
  
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    };
  }
  
  async execute(args: any): Promise<{ success: boolean; output: string }> {
    throw new Error('Simulated tool error');
  }
}

describe('Tool Orchestrator (Phase 3.1)', () => {
  
  beforeEach(() => {
    // Register mock tools
    ToolRegistry.clear();
    ToolRegistry.register(new MockReadTool());
    ToolRegistry.register(new MockWriteTool());
    ToolRegistry.register(new MockErrorTool());
  });
  
  afterEach(() => {
    ToolRegistry.clear();
  });
  
  // Helper to create tool call
  function createToolCall(name: string, id?: string): ToolCall {
    return {
      id: id || `call_${Date.now()}_${Math.random()}`,
      type: 'function',
      function: {
        name,
        arguments: {}
      }
    };
  }
  
  // Helper to create context
  function createContext(overrides?: Partial<ToolUseContext>): ToolUseContext {
    return {
      userId: 'test-user',
      conversationId: 'test-conv',
      ...overrides
    };
  }
  
  describe('Basic Execution', () => {
    it('should execute single tool', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].tool).toBe('MockReadTool');
      expect(executions[0].success).toBe(true);
      expect(executions[0].output).toBe('read result');
    });
    
    it('should execute multiple tools', async () => {
      const toolCalls = [
        createToolCall('MockReadTool', 'call_1'),
        createToolCall('MockWriteTool', 'call_2')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].tool).toBe('MockReadTool');
      expect(executions[1].tool).toBe('MockWriteTool');
      expect(executions[0].success).toBe(true);
      expect(executions[1].success).toBe(true);
    });
    
    it('should execute empty array', async () => {
      const toolCalls: ToolCall[] = [];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should NOT crash when tool throws error', async () => {
      const toolCalls = [createToolCall('MockErrorTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(false);
      expect(executions[0].error).toContain('Simulated tool error');
    });
    
    it('should continue executing after error', async () => {
      const toolCalls = [
        createToolCall('MockErrorTool', 'call_1'),
        createToolCall('MockReadTool', 'call_2')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].success).toBe(false); // Error tool
      expect(executions[1].success).toBe(true);  // Read tool still executed
    });
    
    it('should handle tool not found', async () => {
      const toolCalls = [createToolCall('NonExistentTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(false);
      expect(executions[0].error).toContain('not found in registry');
    });
  });
  
  describe('Tool Blocking', () => {
    it('should block tool in blockedTools list', async () => {
      const toolCalls = [createToolCall('MockWriteTool')];
      const context = createContext({
        blockedTools: ['MockWriteTool']
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(false);
      expect(executions[0].error).toContain('is blocked');
    });
    
    it('should allow tool in allowedTools list', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext({
        allowedTools: ['MockReadTool']
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(true);
    });
    
    it('should block tool NOT in allowedTools list', async () => {
      const toolCalls = [createToolCall('MockWriteTool')];
      const context = createContext({
        allowedTools: ['MockReadTool'] // Only read tool allowed
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(false);
      expect(executions[0].error).toContain('is blocked');
    });
    
    it('should allow all tools when allowedTools=["*"]', async () => {
      const toolCalls = [
        createToolCall('MockReadTool'),
        createToolCall('MockWriteTool')
      ];
      const context = createContext({
        allowedTools: ['*']
      });
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].success).toBe(true);
      expect(executions[1].success).toBe(true);
    });
  });
  
  describe('ToolExecution Recording', () => {
    it('should record tool name', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions[0].tool).toBe('MockReadTool');
    });
    
    it('should record input arguments', async () => {
      const toolCalls = [{
        id: 'call_1',
        type: 'function' as const,
        function: {
          name: 'MockReadTool',
          arguments: { path: '/test/file.txt' }
        }
      }];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions[0].input).toEqual({ path: '/test/file.txt' });
    });
    
    it('should record success/failure', async () => {
      const toolCalls = [
        createToolCall('MockReadTool', 'call_1'),
        createToolCall('MockErrorTool', 'call_2')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions[0].success).toBe(true);
      expect(executions[1].success).toBe(false);
    });
    
    it('should record timestamp and duration', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions[0].timestamp).toBeGreaterThan(0);
      expect(executions[0].duration).toBeGreaterThanOrEqual(0);
    });
    
    it('should record toolCallId', async () => {
      const toolCalls = [createToolCall('MockReadTool', 'my_custom_id')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions[0].toolCallId).toBe('my_custom_id');
    });
    
    it('should record iteration number', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 5);
      
      expect(executions[0].iteration).toBe(5);
    });
  });
  
  describe('Critical Phase 3 Validations', () => {
    it('MUST execute ALL tools (no skipping)', async () => {
      const toolCalls = [
        createToolCall('MockReadTool', 'call_1'),
        createToolCall('MockWriteTool', 'call_2'),
        createToolCall('MockErrorTool', 'call_3'),
        createToolCall('MockReadTool', 'call_4')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      // CRITICAL: Must execute ALL 4 tools
      expect(executions.length).toBe(4);
      expect(executions.length).toBe(toolCalls.length);
    });
    
    it('MUST return executions.length === toolCalls.length', async () => {
      const toolCalls = [
        createToolCall('MockReadTool'),
        createToolCall('MockReadTool'),
        createToolCall('MockReadTool')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(toolCalls.length);
    });
    
    it('SHOULD execute tools even if one fails', async () => {
      // This is the core bug we're preventing:
      // Tool 1 fails → Tool 2 should STILL execute
      const toolCalls = [
        createToolCall('MockErrorTool', 'call_1'),
        createToolCall('MockReadTool', 'call_2')
      ];
      const context = createContext();
      const orchestrator = new ToolOrchestrator(context);
      
      const executions = await orchestrator.runTools(toolCalls, 1);
      
      expect(executions.length).toBe(2);
      expect(executions[0].success).toBe(false); // First tool failed
      expect(executions[1].success).toBe(true);  // Second tool still ran
    });
  });
  
  describe('Convenience Function', () => {
    it('executeTools should work', async () => {
      const toolCalls = [createToolCall('MockReadTool')];
      const context = createContext();
      
      const executions = await executeTools(toolCalls, context, 1);
      
      expect(executions.length).toBe(1);
      expect(executions[0].success).toBe(true);
    });
  });
  
  describe('Execution Summary', () => {
    it('should generate summary', async () => {
      const executions: ToolExecution[] = [
        {
          tool: 'Tool1',
          input: {},
          output: 'ok',
          success: true,
          timestamp: Date.now(),
          duration: 100,
          iteration: 1
        },
        {
          tool: 'Tool2',
          input: {},
          output: '',
          success: false,
          error: 'failed',
          timestamp: Date.now(),
          duration: 50,
          iteration: 1
        }
      ];
      
      const summary = ToolOrchestrator.getExecutionSummary(executions);
      
      expect(summary).toContain('Total: 2');
      expect(summary).toContain('Success: 1');
      expect(summary).toContain('Failed: 1');
      expect(summary).toContain('Total Duration: 150ms');
    });
  });
});
