import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs/promises';

// Default limit to prevent context bloat
const DEFAULT_FILE_LIMIT = 100;

/**
 * Tool for finding files using glob patterns
 * Fast file pattern matching across the codebase
 */
export class GlobTool extends BaseTool {
  public readonly name = 'glob_search';
  public readonly description = 'Find files by name pattern using glob syntax. Supports wildcards like *.ts, **/*.js, src/**/*.{ts,tsx}. Fast file discovery for exact filename patterns.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      isConcurrencySafe: true, // READ-ONLY file discovery
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'Glob pattern to match files (e.g., "*.ts", "src/**/*.js", "**/*.{ts,tsx}", "test*.py"). Supports ** for recursive search, * for wildcards, {a,b} for alternatives.',
          },
          path: {
            type: 'string',
            description: 'Directory to search in. Defaults to current working directory. Must be a valid directory path.',
          },
          limit: {
            type: 'number',
            description: `Maximum number of files to return (default: ${DEFAULT_FILE_LIMIT}, set to 0 for unlimited)`,
          },
          ignore_vcs: {
            type: 'boolean',
            description: 'Automatically ignore VCS directories (.git, .svn, node_modules, etc). Default: true',
          },
        },
        required: ['pattern'],
      },
    };
  }

  /**
   * Execute glob search
   */
  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['pattern']);

      const {
        pattern,
        path: searchPath,
        limit,
        ignore_vcs = true,
      } = args;

      const startTime = Date.now();

      // Determine search directory
      const searchDir = searchPath ? path.resolve(searchPath) : process.cwd();

      // Validate search directory exists
      try {
        const stats = await fs.stat(searchDir);
        if (!stats.isDirectory()) {
          return {
            success: false,
            output: `Error: Path is not a directory: ${searchPath}`,
          };
        }
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return {
            success: false,
            output: `Error: Directory does not exist: ${searchPath}`,
          };
        }
        throw err;
      }

      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`📁 Globbing pattern: "${pattern}" in ${searchDir}`);
      }

      // Build glob options
      const globOptions: any = {
        cwd: searchDir,
        absolute: false, // Return relative paths
        nodir: false, // Include directories
        dot: false, // Don't match dotfiles by default
        ignore: ignore_vcs ? [
          '**/node_modules/**',
          '**/.git/**',
          '**/.svn/**',
          '**/.hg/**',
          '**/.bzr/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
        ] : [],
      };

      // Execute glob search
      try {
        const files = await new Promise<string[]>((resolve, reject) => {
          glob(pattern, globOptions, (err, matches) => {
            if (err) reject(err);
            else resolve(matches);
          });
        });

        // Sort files alphabetically for deterministic results
        const sortedFiles = files.sort();

        // Apply limit
        const effectiveLimit = limit === 0 ? Infinity : (limit || DEFAULT_FILE_LIMIT);
        const limitedFiles = sortedFiles.slice(0, effectiveLimit);
        const truncated = sortedFiles.length > effectiveLimit;

        const durationMs = Date.now() - startTime;

        // Format output
        if (limitedFiles.length === 0) {
          return {
            success: true,
            output: 'No files found matching pattern.',
            metadata: {
              pattern,
              searchPath: searchDir,
              durationMs,
              numFiles: 0,
            },
          };
        }

        const summary = truncated
          ? `Found ${sortedFiles.length} files (showing first ${limitedFiles.length}):`
          : `Found ${limitedFiles.length} file${limitedFiles.length === 1 ? '' : 's'}:`;

        const truncationNote = truncated
          ? '\n\n(Results truncated. Use a more specific pattern or increase limit.)'
          : '';

        return {
          success: true,
          output: `${summary}\n${limitedFiles.join('\n')}${truncationNote}`,
          metadata: {
            pattern,
            searchPath: searchDir,
            durationMs,
            numFiles: limitedFiles.length,
            totalMatches: sortedFiles.length,
            truncated,
          },
        };
      } catch (globErr: any) {
        return {
          success: false,
          output: `Glob error: ${globErr.message || String(globErr)}`,
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
