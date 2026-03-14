import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormData = require('form-data');
import axios from 'axios';
import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';

/**
 * AudioTool — transcribes audio files using OpenAI Whisper API.
 *
 * Environment:
 *   WHISPER_API_KEY             — API key (falls back to OPENAI_API_KEY)
 *   WHISPER_BASE_URL            — defaults to https://api.openai.com/v1
 *   WHISPER_MODEL               — defaults to "whisper-1"
 *   AUDIO_TRANSCRIPTION_ENABLED — set to "false" to disable (default: true)
 *   WHISPER_LANGUAGE            — ISO-639-1 language code hint (default: "pt")
 */
export class AudioTool extends BaseTool {
  public readonly name = 'transcribe_audio';
  public readonly description =
    'Transcreve um arquivo de áudio ou mensagem de voz para texto usando o Whisper. ' +
    'Aceita formatos: ogg, mp3, mp4, wav, m4a, webm. ' +
    'Retorna o texto transcrito em português.';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          audioPath: {
            type: 'string',
            description: 'Caminho absoluto ou relativo para o arquivo de áudio a ser transcrito.',
          },
          language: {
            type: 'string',
            description: 'Código de idioma ISO-639-1 (ex: "pt", "en"). Padrão: "pt".',
          },
        },
        required: ['audioPath'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    if (process.env.AUDIO_TRANSCRIPTION_ENABLED === 'false') {
      return this.error('Transcrição de áudio desabilitada (AUDIO_TRANSCRIPTION_ENABLED=false).');
    }

    this.validate(args, ['audioPath']);

    const { audioPath, language = process.env.WHISPER_LANGUAGE || 'pt' } = args as {
      audioPath: string;
      language?: string;
    };

    // Restrict paths to CWD and /tmp
    const resolvedPath = path.resolve(audioPath);
    const cwd = process.cwd();
    const tmp = path.resolve('./tmp');
    if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith(tmp) && !resolvedPath.startsWith('/tmp')) {
      return this.error('Caminho de áudio não permitido. O arquivo deve estar dentro do projeto ou /tmp.');
    }

    if (!fs.existsSync(resolvedPath)) {
      return this.error(`Arquivo não encontrado: ${resolvedPath}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const supportedExts = ['ogg', 'mp3', 'mp4', 'wav', 'm4a', 'webm', 'oga'];
    if (!supportedExts.includes(ext)) {
      return this.error(`Formato não suportado: .${ext}. Use: ${supportedExts.join(', ')}`);
    }

    const apiKey = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return this.error('Nenhuma API key configurada para Whisper (WHISPER_API_KEY ou OPENAI_API_KEY).');
    }

    try {
      const baseURL = process.env.WHISPER_BASE_URL || 'https://api.openai.com/v1';
      const model = process.env.WHISPER_MODEL || 'whisper-1';

      const form = new FormData();
      form.append('file', fs.createReadStream(resolvedPath), path.basename(resolvedPath));
      form.append('model', model);
      form.append('language', language);
      form.append('response_format', 'text');

      const response = await axios.post(`${baseURL}/audio/transcriptions`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 120000, // 2 min for long files
      });

      const transcription = typeof response.data === 'string'
        ? response.data.trim()
        : response.data?.text?.trim() || '';

      if (!transcription) {
        return this.error('Whisper retornou transcrição vazia.');
      }

      return this.success(transcription, { model, language, audioPath: resolvedPath });

    } catch (err: any) {
      const detail = err.response?.data?.error?.message || err.message;
      return this.error(`Falha na transcrição: ${detail}`);
    }
  }

  /**
   * Static helper — transcribe a file directly without going through tool infrastructure.
   * Used by TelegramInputHandler for auto-transcription.
   */
  public static async transcribeFile(filePath: string): Promise<string | null> {
    const tool = new AudioTool();
    const result = await tool.execute({ audioPath: filePath });
    return result.success ? result.output : null;
  }
}
