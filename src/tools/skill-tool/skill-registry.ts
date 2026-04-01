/**
 * Skill Registry
 * 
 * Centralized registry for all GueClaw skills
 * Provides discovery, validation, and metadata management
 */

import { SkillLoader } from '../../core/skills/skill-loader';
import type { SkillDefinition, SkillMetadata } from './skill-definition';
import * as fs from 'fs';
import * as path from 'path';

export class SkillRegistry {
  private static skills: Map<string, SkillDefinition> = new Map();
  private static initialized = false;

  /**
   * Initialize registry by scanning skills directory
   */
  public static initialize(): void {
    if (this.initialized) return;

    console.log('🔍 Initializing SkillRegistry...');

    const skillsDir = path.join(process.cwd(), '.agents', 'skills');
    
    if (!fs.existsSync(skillsDir)) {
      console.warn('⚠️ Skills directory not found:', skillsDir);
      return;
    }

    const skillFolders = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const skillName of skillFolders) {
      try {
        const skillContent = SkillLoader.loadSkillContent(skillName);
        const skillMetadata = SkillLoader.getMetadata(skillName);
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md');

        if (skillContent && skillMetadata) {
          this.skills.set(skillName, {
            name: skillName,
            metadata: skillMetadata as SkillMetadata,
            content: skillContent,
            filePath: skillPath,
          });
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load skill "${skillName}":`, error);
      }
    }

    console.log(`✅ SkillRegistry initialized with ${this.skills.size} skills`);
    this.initialized = true;
  }

  /**
   * Get a skill by name
   */
  public static get(name: string): SkillDefinition | undefined {
    if (!this.initialized) this.initialize();
    return this.skills.get(name);
  }

  /**
   * Check if a skill exists
   */
  public static has(name: string): boolean {
    if (!this.initialized) this.initialize();
    return this.skills.has(name);
  }

  /**
   * Get all skill names
   */
  public static getAllNames(): string[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.skills.keys());
  }

  /**
   * Get all skills
   */
  public static getAll(): SkillDefinition[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   */
  public static getByCategory(category: string): SkillDefinition[] {
    if (!this.initialized) this.initialize();
    return Array.from(this.skills.values()).filter(
      skill => skill.metadata.category === category
    );
  }

  /**
   * Register a skill manually (for dynamic skills)
   */
  public static register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
    console.log(`✅ Registered skill: ${skill.name}`);
  }

  /**
   * Unregister a skill
   */
  public static unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * Clear all skills (useful for testing)
   */
  public static clear(): void {
    this.skills.clear();
    this.initialized = false;
  }

  /**
   * Get skill metadata only
   */
  public static getMetadata(name: string): SkillMetadata | undefined {
    const skill = this.get(name);
    return skill?.metadata;
  }

  /**
   * Search skills by keyword (name or description)
   */
  public static search(keyword: string): SkillDefinition[] {
    if (!this.initialized) this.initialize();
    const lowerKeyword = keyword.toLowerCase();
    return Array.from(this.skills.values()).filter(skill =>
      skill.name.toLowerCase().includes(lowerKeyword) ||
      skill.metadata.description?.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get summary for logging/debugging
   */
  public static getSummary(): string {
    if (!this.initialized) this.initialize();
    const categories = new Map<string, number>();
    
    for (const skill of this.skills.values()) {
      const category = skill.metadata.category || 'uncategorized';
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    const lines = [
      `📊 SkillRegistry Summary:`,
      `   Total skills: ${this.skills.size}`,
      `   Categories:`,
    ];

    for (const [category, count] of categories.entries()) {
      lines.push(`     - ${category}: ${count}`);
    }

    return lines.join('\n');
  }
}
