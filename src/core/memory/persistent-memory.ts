import * as fs from 'fs';
import * as path from 'path';

function assertSafeUserId(userId: string): string {
  if (!/^\d{1,20}$/.test(userId)) {
    throw new Error(`userId inválido: '${userId}'. Apenas dígitos numéricos são permitidos.`);
  }
  return userId;
}

/**
 * PersistentMemory — file-based memory that survives across bot restarts.
 *
 * Layout per user:
 *   data/memory/{userId}/MEMORY.md        — curated permanent facts
 *   data/memory/{userId}/YYYY-MM-DD.md    — daily activity log
 *   data/memory/{userId}/compact-{ts}.md  — LLM-generated context summaries
 */
export class PersistentMemory {
  private static readonly BASE_DIR = path.join(process.cwd(), 'data', 'memory');

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private static dir(userId: string): string {
    const d = path.join(this.BASE_DIR, assertSafeUserId(userId));
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    return d;
  }

  private static today(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Load MEMORY.md + today's log as a single block for injection into the system prompt.
   * Returns empty string if no memory files exist for the user.
   */
  public static read(userId: string): string {
    const dir = path.join(this.BASE_DIR, assertSafeUserId(userId));
    if (!fs.existsSync(dir)) return '';

    const sections: string[] = [];

    const memoryFile = path.join(dir, 'MEMORY.md');
    if (fs.existsSync(memoryFile)) {
      const content = fs.readFileSync(memoryFile, 'utf8').trim();
      if (content) sections.push(`## Memória Permanente\n${content}`);
    }

    const logFile = path.join(dir, `${this.today()}.md`);
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8').trim();
      if (content) sections.push(`## Log de Hoje (${this.today()})\n${content}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Load the most recent compaction summary, if it exists.
   */
  public static loadLastCompact(userId: string): string | null {
    const dir = path.join(this.BASE_DIR, assertSafeUserId(userId));
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('compact-') && f.endsWith('.md'))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    return fs.readFileSync(path.join(dir, files[0]), 'utf8').trim();
  }

  // ─── Write ────────────────────────────────────────────────────────────────

  /**
   * Append an entry to today's daily log.
   */
  public static appendLog(userId: string, entry: string): void {
    const dir = this.dir(userId);
    const logFile = path.join(dir, `${this.today()}.md`);
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: process.env.TIMEZONE || 'America/Sao_Paulo',
    });

    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, `# Log — ${this.today()}\n`);
    }
    fs.appendFileSync(logFile, `\n- [${timestamp}] ${entry}`);
  }

  /**
   * Append a permanent fact to MEMORY.md.
   */
  public static curate(userId: string, fact: string): void {
    const dir = this.dir(userId);
    const memoryFile = path.join(dir, 'MEMORY.md');

    if (!fs.existsSync(memoryFile)) {
      fs.writeFileSync(memoryFile, `# Memória Permanente\n`);
    }
    fs.appendFileSync(memoryFile, `\n- ${fact}`);
    console.log(`🧠 Memory curated for ${userId}: ${fact.substring(0, 60)}`);
  }

  /**
   * Save an LLM-generated compaction summary to disk.
   */
  public static saveCompact(userId: string, summary: string): void {
    const dir = this.dir(userId);
    const timestamp = Date.now();
    const file = path.join(dir, `compact-${timestamp}.md`);
    fs.writeFileSync(file, `# Resumo de Contexto — ${new Date().toISOString()}\n\n${summary}\n`);
    console.log(`📦 Compact saved: ${path.basename(file)}`);
  }
}
