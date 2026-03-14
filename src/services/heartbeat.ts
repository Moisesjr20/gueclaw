import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TelegramNotifier } from './telegram-notifier';

const execAsync = promisify(exec);

export interface MonitorEntry {
  id: string;
  type: 'docker' | 'systemd' | 'http' | 'process';
  target: string;     // container name, service name, URL, or process pattern
  label: string;      // friendly display name
  addedAt: number;
}

/**
 * Heartbeat — proactive monitor that runs periodic checks and alerts via Telegram.
 *
 * Checks are configured via /monitorar add <type> <target> [label].
 * Config persists in data/heartbeat/monitors.json.
 *
 * Environment:
 *   HEARTBEAT_INTERVAL_MINUTES  — check interval (default: 60)
 *   HEARTBEAT_ENABLED           — set to "false" to disable (default: true)
 */
export class Heartbeat {
  private static readonly CONFIG_DIR = path.join(process.cwd(), 'data', 'heartbeat');
  private static readonly CONFIG_FILE = path.join(Heartbeat.CONFIG_DIR, 'monitors.json');

  private notifier: TelegramNotifier;
  private intervalId?: ReturnType<typeof setInterval>;
  private intervalMinutes: number;

  constructor(notifier: TelegramNotifier) {
    this.notifier = notifier;
    this.intervalMinutes = parseInt(process.env.HEARTBEAT_INTERVAL_MINUTES || '60', 10);

    // Ensure config directory exists
    if (!fs.existsSync(Heartbeat.CONFIG_DIR)) {
      fs.mkdirSync(Heartbeat.CONFIG_DIR, { recursive: true });
    }
  }

  // ─── Config persistence ───────────────────────────────────────────────────

  public loadMonitors(): MonitorEntry[] {
    if (!fs.existsSync(Heartbeat.CONFIG_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(Heartbeat.CONFIG_FILE, 'utf8')) as MonitorEntry[];
    } catch {
      return [];
    }
  }

  private saveMonitors(monitors: MonitorEntry[]): void {
    fs.writeFileSync(Heartbeat.CONFIG_FILE, JSON.stringify(monitors, null, 2));
  }

  public addMonitor(entry: Omit<MonitorEntry, 'addedAt'>): void {
    const monitors = this.loadMonitors();
    // Avoid duplicate ids
    if (monitors.find(m => m.id === entry.id)) return;
    monitors.push({ ...entry, addedAt: Date.now() });
    this.saveMonitors(monitors);
    console.log(`💓 Monitor added: ${entry.label} (${entry.type}:${entry.target})`);
  }

  public removeMonitor(id: string): boolean {
    const monitors = this.loadMonitors();
    const filtered = monitors.filter(m => m.id !== id);
    if (filtered.length === monitors.length) return false;
    this.saveMonitors(filtered);
    return true;
  }

  // ─── Check logic ──────────────────────────────────────────────────────────

  public async checkMonitor(monitor: MonitorEntry): Promise<{ ok: boolean; detail: string }> {
    try {
      switch (monitor.type) {
        case 'docker':
          return await this.checkDocker(monitor.target);
        case 'systemd':
          return await this.checkSystemd(monitor.target);
        case 'http':
          return await this.checkHttp(monitor.target);
        case 'process':
          return await this.checkProcess(monitor.target);
        default:
          return { ok: false, detail: `Tipo desconhecido: ${monitor.type}` };
      }
    } catch (err: any) {
      return { ok: false, detail: err.message };
    }
  }

  private async checkDocker(containerName: string): Promise<{ ok: boolean; detail: string }> {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${containerName} 2>&1`
    );
    const status = stdout.trim().replace(/^'|'$/g, '');
    const ok = status === 'running';
    return { ok, detail: `status: ${status}` };
  }

  private async checkSystemd(serviceName: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const { stdout } = await execAsync(
        `systemctl is-active ${serviceName} 2>&1`
      );
      const active = stdout.trim() === 'active';
      return { ok: active, detail: stdout.trim() };
    } catch (err: any) {
      // systemctl exits non-zero when inactive
      return { ok: false, detail: (err.stdout || err.message || 'inactive').trim() };
    }
  }

  private async checkHttp(url: string): Promise<{ ok: boolean; detail: string }> {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const ok = response.status >= 200 && response.status < 400;
    return { ok, detail: `HTTP ${response.status}` };
  }

  private async checkProcess(pattern: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const { stdout } = await execAsync(`pgrep -f "${pattern}" 2>&1`);
      const pids = stdout.trim().split('\n').filter(Boolean);
      const ok = pids.length > 0;
      return { ok, detail: ok ? `pids: ${pids.join(',')}` : 'not found' };
    } catch {
      return { ok: false, detail: 'not found' };
    }
  }

  // ─── Run all checks ───────────────────────────────────────────────────────

  public async runChecks(): Promise<void> {
    const monitors = this.loadMonitors();
    if (monitors.length === 0) return;

    console.log(`💓 Heartbeat check — ${monitors.length} monitor(s)...`);
    const failures: string[] = [];

    for (const monitor of monitors) {
      const result = await this.checkMonitor(monitor);
      if (!result.ok) {
        const msg = `❌ ${monitor.label} (${monitor.type}:${monitor.target}) — ${result.detail}`;
        console.warn(`💔 ${msg}`);
        failures.push(msg);
      } else {
        console.log(`💚 ${monitor.label} — OK (${result.detail})`);
      }
    }

    if (failures.length > 0) {
      const alertMsg = [
        `⚠️ <b>Heartbeat — Anomalias Detectadas</b>`,
        ``,
        ...failures,
        ``,
        `🕐 ${new Date().toLocaleString('pt-BR', { timeZone: process.env.TIMEZONE || 'America/Sao_Paulo' })}`,
      ].join('\n');

      await this.notifier.sendToAllUsers(alertMsg, { parse_mode: 'HTML' });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  public start(): void {
    if (process.env.HEARTBEAT_ENABLED === 'false') {
      console.log('💤 Heartbeat disabled (HEARTBEAT_ENABLED=false)');
      return;
    }

    const ms = this.intervalMinutes * 60 * 1000;
    console.log(`💓 Heartbeat started — checks every ${this.intervalMinutes} min`);

    // Run once immediately, then on interval
    setTimeout(() => this.runChecks().catch(console.error), 30000); // 30s after boot
    this.intervalId = setInterval(() => this.runChecks().catch(console.error), ms);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('💓 Heartbeat stopped');
    }
  }
}
