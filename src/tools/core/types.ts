import { z } from 'zod';
import { ToolResult } from '../../types';

/**
 * Configuration for building a tool with buildTool() factory
 */
export interface ToolConfig<TSchema extends z.ZodTypeAny> {
  /**
   * Unique name for the tool (snake_case recommended)
   */
  name: string;

  /**
   * Human-readable description of what the tool does
   */
  description: string;

  /**
   * Zod schema defining the tool's parameters
   */
  parameters: TSchema;

  /**
   * Function that executes the tool logic
   * @param args - Validated and typed arguments (inferred from Zod schema)
   * @param helpers - Utility functions for creating results
   */
  execute: (
    args: z.infer<TSchema>,
    helpers: ToolHelpers
  ) => Promise<ToolResult>;

  /**
   * Optional examples of how to use the tool
   */
  examples?: ToolExample[];
}

/**
 * Example usage of a tool
 */
export interface ToolExample {
  /**
   * Description of what this example does
   */
  description: string;

  /**
   * Example arguments
   */
  args: Record<string, any>;

  /**
   * Expected output (optional)
   */
  expectedOutput?: string;
}

/**
 * Helper functions provided to tool execution
 */
export interface ToolHelpers {
  /**
   * Create a successful result
   */
  success: (output: string, metadata?: Record<string, any>) => ToolResult;

  /**
   * Create an error result
   */
  error: (error: string, metadata?: Record<string, any>) => ToolResult;
}
