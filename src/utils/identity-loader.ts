import * as fs from 'fs';
import * as path from 'path';

/**
 * IdentityLoader — loads SOUL.md, USER.md and AGENTS.md from .agents/
 * and prepends their content to the agent's system prompt.
 * Files are optional: missing files are silently skipped.
 */
export class IdentityLoader {
  private static readonly AGENTS_DIR = path.join(process.cwd(), '.agents');

  private static readonly FILES = ['SOUL.md', 'USER.md', 'AGENTS.md'] as const;

  /** Cached identity block so we only read disk once per process */
  private static cached: string | null = null;

  /**
   * Load and cache the identity block from .agents/*.md files.
   * Returns empty string if no identity files exist.
   */
  public static load(): string {
    if (this.cached !== null) return this.cached;

    const sections: string[] = [];

    for (const file of this.FILES) {
      const filePath = path.join(this.AGENTS_DIR, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8').trim();
          if (content) {
            sections.push(content);
          }
        } catch {
          // silently skip unreadable files
        }
      }
    }

    this.cached = sections.join('\n\n---\n\n');
    if (this.cached) {
      console.log(`🧬 Identity loaded (${this.cached.length} chars)`);
    }
    return this.cached;
  }

  /**
   * Prepend the identity block to an existing system prompt.
   * If no identity files exist, returns the original prompt unchanged.
   */
  public static prepend(systemPrompt: string): string {
    const identity = this.load();
    if (!identity) return systemPrompt;
    return `${identity}\n\n---\n\n${systemPrompt}`;
  }

  /**
   * Invalidate the cache (useful for hot-reload in development).
   */
  public static invalidateCache(): void {
    this.cached = null;
  }
}
