import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as path from 'path';

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpServersConfig {
  servers: Record<string, McpServerConfig>;
}

export interface McpToolDef {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * Manages connections to MCP servers and exposes their tools.
 */
export class MCPManager {
  private static instance: MCPManager;
  private clients: Map<string, Client> = new Map();
  private tools: McpToolDef[] = [];
  private initialized = false;

  private constructor() {}

  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Initialize all MCP servers from a config file.
   * Tolerates individual server failures — others still load.
   */
  public async initialize(configPath: string): Promise<void> {
    if (this.initialized) return;

    if (!fs.existsSync(configPath)) {
      console.log(`[MCPManager] Config not found at ${configPath}, skipping MCP initialization.`);
      return;
    }

    let config: McpServersConfig;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error('[MCPManager] Failed to parse MCP config:', err);
      return;
    }

    const serverEntries = Object.entries(config.servers ?? {});
    console.log(`[MCPManager] Initializing ${serverEntries.length} MCP server(s)...`);

    await Promise.allSettled(
      serverEntries.map(([name, cfg]) => this.connectServer(name, cfg))
    );

    this.initialized = true;
    console.log(`[MCPManager] Ready — ${this.tools.length} MCP tool(s) loaded.`);
  }

  private async connectServer(name: string, cfg: McpServerConfig): Promise<void> {
    try {
      // Resolve env vars (format: ${env:VAR_NAME})
      const resolvedEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(cfg.env ?? {})) {
        resolvedEnv[k] = v.replace(/\$\{env:([^}]+)\}/g, (_, varName) =>
          process.env[varName] ?? ''
        );
      }

      const transport = new StdioClientTransport({
        command: cfg.command,
        args: (cfg.args ?? []).map(a =>
          a.replace(/\$\{env:([^}]+)\}/g, (_, varName) => process.env[varName] ?? '')
           .replace(/\$\{workspaceFolder\}/g, process.env.WORKSPACE_ROOT ?? process.cwd())
        ),
        env: { ...process.env as Record<string, string>, ...resolvedEnv },
      });

      const client = new Client({ name: `gueclaw-${name}`, version: '1.0.0' });
      await client.connect(transport);

      this.clients.set(name, client);

      const { tools } = await client.listTools();
      for (const tool of tools) {
        this.tools.push({
          serverName: name,
          name: `${name}__${tool.name}`,
          description: tool.description ?? '',
          inputSchema: (tool.inputSchema as Record<string, any>) ?? {},
        });
      }

      console.log(`[MCPManager] ✅ ${name}: ${tools.length} tool(s)`);
    } catch (err: any) {
      console.warn(`[MCPManager] ⚠️  ${name}: failed to connect — ${err?.message ?? err}`);
    }
  }

  /** Return all discovered tool definitions */
  public getTools(): McpToolDef[] {
    return this.tools;
  }

  /** Call a specific MCP tool (name format: serverName__toolName) */
  public async callTool(qualifiedName: string, args: Record<string, any>): Promise<string> {
    const sep = qualifiedName.indexOf('__');
    if (sep === -1) throw new Error(`Invalid MCP tool name: ${qualifiedName}`);

    const serverName = qualifiedName.slice(0, sep);
    const toolName = qualifiedName.slice(sep + 2);

    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not connected: ${serverName}`);

    const result = await client.callTool({ name: toolName, arguments: args });

    // Extract text content from result
    const content = result.content as Array<{ type: string; text?: string }>;
    return content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text!)
      .join('\n');
  }

  /** Gracefully disconnect all servers */
  public async shutdown(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`[MCPManager] Disconnected: ${name}`);
      } catch {}
    }
    this.clients.clear();
    this.tools = [];
  }
}
