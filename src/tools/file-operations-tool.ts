import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Set FILE_WORKSPACE_ROOT in .env to restrict file access to a specific directory.
// If unset, all paths are allowed except the explicit denylist below.
// Read dynamically per call so env changes (e.g., in tests) are respected.

// Paths always blocked regardless of WORKSPACE_ROOT
const DENIED_PATHS = [
  '/etc/shadow',
  '/etc/gshadow',
  '/etc/sudoers',
  '/root/.ssh',
  '/proc/self/environ',
  '/proc/1/environ',
];

function assertSafePath(filePath: string): string {
  const resolved = path.resolve(filePath);

  const workspaceRoot = process.env.FILE_WORKSPACE_ROOT
    ? path.resolve(process.env.FILE_WORKSPACE_ROOT)
    : null;

  if (workspaceRoot) {
    const withSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;
    if (resolved !== workspaceRoot && !resolved.startsWith(withSep)) {
      throw new Error(`Acesso negado: '${filePath}' está fora do workspace permitido (${workspaceRoot}).`);
    }
  }

  // Normalize to POSIX-style for cross-platform denylist matching
  // (handles Windows where path.resolve('/etc/shadow') → 'D:\etc\shadow')
  const toPosix = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');
  const resolvedPosix = toPosix(resolved);
  const inputPosix = toPosix(filePath);

  for (const denied of DENIED_PATHS) {
    if (
      inputPosix === denied || inputPosix.startsWith(denied + '/') ||
      resolvedPosix === denied || resolvedPosix.startsWith(denied + '/')
    ) {
      throw new Error(`Acesso negado: '${filePath}' é um caminho protegido do sistema.`);
    }
  }

  return resolved;
}

/**
 * Tool for file operations
 */
export class FileOperationsTool extends BaseTool {
  public readonly name = 'file_operations';
  public readonly description = 'Perform file system operations: read, write, append, delete, list directories, create directories.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'File operation to perform',
            enum: ['read', 'write', 'append', 'delete', 'list_dir', 'create_dir', 'exists', 'get_info'],
          },
          filePath: {
            type: 'string',
            description: 'Path to the file or directory',
          },
          content: {
            type: 'string',
            description: 'Content to write or append (for write and append actions)',
          },
          encoding: {
            type: 'string',
            description: 'File encoding (defaults to utf8)',
          },
        },
        required: ['action', 'filePath'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['action', 'filePath']);

      const { action, filePath, content, encoding = 'utf8' } = args;
      const safePath = assertSafePath(filePath);

      switch (action) {
        case 'read':
          return await this.readFile(safePath, encoding);
        
        case 'write':
          this.validate(args, ['content']);
          return await this.writeFile(safePath, content, encoding);
        
        case 'append':
          this.validate(args, ['content']);
          return await this.appendFile(safePath, content, encoding);
        
        case 'delete':
          return await this.deleteFile(safePath);
        
        case 'list_dir':
          return await this.listDirectory(safePath);
        
        case 'create_dir':
          return await this.createDirectory(safePath);
        
        case 'exists':
          return await this.checkExists(safePath);
        
        case 'get_info':
          return await this.getInfo(safePath);
        
        default:
          return this.error(`Unknown file action: ${action}`);
      }

    } catch (error: any) {
      console.error(`❌ File operation error:`, error.message);
      return this.error(`File operation failed: ${error.message}`);
    }
  }

  private async readFile(filePath: string, encoding: string): Promise<ToolResult> {
    const content = fs.readFileSync(filePath, { encoding: encoding as BufferEncoding });
    return this.success(content.toString(), { size: content.toString().length });
  }

  private async writeFile(filePath: string, content: string, encoding: string): Promise<ToolResult> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, { encoding: encoding as any });
    return this.success(`File written successfully: ${filePath}`, { size: content.length });
  }

  private async appendFile(filePath: string, content: string, encoding: string): Promise<ToolResult> {
    fs.appendFileSync(filePath, content, { encoding: encoding as any });
    return this.success(`Content appended successfully: ${filePath}`);
  }

  private async deleteFile(filePath: string): Promise<ToolResult> {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
        return this.success(`Directory deleted: ${filePath}`);
      } else {
        fs.unlinkSync(filePath);
        return this.success(`File deleted: ${filePath}`);
      }
    }
    
    return this.error(`Path does not exist: ${filePath}`);
  }

  private async listDirectory(dirPath: string): Promise<ToolResult> {
    if (!fs.existsSync(dirPath)) {
      return this.error(`Directory does not exist: ${dirPath}`);
    }

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const formatted = items.map((item: fs.Dirent) => {
      const type = item.isDirectory() ? 'DIR' : 'FILE';
      return `[${type}] ${item.name}`;
    }).join('\n');

    return this.success(formatted || 'Empty directory', { count: items.length });
  }

  private async createDirectory(dirPath: string): Promise<ToolResult> {
    fs.mkdirSync(dirPath, { recursive: true });
    return this.success(`Directory created: ${dirPath}`);
  }

  private async checkExists(filePath: string): Promise<ToolResult> {
    const exists = fs.existsSync(filePath);
    return this.success(exists ? 'exists' : 'not_exists', { exists });
  }

  private async getInfo(filePath: string): Promise<ToolResult> {
    if (!fs.existsSync(filePath)) {
      return this.error(`Path does not exist: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    
    const info = {
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
    };

    return this.success(JSON.stringify(info, null, 2), info);
  }
}
