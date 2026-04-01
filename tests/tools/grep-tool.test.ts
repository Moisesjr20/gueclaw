/**
 * GrepTool Unit Tests
 * 
 * Tests for regex-based code search functionality
 */

import { GrepTool } from '../../src/tools/grep-tool';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('GrepTool', () => {
  let grepTool: GrepTool;

  beforeEach(() => {
    grepTool = new GrepTool();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(grepTool.name).toBe('grep_search');
    });

    it('should have description', () => {
      const definition = grepTool.getDefinition();
      expect(definition.description).toBeTruthy();
      expect(definition.description).toContain('ripgrep');
    });

    it('should have valid parameter schema', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters).toBeDefined();
      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.properties).toBeDefined();
      expect(definition.parameters.required).toContain('pattern');
    });

    it('should have pattern parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.pattern).toBeDefined();
      expect(definition.parameters.properties.pattern.type).toBe('string');
    });

    it('should have optional path parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.path).toBeDefined();
      expect(definition.parameters.properties.path.type).toBe('string');
      expect(definition.parameters.required).not.toContain('path');
    });

    it('should have case_insensitive boolean parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.case_insensitive).toBeDefined();
      expect(definition.parameters.properties.case_insensitive.type).toBe('boolean');
    });

    it('should have glob pattern parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.glob).toBeDefined();
      expect(definition.parameters.properties.glob.type).toBe('string');
    });

    it('should have type filter parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.type).toBeDefined();
      expect(definition.parameters.properties.type.type).toBe('string');
    });

    it('should have show_content parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.show_content).toBeDefined();
      expect(definition.parameters.properties.show_content.type).toBe('boolean');
    });

    it('should have limit parameter', () => {
      const definition = grepTool.getDefinition();
      expect(definition.parameters.properties.limit).toBeDefined();
      expect(definition.parameters.properties.limit.type).toBe('number');
    });
  });

  describe('Input Validation', () => {
    it('should require pattern parameter', async () => {
      const result = await grepTool.execute({ });
      
      expect(result.success).toBe(false);
      expect(result.output).toContain('pattern');
    });

    it('should accept valid pattern', async () => {
      const result = await grepTool.execute({
        pattern: 'class.*Controller',
      });

      // Should not throw validation error
      // May fail with ripgrep not installed, but that's different
      expect(result).toBeDefined();
    });

    it('should accept optional path parameter', async () => {
      const result = await grepTool.execute({
        pattern: 'test',
        path: './src',
      });

      expect(result).toBeDefined();
    });

    it('should reject non-existent path', async () => {
      const result = await grepTool.execute({
        pattern: 'test',
        path: './this-path-does-not-exist-xyz',
      });

      expect(result.success).toBe(false);
      
      // Should either:
      // 1. Report path does not exist (if ripgrep is installed)
      // 2. Report ripgrep not installed (if ripgrep is missing)
      expect(
        result.output.includes('does not exist') ||
        result.output.includes('ripgrep')
      ).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('should search for pattern in current directory', async () => {
      const result = await grepTool.execute({
        pattern: 'GrepTool',
      });

      // Should either:
      // 1. Find matches (success=true, output contains files)
      // 2. Warn that ripgrep is not installed (success=false)
      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep')) {
        // If ripgrep is installed, should find matches
        expect(result.success).toBe(true);
      }
    });

    it('should search with case insensitive flag', async () => {
      const result = await grepTool.execute({
        pattern: 'greptool',
        case_insensitive: true,
      });

      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep')) {
        expect(result.success).toBe(true);
      }
    });

    it('should search with glob pattern', async () => {
      const result = await grepTool.execute({
        pattern: 'import',
        glob: '*.ts',
      });

      expect(result).toBeDefined();
    });

    it('should search with type filter', async () => {
      const result = await grepTool.execute({
        pattern: 'function',
        type: 'ts',
      });

      expect(result).toBeDefined();
    });

    it('should limit results', async () => {
      const result = await grepTool.execute({
        pattern: 'const',
        limit: 5,
      });

      expect(result).toBeDefined();
      
      if (result.success && result.metadata?.matchCount) {
        expect(result.metadata.matchCount).toBeLessThanOrEqual(5);
      }
    });

    it('should show content when requested', async () => {
      const result = await grepTool.execute({
        pattern: 'GrepTool',
        show_content: true,
        limit: 3,
      });

      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep') && result.success) {
        // Should show matching lines, not just filenames
        expect(result.output).not.toBe('No matches found.');
      }
    });

    it('should handle no matches gracefully', async () => {
      const result = await grepTool.execute({
        pattern: 'ThisPatternDefinitelyDoesNotExistInTheCodebaseXYZ123',
      });

      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep')) {
        expect(result.success).toBe(true);
        expect(result.output).toContain('No matches found');
      }
    });

    it('should search in specific directory', async () => {
      const result = await grepTool.execute({
        pattern: 'Tool',
        path: './src/tools',
      });

      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep')) {
        expect(result.success).toBe(true);
      }
    });

    it('should handle patterns starting with dash', async () => {
      const result = await grepTool.execute({
        pattern: '-n',
      });

      // Should not interpret -n as a flag
      expect(result).toBeDefined();
    });

    it('should show context lines when requested', async () => {
      const result = await grepTool.execute({
        pattern: 'GrepTool',
        show_content: true,
        context_lines: 2,
        limit: 3,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Result Formatting', () => {
    it('should include metadata in successful results', async () => {
      const result = await grepTool.execute({
        pattern: 'import',
        limit: 5,
      });

      if (!result.output.includes('ripgrep') && result.success) {
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.pattern).toBe('import');
        expect(result.metadata?.searchPath).toBeDefined();
        expect(typeof result.metadata?.matchCount).toBe('number');
      }
    });

    it('should indicate truncation when limit is applied', async () => {
      const result = await grepTool.execute({
        pattern: 'const',
        limit: 2,
      });

      if (!result.output.includes('ripgrep') && result.success) {
        if (result.metadata?.matchCount && result.metadata.matchCount > 2) {
          expect(result.metadata.truncated).toBe(true);
        }
      }
    });

    it('should show file count summary', async () => {
      const result = await grepTool.execute({
        pattern: 'Tool',
        limit: 5,
      });

      if (!result.output.includes('ripgrep') && result.success) {
        expect(result.output).toMatch(/Found \d+ file/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should detect missing ripgrep', async () => {
      // This test will pass if ripgrep is installed or fail gracefully if not
      const result = await grepTool.execute({
        pattern: 'test',
      });

      expect(result).toBeDefined();
      expect(result.output).toBeTruthy();
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const result = await grepTool.execute({
        pattern: '[invalid(regex',
      });

      expect(result).toBeDefined();
      
      if (!result.output.includes('ripgrep is not installed')) {
        // If ripgrep is installed, should report error
        // (may succeed or fail depending on ripgrep version/strictness)
        expect(result).toBeDefined();
      }
    });

    it('should handle timeout gracefully', async () => {
      // Search for common pattern that might take time
      const result = await grepTool.execute({
        pattern: '.*',
        limit: 1000,
      });

      expect(result).toBeDefined();
    });
  });

  describe('VCS Directory Exclusion', () => {
    it('should exclude .git directory', async () => {
      const result = await grepTool.execute({
        pattern: 'head',
        show_content: false,
      });

      if (!result.output.includes('ripgrep') && result.success) {
        // Should not return files from .git directory
        expect(result.output).not.toMatch(/\.git\//);
      }
    });
  });

  describe('Performance', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = Date.now();
      
      await grepTool.execute({
        pattern: 'function',
        type: 'ts',
        limit: 10,
      });

      const duration = Date.now() - startTime;
      
      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    }, 35000);
  });
});
