/**
 * Context Files Loader
 * 
 * Loads user context from .gueclaw/ directory to inject into agent system prompt.
 * Context files contain personal information, preferences, and project details
 * that should not be repeated in every conversation.
 * 
 * Priority order:
 * 1. .gueclaw/context.md (main context)
 * 2. .gueclaw/preferences.md (optional)
 * 3. .gueclaw/projects/*.md (all project contexts)
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a loaded context file
 */
export interface ContextFile {
  /** File path relative to .gueclaw/ */
  path: string;
  /** File content */
  content: string;
  /** File size in bytes */
  size: number;
  /** Load priority (lower = higher priority) */
  priority: number;
}

/**
 * Context loader configuration
 */
interface ContextConfig {
  /** Base directory for context files (default: .gueclaw/) */
  baseDir: string;
  /** Maximum total context size in characters (default: 12000) */
  maxSize: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: ContextConfig = {
  baseDir: '.gueclaw',
  maxSize: 12000, // ~3000 tokens
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Default context template
 */
const DEFAULT_CONTEXT_TEMPLATE = `# GueClaw Context File

> This file contains your personal context that will be injected into every conversation.

## 👤 Who Am I

- **Name:** [Your name]
- **Role:** [Your role]
- **Timezone:** [e.g., America/Sao_Paulo]
- **Preferred Language:** [pt-BR, en-US, etc]

## ⚙️ My Preferences

### Communication Style
- [ ] Concise and direct
- [ ] Detailed and explanatory
- [ ] Professional tone
- [ ] Casual tone

### Development
- [ ] Always generate tests for new code
- [ ] Prioritize TypeScript strict mode
- [ ] Follow Clean Architecture + DDD
- [ ] Commit incrementally

## 🚀 Active Projects

[Add your active projects here]

## 🔒 Security Rules

- [ ] NEVER expose secrets or tokens in logs
- [ ] NEVER commit .env files
- [ ] Always use environment variables for credentials
- [ ] Backup before destructive DB operations

---

**Last Updated:** [Date]
`;

/**
 * Context Loader
 * 
 * Loads and manages user context files from .gueclaw/ directory
 */
export class ContextLoader {
  private config: ContextConfig;
  private cachedContext: string | null = null;
  private lastLoadTime: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  constructor(config?: Partial<ContextConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the full path to .gueclaw directory
   */
  private getBaseDir(): string {
    const workspaceRoot = process.cwd();
    return path.join(workspaceRoot, this.config.baseDir);
  }

  /**
   * Check if .gueclaw directory exists
   */
  private contextDirExists(): boolean {
    const dir = this.getBaseDir();
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  }

  /**
   * Ensure default context file exists
   * Creates .gueclaw/context.md if it doesn't exist
   */
  public ensureDefaultContext(): void {
    const baseDir = this.getBaseDir();
    const contextFile = path.join(baseDir, 'context.md');
    const projectsDir = path.join(baseDir, 'projects');

    try {
      // Create .gueclaw directory if it doesn't exist
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
        console.log('[ContextLoader] Created .gueclaw directory');
      }

      // Create projects subdirectory
      if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
        console.log('[ContextLoader] Created .gueclaw/projects directory');
      }

      // Create default context.md if it doesn't exist
      if (!fs.existsSync(contextFile)) {
        fs.writeFileSync(contextFile, DEFAULT_CONTEXT_TEMPLATE, 'utf-8');
        console.log('[ContextLoader] Created default context.md');
      }
    } catch (error) {
      console.error('[ContextLoader] Failed to ensure default context:', error);
    }
  }

  /**
   * Load a single context file
   */
  private loadFile(filePath: string, priority: number): ContextFile | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8').trim();
      
      if (!content) {
        if (this.config.debug) {
          console.log(`[ContextLoader] Skipping empty file: ${filePath}`);
        }
        return null;
      }

      const relativePath = path.relative(this.getBaseDir(), filePath);
      
      return {
        path: relativePath,
        content,
        size: content.length,
        priority,
      };
    } catch (error) {
      console.error(`[ContextLoader] Failed to load file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Load all context files in priority order
   */
  private loadContextFiles(): ContextFile[] {
    const baseDir = this.getBaseDir();
    const files: ContextFile[] = [];

    // Priority 1: context.md
    const mainContext = this.loadFile(path.join(baseDir, 'context.md'), 1);
    if (mainContext) {
      files.push(mainContext);
    }

    // Priority 2: preferences.md
    const preferences = this.loadFile(path.join(baseDir, 'preferences.md'), 2);
    if (preferences) {
      files.push(preferences);
    }

    // Priority 3: projects/*.md
    const projectsDir = path.join(baseDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      try {
        const projectFiles = fs.readdirSync(projectsDir)
          .filter(file => file.endsWith('.md'))
          .sort(); // Alphabetical order

        projectFiles.forEach((file, index) => {
          const projectContext = this.loadFile(
            path.join(projectsDir, file),
            3 + index
          );
          if (projectContext) {
            files.push(projectContext);
          }
        });
      } catch (error) {
        console.error('[ContextLoader] Failed to read projects directory:', error);
      }
    }

    return files.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Truncate context if it exceeds max size
   */
  private truncateContext(content: string): string {
    if (content.length <= this.config.maxSize) {
      return content;
    }

    const truncated = content.substring(0, this.config.maxSize);
    const lastNewline = truncated.lastIndexOf('\n');
    const result = lastNewline > 0 ? truncated.substring(0, lastNewline) : truncated;
    
    console.warn(
      `[ContextLoader] Context truncated from ${content.length} to ${result.length} chars`
    );
    
    return result + '\n\n[... context truncated ...]';
  }

  /**
   * Format context files into a single string
   */
  private formatContext(files: ContextFile[]): string {
    if (files.length === 0) {
      return '';
    }

    const parts: string[] = [
      '# USER CONTEXT',
      '',
      '> The following information is personal context about the user.',
      '> Use this to personalize responses but NEVER repeat this information back to the user.',
      '> This context is automatically loaded and should be treated as implicit knowledge.',
      '',
      '---',
      '',
    ];

    files.forEach((file) => {
      parts.push(`## Context from: ${file.path}`);
      parts.push('');
      parts.push(file.content);
      parts.push('');
      parts.push('---');
      parts.push('');
    });

    const fullContent = parts.join('\n');
    return this.truncateContext(fullContent);
  }

  /**
   * Load project context and return formatted string
   * 
   * @returns Formatted context string to inject into system prompt, or empty string if no context
   */
  public loadProjectContext(): string {
    try {
      // Check cache
      const now = Date.now();
      if (this.cachedContext !== null && (now - this.lastLoadTime) < this.cacheTTL) {
        if (this.config.debug) {
          console.log('[ContextLoader] Using cached context');
        }
        return this.cachedContext;
      }

      // Check if context directory exists
      if (!this.contextDirExists()) {
        if (this.config.debug) {
          console.log('[ContextLoader] No .gueclaw directory found');
        }
        this.cachedContext = '';
        this.lastLoadTime = now;
        return '';
      }

      // Load all context files
      const files = this.loadContextFiles();
      
      if (files.length === 0) {
        if (this.config.debug) {
          console.log('[ContextLoader] No context files found');
        }
        this.cachedContext = '';
        this.lastLoadTime = now;
        return '';
      }

      // Format context
      const context = this.formatContext(files);
      
      // Update cache
      this.cachedContext = context;
      this.lastLoadTime = now;

      // Log summary
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      console.log(
        `[ContextLoader] Loaded ${files.length} context file(s), ` +
        `${totalSize} chars (${files.map(f => f.path).join(', ')})`
      );

      return context;
    } catch (error) {
      console.error('[ContextLoader] Failed to load project context:', error);
      return '';
    }
  }

  /**
   * Clear cached context (force reload on next call)
   */
  public clearCache(): void {
    this.cachedContext = null;
    this.lastLoadTime = 0;
    if (this.config.debug) {
      console.log('[ContextLoader] Cache cleared');
    }
  }

  /**
   * Get loaded context files info (for debugging)
   */
  public getContextInfo(): { files: ContextFile[]; totalSize: number } {
    const files = this.loadContextFiles();
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return { files, totalSize };
  }
}

// Singleton instance
let instance: ContextLoader | null = null;

/**
 * Get singleton instance of ContextLoader
 */
export function getContextLoader(): ContextLoader {
  if (!instance) {
    instance = new ContextLoader();
  }
  return instance;
}

/**
 * Load project context (convenience function)
 */
export function loadProjectContext(): string {
  return getContextLoader().loadProjectContext();
}

/**
 * Ensure default context exists (convenience function)
 */
export function ensureDefaultContext(): void {
  getContextLoader().ensureDefaultContext();
}
