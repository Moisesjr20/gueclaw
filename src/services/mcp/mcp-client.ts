/**
 * MCP Client
 * Connects to MCP servers using stdio or SSE transport
 * 
 * Architecture: Phase 2.5 - MCP Integration
 * Based on: @modelcontextprotocol/sdk@^1.27.1
 */

import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPServerConfig } from './mcp-config';

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPConnectionInfo {
  serverName: string;
  connected: boolean;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  serverInfo?: {
    name: string;
    version: string;
  };
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private process: ChildProcess | null = null;
  private serverName: string;
  private config: MCPServerConfig;
  private connectionInfo: MCPConnectionInfo;

  constructor(serverName: string, config: MCPServerConfig) {
    this.serverName = serverName;
    this.config = config;
    this.connectionInfo = {
      serverName,
      connected: false,
      tools: [],
      resources: [],
      prompts: [],
    };
  }

  /**
   * Connect to MCP server
   */
  public async connect(): Promise<void> {
    try {
      console.log(`🔌 Connecting to MCP server: ${this.serverName} (${this.config.type || 'stdio'})`);

      if (this.config.type === 'sse') {
        await this.connectSSE();
      } else {
        await this.connectStdio();
      }

      // Initialize connection
      await this.initialize();

      // List capabilities
      await this.listCapabilities();

      this.connectionInfo.connected = true;
      console.log(`✅ MCP server connected: ${this.serverName}`);
    } catch (error) {
      console.error(`Failed to connect to MCP server ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Connect using stdio transport
   */
  private async connectStdio(): Promise<void> {
    const { command, args, env } = this.config;

    // Merge env with process.env, keeping only string values
    const processEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        processEnv[key] = value;
      }
    }

    const mergedEnv = { ...processEnv, ...env };

    // Spawn child process
    this.process = spawn(command, args, {
      env: mergedEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle stderr (non-null assertion safe as we set stdio above)
    this.process.stderr!.on('data', (data) => {
      const message = data.toString().trim();
      if (message && !message.includes('ExperimentalWarning')) {
        console.debug(`[${this.serverName}] ${message}`);
      }
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      console.warn(`MCP server ${this.serverName} exited with code ${code}`);
      this.connectionInfo.connected = false;
    });

    // Create transport
    this.transport = new StdioClientTransport({
      command,
      args,
      env: mergedEnv,
    });

    // Create client
    this.client = new Client(
      {
        name: 'gueclaw-agent',
        version: '3.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect transport
    await this.client.connect(this.transport);
  }

  /**
   * Connect using SSE transport
   */
  private async connectSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('SSE transport requires url');
    }

    // Create transport
    this.transport = new SSEClientTransport(new URL(this.config.url));

    // Create client
    this.client = new Client(
      {
        name: 'gueclaw-agent',
        version: '3.0.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect transport
    await this.client.connect(this.transport);
  }

  /**
   * Initialize connection (send initialize request)
   */
  private async initialize(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not created');
    }

    const result = await this.client.request(
      {
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'gueclaw-agent',
            version: '3.0.0',
          },
        },
      },
      // @ts-ignore - SDK types may not match exactly
      { timeout: 10000 }
    );

    this.connectionInfo.serverInfo = result.serverInfo as { name: string; version: string };
  }

  /**
   * List server capabilities (tools, resources, prompts)
   */
  private async listCapabilities(): Promise<void> {
    if (!this.client) return;

    try {
      // List tools
      const toolsResult = await this.client.request(
        {
          method: 'tools/list',
          params: {},
        },
        // @ts-ignore
        { timeout: 5000 }
      );

      this.connectionInfo.tools = (toolsResult.tools || []) as MCPTool[];
      console.log(`  → ${this.connectionInfo.tools.length} tools available`);

      // List resources
      try {
        const resourcesResult = await this.client.request(
          {
            method: 'resources/list',
            params: {},
          },
          // @ts-ignore
          { timeout: 5000 }
        );
        this.connectionInfo.resources = (resourcesResult.resources || []) as MCPResource[];
        console.log(`  → ${this.connectionInfo.resources.length} resources available`);
      } catch (error) {
        // Resources may not be supported
        console.debug(`  → No resources (${error})`);
      }

      // List prompts
      try {
        const promptsResult = await this.client.request(
          {
            method: 'prompts/list',
            params: {},
          },
          // @ts-ignore
          { timeout: 5000 }
        );
        this.connectionInfo.prompts = (promptsResult.prompts || []) as MCPPrompt[];
        console.log(`  → ${this.connectionInfo.prompts.length} prompts available`);
      } catch (error) {
        // Prompts may not be supported
        console.debug(`  → No prompts (${error})`);
      }
    } catch (error) {
      console.error(`Failed to list capabilities for ${this.serverName}:`, error);
    }
  }

  /**
   * Call a tool on the MCP server
   */
  public async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.debug(`Calling tool ${toolName} on ${this.serverName}`, args);

      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        },
        // @ts-ignore
        { timeout: 30000 }
      );

      return result;
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Read a resource from the MCP server
   */
  public async readResource(uri: string): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.client.request(
        {
          method: 'resources/read',
          params: { uri },
        },
        // @ts-ignore
        { timeout: 10000 }
      );

      return result;
    } catch (error) {
      console.error(`Failed to read resource ${uri} from ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Get a prompt from the MCP server
   */
  public async getPrompt(promptName: string, args?: Record<string, string>): Promise<unknown> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.client.request(
        {
          method: 'prompts/get',
          params: {
            name: promptName,
            arguments: args || {},
          },
        },
        // @ts-ignore
        { timeout: 10000 }
      );

      return result;
    } catch (error) {
      console.error(`Failed to get prompt ${promptName} from ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      if (this.process) {
        this.process.kill();
        this.process = null;
      }

      this.connectionInfo.connected = false;
      console.log(`Disconnected from MCP server: ${this.serverName}`);
    } catch (error) {
      console.error(`Error disconnecting from ${this.serverName}:`, error);
    }
  }

  /**
   * Get connection info
   */
  public getConnectionInfo(): MCPConnectionInfo {
    return this.connectionInfo;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionInfo.connected;
  }
}
