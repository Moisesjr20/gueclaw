import { describe, it, expect } from '@jest/globals';
import { EchoTool } from '../../src/tools/echo-tool';

describe('EchoTool', () => {
  describe('Basic Functionality', () => {
    it('should echo simple text', async () => {
      const result = await EchoTool.execute({
        text: 'Hello, World!',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
      expect(result.metadata?.originalLength).toBe(13);
    });

    it('should reject empty text', async () => {
      const result = await EchoTool.execute({
        text: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('Transformations', () => {
    it('should convert to uppercase', async () => {
      const result = await EchoTool.execute({
        text: 'hello',
        uppercase: true,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('HELLO');
      expect(result.metadata?.transformed).toBe(true);
    });

    it('should add prefix', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        prefix: '> ',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('> Test');
      expect(result.metadata?.transformed).toBe(true);
    });

    it('should repeat text', async () => {
      const result = await EchoTool.execute({
        text: 'Line',
        repeat: 3,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Line\nLine\nLine');
      expect(result.metadata?.transformed).toBe(true);
    });

    it('should combine multiple transformations', async () => {
      const result = await EchoTool.execute({
        text: 'test',
        uppercase: true,
        prefix: '> ',
        repeat: 2,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('> TEST\n> TEST');
    });
  });

  describe('Output Formats', () => {
    it('should format as plain text (default)', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        format: 'plain',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Test');
    });

    it('should format as markdown', async () => {
      const result = await EchoTool.execute({
        text: 'console.log("Hello");',
        format: 'markdown',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('```\nconsole.log("Hello");\n```');
    });

    it('should format as JSON', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        format: 'json',
      });

      expect(result.success).toBe(true);
      
      const parsed = JSON.parse(result.output);
      expect(parsed.text).toBe('Test');
      expect(parsed.processed).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should require text parameter', async () => {
      const result = await EchoTool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should validate repeat is positive', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        repeat: -1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should validate repeat as integer', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        repeat: 2.5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should validate format enum', async () => {
      const result = await EchoTool.execute({
        text: 'Test',
        format: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation error');
    });
  });

  describe('Metadata', () => {
    it('should include transformation metadata', async () => {
      const result = await EchoTool.execute({
        text: 'hello',
        uppercase: true,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.originalLength).toBe(5);
      expect(result.metadata?.finalLength).toBe(5);
      expect(result.metadata?.transformed).toBe(true);
    });

    it('should mark as not transformed when no transformations', async () => {
      const result = await EchoTool.execute({
        text: 'hello',
      });

      expect(result.metadata?.transformed).toBe(false);
    });
  });

  describe('Tool Definition', () => {
    it('should have correct name and description', () => {
      expect(EchoTool.name).toBe('echo');
      expect(EchoTool.description).toContain('Echoes back');
    });

    it('should generate valid tool definition', () => {
      const definition = EchoTool.getDefinition();

      expect(definition.name).toBe('echo');
      expect(definition.parameters.type).toBe('object');
      expect(definition.parameters.properties.text).toBeDefined();
      expect(definition.parameters.properties.uppercase).toBeDefined();
      expect(definition.parameters.properties.repeat).toBeDefined();
      expect(definition.parameters.properties.prefix).toBeDefined();
      expect(definition.parameters.properties.format).toBeDefined();
      expect(definition.parameters.required).toEqual(['text']);
    });
  });
});
