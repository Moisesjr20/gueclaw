import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

// Version control system directories to exclude from searches
const VCS_DIRECTORIES_TO_EXCLUDE = [
  '.git',
  '.svn',
  '.hg',
  '.bzr',
  '.jj',
  '.sl',
] as const;

// Default limit to prevent context bloat
const DEFAULT_RESULT_LIMIT = 100;

/**
 * Tool for searching code using ripgrep
 * Provides fast regex-based search across the codebase
 */
export class GrepTool extends BaseTool {
  public readonly name = 'grep_search';
  public readonly description = 'Search for patterns in code using ripgrep. Fast regex-based search across files with automatic VCS directory exclusion (.git, .svn, etc).';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The regex pattern to search for in file contents (e.g., "class.*Controller", "function\\s+\\w+", "TODO:")',
          },
          path: {
            type: 'string',
            description: 'File or directory to search in. Defaults to current working directory. Can be absolute or relative.',
          },
          glob: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,ts}", "src/**/*.py"). Applied with --glob flag.',
          },
          case_insensitive: {
            type: 'boolean',
            description: 'Perform case-insensitive search (equivalent to rg -i flag)',
          },
          type: {
            type: 'string',
            description: 'File type filter (e.g., "ts", "js", "py", "rust"). More efficient than glob for standard types.',
          },
          show_content: {
            type: 'boolean',
            description: 'Show matching lines with context (default: false, only shows filenames)',
          },
          context_lines: {
            type: 'number',
            description: 'Number of context lines to show before/after each match (only when show_content=true)',
          },
          limit: {
            type: 'number',
            description: `Maximum number of results to return (default: ${DEFAULT_RESULT_LIMIT}, set to 0 for unlimited)`,
          },
        },
        required: ['pattern'],
      },
    };
  }

  /**
   * Check if ripgrep is installed
   */
  private async checkRipgrep(): Promise<boolean> {
    try {
      await execAsync('rg --version', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build ripgrep command arguments
   */
  private buildRipgrepArgs(args: Record<string, any>): string[] {
    const {
      pattern,
      path: searchPath,
      glob,
      case_insensitive,
      type,
      show_content,
      context_lines,
    } = args;

    const rgArgs: string[] = [];

    // Always search hidden files but exclude VCS directories
    rgArgs.push('--hidden');

    // Exclude VCS directories
    for (const dir of VCS_DIRECTORIES_TO_EXCLUDE) {
      rgArgs.push('--glob', `!${dir}`);
    }

    // Limit line length to prevent base64/minified bloat
    rgArgs.push('--max-columns', '500');

    // Case insensitive flag
    if (case_insensitive) {
      rgArgs.push('-i');
    }

    // Output mode: files only or with content
    if (!show_content) {
      rgArgs.push('-l'); // list files with matches only
    } else {
      rgArgs.push('-n'); // show line numbers
      if (context_lines !== undefined && context_lines > 0) {
        rgArgs.push('-C', String(context_lines)); // context lines
      }
    }

    // Type filter
    if (type) {
      rgArgs.push('--type', type);
    }

    // Glob pattern
    if (glob) {
      // Handle multiple patterns separated by comma or space
      const patterns = glob.split(/[,\s]+/).filter(Boolean);
      for (const p of patterns) {
        rgArgs.push('--glob', p);
      }
    }

    // Pattern (handle patterns starting with dash)
    if (pattern.startsWith('-')) {
      rgArgs.push('-e', pattern);
    } else {
      rgArgs.push(pattern);
    }

    // Search path (default to current dir if not specified)
    if (searchPath) {
      rgArgs.push(searchPath);
    } else {
      rgArgs.push('.');
    }

    return rgArgs;
  }

  /**
   * Parse ripgrep output and format results
   */
  private formatResults(
    stdout: string,
    show_content: boolean,
    limit: number,
  ): { output: string; count: number; limited: boolean } {
    if (!stdout.trim()) {
      return { output: 'No matches found.', count: 0, limited: false };
    }

    const lines = stdout.trim().split('\n');
    const effectiveLimit = limit === 0 ? Infinity : (limit || DEFAULT_RESULT_LIMIT);
    const limitedLines = lines.slice(0, effectiveLimit);
    const limited = lines.length > effectiveLimit;

    if (!show_content) {
      // Files mode: convert absolute to relative paths
      const files = limitedLines.map(f => {
        try {
          return path.relative(process.cwd(), f);
        } catch {
          return f;
        }
      });

      const summary = limited
        ? `Found ${lines.length} files (showing first ${files.length}):`
        : `Found ${files.length} file${files.length === 1 ? '' : 's'}:`;

      return {
        output: `${summary}\n${files.join('\n')}`,
        count: files.length,
        limited,
      };
    } else {
      // Content mode: show matching lines
      const summary = limited
        ? `Found matches (showing first ${limitedLines.length} of ${lines.length} lines):`
        : `Found ${lines.length} matching line${lines.length === 1 ? '' : 's'}:`;

      return {
        output: `${summary}\n${limitedLines.join('\n')}`,
        count: lines.length,
        limited,
      };
    }
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['pattern']);

      const { pattern, path: searchPath, show_content = false, limit } = args;

      // Check ripgrep installation
      const hasRipgrep = await this.checkRipgrep();
      if (!hasRipgrep) {
        return {
          success: false,
          output: 'Error: ripgrep (rg) is not installed. Install it with: apt install ripgrep (Linux) or brew install ripgrep (Mac)',
        };
      }

      // Validate search path if provided
      if (searchPath) {
        try {
          const absolutePath = path.resolve(searchPath);
          await fs.access(absolutePath);
        } catch (err) {
          return {
            success: false,
            output: `Error: Path does not exist: ${searchPath}`,
          };
        }
      }

      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`🔍 Searching for pattern: "${pattern.substring(0, 100)}"`);
      }

      // Build and execute ripgrep command
      const rgArgs = this.buildRipgrepArgs(args);
      const command = `rg ${rgArgs.map(arg => {
        // Quote args that contain spaces or special chars
        if (/[\s;&|<>()$`"']/.test(arg)) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      }).join(' ')}`;

      try {
        const { stdout, stderr } = await execAsync(command, {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer
          encoding: 'utf8',
        });

        const { output, count, limited } = this.formatResults(
          stdout,
          show_content,
          limit,
        );

        return {
          success: true,
          output,
          metadata: {
            pattern,
            searchPath: searchPath || '.',
            matchCount: count,
            truncated: limited,
            ...(stderr.trim() && { warnings: stderr.trim() }),
          },
        };
      } catch (err: any) {
        // ripgrep exits with code 1 when no matches found
        if (err.code === 1) {
          return {
            success: true,
            output: 'No matches found.',
            metadata: {
              pattern,
              searchPath: searchPath || '.',
              matchCount: 0,
            },
          };
        }

        // Other errors (timeout, invalid regex, etc)
        const errorMsg = err.stderr || err.message || 'Unknown ripgrep error';
        return {
          success: false,
          output: `Ripgrep error: ${errorMsg}`,
        };
      }
    } catch (err) {
      return {
        success: false,
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
