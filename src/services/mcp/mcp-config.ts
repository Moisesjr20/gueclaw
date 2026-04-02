/**
 * MCP Configuration Loader
 * Loads and validates MCP server configuration from config/mcp-servers.json
 * 
 * Architecture: Phase 2.5 - MCP Integration
 * Supports: stdio (n8n, playwright, filesystem) and SSE (remote APIs)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MCPServerEnv {
  [key: string]: string;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: MCPServerEnv;
  url?: string; // For SSE transport
  type?: 'stdio' | 'sse';
}

export interface MCPServersConfig {
  servers: {
    [serverName: string]: MCPServerConfig;
  };
}

export class MCPConfigLoader {
  private configPath: string;
  private config: MCPServersConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'mcp-servers.json');
  }

  /**
   * Load MCP servers configuration
   */
  public loadConfig(): MCPServersConfig {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn(`[MCP] Config not found at ${this.configPath}, using empty config`);
        return { servers: {} };
      }

      const rawConfig = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(rawConfig) as MCPServersConfig;

      // Substitute environment variables
      this.config = this.substituteEnvVars(config);

      console.log(`[MCP] ✅ Config loaded: ${Object.keys(this.config.servers).length} servers`);
      return this.config;
    } catch (error) {
      console.error('[MCP] Failed to load config:', error);
      return { servers: {} };
    }
  }

  /**
   * Get specific server config
   */
  public getServerConfig(serverName: string): MCPServerConfig | null {
    if (!this.config) {
      this.loadConfig();
    }

    const server = this.config?.servers[serverName];
    if (!server) {
      console.warn(`[MCP] Server '${serverName}' not found in config`);
      return null;
    }

    // Auto-detect transport type
    if (!server.type) {
      server.type = server.url ? 'sse' : 'stdio';
    }

    return server;
  }

  /**
   * List all configured server names
   */
  public listServers(): string[] {
    if (!this.config) {
      this.loadConfig();
    }
    return Object.keys(this.config?.servers || {});
  }

  /**
   * Substitute ${env:VAR_NAME} and ${WORKSPACE_ROOT} in config
   */
  private substituteEnvVars(config: MCPServersConfig): MCPServersConfig {
    const substituted = JSON.parse(JSON.stringify(config)) as MCPServersConfig;

    for (const [serverName, serverConfig] of Object.entries(substituted.servers)) {
      // Substitute in env vars
      if (serverConfig.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
          serverConfig.env[key] = this.substituteString(value);
        }
      }

      // Substitute in args
      if (serverConfig.args) {
        serverConfig.args = serverConfig.args.map((arg: string) => this.substituteString(arg));
      }

      // Substitute in URL
      if (serverConfig.url) {
        serverConfig.url = this.substituteString(serverConfig.url);
      }
    }

    return substituted;
  }

  /**
   * Substitute a single string value
   */
  private substituteString(value: string): string {
    // ${env:VAR_NAME} pattern
    let result = value.replace(/\$\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });

    // ${WORKSPACE_ROOT} pattern
    result = result.replace(/\$\{WORKSPACE_ROOT\}/g, process.cwd());

    return result;
  }

  /**
   * Validate server configuration
   */
  public validateServerConfig(serverName: string): { valid: boolean; errors: string[] } {
    const config = this.getServerConfig(serverName);
    const errors: string[] = [];

    if (!config) {
      return { valid: false, errors: [`Server '${serverName}' not found`] };
    }

    // Validate stdio config
    if (config.type === 'stdio') {
      if (!config.command) {
        errors.push('Missing command for stdio transport');
      }
      if (!config.args || config.args.length === 0) {
        errors.push('Missing args for stdio transport');
      }
    }

    // Validate SSE config
    if (config.type === 'sse') {
      if (!config.url) {
        errors.push('Missing url for SSE transport');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const mcpConfig = new MCPConfigLoader();
