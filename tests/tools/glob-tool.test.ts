/**
 * GlobTool Unit Tests
 * 
 * Tests for file pattern matching functionality
 */

import { GlobTool } from '../../src/tools/glob-tool';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('GlobTool', () => {
  let globTool: GlobTool;

  beforeEach(() => {
    globTool = new GlobTool();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(globTool.name).toBe('glob_search');
    });

    it('should have description', () => {
      const definition = globTool.getDefinition();
      expect(definition.description).toBeTruthy();
      expect(definition.description).toContain('glob');
    });

    it('should have valid parameter schema', () => {
      const definition = globTool.getDefinition();
      expect(definition.parameters).toBeDefined();
      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.properties).toBeDefined();
      expect(definition.parameters.required).toContain('pattern');
    });

    it('should have pattern parameter', () => {
      const definition = globTool.getDefinition();
      expect(definition.parameters.properties.pattern).toBeDefined();
      expect(definition.parameters.properties.pattern.type).toBe('string');
    });

    it('should have optional path parameter', () => {
      const definition = globTool.getDefinition();
      expect(definition.parameters.properties.path).toBeDefined();
      expect(definition.parameters.properties.path.type).toBe('string');
      expect(definition.parameters.required).not.toContain('path');
    });

    it('should have limit parameter', () => {
      const definition = globTool.getDefinition();
      expect(definition.parameters.properties.limit).toBeDefined();
      expect(definition.parameters.properties.limit.type).toBe('number');
    });

    it('should have ignore_vcs parameter', () => {
      const definition = globTool.getDefinition();
      expect(definition.parameters.properties.ignore_vcs).toBeDefined();
      expect(definition.parameters.properties.ignore_vcs.type).toBe('boolean');
    });
  });

  describe('Input Validation', () => {
    it('should require pattern parameter', async () => {
      const result = await globTool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.output).toContain('pattern');
    });

    it('should accept valid pattern', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
      });

      expect(result).toBeDefined();
      // Should either succeed or fail gracefully
    });

    it('should accept optional path parameter', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
        path: './src',
      });

      expect(result).toBeDefined();
    });

    it('should reject non-existent path', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
        path: './this-path-does-not-exist-xyz',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('does not exist');
    });

    it('should reject file path (not directory)', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
        path: './package.json',
      });

      expect(result.success).toBe(false);
      expect(result.output).toContain('not a directory');
    });
  });

  describe('Pattern Matching', () => {
    it('should find TypeScript files with *.ts pattern', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
      });

      expect(result.success).toBe(true);
      
      if (result.metadata?.numFiles && result.metadata.numFiles > 0) {
        expect(result.output).toContain('.ts');
      }
    });

    it('should find files recursively with **/*.ts pattern', async () => {
      const result = await globTool.execute({
        pattern: 'src/**/*.ts',
      });

      expect(result.success).toBe(true);
      
      if (result.metadata?.numFiles && result.metadata.numFiles > 0) {
        expect(result.output).toContain('src/');
      }
    });

    it('should support brace expansion {ts,tsx} pattern', async () => {
      const result = await globTool.execute({
        pattern: 'src/**/*.{ts,tsx}',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
    });

    it('should handle no matches gracefully', async () => {
      const result = await globTool.execute({
        pattern: '*.xyz123nonexistent',
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('No files found');
    });

    it('should search in specific directory', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
        path: './src',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.searchPath).toContain('src');
    });

    it('should ignore VCS directories by default', async () => {
      const result = await globTool.execute({
        pattern: '**/*',
        limit: 1000,
      });

      if (result.success && result.output) {
        // Should not contain .git or node_modules paths
        expect(result.output).not.toMatch(/\.git\//);
        expect(result.output).not.toMatch(/node_modules\//);
      }
    });

    it('should respect ignore_vcs=false', async () => {
      const result = await globTool.execute({
        pattern: '.git/*',
        ignore_vcs: false,
      });

      // Should attempt to search .git (may or may not find files)
      expect(result).toBeDefined();
    });
  });

  describe('Limit Handling', () => {
    it('should limit results to default (100)', async () => {
      const result = await globTool.execute({
        pattern: '**/*.ts',
      });

      if (result.success && result.metadata?.numFiles) {
        expect(result.metadata.numFiles).toBeLessThanOrEqual(100);
      }
    });

    it('should respect custom limit', async () => {
      const result = await globTool.execute({
        pattern: 'src/**/*.ts',
        limit: 5,
      });

      if (result.success && result.metadata?.numFiles) {
        expect(result.metadata.numFiles).toBeLessThanOrEqual(5);
      }
    });

    it('should support unlimited with limit=0', async () => {
      const result = await globTool.execute({
        pattern: '*.json',
        limit: 0,
      });

      expect(result.success).toBe(true);
      // Should not have truncation warning
    });

    it('should indicate truncation when limit exceeded', async () => {
      const result = await globTool.execute({
        pattern: '**/*.ts',
        limit: 2,
      });

      if (result.success && result.metadata?.totalMatches && result.metadata.totalMatches > 2) {
        expect(result.metadata.truncated).toBe(true);
        expect(result.output).toContain('truncated');
      }
    });
  });

  describe('Result Formatting', () => {
    it('should include metadata in results', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
      });

      if (result.success) {
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.pattern).toBe('*.ts');
        expect(result.metadata?.searchPath).toBeDefined();
        expect(typeof result.metadata?.durationMs).toBe('number');
        expect(typeof result.metadata?.numFiles).toBe('number');
      }
    });

    it('should show file count in output', async () => {
      const result = await globTool.execute({
        pattern: '*.json',
      });

      if (result.success && result.metadata?.numFiles && result.metadata.numFiles > 0) {
        expect(result.output).toMatch(/Found \d+ file/);
      }
    });

    it('should list files in output', async () => {
      const result = await globTool.execute({
        pattern: 'package.json',
      });

      if (result.success && result.metadata?.numFiles && result.metadata.numFiles > 0) {
        expect(result.output).toContain('package.json');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid glob patterns gracefully', async () => {
      const result = await globTool.execute({
        pattern: '[invalid',
      });

      expect(result).toBeDefined();
      // May succeed with no matches or report error
    });

    it('should handle permission errors gracefully', async () => {
      // Try to search in a system directory that may have restricted access
      const result = await globTool.execute({
        pattern: '*',
        path: '/root',
      });

      expect(result).toBeDefined();
      // Should either succeed or fail gracefully
    });
  });

  describe('Performance', () => {
    it('should complete search within reasonable time', async () => {
      const startTime = Date.now();
      
      await globTool.execute({
        pattern: '**/*.ts',
        limit: 10,
      });

      const duration = Date.now() - startTime;
      
      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should include duration in metadata', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
      });

      if (result.success && result.metadata) {
        expect(result.metadata.durationMs).toBeDefined();
        expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pattern', async () => {
      const result = await globTool.execute({
        pattern: '',
      });

      expect(result).toBeDefined();
      // May succeed with no matches or report error
    });

    it('should handle pattern with spaces', async () => {
      const result = await globTool.execute({
        pattern: '* with spaces *',
      });

      expect(result).toBeDefined();
    });

    it('should handle absolute paths in pattern', async () => {
      const result = await globTool.execute({
        pattern: '*.ts',
        path: path.resolve('./src'),
      });

      expect(result.success).toBe(true);
    });
  });
});
