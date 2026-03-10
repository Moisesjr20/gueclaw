import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { downloadTelegramFile, readTextFile, fileToBase64 } from './TelegramFileDownloader';

// Extensões de texto que o bot consegue ler diretamente
const TEXT_EXTENSIONS = new Set([
  'txt', 'log', 'json', 'yaml', 'yml', 'md', 'csv', 'xml',
  'py', 'ts', 'js', 'ts', 'tsx', 'jsx', 'java', 'go', 'rs',
  'cpp', 'c', 'h', 'php', 'rb', 'sh', 'bash', 'env', 'ini',
  'toml', 'sql', 'html', 'css', 'scss'
]);

/**
 * Processa uma imagem enviada pelo usuário via Telegram.
 * Usa Gemini Vision para descrever/analisar o conteúdo.
 */
export async function processImage(
  botToken: string,
  fileId: string,
  userCaption: string
): Promise<string> {
  const localPath = await downloadTelegramFile(botToken, fileId, 'jpg');

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const imageBase64 = fileToBase64(localPath);

    const prompt = userCaption
      ? `O usuário enviou esta imagem com a seguinte mensagem: "${userCaption}". Analise e responda.`
      : 'Descreva e analise detalhadamente o que você vê nesta imagem.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
        ]
      }]
    });

    return response.text || 'Não consegui analisar a imagem.';
  } finally {
    // Limpa arquivo temporário
    fs.unlink(localPath, () => {});
  }
}

/**
 * Processa um documento enviado pelo usuário.
 * Se for texto/código, lê diretamente. Se for binário, tenta via Gemini.
 */
export async function processDocument(
  botToken: string,
  fileId: string,
  fileName: string,
  userCaption: string
): Promise<string> {
  const ext = path.extname(fileName).replace('.', '').toLowerCase();
  const isText = TEXT_EXTENSIONS.has(ext);

  const localPath = await downloadTelegramFile(botToken, fileId, ext || 'bin');

  try {
    if (isText) {
      // Lê o conteúdo diretamente
      const content = readTextFile(localPath);
      const intro = userCaption
        ? `O usuário enviou o arquivo "${fileName}" com a mensagem: "${userCaption}"\n\nConteúdo do arquivo:\n\`\`\`${ext}\n${content}\n\`\`\``
        : `O usuário enviou o arquivo "${fileName}". Aqui está seu conteúdo:\n\`\`\`${ext}\n${content}\n\`\`\``;
      return intro;
    } else if (ext === 'pdf') {
      // PDF: tenta via Gemini como documento
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const fileData = fileToBase64(localPath);

      const prompt = userCaption
        ? `O usuário enviou o PDF "${fileName}" com a mensagem: "${userCaption}". Analise o conteúdo.`
        : `Analise e resuma o conteúdo deste PDF: "${fileName}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'application/pdf', data: fileData } }
          ]
        }]
      });
      return response.text || 'Não consegui processar o PDF.';
    } else {
      return `Recebi o arquivo "${fileName}" (.${ext}), mas este formato binário não é lido diretamente. Envie arquivos de texto, código, JSON, PDF ou imagens.`;
    }
  } finally {
    fs.unlink(localPath, () => {});
  }
}

/**
 * Processa uma mensagem de voz/áudio via Gemini Audio.
 */
export async function processVoice(
  botToken: string,
  fileId: string,
  mimeType: string = 'audio/ogg'
): Promise<string> {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'ogg';
  const localPath = await downloadTelegramFile(botToken, fileId, ext);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const audioBase64 = fileToBase64(localPath);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        parts: [
          { text: 'Transcreva exatamente o que foi dito neste áudio em português. Responda APENAS com a transcrição, sem comentários.' },
          { inlineData: { mimeType: mimeType as any, data: audioBase64 } }
        ]
      }]
    });

    const transcription = response.text?.trim() || '';
    if (!transcription) return '';

    return transcription;
  } finally {
    fs.unlink(localPath, () => {});
  }
}
