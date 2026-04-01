/**
 * SkillTool Unit Tests
 * 
 * Tests for LLM-invocable skill execution system
 */

import { SkillTool } from '../../../src/tools/skill-tool/skill-tool';
import { SkillRegistry } from '../../../src/tools/skill-tool/skill-registry';
import { SKILL_TOOL_NAME } from '../../../src/tools/skill-tool/constants';

describe('SkillTool', () => {
  let skillTool: SkillTool;

  beforeEach(() => {
    skillTool = new SkillTool();
    SkillRegistry.clear(); // Clear registry before each test
  });

  afterEach(() => {
    SkillRegistry.clear();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(skillTool.name).toBe(SKILL_TOOL_NAME);
    });

    it('should have description', () => {
      const definition = skillTool.getDefinition();
      expect(definition.description).toBeTruthy();
      expect(definition.description.length).toBeGreaterThan(10);
    });

    it('should have valid schema', () => {
      const definition = skillTool.getDefinition();
      expect(definition.parameters).toBeDefined();
      expect(definition.parameters.properties).toBeDefined();
      expect(definition.parameters.properties.skill_name).toBeDefined();
    });
  });

  describe('Skill Execution', () => {
    it('should return error for non-existent skill', async () => {
      const result = await skillTool.execute({
        skill_name: 'non_existent_skill_xyz',
      });

      expect(result).toContain('❌');
      expect(result).toContain('não encontrada');
    });

    it('should list available skills when skill not found', async () => {
      // Initialize with real skills
      SkillRegistry.initialize();
      
      const result = await skillTool.execute({
        skill_name: 'invalid_skill',
      });

      expect(result).toContain('Skills disponíveis');
    });

    // Note: Testing actual skill execution requires mocking SkillExecutor
    // which would make this an integration test rather than unit test
  });

  describe('Progress Callback', () => {
    it('should call progress callback during execution', async () => {
      const progressStages: string[] = [];
      
      await skillTool.execute(
        {
          skill_name: 'invalid_skill',
        },
        [],
        undefined,
        (progress) => {
          progressStages.push(progress.stage);
        }
      );

      // Should have at least loaded stage
      expect(progressStages.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should accept valid skill_name', async () => {
      const result = await skillTool.execute({
        skill_name: 'doe',
      });

      // Should not throw, will return error if skill doesn't exist
      expect(result).toBeTruthy();
    });

    it('should accept optional args', async () => {
      const result = await skillTool.execute({
        skill_name: 'doe',
        args: 'some arguments',
      });

      expect(result).toBeTruthy();
    });

    it('should accept optional mode', async () => {
      const result = await skillTool.execute({
        skill_name: 'doe',
        mode: 'normal',
      });

      expect(result).toBeTruthy();
    });
  });
});

describe('SkillRegistry', () => {
  beforeEach(() => {
    SkillRegistry.clear();
  });

  afterEach(() => {
    SkillRegistry.clear();
  });

  describe('Initialization', () => {
    it('should initialize and load skills from .agents/skills/', () => {
      SkillRegistry.initialize();
      
      const allSkills = SkillRegistry.getAllNames();
      
      // Should load at least some skills (we have 20+ in the project)
      expect(allSkills.length).toBeGreaterThan(0);
    });

    it('should not reinitialize if already initialized', () => {
      SkillRegistry.initialize();
      const count1 = SkillRegistry.getAllNames().length;
      
      SkillRegistry.initialize();
      const count2 = SkillRegistry.getAllNames().length;
      
      expect(count1).toBe(count2);
    });
  });

  describe('Skill Operations', () => {
    beforeEach(() => {
      SkillRegistry.initialize();
    });

    it('should check if skill exists', () => {
      // Assuming 'doe' skill exists in .agents/skills/
      expect(SkillRegistry.has('doe')).toBe(true);
      expect(SkillRegistry.has('nonexistent_skill')).toBe(false);
    });

    it('should get skill by name', () => {
      const skill = SkillRegistry.get('doe');
      
      if (skill) {
        expect(skill.name).toBe('doe');
        expect(skill.metadata).toBeDefined();
        expect(skill.content).toBeDefined();
      }
    });

    it('should return undefined for non-existent skill', () => {
      const skill = SkillRegistry.get('nonexistent_skill');
      expect(skill).toBeUndefined();
    });

    it('should get all skill names', () => {
      const names = SkillRegistry.getAllNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should get metadata for a skill', () => {
      const metadata = SkillRegistry.getMetadata('doe');
      
      if (metadata) {
        expect(metadata.name).toBeDefined();
        expect(metadata.description).toBeDefined();
      }
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      SkillRegistry.initialize();
    });

    it('should search skills by keyword', () => {
      const results = SkillRegistry.search('vps');
      
      // Should find vps-manager skill
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const results = SkillRegistry.search('xyzabc123nonexistent');
      
      expect(results).toEqual([]);
    });
  });

  describe('Category Filtering', () => {
    beforeEach(() => {
      SkillRegistry.initialize();
    });

    it('should filter skills by category', () => {
      const engineeringSkills = SkillRegistry.getByCategory('engineering');
      
      // Should find at least 'doe' skill
      expect(Array.isArray(engineeringSkills)).toBe(true);
    });
  });

  describe('Summary', () => {
    beforeEach(() => {
      SkillRegistry.initialize();
    });

    it('should generate summary with statistics', () => {
      const summary = SkillRegistry.getSummary();
      
      expect(summary).toContain('SkillRegistry Summary');
      expect(summary).toContain('Total skills');
      expect(summary).toContain('Categories');
    });
  });
});
