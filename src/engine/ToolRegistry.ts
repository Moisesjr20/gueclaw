export interface Tool {
  name: string;
  description: string;
  // JSON Schema básico
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  /**
   * O Executor da tool (geralmente devolvendo uma string como Observation)
   */
  execute: (args: any) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  public register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
