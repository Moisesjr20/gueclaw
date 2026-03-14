import * as fs from 'fs';
import * as path from 'path';
import { AudioTool } from '../../src/tools/audio-tool';

// Prevent real HTTP calls
jest.mock('axios');

const PROJECT_TMP = path.join(process.cwd(), 'tmp');

function createTmpFile(filename: string, content = 'fake-audio-data'): string {
  if (!fs.existsSync(PROJECT_TMP)) fs.mkdirSync(PROJECT_TMP, { recursive: true });
  const p = path.join(PROJECT_TMP, filename);
  fs.writeFileSync(p, content);
  return p;
}

function removeTmpFile(p: string): void {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

describe('AudioTool', () => {
  let tool: AudioTool;
  const savedWhisperKey = process.env.WHISPER_API_KEY;
  const savedOpenAIKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    tool = new AudioTool();
    delete process.env.AUDIO_TRANSCRIPTION_ENABLED;
  });

  afterAll(() => {
    // Restore env vars
    if (savedWhisperKey !== undefined) process.env.WHISPER_API_KEY = savedWhisperKey;
    else delete process.env.WHISPER_API_KEY;

    if (savedOpenAIKey !== undefined) process.env.OPENAI_API_KEY = savedOpenAIKey;
    else delete process.env.OPENAI_API_KEY;
  });

  describe('tool metadata', () => {
    it('has name "transcribe_audio"', () => {
      expect(tool.name).toBe('transcribe_audio');
    });

    it('definition requires audioPath parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('audioPath');
    });

    it('definition accepts optional language parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties).toHaveProperty('language');
    });
  });

  describe('AUDIO_TRANSCRIPTION_ENABLED guard', () => {
    it('returns error when AUDIO_TRANSCRIPTION_ENABLED=false', async () => {
      process.env.AUDIO_TRANSCRIPTION_ENABLED = 'false';
      const result = await tool.execute({ audioPath: '/any/file.ogg' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('AUDIO_TRANSCRIPTION_ENABLED=false');
    });
  });

  describe('file validation', () => {
    it('returns error when audio file does not exist', async () => {
      const result = await tool.execute({ audioPath: path.join(PROJECT_TMP, `missing-${Date.now()}.ogg`) });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Arquivo não encontrado');
    });

    it('returns error for unsupported extension (.avi)', async () => {
      const tmpFile = createTmpFile(`test-bad-${Date.now()}.avi`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Formato não suportado');
    });

    it('returns error for unsupported extension (.flac)', async () => {
      const tmpFile = createTmpFile(`test-bad-${Date.now()}.flac`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Formato não suportado');
    });

    it('accepts .ogg extension without format error', async () => {
      // Will fail at API key check before hitting the API — but NOT due to format
      delete process.env.WHISPER_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const tmpFile = createTmpFile(`valid-${Date.now()}.ogg`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.error).not.toMatch(/Formato não suportado|Arquivo não encontrado/);
    });

    it('accepts .mp3 extension without format error', async () => {
      delete process.env.WHISPER_API_KEY;
      delete process.env.OPENAI_API_KEY;
      const tmpFile = createTmpFile(`valid-${Date.now()}.mp3`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.error).not.toMatch(/Formato não suportado|Arquivo não encontrado/);
    });
  });

  describe('API key validation', () => {
    it('returns error when neither WHISPER_API_KEY nor OPENAI_API_KEY is set', async () => {
      delete process.env.WHISPER_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const tmpFile = createTmpFile(`keytest-${Date.now()}.ogg`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key');
    });

    it('proceeds past API key check when WHISPER_API_KEY is set', async () => {
      process.env.WHISPER_API_KEY = 'test-key-xyz';
      const tmpFile = createTmpFile(`keytest2-${Date.now()}.ogg`);
      const result = await tool.execute({ audioPath: tmpFile });
      removeTmpFile(tmpFile);

      // Should NOT fail with "API key" error (may fail at axios call instead)
      expect(result.error).not.toContain('Nenhuma API key');
    });
  });

  describe('path traversal prevention', () => {
    it('returns error when path resolves outside project directory', async () => {
      const outsidePath = path.resolve(process.cwd(), '..', '..', 'etc', 'audio.ogg');
      const result = await tool.execute({ audioPath: outsidePath });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
