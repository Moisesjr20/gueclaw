import { z } from 'zod';
import { BaseTool } from '../base-tool';
import { ToolDefinition } from '../../core/providers/base-provider';
import { ToolResult } from '../../types';
import { ToolConfig, ToolHelpers } from './types';
import { convertZodSchemaToToolDefinition } from './schema-converter';

/**
 * Factory function to build a tool with less boilerplate
 * 
 * @example
 * ```typescript
 * export const MyTool = buildTool({
 *   name: 'my_tool',
 *   description: 'Does something useful',
 *   parameters: z.object({
 *     input: z.string().describe('The input value'),
 *     count: z.number().optional().describe('Number of times to repeat'),
 *   }),
 *   execute: async (args, { success, error }) => {
 *     try {
 *       const result = doSomething(args.input, args.count);
 *       return success(result);
 *     } catch (err) {
 *       return error(err.message);
 *     }
 *   },
 * });
 * ```
 */
export function buildTool<TSchema extends z.ZodTypeAny>(
  config: ToolConfig<TSchema>
): BaseTool {
  // Create a class that extends BaseTool
  class BuiltTool extends BaseTool {
    public readonly name = config.name;
    public readonly description = config.description;
    private readonly schema = config.parameters;
    private readonly toolDefinition: ToolDefinition;

    constructor() {
      super();
      
      // Convert Zod schema to ToolDefinition format
      this.toolDefinition = convertZodSchemaToToolDefinition(
        this.name,
        this.description,
        this.schema
      );
      
      // Add concurrency safety metadata
      if (config.isConcurrencySafe !== undefined) {
        this.toolDefinition.isConcurrencySafe = config.isConcurrencySafe;
      }
    }

    /**
     * Get the tool definition for LLM
     */
    public getDefinition(): ToolDefinition {
      return this.toolDefinition;
    }

    /**
     * Execute the tool with automatic validation
     */
    public async execute(args: Record<string, any>): Promise<ToolResult> {
      try {
        // Validate arguments using Zod schema
        const validatedArgs = this.schema.parse(args);

        // Create helper functions
        const helpers: ToolHelpers = {
          success: (output: string, metadata?: Record<string, any>) =>
            this.success(output, metadata),
          error: (error: string, metadata?: Record<string, any>) =>
            this.error(error, metadata),
        };

        // Execute the tool logic
        return await config.execute(validatedArgs, helpers);
      } catch (err) {
        // Handle validation errors
        if (err instanceof z.ZodError) {
          const issues = err.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', ');
          return this.error(`Validation error: ${issues}`);
        }

        // Handle execution errors
        if (err instanceof Error) {
          return this.error(`Execution error: ${err.message}`);
        }

        return this.error('Unknown error occurred');
      }
    }
  }

  // Return an instance of the tool
  return new BuiltTool();
}

/**
 * Re-export Zod for convenient imports
 */
export { z };
