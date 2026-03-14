import * as fs from 'fs';
import * as path from 'path';
import { PersistentMemory } from '../../src/core/memory/persistent-memory';

const BASE_DIR = path.join(process.cwd(), 'data', 'memory');
const TEST_USER = String(Date.now());
const USER_DIR = path.join(BASE_DIR, TEST_USER);

afterAll(() => {
  if (fs.existsSync(USER_DIR)) {
    fs.rmSync(USER_DIR, { recursive: true, force: true });
  }
});

describe('PersistentMemory', () => {
  describe('read', () => {
    it('returns empty string when no memory directory exists for user', () => {
      const result = PersistentMemory.read('99999999999');
      expect(result).toBe('');
    });

    it('returns MEMORY.md content under "Memória Permanente" heading', () => {
      PersistentMemory.curate(TEST_USER, 'fact: projeto fica em /opt/gueclaw');
      const result = PersistentMemory.read(TEST_USER);
      expect(result).toContain('Memória Permanente');
      expect(result).toContain('fact: projeto fica em /opt/gueclaw');
    });

    it('includes today log under "Log de Hoje" heading', () => {
      PersistentMemory.appendLog(TEST_USER, 'reiniciou o servidor nginx');
      const result = PersistentMemory.read(TEST_USER);
      expect(result).toContain('Log de Hoje');
      expect(result).toContain('reiniciou o servidor nginx');
    });
  });

  describe('curate', () => {
    it('creates MEMORY.md if it does not exist', () => {
      const userId = String(Number(TEST_USER) + 1);
      const memFile = path.join(BASE_DIR, userId, 'MEMORY.md');
      expect(fs.existsSync(memFile)).toBe(false);

      PersistentMemory.curate(userId, 'primeiro fato');
      expect(fs.existsSync(memFile)).toBe(true);

      fs.rmSync(path.join(BASE_DIR, userId), { recursive: true, force: true });
    });

    it('appends multiple facts, each on its own line', () => {
      const userId = String(Number(TEST_USER) + 2);
      PersistentMemory.curate(userId, 'fato A');
      PersistentMemory.curate(userId, 'fato B');

      const content = fs.readFileSync(path.join(BASE_DIR, userId, 'MEMORY.md'), 'utf8');
      expect(content).toContain('fato A');
      expect(content).toContain('fato B');

      fs.rmSync(path.join(BASE_DIR, userId), { recursive: true, force: true });
    });
  });

  describe('appendLog', () => {
    it('creates a dated log file for today', () => {
      const today = new Date().toISOString().slice(0, 10);
      PersistentMemory.appendLog(TEST_USER, 'entrada de log de test');

      const logFile = path.join(USER_DIR, `${today}.md`);
      expect(fs.existsSync(logFile)).toBe(true);

      const content = fs.readFileSync(logFile, 'utf8');
      expect(content).toContain('entrada de log de test');
    });

    it('appends multiple entries to the same log file', () => {
      const today = new Date().toISOString().slice(0, 10);
      PersistentMemory.appendLog(TEST_USER, 'primeira entrada');
      PersistentMemory.appendLog(TEST_USER, 'segunda entrada');

      const content = fs.readFileSync(path.join(USER_DIR, `${today}.md`), 'utf8');
      expect(content).toContain('primeira entrada');
      expect(content).toContain('segunda entrada');
    });
  });

  describe('saveCompact', () => {
    it('creates a compact-{ts}.md file in the user directory', () => {
      const userId = String(Number(TEST_USER) + 3);
      PersistentMemory.saveCompact(userId, 'resumo de contexto salvo');

      const dir = path.join(BASE_DIR, userId);
      const files = fs.readdirSync(dir).filter(f => f.startsWith('compact-') && f.endsWith('.md'));
      expect(files.length).toBe(1);

      const content = fs.readFileSync(path.join(dir, files[0]), 'utf8');
      expect(content).toContain('resumo de contexto salvo');

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('loadLastCompact', () => {
    it('returns null when no compact files exist for user', () => {
      const result = PersistentMemory.loadLastCompact('88888888888');
      expect(result).toBeNull();
    });

    it('returns the content of the most recent compact file', () => {
      const userId = String(Number(TEST_USER) + 4);
      PersistentMemory.saveCompact(userId, 'primeiro resumo');

      // Small delay to ensure a different timestamp for the second file
      const result = PersistentMemory.loadLastCompact(userId);
      expect(result).toContain('primeiro resumo');

      fs.rmSync(path.join(BASE_DIR, userId), { recursive: true, force: true });
    });

    it('returns the latest file when multiple compact files exist', () => {
      const userId = String(Number(TEST_USER) + 5);
      PersistentMemory.saveCompact(userId, 'resumo antigo');
      // Force slightly different timestamp via sleep workaround: just write directly
      const dir = path.join(BASE_DIR, userId);
      fs.writeFileSync(path.join(dir, `compact-${Date.now() + 1}.md`), 'resumo novo\n');

      const result = PersistentMemory.loadLastCompact(userId);
      expect(result).toContain('resumo novo');

      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});
