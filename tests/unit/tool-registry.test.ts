import { ToolRegistry } from '../../src/tools/tool-registry';
import { BaseTool } from '../../src/tools/base-tool';
import { ToolDefinition } from '../../src/core/providers/base-provider';
import { ToolResult } from '../../src/types';

class MockTool extends BaseTool {
  public readonly name = 'mock_tool';
  public readonly description = 'A mock tool for testing';

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' },
        },
        required: ['input'],
      },
    };
  }

  async execute(args: Record<string, any>): Promise<ToolResult> {
    return this.success(`Executed with: ${args.input}`);
  }
}

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Clear registry between tests
    ToolRegistry.clear();
  });

  afterAll(() => {
    ToolRegistry.clear();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      const tool = new MockTool();
      ToolRegistry.register(tool);

      expect(ToolRegistry.has('mock_tool')).toBe(true);
    });

    it('should allow retrieving registered tool', () => {
      const tool = new MockTool();
      ToolRegistry.register(tool);

      const retrieved = ToolRegistry.get('mock_tool');
      expect(retrieved).toBe(tool);
    });
  });

  describe('getAllDefinitions', () => {
    it('should return definitions for all registered tools', () => {
      const tool1 = new MockTool();
      ToolRegistry.register(tool1);

      const definitions = ToolRegistry.getAllDefinitions();

      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.some(d => d.name === 'mock_tool')).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve a registered tool by name', () => {
      const tool = new MockTool();
      ToolRegistry.register(tool);

      const retrieved = ToolRegistry.get('mock_tool');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('mock_tool');
    });

    it('should return undefined for non-existent tool', () => {
      const result = ToolRegistry.get('non_existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllNames', () => {
    it('should return all registered tool names', () => {
      const tool = new MockTool();
      ToolRegistry.register(tool);

      const names = ToolRegistry.getAllNames();

      expect(names).toContain('mock_tool');
    });
  });

  describe('has', () => {
    it('should return true for registered tools', () => {
      const tool = new MockTool();
      ToolRegistry.register(tool);

      expect(ToolRegistry.has('mock_tool')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      expect(ToolRegistry.has('non_existent')).toBe(false);
    });
  });
});
