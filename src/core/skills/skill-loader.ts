import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SkillMetadata } from '../../types';

/**
 * Skill Loader - Loads skills from .agents/skills directory
 */
export class SkillLoader {
  private static readonly SKILLS_DIR = path.join(process.cwd(), '.agents', 'skills');

  /**
   * Load all available skills with their metadata
   */
  public static loadAll(): SkillMetadata[] {
    const skills: SkillMetadata[] = [];

    // Ensure skills directory exists
    if (!fs.existsSync(this.SKILLS_DIR)) {
      fs.mkdirSync(this.SKILLS_DIR, { recursive: true });
      console.log(`📁 Created skills directory: ${this.SKILLS_DIR}`);
      return skills;
    }

    // Read all subdirectories
    const entries = fs.readdirSync(this.SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(this.SKILLS_DIR, entry.name);
        const skillFile = path.join(skillPath, 'SKILL.md');

        if (fs.existsSync(skillFile)) {
          try {
            const metadata = this.parseSkillFile(skillFile);
            if (metadata) {
              skills.push(metadata);
              console.log(`✅ Loaded skill: ${metadata.name}`);
            }
          } catch (error: any) {
            console.warn(`⚠️  Failed to load skill from ${entry.name}: ${error.message}`);
          }
        }
      }
    }

    console.log(`📚 Loaded ${skills.length} skills total`);
    return skills;
  }

  /**
   * Load a specific skill's full content
   */
  public static loadSkillContent(skillName: string): string | null {
    const skillPath = path.join(this.SKILLS_DIR, skillName, 'SKILL.md');

    if (!fs.existsSync(skillPath)) {
      console.warn(`⚠️  Skill file not found: ${skillPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      
      // Remove frontmatter, keeping only the main content
      const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
      
      return withoutFrontmatter.trim();
    } catch (error: any) {
      console.error(`❌ Failed to read skill content: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from skill file
   */
  private static parseSkillFile(filePath: string): SkillMetadata | null {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      console.warn(`⚠️  No frontmatter found in ${filePath}`);
      return null;
    }

    try {
      const frontmatter = yaml.load(frontmatterMatch[1]) as any;

      // Validate required fields
      if (!frontmatter.name || !frontmatter.description) {
        console.warn(`⚠️  Missing required fields (name, description) in ${filePath}`);
        return null;
      }

      return {
        name: frontmatter.name,
        description: frontmatter.description,
        version: frontmatter.version,
        author: frontmatter.author,
        category: frontmatter.category,
        tools: frontmatter.tools || [],
      };

    } catch (error: any) {
      console.error(`❌ Failed to parse YAML frontmatter: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a skill exists
   */
  public static skillExists(skillName: string): boolean {
    const skillPath = path.join(this.SKILLS_DIR, skillName, 'SKILL.md');
    return fs.existsSync(skillPath);
  }

  /**
   * Get skills directory path
   */
  public static getSkillsDirectory(): string {
    return this.SKILLS_DIR;
  }
}
