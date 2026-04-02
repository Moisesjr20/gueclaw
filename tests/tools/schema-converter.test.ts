import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { convertZodSchemaToToolDefinition } from '../../src/tools/core/schema-converter';

describe('Schema Converter', () => {
  describe('convertZodSchemaToToolDefinition', () => {
    it('should convert simple string schema', () => {
      const schema = z.object({
        name: z.string().describe('The name'),
      });

      const result = convertZodSchemaToToolDefinition(
        'test_tool',
        'Test description',
        schema
      );

      expect(result).toEqual({
        name: 'test_tool',
        description: 'Test description',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The name',
            },
          },
          required: ['name'],
        },
      });
    });

    it('should convert optional fields correctly', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.string().default('default value'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.required).toEqual(['required']);
      expect(result.parameters.properties.optional.type).toBe('string');
      expect(result.parameters.properties.withDefault.type).toBe('string');
    });

    it('should convert number schema', () => {
      const schema = z.object({
        count: z.number().describe('The count'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.properties.count).toEqual({
        type: 'number',
        description: 'The count',
      });
    });

    it('should convert boolean schema', () => {
      const schema = z.object({
        flag: z.boolean().describe('The flag'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.properties.flag).toEqual({
        type: 'boolean',
        description: 'The flag',
      });
    });

    it('should convert enum schema', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).describe('The status'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.properties.status).toEqual({
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
        description: 'The status',
      });
    });

    it('should convert array schema', () => {
      const schema = z.object({
        tags: z.array(z.string()).describe('List of tags'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.properties.tags).toEqual({
        type: 'array',
        items: { type: 'string' },
        description: 'List of tags',
      });
    });

    it('should convert nested object schema', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number(),
        }).describe('User information'),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.properties.user).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        description: 'User information',
      });
    });

    it('should handle complex mixed schema', () => {
      const schema = z.object({
        name: z.string().describe('Name'),
        age: z.number().optional().describe('Age'),
        role: z.enum(['admin', 'user']).describe('Role'),
        active: z.boolean().default(true).describe('Is active'),
        tags: z.array(z.string()).optional(),
      });

      const result = convertZodSchemaToToolDefinition('test', 'desc', schema);

      expect(result.parameters.required).toEqual(['name', 'role']);
      expect(result.parameters.properties.name.type).toBe('string');
      expect(result.parameters.properties.age.type).toBe('number');
      expect(result.parameters.properties.role.type).toBe('string');
      expect(result.parameters.properties.role.enum).toEqual(['admin', 'user']);
      expect(result.parameters.properties.active.type).toBe('boolean');
      expect(result.parameters.properties.tags.type).toBe('array');
    });

    it('should throw error for non-object schema', () => {
      const schema = z.string();

      expect(() => {
        convertZodSchemaToToolDefinition('test', 'desc', schema as any);
      }).toThrow('Tool schema must be a Zod object');
    });
  });
});
