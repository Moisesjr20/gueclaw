/**
 * Command Registry Unit Tests (DVACE Architecture - Phase 1.2)
 */

import { CommandRegistry } from '../../src/core/command-registry';
import {
  LocalCommand,
  PromptCommand,
  ToolCommand,
  CommandContext,
  CommandResult
} from '../../src/types/command-types';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;
  
  beforeEach(() => {
    // Reset registry before each test
    CommandRegistry.reset();
    registry = CommandRegistry.getInstance();
  });
  
  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CommandRegistry.getInstance();
      const instance2 = CommandRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
    
    it('should reset singleton', () => {
      const instance1 = CommandRegistry.getInstance();
      CommandRegistry.reset();
      const instance2 = CommandRegistry.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('LocalCommand Registration', () => {
    it('should register a local command', () => {
      const versionCommand: LocalCommand = {
        type: 'local',
        name: 'version',
        description: 'Show version',
        run: async (): Promise<CommandResult> => ({
          success: true,
          message: 'v1.0.0'
        })
      };
      
      registry.register(versionCommand);
      
      expect(registry.hasCommand('version')).toBe(true);
      expect(registry.get('version')).toEqual(versionCommand);
    });
    
    it('should register local command with aliases', () => {
      const helpCommand: LocalCommand = {
        type: 'local',
        name: 'help',
        description: 'Show help',
        aliases: ['h', '?'],
        run: async () => ({ success: true, message: 'Help text' })
      };
      
      registry.register(helpCommand);
      
      expect(registry.get('help')).toEqual(helpCommand);
      expect(registry.get('h')).toEqual(helpCommand);
      expect(registry.get('?')).toEqual(helpCommand);
    });
    
    it('should normalize command names (case-insensitive)', () => {
      const command: LocalCommand = {
        type: 'local',
        name: 'VERSION',
        description: 'Version',
        run: async () => ({ success: true })
      };
      
      registry.register(command);
      
      expect(registry.get('version')).toBeDefined();
      expect(registry.get('VERSION')).toBeDefined();
      expect(registry.get('VeRsIoN')).toBeDefined();
    });
    
    it('should handle leading slash in command name', () => {
      const command: LocalCommand = {
        type: 'local',
        name: '/start',
        description: 'Start',
        run: async () => ({ success: true })
      };
      
      registry.register(command);
      
      expect(registry.get('start')).toBeDefined();
      expect(registry.get('/start')).toBeDefined();
    });
  });
  
  describe('PromptCommand Registration', () => {
    it('should register a prompt command', () => {
      const reviewCommand: PromptCommand = {
        type: 'prompt',
        name: 'review',
        description: 'AI code review',
        allowedTools: ['FileRead(*)', 'Bash(git *)'],
        getPrompt: async () => 'Review staged changes'
      };
      
      registry.register(reviewCommand);
      
      expect(registry.hasCommand('review')).toBe(true);
      const cmd = registry.get('review');
      expect(cmd?.type).toBe('prompt');
    });
  });
  
  describe('ToolCommand Registration', () => {
    it('should register a tool command', () => {
      const fileReadCommand: ToolCommand = {
        type: 'tool',
        name: 'file-read',
        description: 'Read file',
        toolName: 'FileRead',
        execute: async (input) => ({
          success: true,
          output: 'file contents',
          metadata: input
        })
      };
      
      registry.register(fileReadCommand);
      
      expect(registry.hasCommand('file-read')).toBe(true);
    });
  });
  
  describe('Command Lookup', () => {
    beforeEach(() => {
      registry.register({
        type: 'local',
        name: 'cmd1',
        description: 'Command 1',
        run: async () => ({ success: true })
      });
      
      registry.register({
        type: 'local',
        name: 'cmd2',
        description: 'Command 2',
        aliases: ['c2'],
        run: async () => ({ success: true })
      });
    });
    
    it('should get command by name', () => {
      expect(registry.get('cmd1')).toBeDefined();
      expect(registry.get('cmd1')?.name).toBe('cmd1');
    });
    
    it('should get command by alias', () => {
      const cmd = registry.get('c2');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('cmd2');
    });
    
    it('should return undefined for non-existent command', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });
  
  describe('Command Listing', () => {
    beforeEach(() => {
      registry.register({
        type: 'local',
        name: 'version',
        description: 'Version',
        run: async () => ({ success: true })
      });
      
      registry.register({
        type: 'local',
        name: 'help',
        description: 'Help',
        run: async () => ({ success: true })
      }, { hidden: true });
      
      registry.register({
        type: 'prompt',
        name: 'review',
        description: 'Review',
        allowedTools: [],
        getPrompt: async () => 'prompt'
      });
    });
    
    it('should list all commands (excluding hidden)', () => {
      const commands = registry.listCommands();
      
      expect(commands).toContain('version');
      expect(commands).toContain('review');
      expect(commands).not.toContain('help'); // Hidden
    });
    
    it('should list all commands including hidden', () => {
      const commands = registry.listCommands(true);
      
      expect(commands).toContain('version');
      expect(commands).toContain('help');
      expect(commands).toContain('review');
    });
    
    it('should list commands by type', () => {
      const localCommands = registry.listByType('local');
      const promptCommands = registry.listByType('prompt');
      
      expect(localCommands.length).toBe(2); // version, help
      expect(promptCommands.length).toBe(1); // review
    });
  });
  
  describe('Command Overriding', () => {
    const originalCommand: LocalCommand = {
      type: 'local',
      name: 'test',
      description: 'Original',
      run: async () => ({ success: true, message: 'original' })
    };
    
    const newCommand: LocalCommand = {
      type: 'local',
      name: 'test',
      description: 'New',
      run: async () => ({ success: true, message: 'new' })
    };
    
    it('should throw error when registering duplicate without override', () => {
      registry.register(originalCommand);
      
      expect(() => {
        registry.register(newCommand);
      }).toThrow('already registered');
    });
    
    it('should allow override when override=true', () => {
      registry.register(originalCommand);
      registry.register(newCommand, { override: true });
      
      const cmd = registry.get('test');
      expect(cmd?.description).toBe('New');
    });
  });
  
  describe('Command Unregistration', () => {
    it('should unregister a command', () => {
      registry.register({
        type: 'local',
        name: 'temp',
        description: 'Temporary',
        run: async () => ({ success: true })
      });
      
      expect(registry.hasCommand('temp')).toBe(true);
      
      const removed = registry.unregister('temp');
      
      expect(removed).toBe(true);
      expect(registry.hasCommand('temp')).toBe(false);
    });
    
    it('should return false when unregistering non-existent command', () => {
      const removed = registry.unregister('nonexistent');
      expect(removed).toBe(false);
    });
  });
  
  describe('Registry Statistics', () => {
    beforeEach(() => {
      registry.register({
        type: 'local',
        name: 'cmd1',
        description: 'Local 1',
        run: async () => ({ success: true })
      });
      
      registry.register({
        type: 'local',
        name: 'cmd2',
        description: 'Local 2',
        aliases: ['c2', 'command2'],
        run: async () => ({ success: true })
      }, { hidden: true });
      
      registry.register({
        type: 'prompt',
        name: 'cmd3',
        description: 'Prompt',
        allowedTools: [],
        getPrompt: async () => 'prompt'
      });
      
      registry.register({
        type: 'tool',
        name: 'cmd4',
        description: 'Tool',
        toolName: 'SomeTool',
        execute: async () => ({ success: true, output: 'ok' })
      });
    });
    
    it('should return correct statistics', () => {
      const stats = registry.getStats();
      
      expect(stats.totalCommands).toBe(4);
      expect(stats.localCommands).toBe(2);
      expect(stats.promptCommands).toBe(1);
      expect(stats.toolCommands).toBe(1);
      expect(stats.hiddenCommands).toBe(1);
      expect(stats.aliasCount).toBe(2); // c2, command2
    });
  });
  
  describe('Error Handling', () => {
    it('should throw error for empty command name', () => {
      expect(() => {
        registry.register({
          type: 'local',
          name: '',
          description: 'Empty name',
          run: async () => ({ success: true })
        });
      }).toThrow('Command name cannot be empty');
    });
    
    it('should throw error for duplicate alias', () => {
      registry.register({
        type: 'local',
        name: 'cmd1',
        description: 'Command 1',
        aliases: ['alias1'],
        run: async () => ({ success: true })
      });
      
      expect(() => {
        registry.register({
          type: 'local',
          name: 'cmd2',
          description: 'Command 2',
          aliases: ['alias1'], // Duplicate alias
          run: async () => ({ success: true })
        });
      }).toThrow('already registered');
    });
  });
  
  describe('Clear Registry', () => {
    it('should clear all commands', () => {
      registry.register({
        type: 'local',
        name: 'cmd1',
        description: 'Command 1',
        run: async () => ({ success: true })
      });
      
      registry.register({
        type: 'local',
        name: 'cmd2',
        description: 'Command 2',
        run: async () => ({ success: true })
      });
      
      expect(registry.listCommands().length).toBe(2);
      
      registry.clear();
      
      expect(registry.listCommands().length).toBe(0);
      expect(registry.hasCommand('cmd1')).toBe(false);
    });
  });
});
