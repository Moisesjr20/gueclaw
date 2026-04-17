import { BaseTool } from './base-tool';
import { spawn } from 'child_process';
import * as path from 'path';
import { ToolResult } from '../types';

/**
 * NotebookLM Tool - Integração com Google NotebookLM via notebooklm-py
 *
 * Permite:
 * - Fazer RAG completo com documentos
 * - Adicionar/remover fontes (PDF, texto, etc)
 * - Gerar podcasts/áudio de documentos
 * - Conversar com documentos via chat RAG
 */
export class NotebookLMTool extends BaseTool {
  public readonly name = 'NotebookLM';
  public readonly description = 'Integração com Google NotebookLM para RAG completo - adicione documentos, faça perguntas e gere podcasts';

  private wrapperPath: string;

  constructor() {
    super();

    // Caminho para o wrapper Python
    this.wrapperPath = path.resolve(__dirname, '../../scripts/notebooklm/notebooklm_wrapper.py');
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['login', 'list_sources', 'add_source', 'delete_source', 'generate_audio', 'chat'],
            description: 'Ação a ser executada no NotebookLM'
          },
          file_path: {
            type: 'string',
            description: 'Caminho do arquivo para adicionar como fonte (apenas para add_source)'
          },
          source_id: {
            type: 'string',
            description: 'ID da fonte (para delete_source, generate_audio, chat)'
          },
          title: {
            type: 'string',
            description: 'Título opcional da fonte (apenas para add_source)'
          },
          message: {
            type: 'string',
            description: 'Mensagem para chat RAG (apenas para chat)'
          }
        },
        required: ['action']
      }
    };
  }

  async validateInput(input: any): Promise<boolean> {
    if (!input.action) {
      throw new Error('action é obrigatório');
    }

    const validActions = ['login', 'list_sources', 'add_source', 'delete_source', 'generate_audio', 'chat'];
    if (!validActions.includes(input.action)) {
      throw new Error(`Ação inválida. Use uma das: ${validActions.join(', ')}`);
    }

    // Validações específicas por ação
    if (input.action === 'add_source' && !input.file_path) {
      throw new Error('file_path é obrigatório para add_source');
    }

    if (['delete_source', 'generate_audio', 'chat'].includes(input.action) && !input.source_id) {
      throw new Error('source_id é obrigatório para esta ação');
    }

    if (input.action === 'chat' && !input.message) {
      throw new Error('message é obrigatório para chat');
    }

    return true;
  }

  async execute(input: any): Promise<ToolResult> {
    try {
      await this.validateInput(input);

      const { action, file_path, source_id, title, message } = input;

      // Constrói argumentos para o wrapper Python
      const args: string[] = [action];

      if (file_path) args.push(file_path);
      if (source_id) args.push(source_id);
      if (title) args.push(title);
      if (message) args.push(message);

      const result = await this.runPythonWrapper(args);

      if (result.success) {
        return this.success(
          result.message || 'Operação concluída',
          result.data
        );
      } else {
        return this.error(
          result.error || 'Erro desconhecido',
          { raw_output: result }
        );
      }
    } catch (error) {
      return this.error(
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    }
  }

  /**
   * Executa o wrapper Python com os argumentos fornecidos
   */
  private async runPythonWrapper(args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      const fullArgs = [this.wrapperPath, ...args];

      console.log(`[NotebookLM] Executando: ${pythonCommand} ${fullArgs.join(' ')}`);

      const childProcess = spawn(pythonCommand, fullArgs, {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        console.log(`[NotebookLM] Processo finalizado com código: ${code}`);

        if (stderr && code !== 0) {
          console.error(`[NotebookLM] Stderr: ${stderr}`);
        }

        try {
          // Tenta parsear o resultado JSON
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (e) {
          // Se não for JSON válido, retorna como texto
          resolve({
            success: code === 0,
            output: stdout.trim(),
            error: stderr.trim() || null
          });
        }
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Falha ao executar Python: ${error.message}`));
      });
    });
  }

  /**
   * Verifica se o notebooklm-py está instalado
   */
  async checkInstallation(): Promise<{ installed: boolean; version?: string; error?: string }> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const { stdout } = await execAsync('pip show notebooklm-py');
      const versionMatch = stdout.match(/Version: ([\d.]+)/);
      return {
        installed: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      };
    } catch (error) {
      return {
        installed: false,
        error: 'notebooklm-py não instalado. Execute: pip install notebooklm-py'
      };
    }
  }
}
