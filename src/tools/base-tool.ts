import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { z, ZodSchema } from 'zod';
import { formatZodValidationError, isZodError } from '../utils/zod-validation';

/**
 * Base class for all tools
 */
export abstract class BaseTool {
  public abstract readonly name: string;
  public abstract readonly description: string;

  /**
   * Get the tool definition for LLM
   */
  public abstract getDefinition(): ToolDefinition;

  /**
   * Execute the tool with given arguments
   */
  public abstract execute(args: Record<string, any>): Promise<ToolResult>;

  /**
   * Validate tool arguments using Zod schema (optional, recommended)
   * @param args - Arguments to validate
   * @param schema - Zod schema for validation
   * @returns Validated and typed arguments
   * @throws Error with formatted message if validation fails
   */
  protected validateWithZod<T>(args: Record<string, any>, schema: ZodSchema<T>): T {
    try {
      return schema.parse(args);
    } catch (error) {
      if (isZodError(error)) {
        throw new Error(formatZodValidationError(this.name, error));
      }
      throw error;
    }
  }

  /**
   * Validate tool arguments (legacy, prefer validateWithZod)
   */
  protected validate(args: Record<string, any>, required: string[]): void {
    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Missing required argument: ${field}`);
      }
    }
  }

  /**
   * Create a success result
   */
  protected success(output: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      output,
      metadata,
    };
  }

  /**
   * Create an error result
   */
  protected error(error: string, metadata?: Record<string, any>): ToolResult {
    return {
      success: false,
      output: '',
      error,
      metadata,
    };
  }
}
