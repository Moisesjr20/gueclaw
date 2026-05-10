import {
  getSpecialistModels,
  modelForCategory,
  TRIAGE_SYSTEM_PROMPT,
  SpecialistModels,
} from '../../../src/services/llm-router/router-config';
import { RouterCategory } from '../../../src/types/routing-types';

const ALL_CATEGORIES: RouterCategory[] = [
  'reasoning', 'agentic', 'text', 'fast', 'longoutput', 'code', 'fallback',
];

describe('router-config', () => {
  describe('getSpecialistModels()', () => {
    it('returns an object with all 7 categories', () => {
      const models = getSpecialistModels();
      for (const cat of ALL_CATEGORIES) {
        expect(models).toHaveProperty(cat);
      }
    });

    it('all model IDs are non-empty strings', () => {
      const models = getSpecialistModels();
      for (const [key, value] of Object.entries(models)) {
        expect(typeof value).toBe('string');
        expect((value as string).length).toBeGreaterThan(0);
      }
    });

    it('default reasoning model contains deepseek', () => {
      delete process.env.ROUTER_MODEL_REASONING;
      const models = getSpecialistModels();
      expect(models.reasoning.toLowerCase()).toContain('deepseek');
    });

    it('respects ROUTER_MODEL_FAST env override', () => {
      process.env.ROUTER_MODEL_FAST = 'test/custom-fast-model';
      const models = getSpecialistModels();
      expect(models.fast).toBe('test/custom-fast-model');
      delete process.env.ROUTER_MODEL_FAST;
    });

    it('respects ROUTER_MODEL_CODE env override', () => {
      process.env.ROUTER_MODEL_CODE = 'test/custom-code-model';
      const models = getSpecialistModels();
      expect(models.code).toBe('test/custom-code-model');
      delete process.env.ROUTER_MODEL_CODE;
    });

    it('respects ROUTER_MODEL_FALLBACK env override', () => {
      process.env.ROUTER_MODEL_FALLBACK = 'test/fallback-model';
      const models = getSpecialistModels();
      expect(models.fallback).toBe('test/fallback-model');
      delete process.env.ROUTER_MODEL_FALLBACK;
    });

    it('returns consistent results on multiple calls', () => {
      const a = getSpecialistModels();
      const b = getSpecialistModels();
      expect(a).toEqual(b);
    });
  });

  describe('modelForCategory()', () => {
    let models: SpecialistModels;
    beforeEach(() => { models = getSpecialistModels(); });

    it('returns the correct model for each valid category', () => {
      for (const cat of ALL_CATEGORIES) {
        const model = modelForCategory(cat, models);
        expect(model).toBe(models[cat]);
      }
    });

    it('returns fallback model for unknown category', () => {
      const model = modelForCategory('unknown_category' as RouterCategory, models);
      expect(model).toBe(models.fallback);
    });

    it('returns non-empty string for every category', () => {
      for (const cat of ALL_CATEGORIES) {
        expect(modelForCategory(cat, models).length).toBeGreaterThan(0);
      }
    });
  });

  describe('TRIAGE_SYSTEM_PROMPT', () => {
    it('is defined', () => {
      expect(TRIAGE_SYSTEM_PROMPT).toBeDefined();
    });

    it('is a non-empty string', () => {
      expect(typeof TRIAGE_SYSTEM_PROMPT).toBe('string');
      expect(TRIAGE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('mentions all 7 category names', () => {
      for (const cat of ALL_CATEGORIES) {
        expect(TRIAGE_SYSTEM_PROMPT).toContain(cat);
      }
    });

    it('instructs JSON output format', () => {
      expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain('json');
    });

    it('mentions confidence field', () => {
      expect(TRIAGE_SYSTEM_PROMPT.toLowerCase()).toContain('confidence');
    });
  });
});
