import { BaseTool } from './base-tool';

/**
 * Tool Registry - Manages available tools for the agent
 */
export class ToolRegistry {
  private static tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool
   */
  public static register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
    console.log(`🔧 Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools
   */
  public static registerAll(tools: BaseTool[]): void {
    tools.forEach(tool => this.register(tool));
  }

  /**
   * Get a tool by name
   */
  public static get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions for LLM
   */
  public static getAllDefinitions() {
    return Array.from(this.tools.values()).map(tool => tool.getDefinition());
  }

  /**
   * Get all tool names
   */
  public static getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool exists
   */
  public static has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Clear all tools
   */
  public static clear(): void {
    this.tools.clear();
  }

  /**
   * Get tools by category (from metadata)
   */
  public static getByCategory(category: string): BaseTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      const def = tool.getDefinition();
      return def.parameters.properties['_category']?.enum?.includes(category);
    });
  }
}
