/**
 * security-validators.test.ts
 *
 * Verifies that security guard functions (command injection, path traversal,
 * SSRF, userId validation) correctly block dangerous inputs.
 */

import { VPSCommandTool } from '../../src/tools/vps-command-tool';
import { FileOperationsTool } from '../../src/tools/file-operations-tool';
import { APIRequestTool } from '../../src/tools/api-request-tool';
import { PersistentMemory } from '../../src/core/memory/persistent-memory';

// ─── VPSCommandTool ────────────────────────────────────────────────────────────

describe('VPSCommandTool — command injection guards', () => {
  let tool: VPSCommandTool;

  beforeEach(() => {
    tool = new VPSCommandTool();
  });

  it('blocks rm -rf /', async () => {
    const result = await tool.execute({ command: 'rm -rf /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bloqueado');
  });

  it('blocks rm -fr /', async () => {
    const result = await tool.execute({ command: 'rm -fr /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bloqueado');
  });

  it('blocks dd targeting a disk device', async () => {
    const result = await tool.execute({ command: 'dd if=/dev/zero of=/dev/sda' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bloqueado');
  });

  it('blocks mkfs commands', async () => {
    const result = await tool.execute({ command: 'mkfs.ext4 /dev/sdb1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bloqueado');
  });

  it('blocks wipefs', async () => {
    const result = await tool.execute({ command: 'wipefs -a /dev/sda' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bloqueado');
  });

  it('blocks commands exceeding 1000 characters', async () => {
    const result = await tool.execute({ command: 'echo ' + 'A'.repeat(1000) });
    expect(result.success).toBe(false);
    expect(result.error).toContain('longo');
  });

  it('blocks workingDir containing semicolons', async () => {
    const result = await tool.execute({ command: 'ls', workingDir: '/tmp; rm -rf /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('inválidos');
  });

  it('blocks workingDir containing backticks', async () => {
    const result = await tool.execute({ command: 'ls', workingDir: '/tmp`id`' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('inválidos');
  });
});

// ─── FileOperationsTool ────────────────────────────────────────────────────────

describe('FileOperationsTool — path traversal guards', () => {
  let tool: FileOperationsTool;
  const savedRoot = process.env.FILE_WORKSPACE_ROOT;

  beforeEach(() => {
    tool = new FileOperationsTool();
    delete process.env.FILE_WORKSPACE_ROOT;
  });

  afterEach(() => {
    if (savedRoot !== undefined) {
      process.env.FILE_WORKSPACE_ROOT = savedRoot;
    } else {
      delete process.env.FILE_WORKSPACE_ROOT;
    }
  });

  const deniedPaths = [
    '/etc/shadow',
    '/etc/sudoers',
    '/etc/gshadow',
    '/root/.ssh/id_rsa',
    '/proc/self/environ',
    '/proc/1/environ',
  ];

  test.each(deniedPaths)('blocks read of denied path: %s', async (filePath) => {
    const result = await tool.execute({ action: 'read', filePath });
    expect(result.success).toBe(false);
    expect(result.error).toContain('negado');
  });

  test.each(deniedPaths)('blocks delete of denied path: %s', async (filePath) => {
    const result = await tool.execute({ action: 'delete', filePath });
    expect(result.success).toBe(false);
    expect(result.error).toContain('negado');
  });

  describe('with FILE_WORKSPACE_ROOT configured', () => {
    beforeEach(() => {
      process.env.FILE_WORKSPACE_ROOT = '/opt/gueclaw-agent/workspace';
    });

    it('blocks access to a path outside the workspace root', async () => {
      const result = await tool.execute({ action: 'read', filePath: '/etc/passwd' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('fora do workspace');
    });

    it('blocks path traversal that attempts to escape the workspace', async () => {
      const result = await tool.execute({
        action: 'read',
        filePath: '/opt/gueclaw-agent/workspace/../../etc/passwd',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('fora do workspace');
    });

    it('allows access to a path inside the workspace root', async () => {
      // The file won't exist, but the path check should pass — fs.readFile fails with "not found"
      const result = await tool.execute({
        action: 'read',
        filePath: '/opt/gueclaw-agent/workspace/notes.txt',
      });
      // Safe path — error is about the file not existing, NOT about access denial
      expect(result.error ?? '').not.toContain('negado');
      expect(result.error ?? '').not.toContain('fora do workspace');
    });
  });
});

// ─── APIRequestTool ────────────────────────────────────────────────────────────

describe('APIRequestTool — SSRF guards', () => {
  let tool: APIRequestTool;

  beforeEach(() => {
    tool = new APIRequestTool();
  });

  it('blocks requests to 169.254.x.x (link-local / EC2 metadata)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://169.254.169.254/latest/meta-data' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 10.x.x.x (RFC 1918 private range)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://10.0.0.1/admin' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 172.16.x.x (RFC 1918 private range)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://172.16.0.1/secret' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 192.168.x.x (RFC 1918 private range)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://192.168.1.1/config' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 127.0.0.1 (loopback)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://127.0.0.1:8080/secret' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 0.x.x.x', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://0.0.0.0/admin' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to 100.64.x.x (CGNAT)', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://100.64.0.1/internal' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks requests to localhost hostname', async () => {
    const result = await tool.execute({ method: 'GET', url: 'http://localhost/admin' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/bloqueado|interno/i);
  });

  it('blocks non-http/https protocols: file://', async () => {
    const result = await tool.execute({ method: 'GET', url: 'file:///etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/protocolo/i);
  });

  it('blocks non-http/https protocols: ftp://', async () => {
    const result = await tool.execute({ method: 'GET', url: 'ftp://example.com/data' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/protocolo/i);
  });

  it('returns error for a completely invalid URL', async () => {
    const result = await tool.execute({ method: 'GET', url: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/inválida|URL/i);
  });
});

// ─── PersistentMemory — userId validation ─────────────────────────────────────

describe('PersistentMemory — userId path-traversal guards', () => {
  const invalidIds = [
    '../../etc',
    '../passwords',
    'admin',
    'abc-123',
    'test-pm-123456',
    'root',
    '',
    ' ',
    '1234567890123456789012', // 22 digits — over the 20-char limit
  ];

  test.each(invalidIds)('throws for non-numeric userId: "%s"', (userId) => {
    expect(() => PersistentMemory.read(userId)).toThrow(/inválido/i);
  });

  it('accepts a valid numeric userId and returns empty string for unknown user', () => {
    expect(() => PersistentMemory.read('99999999991')).not.toThrow();
    expect(PersistentMemory.read('99999999991')).toBe('');
  });

  it('throws on loadLastCompact with a non-numeric userId', () => {
    expect(() => PersistentMemory.loadLastCompact('../../etc')).toThrow(/inválido/i);
  });
});
