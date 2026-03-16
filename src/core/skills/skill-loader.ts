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
      
      // Normalize line endings, then remove frontmatter
      const normalized = content.replace(/\r\n/g, '\n');
      const withoutFrontmatter = normalized.replace(/^---\n[\s\S]*?\n---\n/, '');
      
      return withoutFrontmatter.trim();
    } catch (error: any) {
      console.error(`❌ Failed to read skill content: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from skill file
   */
  public static parseSkillFile(filePath: string): SkillMetadata | null {
    const content = fs.readFileSync(filePath, 'utf8');

    // Normalize line endings (handle Windows CRLF)
    const normalized = content.replace(/\r\n/g, '\n');

    // Extract YAML frontmatter
    const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---/);

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
        blocked_tools: frontmatter.blocked_tools || [],
      };

    } catch (error: any) {
      console.error(`❌ Failed to parse YAML frontmatter: ${error.message}`);
      return null;
    }
  }

  /**
   * Get metadata for a specific skill by name
   */
  public static getMetadata(skillName: string): SkillMetadata | null {
    const skillPath = path.join(this.SKILLS_DIR, skillName, 'SKILL.md');
    if (!fs.existsSync(skillPath)) return null;
    try {
      return this.parseSkillFile(skillPath);
    } catch {
      return null;
    }
  }

  /**
   * Load lightweight manifest for all skills — used for system prompt injection.
   * Returns name, description, and dirName (the directory name used with read_skill tool).
   */
  public static loadManifest(): Array<{ name: string; description: string; dirName: string }> {
    const manifest: Array<{ name: string; description: string; dirName: string }> = [];

    if (!fs.existsSync(this.SKILLS_DIR)) return manifest;

    const entries = fs.readdirSync(this.SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(this.SKILLS_DIR, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;
      try {
        const meta = this.parseSkillFile(skillFile);
        if (meta) {
          manifest.push({ name: meta.name, description: meta.description, dirName: entry.name });
        }
      } catch {
        // silently skip broken skills
      }
    }

    return manifest;
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
