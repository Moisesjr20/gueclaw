import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

/**
 * Baixa um arquivo do Telegram e salva em tmp/.
 * Retorna o caminho local salvo.
 */
export async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  extension: string
): Promise<string> {
  // 1. Obter o file_path via getFile
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const fileInfo = await fetchJson(getFileUrl) as any;

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error(`Telegram getFile falhou: ${JSON.stringify(fileInfo)}`);
  }

  const filePath = fileInfo.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

  // 2. Garantir pasta tmp/
  const tmpDir = path.resolve('tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // 3. Salvar arquivo com nome único
  const localPath = path.join(tmpDir, `${fileId}.${extension}`);
  await downloadToFile(downloadUrl, localPath);

  return localPath;
}

/**
 * Lê um arquivo de texto e retorna o conteúdo (truncado a 50KB).
 */
export function readTextFile(filePath: string, maxBytes = 50000): string {
  const stats = fs.statSync(filePath);
  const buf = Buffer.alloc(Math.min(stats.size, maxBytes));
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);

  let content = buf.toString('utf-8');
  if (stats.size > maxBytes) {
    content += `\n\n[... arquivo truncado após ${maxBytes} bytes de ${stats.size} bytes totais]`;
  }
  return content;
}

/**
 * Lê um arquivo e converte para base64 (para envio via API Vision).
 */
export function fileToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString('base64');
}

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadToFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
