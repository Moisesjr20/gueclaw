import { MemoryWriteTool } from '../../src/tools/memory-write-tool';
import { PersistentMemory } from '../../src/core/memory/persistent-memory';

jest.mock('../../src/core/memory/persistent-memory', () => ({
  PersistentMemory: {
    curate: jest.fn(),
    appendLog: jest.fn(),
  },
}));

const mockCurate = PersistentMemory.curate as jest.Mock;
const mockAppendLog = PersistentMemory.appendLog as jest.Mock;

describe('MemoryWriteTool', () => {
  let tool: MemoryWriteTool;

  beforeEach(() => {
    tool = new MemoryWriteTool();
    mockCurate.mockClear();
    mockAppendLog.mockClear();
  });

  describe('tool metadata', () => {
    it('has name "memory_write"', () => {
      expect(tool.name).toBe('memory_write');
    });

    it('definition includes userId, fact, and type parameters', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties).toHaveProperty('userId');
      expect(def.parameters.properties).toHaveProperty('fact');
      expect(def.parameters.properties).toHaveProperty('type');
      expect(def.parameters.required).toContain('userId');
      expect(def.parameters.required).toContain('fact');
      expect(def.parameters.required).toContain('type');
    });
  });

  describe('execute — type=permanent', () => {
    it('calls PersistentMemory.curate with userId and fact', async () => {
      const result = await tool.execute({ userId: 'user-42', fact: 'prefere respostas curtas', type: 'permanent' });

      expect(result.success).toBe(true);
      expect(mockCurate).toHaveBeenCalledWith('user-42', 'prefere respostas curtas');
      expect(mockAppendLog).not.toHaveBeenCalled();
    });

    it('result output confirms the saved fact', async () => {
      const result = await tool.execute({ userId: 'u1', fact: 'gosta de Python', type: 'permanent' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('gosta de Python');
    });
  });

  describe('execute — type=log', () => {
    it('calls PersistentMemory.appendLog with userId and fact', async () => {
      const result = await tool.execute({ userId: 'user-99', fact: 'reiniciou nginx', type: 'log' });

      expect(result.success).toBe(true);
      expect(mockAppendLog).toHaveBeenCalledWith('user-99', 'reiniciou nginx');
      expect(mockCurate).not.toHaveBeenCalled();
    });
  });

  describe('execute — validation errors', () => {
    it('returns error for invalid type value', async () => {
      const result = await tool.execute({ userId: 'u1', fact: 'algo', type: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('type inválido');
    });

    it('throws when required argument userId is missing', async () => {
      await expect(tool.execute({ fact: 'algo', type: 'log' })).rejects.toThrow('Missing required argument: userId');
    });

    it('throws when required argument fact is missing', async () => {
      await expect(tool.execute({ userId: 'u1', type: 'log' })).rejects.toThrow('Missing required argument: fact');
    });

    it('throws when required argument type is missing', async () => {
      await expect(tool.execute({ userId: 'u1', fact: 'algo' })).rejects.toThrow('Missing required argument: type');
    });
  });
});
