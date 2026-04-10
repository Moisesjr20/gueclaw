/**
 * Phase 1 Integration Tests (DVACE Architecture)
 * 
 * Validates the Command System implementation:
 * - LocalCommands execute immediately without LLM
 * - CommandRegistry properly stores and retrieves commands
 * - Integration with bot handlers works correctly
 */

import { CommandRegistry } from '../../src/core/command-registry';
import {
  versionCommand,
  helpCommand,
  statusCommand,
  tasksCommand,
  reviewCommand,
  commitCommand
} from '../../src/commands/telegram-commands';
import { CommandContext } from '../../src/types/command-types';

describe('Phase 1 - Command System Integration', () => {
  let registry: CommandRegistry;
  
  beforeEach(() => {
    CommandRegistry.reset();
    registry = CommandRegistry.getInstance();
  });
  
  describe('1.1 & 1.2 - Command Types and Registry', () => {
    it('should register LocalCommand successfully', () => {
      registry.register(versionCommand);
      
      expect(registry.hasCommand('version')).toBe(true);
      expect(registry.get('version')).toBeDefined();
      expect(registry.get('version')?.type).toBe('local');
    });
    
    it('should register PromptCommand successfully', () => {
      registry.register(reviewCommand);
      
      expect(registry.hasCommand('review')).toBe(true);
      expect(registry.get('review')?.type).toBe('prompt');
    });
    
    it('should handle command aliases', () => {
      registry.register(helpCommand);
      
      expect(registry.get('help')).toBeDefined();
      expect(registry.get('h')).toBeDefined();
      expect(registry.get('?')).toBeDefined();
      
      // All aliases should point to same command
      expect(registry.get('help')).toBe(registry.get('h'));
    });
    
    it('should list all registered commands', () => {
      registry.register(versionCommand);
      registry.register(helpCommand);
      registry.register(reviewCommand);
      
      const commands = registry.listCommands();
      
      expect(commands).toContain('version');
      expect(commands).toContain('help');
      expect(commands).toContain('review');
    });
    
    it('should provide registry statistics', () => {
      registry.register(versionCommand);
      registry.register(helpCommand);
      registry.register(reviewCommand);
      registry.register(commitCommand);
      
      const stats = registry.getStats();
      
      expect(stats.totalCommands).toBe(4);
      expect(stats.localCommands).toBe(2); // version, help
      expect(stats.promptCommands).toBe(2); // review, commit
      expect(stats.aliasCount).toBeGreaterThan(0); // help has aliases
    });
  });
  
  describe('1.3 - Command Migration', () => {
    it('version command should return immediately', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const startTime = Date.now();
      const result = await versionCommand.run([], context);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('GueClaw Agent');
      expect(result.message).toContain('Version');
      expect(duration).toBeLessThan(100); // Should be instant
    });
    
    it('status command should return system info', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const result = await statusCommand.run([], context);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Online');
      expect(result.message).toContain('Uptime');
      expect(result.message).toContain('Memory');
      expect(result.data).toBeDefined();
      expect(result.data?.uptime).toBeGreaterThan(0);
    });
    
    it('tasks command should list tasks (empty or with data)', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const result = await tasksCommand.run([], context);
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      // Message should contain either "Nenhuma tarefa" or "Tarefas Ativas"
      expect(
        result.message?.includes('Nenhuma tarefa') ||
        result.message?.includes('Tarefas Ativas')
      ).toBe(true);
    });
    
    it('help command should list available commands', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const result = await helpCommand.run([], context);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Help');
      expect(result.message).toContain('/start');
      expect(result.message).toContain('/help');
      expect(result.message).toContain('/stats');
    });
  });
  
  describe('1.4 - PromptCommand Configuration', () => {
    it('review command should have git-related tools', () => {
      expect(reviewCommand.type).toBe('prompt');
      expect(reviewCommand.allowedTools).toContain('Bash(git *)');
      expect(reviewCommand.allowedTools).toContain('FileRead(*)');
      expect(reviewCommand.allowedTools).toContain('FileEdit(*)');
    });
    
    it('review command should generate appropriate prompt', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const prompt = await reviewCommand.getPrompt([], context);
      
      // prompt can be string or Message[]
      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      expect(promptText).toContain('review');
      expect(promptText.toLowerCase()).toContain('git');
    });
    
    it('commit command should have commit-related tools', () => {
      expect(commitCommand.type).toBe('prompt');
      expect(commitCommand.allowedTools).toContain('Bash(git commit *)');
      expect(commitCommand.allowedTools).toContain('Bash(git push *)');
    });
    
    it('commit command should accept custom message', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const customMessage = ['fix:', 'correct', 'typo'];
      const prompt = await commitCommand.getPrompt(customMessage, context);
      
      // prompt can be string or Message[]
      const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      
      expect(promptText).toContain('fix: correct typo');
    });
  });
  
  describe('Phase 1 Validation - CRITICAL', () => {
    it('LocalCommands NEVER invoke LLM', async () => {
      // Create a mock to track if any network call is made
      const networkSpy = jest.spyOn(global, 'fetch');
      
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      // Execute multiple local commands
      await versionCommand.run([], context);
      await helpCommand.run([], context);
      await statusCommand.run([], context);
      
      // No network calls should be made
      expect(networkSpy).not.toHaveBeenCalled();
      
      networkSpy.mockRestore();
    });
    
    it('Response time for LocalCommands < 500ms', async () => {
      const context: CommandContext = {
        userId: 'test-user',
        conversationId: 'test-conv',
        messageHistory: []
      };
      
      const commands = [
        versionCommand,
        helpCommand,
        statusCommand
      ];
      
      for (const cmd of commands) {
        const startTime = Date.now();
        await cmd.run([], context);
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(500);
      }
    });
    
    it('PromptCommands have allowedTools restrictions', () => {
      const promptCommands = [
        reviewCommand,
        commitCommand
      ];
      
      for (const cmd of promptCommands) {
        expect(cmd.allowedTools).toBeDefined();
        expect(cmd.allowedTools.length).toBeGreaterThan(0);
        
        // Should not allow all tools (security)
        expect(cmd.allowedTools).not.toContain('*');
      }
    });
  });
});
