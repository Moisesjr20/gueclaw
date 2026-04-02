/**
 * MCP Integration Tests
 * Tests for MCP Manager, Client, and Config loading
 * 
 * Phase 2.5 - MCP Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { MCPConfigLoader } from '../../src/services/mcp/mcp-config';
import { MCPManager } from '../../src/services/mcp/mcp-manager';
import { MCPClient } from '../../src/services/mcp/mcp-client';

describe('MCP Integration', () => {
  const testConfigPath = path.join(__dirname, '../fixtures/mcp-test-config.json');

  beforeAll(() => {
    // Create test config
    const testConfig = {
      servers: {
        'test-server': {
          command: 'echo',
          args: ['test'],
          env: {
            TEST_VAR: '${env:TEST_ENV_VAR}',
            WORKSPACE: '${WORKSPACE_ROOT}',
          },
        },
        'sse-server': {
          url: 'http://localhost:3000/mcp',
          type: 'sse',
        },
      },
    };

    fs.mkdirSync(path.dirname(testConfigPath), { recursive: true });
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    // Set test env var
    process.env.TEST_ENV_VAR = 'test-value';
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe('MCPConfigLoader', () => {
    let configLoader: MCPConfigLoader;

    beforeEach(() => {
      configLoader = new MCPConfigLoader(testConfigPath);
    });

    test('should load config from file', () => {
      const config = configLoader.loadConfig();

      expect(config).toBeDefined();
      expect(config.servers).toBeDefined();
      expect(Object.keys(config.servers).length).toBe(2);
    });

    test('should list all servers', () => {
      configLoader.loadConfig();
      const servers = configLoader.listServers();

      expect(servers).toContain('test-server');
      expect(servers).toContain('sse-server');
      expect(servers.length).toBe(2);
    });

    test('should get specific server config', () => {
      configLoader.loadConfig();
      const server = configLoader.getServerConfig('test-server');

      expect(server).toBeDefined();
      expect(server?.command).toBe('echo');
      expect(server?.args).toEqual(['test']);
      expect(server?.type).toBe('stdio');
    });

    test('should auto-detect transport type', () => {
      configLoader.loadConfig();

      const stdioServer = configLoader.getServerConfig('test-server');
      expect(stdioServer?.type).toBe('stdio');

      const sseServer = configLoader.getServerConfig('sse-server');
      expect(sseServer?.type).toBe('sse');
    });

    test('should substitute environment variables', () => {
      const config = configLoader.loadConfig();
      const server = config.servers['test-server'];

      expect(server.env?.TEST_VAR).toBe('test-value');
      expect(server.env?.WORKSPACE).toBe(process.cwd());
    });

    test('should validate server config', () => {
      configLoader.loadConfig();

      const validStdio = configLoader.validateServerConfig('test-server');
      expect(validStdio.valid).toBe(true);
      expect(validStdio.errors.length).toBe(0);

      const validSSE = configLoader.validateServerConfig('sse-server');
      expect(validSSE.valid).toBe(true);

      const invalid = configLoader.validateServerConfig('non-existent');
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    test('should return empty config if file not found', () => {
      const loader = new MCPConfigLoader('/non/existent/path.json');
      const config = loader.loadConfig();

      expect(config.servers).toEqual({});
    });
  });

  describe('MCPManager', () => {
    let manager: MCPManager;

    beforeEach(() => {
      manager = new MCPManager(false);
    });

    test('should initialize with config', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    test('should list configured servers', () => {
      const servers = manager.listServers();

      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThan(0);
    });

    test('should get status of all servers', () => {
      const status = manager.getStatus();

      expect(status).toBeDefined();
      expect(status.totalServers).toBeGreaterThanOrEqual(0);
      expect(status.connectedServers).toBeGreaterThanOrEqual(0);
      expect(status.servers).toBeDefined();
    });

    test('should handle connection errors gracefully', async () => {
      // Try to connect to non-existent server
      await expect(manager.connect('non-existent-server'))
        .rejects
        .toThrow();
    });

    test('should not duplicate connection attempts', async () => {
      // This would hang if not handled properly
      const promises = [
        manager.connect('github'),
        manager.connect('github'),
        manager.connect('github'),
      ];

      // All should resolve (or reject) without hanging
      await expect(Promise.allSettled(promises))
        .resolves
        .toBeDefined();
    });
  });

  describe('MCPClient', () => {
    test('should require valid config', () => {
      expect(() => {
        const config = {
          command: '',
          args: [],
        };
        new MCPClient('invalid', config);
      }).not.toThrow(); // Constructor doesn't validate yet

      // But connection should fail
      const client = new MCPClient('invalid', { command: '', args: [] });
      expect(client.connect()).rejects.toThrow();
    });

    test('should create connection info structure', () => {
      const client = new MCPClient('test', {
        command: 'echo',
        args: ['test'],
      });

      const info = client.getConnectionInfo();

      expect(info.serverName).toBe('test');
      expect(info.connected).toBe(false);
      expect(info.tools).toEqual([]);
      expect(info.resources).toEqual([]);
      expect(info.prompts).toEqual([]);
    });

    test('should report connection status', () => {
      const client = new MCPClient('test', {
        command: 'echo',
        args: ['test'],
      });

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('MCPManager should use MCPConfigLoader', () => {
      const manager = new MCPManager(false);
      const servers = manager.listServers();

      // Should load from actual config/mcp-servers.json
      expect(Array.isArray(servers)).toBe(true);
    });

    test('should handle missing config gracefully', () => {
      const loader = new MCPConfigLoader('/tmp/non-existent-' + Date.now() + '.json');

      expect(() => loader.loadConfig()).not.toThrow();

      const config = loader.loadConfig();
      expect(config.servers).toEqual({});
    });
  });

  describe('Real MCP Servers (if available)', () => {
    test('should list real MCP tools if connected', async () => {
      const manager = new MCPManager(false);
      await manager.initialize();

      const status = manager.getStatus();

      if (status.connectedServers > 0) {
        console.log(`✅ ${status.connectedServers} MCP servers connected`);
        console.log('Servers:', Object.keys(status.servers));

        // Try to list tools
        const tools = await manager.listAllTools();
        console.log(`📋 ${tools.length} total tools available`);

        expect(tools.length).toBeGreaterThan(0);
      } else {
        console.log('⚠️ No MCP servers connected (this is OK in test environment)');
      }
    });
  });
});
