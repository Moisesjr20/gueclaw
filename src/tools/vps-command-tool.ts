import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Tool for executing shell commands on the VPS
 */
export class VPSCommandTool extends BaseTool {
  public readonly name = 'vps_execute_command';
  public readonly description = 'Execute shell commands on the VPS. Can run any bash/shell command with full access.';

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

      console.log(`🖥️  Executing VPS command: ${command}`);

      const options: any = {
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        encoding: 'utf8' as BufferEncoding,
      };

      if (workingDir) {
        options.cwd = workingDir;
      }

      const { stdout, stderr } = await execAsync(command, options);

      let output = stdout.toString().trim();
      if (stderr.toString().trim()) {
        output += `\n[STDERR]: ${stderr.toString().trim()}`;
      }

      return this.success(output || 'Command executed successfully (no output)');

    } catch (error: any) {
      console.error(`❌ VPS command error:`, error.message);
      return this.error(`Command failed: ${error.message}\n${error.stderr || ''}`);
    }
  }
}
