import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

const MAX_COMMAND_LENGTH = 4096;

// Patterns that match catastrophically destructive operations
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-\w+\s+)*-[a-z]*r[a-z]*f[a-z]*\s+\/([\s;|&]|$)/i,  // rm -rf /
  /\brm\s+(-\w+\s+)*-[a-z]*f[a-z]*r[a-z]*\s+\/([\s;|&]|$)/i,  // rm -fr /
  /\bdd\s+.*\bof=\/dev\/(sd|hd|nvme|xvd|vd)/i,                   // dd → raw disk
  /\bmkfs(\.\w+)?\s/i,                                            // format filesystem
  /\bshred\s+.*\/dev\//i,                                        // shred disk device
  /\bwipefs\b/i,                                                  // wipe filesystem signatures
  /\bfdisk\s+.*\/dev\//i,                                        // fdisk on device
  /\bparted\s+.*\/dev\//i,                                       // parted on device
  />\s*\/dev\/(sd|hd|nvme|xvd|vd)/i,                             // redirect to disk
];

function assertSafeCommand(command: string): void {
  if (command.length > MAX_COMMAND_LENGTH) {
    throw new Error(`Comando muito longo (${command.length} chars). Máximo: ${MAX_COMMAND_LENGTH}.`);
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error('Comando bloqueado: padrão destrutivo detectado.');
    }
  }
}

function assertSafeWorkingDir(dir: string): string {
  if (/[;&|`$<>()\n\r]/.test(dir)) {
    throw new Error('workingDir contém caracteres inválidos.');
  }
  return path.resolve(dir);
}

/**
 * Tool for executing shell commands on the VPS
 */
export class VPSCommandTool extends BaseTool {
  public readonly name = 'vps_execute_command';
  public readonly description = 'Execute shell commands on the VPS to manage the system.  ';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute (e.g., "ls -la", "docker ps", "systemctl status nginx")',
          },
          workingDir: {
            type: 'string',
            description: 'Working directory for the command (optional, defaults to home)',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (optional, defaults to 30000)',
          },
        },
        required: ['command'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['command']);

      const { command, workingDir, timeout = 30000 } = args;

      assertSafeCommand(command);
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`🖥️  Executing VPS command: ${command.substring(0, 200)}`);
      }

      const options: any = {
        timeout: Math.min(Number(timeout) || 30000, 120000), // cap at 2 min
        maxBuffer: 1024 * 1024 * 10,
        encoding: 'utf8' as BufferEncoding,
      };

      if (workingDir) {
        options.cwd = assertSafeWorkingDir(workingDir);
      }

      const { stdout, stderr } = await execAsync(command, options);

      let output = stdout.toString().trim();
      if (stderr.toString().trim()) {
        output += `\n[STDERR]: ${stderr.toString().trim()}`;
      }

      return this.success(output || 'Command executed successfully (no output)');

    } catch (error: any) {
      console.error(`❌ VPS command error:`, error.message);
      const stdoutPart = error.stdout?.toString().trim() || '';
      const stderrPart = error.stderr?.toString().trim() || '';
      const details = [stdoutPart, stderrPart].filter(Boolean).join('\n[STDERR]: ');
      return this.error(`Command failed: ${error.message}${details ? '\n' + details : ''}`);
    }
  }
}
