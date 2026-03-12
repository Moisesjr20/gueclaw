import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';

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
   * Validate tool arguments
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
