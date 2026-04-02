import { z } from 'zod';
import { ToolDefinition, ParameterProperty } from '../../core/providers/base-provider';

/**
 * Converts a Zod schema to OpenAI-compatible ToolDefinition format
 * Supports common Zod types: string, number, boolean, enum, optional, array, object
 */
export function convertZodSchemaToToolDefinition(
  name: string,
  description: string,
  schema: z.ZodTypeAny
): ToolDefinition {
  // Extract object shape from schema
  if (!(schema instanceof z.ZodObject)) {
    throw new Error('Tool schema must be a Zod object');
  }

  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const properties: Record<string, ParameterProperty> = {};
  const required: string[] = [];

  // Convert each property
  for (const [key, zodType] of Object.entries(shape)) {
    const prop = convertZodTypeToProperty(zodType);
    properties[key] = prop;

    // Check if required (not optional and not has default)
    if (!isOptionalZodType(zodType)) {
      required.push(key);
    }
  }

  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}

/**
 * Convert individual Zod type to ParameterProperty
 */
function convertZodTypeToProperty(zodType: z.ZodTypeAny): ParameterProperty {
  // Handle optional types
  if (zodType instanceof z.ZodOptional || zodType instanceof z.ZodNullable) {
    return convertZodTypeToProperty(zodType.unwrap());
  }

  // Handle default types
  if (zodType instanceof z.ZodDefault) {
    return convertZodTypeToProperty(zodType.removeDefault());
  }

  // String type
  if (zodType instanceof z.ZodString) {
    const prop: ParameterProperty = { type: 'string' };
    
    // Extract description from .describe()
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Number type
  if (zodType instanceof z.ZodNumber) {
    const prop: ParameterProperty = { type: 'number' };
    
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Boolean type
  if (zodType instanceof z.ZodBoolean) {
    const prop: ParameterProperty = { type: 'boolean' };
    
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Enum type
  if (zodType instanceof z.ZodEnum) {
    const prop: ParameterProperty = {
      type: 'string',
      enum: zodType.options as string[],
    };
    
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Array type
  if (zodType instanceof z.ZodArray) {
    const prop: ParameterProperty = {
      type: 'array',
      items: convertZodTypeToProperty(zodType.element),
    } as any;
    
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Object type (nested)
  if (zodType instanceof z.ZodObject) {
    const shape = zodType.shape as Record<string, z.ZodTypeAny>;
    const nestedProps: Record<string, ParameterProperty> = {};
    
    for (const [key, type] of Object.entries(shape)) {
      nestedProps[key] = convertZodTypeToProperty(type);
    }

    const prop: ParameterProperty = {
      type: 'object',
      properties: nestedProps,
    } as any;
    
    if (zodType.description) {
      prop.description = zodType.description;
    }

    return prop;
  }

  // Fallback for unknown types
  console.warn(`Unknown Zod type: ${zodType.constructor.name}, defaulting to string`);
  return { type: 'string' };
}

/**
 * Check if a Zod type is optional (has default or is optional)
 */
function isOptionalZodType(zodType: z.ZodTypeAny): boolean {
  return (
    zodType instanceof z.ZodOptional ||
    zodType instanceof z.ZodNullable ||
    zodType instanceof z.ZodDefault
  );
}
