import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// Must be hoisted before any imports that use child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

jest.mock('../../src/services/telegram-notifier', () => ({
  TelegramNotifier: jest.fn().mockImplementation(() => ({
    sendToAllUsers: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Heartbeat, MonitorEntry } from '../../src/services/heartbeat';
import { TelegramNotifier } from '../../src/services/telegram-notifier';

const mockExec = exec as unknown as jest.Mock;
const CONFIG_DIR = path.join(process.cwd(), 'data', 'heartbeat');
const CONFIG_FILE = path.join(CONFIG_DIR, 'monitors.json');

describe('Heartbeat', () => {
  let heartbeat: Heartbeat;
  let backupContent: string | null = null;

  beforeAll(() => {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    if (fs.existsSync(CONFIG_FILE)) {
      backupContent = fs.readFileSync(CONFIG_FILE, 'utf8');
      fs.unlinkSync(CONFIG_FILE);
    }
  });

  afterAll(() => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    if (backupContent !== null) {
      fs.writeFileSync(CONFIG_FILE, backupContent);
    }
  });

  beforeEach(() => {
    if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
    mockExec.mockReset();
    const notifier = new (TelegramNotifier as any)();
    heartbeat = new Heartbeat(notifier);
  });

  describe('loadMonitors', () => {
    it('returns empty array when config file does not exist', () => {
      const monitors = heartbeat.loadMonitors();
      expect(monitors).toEqual([]);
    });

    it('returns monitors parsed from config file', () => {
      const entries: MonitorEntry[] = [
        { id: 'test-nginx', type: 'docker', target: 'nginx', label: 'Nginx', addedAt: 1000 },
      ];
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(entries));

      const monitors = heartbeat.loadMonitors();
      expect(monitors).toHaveLength(1);
      expect(monitors[0].id).toBe('test-nginx');
    });

    it('returns empty array when config file is malformed JSON', () => {
      fs.writeFileSync(CONFIG_FILE, 'not-valid-json');
      const monitors = heartbeat.loadMonitors();
      expect(monitors).toEqual([]);
    });
  });

  describe('addMonitor', () => {
    it('persists a new monitor to disk', () => {
      heartbeat.addMonitor({ id: 'm1', type: 'docker', target: 'postgres', label: 'Postgres' });

      const monitors = heartbeat.loadMonitors();
      expect(monitors).toHaveLength(1);
      expect(monitors[0].id).toBe('m1');
      expect(monitors[0].type).toBe('docker');
      expect(monitors[0].addedAt).toBeDefined();
    });

    it('does not add a monitor with a duplicate ID', () => {
      heartbeat.addMonitor({ id: 'dup', type: 'docker', target: 'c1', label: 'C1' });
      heartbeat.addMonitor({ id: 'dup', type: 'docker', target: 'c2', label: 'C2' });

      const monitors = heartbeat.loadMonitors();
      expect(monitors).toHaveLength(1);
      expect(monitors[0].target).toBe('c1'); // first one kept
    });

    it('adds multiple distinct monitors', () => {
      heartbeat.addMonitor({ id: 'a', type: 'docker', target: 'a', label: 'A' });
      heartbeat.addMonitor({ id: 'b', type: 'systemd', target: 'nginx', label: 'B' });
      heartbeat.addMonitor({ id: 'c', type: 'http', target: 'https://example.com', label: 'C' });

      const monitors = heartbeat.loadMonitors();
      expect(monitors).toHaveLength(3);
    });
  });

  describe('removeMonitor', () => {
    it('removes monitor by ID and returns true', () => {
      heartbeat.addMonitor({ id: 'to-remove', type: 'docker', target: 'c1', label: 'C1' });

      const removed = heartbeat.removeMonitor('to-remove');
      expect(removed).toBe(true);
      expect(heartbeat.loadMonitors()).toHaveLength(0);
    });

    it('returns false when monitor ID is not found', () => {
      const removed = heartbeat.removeMonitor('does-not-exist');
      expect(removed).toBe(false);
    });

    it('only removes the targeted monitor, leaving others intact', () => {
      heartbeat.addMonitor({ id: 'keep', type: 'docker', target: 'k', label: 'K' });
      heartbeat.addMonitor({ id: 'remove-me', type: 'docker', target: 'r', label: 'R' });

      heartbeat.removeMonitor('remove-me');

      const monitors = heartbeat.loadMonitors();
      expect(monitors).toHaveLength(1);
      expect(monitors[0].id).toBe('keep');
    });
  });

  describe('checkMonitor — docker', () => {
    it('returns ok=true when container status is "running"', async () => {
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        cb(null, { stdout: "'running'\n", stderr: '' });
      });

      const result = await heartbeat.checkMonitor({
        id: 't1', type: 'docker', target: 'nginx', label: 'Nginx', addedAt: Date.now(),
      });

      expect(result.ok).toBe(true);
      expect(result.detail).toContain('running');
    });

    it('returns ok=false when container status is "exited"', async () => {
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        cb(null, { stdout: "'exited'\n", stderr: '' });
      });

      const result = await heartbeat.checkMonitor({
        id: 't2', type: 'docker', target: 'myapp', label: 'MyApp', addedAt: Date.now(),
      });

      expect(result.ok).toBe(false);
    });

    it('returns ok=false when docker inspect fails', async () => {
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        cb(new Error('docker: command not found'), { stdout: '', stderr: '' });
      });

      const result = await heartbeat.checkMonitor({
        id: 't3', type: 'docker', target: 'missing', label: 'Missing', addedAt: Date.now(),
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('checkMonitor — process', () => {
    it('returns ok=true when process is found (pgrep returns pids)', async () => {
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        cb(null, { stdout: '1234\n5678\n', stderr: '' });
      });

      const result = await heartbeat.checkMonitor({
        id: 'p1', type: 'process', target: 'node dist/index', label: 'Bot', addedAt: Date.now(),
      });

      expect(result.ok).toBe(true);
    });

    it('returns ok=false when process is not found (pgrep errors)', async () => {
      mockExec.mockImplementation((cmd: string, cb: Function) => {
        cb(new Error('no process found'), { stdout: '', stderr: '' });
      });

      const result = await heartbeat.checkMonitor({
        id: 'p2', type: 'process', target: 'nonexistent-xyz', label: 'NX', addedAt: Date.now(),
      });

      expect(result.ok).toBe(false);
    });
  });

  describe('start / stop lifecycle', () => {
    it('does not throw when HEARTBEAT_ENABLED=false', () => {
      process.env.HEARTBEAT_ENABLED = 'false';
      const notifier = new (TelegramNotifier as any)();
      const hb = new Heartbeat(notifier);

      expect(() => hb.start()).not.toThrow();
      hb.stop(); // safeguard
      delete process.env.HEARTBEAT_ENABLED;
    });

    it('stop() can be called even before start()', () => {
      expect(() => heartbeat.stop()).not.toThrow();
    });
  });
});
