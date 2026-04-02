/**
 * MCP Connection Manager
 * Manages multiple MCP server connections
 * 
 * Architecture: Phase 2.5 - MCP Integration
 * Provides: Lazy connection, connection pooling, automatic reconnection
 */

import { MCPClient, MCPConnectionInfo } from './mcp-client';
import { mcpConfig, MCPServerConfig } from './mcp-config';

export interface MCPManagerStatus {
  totalServers: number;
  connectedServers: number;
  failedServers: number;
  servers: {
    [serverName: string]: {
      connected: boolean;
      error?: string;
      tools: number;
      resources: number;
      prompts: number;
    };
  };
}

export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private connectionPromises: Map<string, Promise<void>> = new Map();
  private autoConnect: boolean;

  constructor(autoConnect: boolean = false) {
    this.autoConnect = autoConnect;
  }

  /**
   * Initialize manager and optionally auto-connect to all servers
   */
  public async initialize(): Promise<void> {
    console.log('🚀 Initializing MCP Manager...');

    // Load configuration
    const config = mcpConfig.loadConfig();
    const serverNames = Object.keys(config.servers);

    console.log(`📋 Found ${serverNames.length} MCP servers in config`);

    if (this.autoConnect && serverNames.length > 0) {
      console.log('🔌 Auto-connecting to all servers...');
      await this.connectAll();
    } else {
      console.log('💡 Lazy connection mode: servers will connect on first use');
    }
  }

  /**
   * Connect to all configured MCP servers
   */
  public async connectAll(): Promise<void> {
    const serverNames = mcpConfig.listServers();
    const results = await Promise.allSettled(
      serverNames.map(name => this.connect(name))
    );

    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
        console.error(`Failed to connect to ${serverNames[index]}: ${result.reason}`);
      }
    });

    console.log(`✅ Connected: ${successCount}/${serverNames.length} servers`);
    if (failCount > 0) {
      console.warn(`⚠️ Failed: ${failCount} servers`);
    }
  }

  /**
   * Connect to a specific MCP server (lazy connection)
   */
  public async connect(serverName: string): Promise<void> {
    // Check if already connected
    if (this.clients.has(serverName)) {
      const client = this.clients.get(serverName)!;
      if (client.isConnected()) {
        console.debug(`Already connected to ${serverName}`);
        return;
      }
    }

    // Check if connection is in progress
    if (this.connectionPromises.has(serverName)) {
      console.debug(`Connection to ${serverName} already in progress, waiting...`);
      return this.connectionPromises.get(serverName)!;
    }

    // Get server config
    const config = mcpConfig.getServerConfig(serverName);
    if (!config) {
      throw new Error(`MCP server '${serverName}' not found in configuration`);
    }

    // Validate config
    const validation = mcpConfig.validateServerConfig(serverName);
    if (!validation.valid) {
      throw new Error(`Invalid config for ${serverName}: ${validation.errors.join(', ')}`);
    }

    // Create connection promise
    const connectionPromise = this._doConnect(serverName, config);
    this.connectionPromises.set(serverName, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      this.connectionPromises.delete(serverName);
    }
  }

  /**
   * Internal connection method
   */
  private async _doConnect(serverName: string, config: MCPServerConfig): Promise<void> {
    const client = new MCPClient(serverName, config);
    await client.connect();
    this.clients.set(serverName, client);
  }

  /**
   * Disconnect from a specific server
   */
  public async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverName);
      console.log(`Disconnected from ${serverName}`);
    }
  }

  /**
   * Disconnect from all servers
   */
  public async disconnectAll(): Promise<void> {
    console.log('Disconnecting from all MCP servers...');
    await Promise.all(
      Array.from(this.clients.keys()).map(name => this.disconnect(name))
    );
  }

  /**
   * Get client for a specific server (auto-connect if not connected)
   */
  public async getClient(serverName: string): Promise<MCPClient> {
    if (!this.clients.has(serverName) || !this.clients.get(serverName)!.isConnected()) {
      await this.connect(serverName);
    }

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Failed to get client for ${serverName}`);
    }

    return client;
  }

  /**
   * Call a tool on a specific MCP server
   */
  public async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const client = await this.getClient(serverName);
    return client.callTool(toolName, args);
  }

  /**
   * List all tools from all connected servers
   */
  public async listAllTools(): Promise<Array<{ server: string; tool: string; description?: string }>> {
    const tools: Array<{ server: string; tool: string; description?: string }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      if (client.isConnected()) {
        const info = client.getConnectionInfo();
        for (const tool of info.tools) {
          tools.push({
            server: serverName,
            tool: tool.name,
            description: tool.description,
          });
        }
      }
    }

    return tools;
  }

  /**
   * List tools from a specific server
   */
  public async listServerTools(serverName: string): Promise<MCPConnectionInfo['tools']> {
    const client = await this.getClient(serverName);
    const info = client.getConnectionInfo();
    return info.tools;
  }

  /**
   * Get status of all MCP servers
   */
  public getStatus(): MCPManagerStatus {
    const serverNames = mcpConfig.listServers();
    const status: MCPManagerStatus = {
      totalServers: serverNames.length,
      connectedServers: 0,
      failedServers: 0,
      servers: {},
    };

    for (const serverName of serverNames) {
      const client = this.clients.get(serverName);

      if (client && client.isConnected()) {
        const info = client.getConnectionInfo();
        status.connectedServers++;
        status.servers[serverName] = {
          connected: true,
          tools: info.tools.length,
          resources: info.resources.length,
          prompts: info.prompts.length,
        };
      } else {
        status.failedServers++;
        status.servers[serverName] = {
          connected: false,
          tools: 0,
          resources: 0,
          prompts: 0,
        };
      }
    }

    return status;
  }

  /**
   * Get connection info for a specific server
   */
  public getServerInfo(serverName: string): MCPConnectionInfo | null {
    const client = this.clients.get(serverName);
    return client ? client.getConnectionInfo() : null;
  }

  /**
   * Check if a server is connected
   */
  public isServerConnected(serverName: string): boolean {
    const client = this.clients.get(serverName);
    return client ? client.isConnected() : false;
  }

  /**
   * List all configured server names
   */
  public listServers(): string[] {
    return mcpConfig.listServers();
  }
}

// Singleton instance (lazy connection by default)
export const mcpManager = new MCPManager(false);

