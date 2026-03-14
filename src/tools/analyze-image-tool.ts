import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';

/**
 * AnalyzeImageTool — sends an image to the vision API and returns a description.
 *
 * Uses the same OpenAI-compatible endpoint as the main provider.
 * Requires the provider to support vision (GPT-4o / GitHub Copilot w/ gpt-4o).
 *
 * Environment:
 *   OPENAI_API_KEY or GITHUB_COPILOT_API_KEY  — used for auth
 *   OPENAI_BASE_URL                            — defaults to https://api.openai.com/v1
 *   VISION_MODEL                               — defaults to "gpt-4o"
 *   VISION_ENABLED                             — set to "false" to disable (default: true)
 */
export class AnalyzeImageTool extends BaseTool {
  public readonly name = 'analyze_image';
  public readonly description =
    'Analisa o conteúdo de uma imagem usando visão computacional e retorna uma descrição detalhada. ' +
    'Aceita o caminho local do arquivo de imagem (jpg, png, gif, webp) que foi enviado pelo usuário.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          imagePath: {
            type: 'string',
            description: 'Caminho absoluto ou relativo para o arquivo de imagem a ser analisado.',
          },
          prompt: {
            type: 'string',
            description: 'Pergunta ou instrução sobre a imagem (opcional). Ex: "O que tem na imagem?", "Leia o texto".',
          },
        },
        required: ['imagePath'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (process.env.VISION_ENABLED === 'false') {
      return this.error('Análise de imagens desabilitada (VISION_ENABLED=false).');
    }

    this.validate(args, ['imagePath']);

    const { imagePath, prompt = 'Descreva detalhadamente o conteúdo desta imagem em português.' } = args as {
      imagePath: string;
      prompt?: string;
    };

    // Prevent path traversal — restrict to CWD and /tmp
    const resolvedPath = path.resolve(imagePath);
    const cwd = process.cwd();
    const tmp = path.resolve('./tmp');
    if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith(tmp) && !resolvedPath.startsWith('/tmp')) {
      return this.error('Caminho de imagem não permitido. O arquivo deve estar dentro do projeto ou /tmp.');
    }

    if (!fs.existsSync(resolvedPath)) {
      return this.error(`Arquivo não encontrado: ${resolvedPath}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const supportedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!supportedExts.includes(ext)) {
      return this.error(`Formato não suportado: .${ext}. Use: ${supportedExts.join(', ')}`);
    }

    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    try {
      const imageData = fs.readFileSync(resolvedPath);
      const base64Image = imageData.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const apiKey = process.env.GITHUB_COPILOT_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return this.error('Nenhuma API key configurada para visão (GITHUB_COPILOT_API_KEY ou OPENAI_API_KEY).');
      }

      const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
      const model = process.env.VISION_MODEL || 'gpt-4o';

      const response = await axios.post(
        `${baseURL}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      );

      const content: string = response.data.choices?.[0]?.message?.content || '';
      if (!content) {
        return this.error('A API retornou resposta vazia.');
      }

      return this.success(content, { model, imagePath: resolvedPath });

    } catch (err: any) {
      const detail = err.response?.data?.error?.message || err.message;
      return this.error(`Falha na análise de imagem: ${detail}`);
    }
  }
}
