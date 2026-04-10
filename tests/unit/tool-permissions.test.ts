/**
 * Tool Permission System Tests (DVACE Phase 5.2)
 */

import { canUseTool, validateToolPatterns } from '../../src/core/tools/tool-permissions';

describe('DVACE Phase 5: Tool Permission System', () => {
  describe('5.2.1: Basic Tool Matching', () => {
    it('should allow exact tool name match', () => {
      const result = canUseTool('FileRead', '/path/to/file', ['FileRead']);
      expect(result.allowed).toBe(true);
    });

    it('should block tool not in allowedTools', () => {
      const result = canUseTool('FileWrite', '/path/to/file', ['FileRead']);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not in allowedTools');
    });

    it('should allow wildcard (*) for all tools', () => {
      const result = canUseTool('AnyTool', 'any args', ['*']);
      expect(result.allowed).toBe(true);
    });
  });

  describe('5.2.2: Argument Pattern Matching', () => {
    it('should allow tool with wildcard args', () => {
      const result = canUseTool('FileRead', '/etc/passwd', ['FileRead(*)']);
      expect(result.allowed).toBe(true);
    });

    it('should match prefix pattern', () => {
      const result = canUseTool('Bash', 'git status', ['Bash(git *)']);
      expect(result.allowed).toBe(true);
    });

    it('should block non-matching prefix pattern', () => {
      const result = canUseTool('Bash', 'rm -rf /', ['Bash(git *)']);
      expect(result.allowed).toBe(false);
    });

    it('should match substring in args', () => {
      const result = canUseTool('SSHExec', 'docker ps -a', ['SSHExec(docker)']);
      expect(result.allowed).toBe(true);
    });

    it('should block non-matching substring', () => {
      const result = canUseTool('SSHExec', 'systemctl restart', ['SSHExec(docker)']);
      expect(result.allowed).toBe(false);
    });
  });

  describe('5.2.3: Negation Patterns', () => {
    it('should block tool with negation pattern', () => {
      const result = canUseTool('FileRead', '/etc/passwd', [
        'FileRead(*)',
        '!FileRead(/etc/*)',
      ]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('negation pattern');
    });

    it('should allow tool not matching negation', () => {
      const result = canUseTool('FileRead', '/home/user/file.txt', [
        'FileRead(*)',
        '!FileRead(/etc/*)',
      ]);
      expect(result.allowed).toBe(true);
    });

    it('should prioritize negation over positive patterns', () => {
      const result = canUseTool('FileEdit', 'config.env', [
        'FileEdit(*)',
        '!FileEdit(*.env)',
      ]);
      expect(result.allowed).toBe(false);
    });
  });

  describe('5.2.4: Real-World Command Patterns', () => {
    describe('/review command', () => {
      const reviewAllowedTools = [
        'Bash(git *)',
        'FileRead(*)',
        'FileEdit(*)',
        'ListDirectory(*)',
      ];

      it('should allow git commands', () => {
        expect(canUseTool('Bash', 'git status', reviewAllowedTools).allowed).toBe(true);
        expect(canUseTool('Bash', 'git diff', reviewAllowedTools).allowed).toBe(true);
        expect(canUseTool('Bash', 'git log', reviewAllowedTools).allowed).toBe(true);
      });

      it('should allow file operations', () => {
        expect(canUseTool('FileRead', 'src/index.ts', reviewAllowedTools).allowed).toBe(true);
        expect(canUseTool('FileEdit', 'README.md', reviewAllowedTools).allowed).toBe(true);
        expect(canUseTool('ListDirectory', 'src/', reviewAllowedTools).allowed).toBe(true);
      });

      it('should block non-git bash commands', () => {
        expect(canUseTool('Bash', 'rm -rf /', reviewAllowedTools).allowed).toBe(false);
        expect(canUseTool('Bash', 'curl malicious.com', reviewAllowedTools).allowed).toBe(false);
      });

      it('should block SSH and Docker tools', () => {
        expect(canUseTool('SSHExec', 'whoami', reviewAllowedTools).allowed).toBe(false);
        expect(canUseTool('DockerCommand', 'ps', reviewAllowedTools).allowed).toBe(false);
      });
    });

    describe('/commit command', () => {
      const commitAllowedTools = [
        'Bash(git commit*)',
        'Bash(git push*)',
        'Bash(git add*)',
        'FileRead(*)',
      ];

      it('should allow git commit operations', () => {
        expect(canUseTool('Bash', 'git commit -m "fix"', commitAllowedTools).allowed).toBe(true);
        expect(canUseTool('Bash', 'git push origin main', commitAllowedTools).allowed).toBe(true);
        expect(canUseTool('Bash', 'git add .', commitAllowedTools).allowed).toBe(true);
      });

      it('should block other git commands', () => {
        expect(canUseTool('Bash', 'git status', commitAllowedTools).allowed).toBe(false);
        expect(canUseTool('Bash', 'git reset --hard', commitAllowedTools).allowed).toBe(false);
      });
    });

    describe('/deploy command', () => {
      const deployAllowedTools = [
        'SSHExec(*)',
        'DockerCommand(*)',
        'Bash(git pull*)',
        '!SSHExec(rm *)',
      ];

      it('should allow SSH and Docker commands', () => {
        expect(canUseTool('SSHExec', 'docker-compose up -d', deployAllowedTools).allowed).toBe(
          true
        );
        expect(canUseTool('DockerCommand', 'restart nginx', deployAllowedTools).allowed).toBe(true);
      });

      it('should allow git pull', () => {
        expect(canUseTool('Bash', 'git pull origin main', deployAllowedTools).allowed).toBe(true);
      });

      it('should block dangerous rm commands', () => {
        expect(canUseTool('SSHExec', 'rm -rf /', deployAllowedTools).allowed).toBe(false);
        expect(canUseTool('SSHExec', 'rm file.txt', deployAllowedTools).allowed).toBe(false);
      });
    });
  });

  describe('5.2.5: Pattern Validation', () => {
    it('should validate correct patterns', () => {
      const result = validateToolPatterns([
        'ToolName',
        'ToolName(*)',
        'ToolName(pattern*)',
        '!ToolName(blocked)',
      ]);
      expect(result.valid).toBe(true);
      expect(result.invalid).toHaveLength(0);
    });

    it('should detect invalid patterns', () => {
      const result = validateToolPatterns([
        'ToolName(',
        'ToolName)',
        '!()',
        'Tool(Name(nested))',
      ]);
      expect(result.valid).toBe(false);
      expect(result.invalid.length).toBeGreaterThan(0);
    });

    it('should allow wildcard', () => {
      const result = validateToolPatterns(['*']);
      expect(result.valid).toBe(true);
    });
  });

  describe('5.2.6: Edge Cases', () => {
    it('should handle empty allowedTools', () => {
      const result = canUseTool('AnyTool', 'args', []);
      expect(result.allowed).toBe(false);
    });

    it('should handle object args', () => {
      const result = canUseTool('ComplexTool', { param1: 'value', param2: 123 }, ['ComplexTool(*)']);
      expect(result.allowed).toBe(true);
    });

    it('should handle case-sensitive matching', () => {
      const result = canUseTool('FileRead', '/path/FILE.TXT', ['FileRead(*/file.txt)']);
      expect(result.allowed).toBe(false); // Case-sensitive
    });

    it('should handle multiple patterns for same tool', () => {
      const result = canUseTool('Bash', 'git status', [
        'Bash(npm *)',
        'Bash(git *)',
        'Bash(docker *)',
      ]);
      expect(result.allowed).toBe(true);
    });
  });
});
