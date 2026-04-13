/**
 * Phase 5 Integration Tests: Tool Permissions in Agent Loop
 */

import { AgentLoop } from '../../src/core/agent-loop/agent-loop';
import { createMockProvider } from '../mocks/mock-provider';

describe('DVACE Phase 5: Integration - Tool Permissions in Agent Loop', () => {
  describe('5.3.1: Permission Enforcement', () => {
    it('should allow tool when in allowedTools', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      // Mock LLM response with FileRead tool call
      mockResponse({
        content: 'Reading the file',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'FileRead',
              arguments: { path: '/path/to/file.txt' },
            },
          },
        ],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        ['FileRead(*)'] // Only FileRead allowed
      );
      
      // This should execute FileRead successfully
      const result = await loop.run('Read the file');
      
      // Verify tool was executed (not permission blocked)
      expect(result).toBeTruthy();
    });

    it('should block tool not in allowedTools', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      // Mock LLM trying to use SSHExec (not allowed)
      mockResponse({
        content: 'Executing command',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'SSHExec',
              arguments: { command: 'whoami' },
            },
          },
        ],
      });
      
      // Mock LLM response after receiving PERMISSION DENIED
      mockResponse({
        content: 'I apologize, but I cannot execute that command. PERMISSION DENIED for SSHExec.',
        finishReason: 'stop',
        toolCalls: [],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        ['FileRead(*)'] // Only FileRead allowed, SSHExec blocked
      );
      
      const result = await loop.run('Execute whoami command');
      
      // Verify permission denied message was added to history
      expect(result).toContain('PERMISSION DENIED');
    });

    it('should enforce git-only bash commands', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      // Mock LLM trying non-git bash command
      mockResponse({
        content: 'Running command',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'Bash',
              arguments: { command: 'rm -rf /' },
            },
          },
        ],
      });
      
      // Mock LLM response after PERMISSION DENIED
      mockResponse({
        content: 'Sorry, that command is not allowed. PERMISSION DENIED for non-git bash command.',
        finishReason: 'stop',
        toolCalls: [],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        ['Bash(git *)'] // Only git commands allowed
      );
      
      const result = await loop.run('Delete everything');
      
      // Verify blocked
      expect(result).toContain('PERMISSION DENIED');
    });
  });

  describe('5.3.2: PromptCommand Patterns', () => {
    it('should support /review command pattern', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      const reviewAllowedTools = [
        'Bash(git *)',
        'FileRead(*)',
        'FileEdit(*)',
        'ListDirectory(*)',
      ];
      
      // Mock git status call
      mockResponse({
        content: 'Checking git status',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'Bash',
              arguments: { command: 'git status' },
            },
          },
        ],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        reviewAllowedTools
      );
      
      const result = await loop.run('Check git status');
      
      // Should succeed with git command
      expect(result).not.toContain('PERMISSION DENIED');
    });

    it('should block SSH in /review command', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      const reviewAllowedTools = [
        'Bash(git *)',
        'FileRead(*)',
        'FileEdit(*)',
        'ListDirectory(*)',
      ];
      
      // Mock SSHExec call (not allowed in review)
      mockResponse({
        content: 'Checking server',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'SSHExec',
              arguments: { command: 'docker ps' },
            },
          },
        ],
      });
      
      // Mock LLM response after PERMISSION DENIED
      mockResponse({
        content: 'I cannot access the server. PERMISSION DENIED for SSHExec in review mode.',
        finishReason: 'stop',
        toolCalls: [],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        reviewAllowedTools
      );
      
      const result = await loop.run('Check Docker containers');
      
      // Should be blocked
      expect(result).toContain('PERMISSION DENIED');
    });

    it('should support /commit command pattern', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      const commitAllowedTools = [
        'Bash(git commit*)',
        'Bash(git push*)',
        'Bash(git add*)',
        'FileRead(*)',
      ];
      
      // Mock git commit
      mockResponse({
        content: 'Committing changes',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'Bash',
              arguments: { command: 'git commit -m "fix: bug"' },
            },
          },
        ],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        commitAllowedTools
      );
      
      const result = await loop.run('Commit changes');
      
      // Should succeed
      expect(result).not.toContain('PERMISSION DENIED');
    });
  });

  describe('5.3.3: Free Conversation Fallback', () => {
    it('should allow all tools with wildcard', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      // Mock any tool call
      mockResponse({
        content: 'Executing',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'AnyTool',
              arguments: { value: 'any args' },
            },
          },
        ],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        ['*'] // Allow all tools (default for free conversation)
      );
      
      const result = await loop.run('Do anything');
      
      // Should not be blocked
      expect(result).not.toContain('PERMISSION DENIED');
    });

    it('should default to wildcard if no allowedTools provided', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      mockResponse({
        content: 'OK',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'AnyTool',
              arguments: { value: 'args' },
            },
          },
        ],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1'
        // No allowedTools parameter → should default to ['*']
      );
      
      const result = await loop.run('Test');
      expect(result).not.toContain('PERMISSION DENIED');
    });
  });

  describe('5.3.4: Negation Patterns', () => {
    it('should block negated patterns', async () => {
      const { provider, mockResponse } = createMockProvider();
      
      mockResponse({
        content: 'Reading file',
        finishReason: 'tool_calls',
        toolCalls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'FileRead',
              arguments: { path: '/etc/passwd' },
            },
          },
        ],
      });
      
      // Mock LLM response after PERMISSION DENIED by negation pattern
      mockResponse({
        content: 'Access denied due to negation pattern. PERMISSION DENIED for /etc/ files.',
        finishReason: 'stop',
        toolCalls: [],
      });
      
      const loop = new AgentLoop(
        provider,
        [],
        undefined,
        undefined,
        [],
        'conv-1',
        ['FileRead(*)', '!FileRead(/etc/*)'] // Block /etc/ files
      );
      
      const result = await loop.run('Read /etc/passwd');
      
      // Should be blocked by negation
      expect(result).toContain('PERMISSION DENIED');
      expect(result).toContain('negation pattern');
    });
  });
});
