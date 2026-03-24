import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { MCPManager, McpToolDef } from './mcp-manager';

/**
 * Dynamic tool that wraps a single MCP server tool.
 * Created at runtime after MCPManager discovers available tools.
 */
export class MCPTool extends BaseTool {
  public readonly name: string;
  public readonly description: string;
  private readonly toolDef: McpToolDef;

  constructor(toolDef: McpToolDef) {
    super();
    this.toolDef = toolDef;
    this.name = toolDef.name;
    this.description = `[MCP:${toolDef.serverName}] ${toolDef.description}`;
  }

  public getDefinition(): ToolDefinition {
    const schema = this.toolDef.inputSchema;
    const properties = schema?.properties ?? {};
    const required: string[] = schema?.required ?? [];

    const params: ToolDefinition['parameters']['properties'] = {};
    for (const [key, val] of Object.entries(properties)) {
      const prop = val as Record<string, any>;
      params[key] = {
        type: prop.type ?? 'string',
        description: prop.description ?? key,
        ...(prop.enum ? { enum: prop.enum } : {}),
      };
    }

    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: params,
        required,
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      const output = await MCPManager.getInstance().callTool(this.name, args);
      return this.success(output);
    } catch (err: any) {
      return this.error(`MCP tool error (${this.name}): ${err?.message ?? err}`);
    }
  }

  /**
   * Create MCPTool instances for all tools discovered by MCPManager.
   */
  public static buildAll(): MCPTool[] {
    return MCPManager.getInstance()
      .getTools()
      .map(def => new MCPTool(def));
  }
}
