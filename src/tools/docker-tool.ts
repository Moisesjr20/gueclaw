import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Docker container/volume names: alphanumeric + underscore, hyphen, dot (max 253)
const DOCKER_NAME_RE  = /^[a-zA-Z0-9][a-zA-Z0-9_.\-]{0,252}$/;
// Image names may include registry host, namespace, tag or digest
const DOCKER_IMAGE_RE = /^[a-zA-Z0-9][a-zA-Z0-9._\-/:@]{0,300}$/;
const SHELL_META_RE   = /[;&|`$<>()\n\r\t ]/;

function sanitizeDockerName(name: string, field = 'containerName'): string {
  if (!DOCKER_NAME_RE.test(name)) {
    throw new Error(`'${field}' inválido: "${name}". Use apenas letras, números, hífens, underscores e pontos (máx 253).`);
  }
  return name;
}

function sanitizeImageName(name: string): string {
  const t = name.trim();
  if (!DOCKER_IMAGE_RE.test(t) || SHELL_META_RE.test(t)) {
    throw new Error(`imageName inválido: "${t}". Não pode conter metacaracteres.`);
  }
  return t;
}

function sanitizeFilePath(p: string, field: string): string {
  if (SHELL_META_RE.test(p)) {
    throw new Error(`'${field}' contém metacaracteres inválidos.`);
  }
  return p;
}

function safeTail(tail: unknown): number {
  const n = Math.floor(Number(tail) || 100);
  return Math.max(1, Math.min(n, 10000));
}

/**
 * Tool for managing Docker containers
 */
export class DockerTool extends BaseTool {
  public readonly name = 'docker_manage';
  public readonly description = 'Manage Docker containers, images, networks, and volumes on the VPS.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Docker action to perform',
            enum: ['list_containers', 'list_images', 'start', 'stop', 'restart', 'remove', 'logs', 'exec', 'inspect', 'pull', 'build', 'compose_up', 'compose_down'],
          },
          containerName: {
            type: 'string',
            description: 'Container name or ID (for start, stop, restart, remove, logs, exec, inspect)',
          },
          imageName: {
            type: 'string',
            description: 'Image name (for pull, build)',
          },
          command: {
            type: 'string',
            description: 'Command to execute inside container (for exec action)',
          },
          composePath: {
            type: 'string',
            description: 'Path to docker-compose.yml file (for compose actions)',
          },
          buildContext: {
            type: 'string',
            description: 'Build context path (for build action)',
          },
          tail: {
            type: 'number',
            description: 'Number of log lines to retrieve (for logs action, defaults to 100)',
          },
        },
        required: ['action'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['action']);

      const { action } = args;

      switch (action) {
        case 'list_containers':
          return await this.listContainers();
        
        case 'list_images':
          return await this.listImages();
        
        case 'start':
          this.validate(args, ['containerName']);
          return await this.startContainer(sanitizeDockerName(args.containerName));
        
        case 'stop':
          this.validate(args, ['containerName']);
          return await this.stopContainer(sanitizeDockerName(args.containerName));
        
        case 'restart':
          this.validate(args, ['containerName']);
          return await this.restartContainer(sanitizeDockerName(args.containerName));
        
        case 'remove':
          this.validate(args, ['containerName']);
          return await this.removeContainer(sanitizeDockerName(args.containerName));
        
        case 'logs':
          this.validate(args, ['containerName']);
          return await this.getLogs(sanitizeDockerName(args.containerName), safeTail(args.tail));
        
        case 'exec':
          this.validate(args, ['containerName', 'command']);
          return await this.execCommand(sanitizeDockerName(args.containerName), args.command);
        
        case 'inspect':
          this.validate(args, ['containerName']);
          return await this.inspectContainer(sanitizeDockerName(args.containerName));
        
        case 'pull':
          this.validate(args, ['imageName']);
          return await this.pullImage(sanitizeImageName(args.imageName));
        
        case 'build':
          this.validate(args, ['imageName', 'buildContext']);
          return await this.buildImage(sanitizeImageName(args.imageName), sanitizeFilePath(args.buildContext, 'buildContext'));
        
        case 'compose_up':
          this.validate(args, ['composePath']);
          return await this.composeUp(sanitizeFilePath(args.composePath, 'composePath'));
        
        case 'compose_down':
          this.validate(args, ['composePath']);
          return await this.composeDown(sanitizeFilePath(args.composePath, 'composePath'));
        
        default:
          return this.error(`Unknown Docker action: ${action}`);
      }

    } catch (error: any) {
      console.error(`❌ Docker tool error:`, error.message);
      return this.error(`Docker operation failed: ${error.message}`);
    }
  }

  private async run(dockerArgs: string[]): Promise<string> {
    const { stdout, stderr } = await execFileAsync('docker', dockerArgs, {
      maxBuffer: 1024 * 1024 * 10,
    });
    return ((stdout || '') + (stderr || '')).toString().trim();
  }

  private async listContainers(): Promise<ToolResult> {
    const output = await this.run(['ps', '-a', '--format', 'table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}']);
    return this.success(output || 'No containers found');
  }

  private async listImages(): Promise<ToolResult> {
    const output = await this.run(['images', '--format', 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}']);
    return this.success(output || 'No images found');
  }

  private async startContainer(name: string): Promise<ToolResult> {
    await this.run(['start', name]);
    return this.success(`Container '${name}' started successfully`);
  }

  private async stopContainer(name: string): Promise<ToolResult> {
    await this.run(['stop', name]);
    return this.success(`Container '${name}' stopped successfully`);
  }

  private async restartContainer(name: string): Promise<ToolResult> {
    await this.run(['restart', name]);
    return this.success(`Container '${name}' restarted successfully`);
  }

  private async removeContainer(name: string): Promise<ToolResult> {
    await this.run(['rm', '-f', name]);
    return this.success(`Container '${name}' removed successfully`);
  }

  private async getLogs(name: string, tail: number): Promise<ToolResult> {
    const output = await this.run(['logs', '--tail', String(tail), name]);
    return this.success(output || 'No logs available');
  }

  private async execCommand(name: string, command: string): Promise<ToolResult> {
    // command runs inside the container — name is already sanitized at call site
    const output = await this.run(['exec', name, 'sh', '-c', command]);
    return this.success(output || 'Command executed (no output)');
  }

  private async inspectContainer(name: string): Promise<ToolResult> {
    const output = await this.run(['inspect', name]);
    return this.success(output);
  }

  private async pullImage(imageName: string): Promise<ToolResult> {
    const output = await this.run(['pull', imageName]);
    return this.success(`Image '${imageName}' pulled successfully\n${output}`);
  }

  private async buildImage(imageName: string, buildContext: string): Promise<ToolResult> {
    const output = await this.run(['build', '-t', imageName, buildContext]);
    return this.success(`Image '${imageName}' built successfully\n${output}`);
  }

  private async composeUp(composePath: string): Promise<ToolResult> {
    const { stdout } = await execFileAsync('docker-compose', ['-f', composePath, 'up', '-d'], {
      maxBuffer: 1024 * 1024 * 10,
    });
    return this.success(`Docker Compose started\n${stdout.toString().trim()}`);
  }

  private async composeDown(composePath: string): Promise<ToolResult> {
    const { stdout } = await execFileAsync('docker-compose', ['-f', composePath, 'down'], {
      maxBuffer: 1024 * 1024 * 10,
    });
    return this.success(`Docker Compose stopped\n${stdout.toString().trim()}`);
  }
}
