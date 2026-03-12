import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
          return await this.startContainer(args.containerName);
        
        case 'stop':
          this.validate(args, ['containerName']);
          return await this.stopContainer(args.containerName);
        
        case 'restart':
          this.validate(args, ['containerName']);
          return await this.restartContainer(args.containerName);
        
        case 'remove':
          this.validate(args, ['containerName']);
          return await this.removeContainer(args.containerName);
        
        case 'logs':
          this.validate(args, ['containerName']);
          return await this.getLogs(args.containerName, args.tail || 100);
        
        case 'exec':
          this.validate(args, ['containerName', 'command']);
          return await this.execCommand(args.containerName, args.command);
        
        case 'inspect':
          this.validate(args, ['containerName']);
          return await this.inspectContainer(args.containerName);
        
        case 'pull':
          this.validate(args, ['imageName']);
          return await this.pullImage(args.imageName);
        
        case 'build':
          this.validate(args, ['imageName', 'buildContext']);
          return await this.buildImage(args.imageName, args.buildContext);
        
        case 'compose_up':
          this.validate(args, ['composePath']);
          return await this.composeUp(args.composePath);
        
        case 'compose_down':
          this.validate(args, ['composePath']);
          return await this.composeDown(args.composePath);
        
        default:
          return this.error(`Unknown Docker action: ${action}`);
      }

    } catch (error: any) {
      console.error(`❌ Docker tool error:`, error.message);
      return this.error(`Docker operation failed: ${error.message}`);
    }
  }

  private async runDockerCommand(command: string): Promise<string> {
    const { stdout, stderr } = await execAsync(`docker ${command}`, { maxBuffer: 1024 * 1024 * 10 });
    return stdout.trim() || stderr.trim();
  }

  private async listContainers(): Promise<ToolResult> {
    const output = await this.runDockerCommand('ps -a --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Image}}"');
    return this.success(output || 'No containers found');
  }

  private async listImages(): Promise<ToolResult> {
    const output = await this.runDockerCommand('images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.ID}}\\t{{.Size}}"');
    return this.success(output || 'No images found');
  }

  private async startContainer(name: string): Promise<ToolResult> {
    await this.runDockerCommand(`start ${name}`);
    return this.success(`Container '${name}' started successfully`);
  }

  private async stopContainer(name: string): Promise<ToolResult> {
    await this.runDockerCommand(`stop ${name}`);
    return this.success(`Container '${name}' stopped successfully`);
  }

  private async restartContainer(name: string): Promise<ToolResult> {
    await this.runDockerCommand(`restart ${name}`);
    return this.success(`Container '${name}' restarted successfully`);
  }

  private async removeContainer(name: string): Promise<ToolResult> {
    await this.runDockerCommand(`rm -f ${name}`);
    return this.success(`Container '${name}' removed successfully`);
  }

  private async getLogs(name: string, tail: number): Promise<ToolResult> {
    const output = await this.runDockerCommand(`logs --tail ${tail} ${name}`);
    return this.success(output || 'No logs available');
  }

  private async execCommand(name: string, command: string): Promise<ToolResult> {
    const output = await this.runDockerCommand(`exec ${name} ${command}`);
    return this.success(output || 'Command executed (no output)');
  }

  private async inspectContainer(name: string): Promise<ToolResult> {
    const output = await this.runDockerCommand(`inspect ${name}`);
    return this.success(output);
  }

  private async pullImage(imageName: string): Promise<ToolResult> {
    const output = await this.runDockerCommand(`pull ${imageName}`);
    return this.success(`Image '${imageName}' pulled successfully\n${output}`);
  }

  private async buildImage(imageName: string, buildContext: string): Promise<ToolResult> {
    const output = await this.runDockerCommand(`build -t ${imageName} ${buildContext}`);
    return this.success(`Image '${imageName}' built successfully\n${output}`);
  }

  private async composeUp(composePath: string): Promise<ToolResult> {
    const { stdout } = await execAsync(`docker-compose -f ${composePath} up -d`, { maxBuffer: 1024 * 1024 * 10 });
    return this.success(`Docker Compose started\n${stdout.trim()}`);
  }

  private async composeDown(composePath: string): Promise<ToolResult> {
    const { stdout } = await execAsync(`docker-compose -f ${composePath} down`, { maxBuffer: 1024 * 1024 * 10 });
    return this.success(`Docker Compose stopped\n${stdout.trim()}`);
  }
}
