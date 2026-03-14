import { ReadSkillTool } from '../../src/tools/read-skill-tool';
import { SkillLoader } from '../../src/core/skills/skill-loader';

jest.mock('../../src/core/skills/skill-loader', () => ({
  SkillLoader: {
    skillExists: jest.fn(),
    loadSkillContent: jest.fn(),
  },
}));

const mockSkillExists = SkillLoader.skillExists as jest.Mock;
const mockLoadSkillContent = SkillLoader.loadSkillContent as jest.Mock;

describe('ReadSkillTool', () => {
  let tool: ReadSkillTool;

  beforeEach(() => {
    tool = new ReadSkillTool();
    mockSkillExists.mockReset();
    mockLoadSkillContent.mockReset();
  });

  describe('tool metadata', () => {
    it('has name "read_skill"', () => {
      expect(tool.name).toBe('read_skill');
    });

    it('definition requires skillName parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('skillName');
    });
  });

  describe('path traversal prevention', () => {
    it('returns error when skillName contains ".."', async () => {
      const result = await tool.execute({ skillName: '../etc' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('inválido');
    });

    it('returns error when skillName contains forward slash', async () => {
      const result = await tool.execute({ skillName: 'some/path' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('inválido');
    });

    it('returns error when skillName contains backslash', async () => {
      const result = await tool.execute({ skillName: 'some\\path' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('inválido');
    });
  });

  describe('execute — skill not found', () => {
    it('returns error when skill does not exist', async () => {
      mockSkillExists.mockReturnValue(false);
      const result = await tool.execute({ skillName: 'nonexistent-skill' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('não encontrada');
    });
  });

  describe('execute — skill content load failure', () => {
    it('returns error when loadSkillContent returns null', async () => {
      mockSkillExists.mockReturnValue(true);
      mockLoadSkillContent.mockReturnValue(null);

      const result = await tool.execute({ skillName: 'broken-skill' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Falha ao ler');
    });
  });

  describe('execute — success', () => {
    it('returns skill content when skill exists and loads successfully', async () => {
      const content = '# VPS Manager\nGuia completo de administração VPS...';
      mockSkillExists.mockReturnValue(true);
      mockLoadSkillContent.mockReturnValue(content);

      const result = await tool.execute({ skillName: 'vps-manager' });
      expect(result.success).toBe(true);
      expect(result.output).toBe(content);
      expect(result.metadata?.skillName).toBe('vps-manager');
    });

    it('calls loadSkillContent with the correct skill name', async () => {
      mockSkillExists.mockReturnValue(true);
      mockLoadSkillContent.mockReturnValue('content');

      await tool.execute({ skillName: 'uazapi-whatsapp' });
      expect(mockLoadSkillContent).toHaveBeenCalledWith('uazapi-whatsapp');
    });
  });

  describe('execute — validation', () => {
    it('throws when skillName is missing', async () => {
      await expect(tool.execute({})).rejects.toThrow('Missing required argument: skillName');
    });
  });
});
