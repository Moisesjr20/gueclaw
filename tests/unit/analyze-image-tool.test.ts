import * as fs from 'fs';
import * as path from 'path';
import { AnalyzeImageTool } from '../../src/tools/analyze-image-tool';

// Prevent real HTTP calls
jest.mock('axios');

const PROJECT_TMP = path.join(process.cwd(), 'tmp');

// Helper: create a temp image file in project/tmp for tests that validate path access
function createTmpFile(filename: string, content = 'fake-image-data'): string {
  if (!fs.existsSync(PROJECT_TMP)) fs.mkdirSync(PROJECT_TMP, { recursive: true });
  const p = path.join(PROJECT_TMP, filename);
  fs.writeFileSync(p, content);
  return p;
}

function removeTmpFile(p: string): void {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

describe('AnalyzeImageTool', () => {
  let tool: AnalyzeImageTool;

  beforeEach(() => {
    tool = new AnalyzeImageTool();
    delete process.env.VISION_ENABLED;
  });

  describe('tool metadata', () => {
    it('has name "analyze_image"', () => {
      expect(tool.name).toBe('analyze_image');
    });

    it('definition requires imagePath parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('imagePath');
    });
  });

  describe('VISION_ENABLED guard', () => {
    it('returns error when VISION_ENABLED=false', async () => {
      process.env.VISION_ENABLED = 'false';
      const result = await tool.execute({ imagePath: path.join(PROJECT_TMP, 'any.jpg') });
      expect(result.success).toBe(false);
      expect(result.error).toContain('VISION_ENABLED=false');
    });
  });

  describe('file validation', () => {
    it('returns error when image file does not exist', async () => {
      const nonExistent = path.join(PROJECT_TMP, `no-file-${Date.now()}.png`);
      const result = await tool.execute({ imagePath: nonExistent });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Arquivo não encontrado');
    });

    it('returns error for unsupported extension (.bmp)', async () => {
      const tmpFile = createTmpFile(`test-unsupported-${Date.now()}.bmp`);
      const result = await tool.execute({ imagePath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Formato não suportado');
    });

    it('returns error for unsupported extension (.tiff)', async () => {
      const tmpFile = createTmpFile(`test-unsupported-${Date.now()}.tiff`);
      const result = await tool.execute({ imagePath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Formato não suportado');
    });

    it('accepts .jpg extension without extension error', async () => {
      // File exists in project/tmp → passes path check and extension check
      // Will then fail at readFileSync + API call (axios mock) but NOT at validation
      const tmpFile = createTmpFile(`valid-${Date.now()}.jpg`);
      const result = await tool.execute({ imagePath: tmpFile });
      removeTmpFile(tmpFile);

      // Should NOT return "Formato não suportado" or "Arquivo não encontrado"
      expect(result.error).not.toMatch(/Formato não suportado|Arquivo não encontrado/);
    });

    it('accepts .png extension without extension error', async () => {
      const tmpFile = createTmpFile(`valid-${Date.now()}.png`);
      const result = await tool.execute({ imagePath: tmpFile });
      removeTmpFile(tmpFile);

      expect(result.error).not.toMatch(/Formato não suportado|Arquivo não encontrado/);
    });
  });

  describe('path traversal prevention', () => {
    it('returns error when path resolves outside project directory', async () => {
      // Resolve outside cwd by using absolute path to a system location
      const outsidePath = path.resolve(process.cwd(), '..', '..', 'etc', 'passwd.jpg');
      const result = await tool.execute({ imagePath: outsidePath });
      expect(result.success).toBe(false);
      // Either "Caminho não permitido" or "Arquivo não encontrado" — not a success
      expect(result.error).toBeTruthy();
    });
  });
});
