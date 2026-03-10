import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface SkillMetadata {
  name: string;
  description: string;
  directory: string; // ex: ".agents/skills/my-skill"
  content: string; // O conteudo puro gerado abaixo do frontmatter
}

export class SkillLoader {
  private skillsPath: string;

  constructor() {
    this.skillsPath = path.resolve(process.cwd(), '.agents', 'skills');
  }

  /**
   * Lê todas as pastas e extrai os Skills via Frontmatter
   */
  public loadAllSkills(): SkillMetadata[] {
    const loadedSkills: SkillMetadata[] = [];
    
    if (!fs.existsSync(this.skillsPath)) {
      console.warn('[SkillLoader] Pasta de skills não encontrada.');
      return loadedSkills; 
    }

    const directories = fs.readdirSync(this.skillsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    for (const dir of directories) {
       const skillFilePath = path.join(this.skillsPath, dir, 'SKILL.md');
       
       if (!fs.existsSync(skillFilePath)) {
          // EC-02 Pula silenciosamente pastar fantasmas (Não tem SKILL.md)
          continue; 
       }

       try {
           const rawFile = fs.readFileSync(skillFilePath, 'utf8');
           const parseResult = this.parseFrontmatter(rawFile);
           
           if (!parseResult) continue; // EC-03 falha no yaml

           loadedSkills.push({
               name: parseResult.metadata.name,
               description: parseResult.metadata.description,
               directory: dir,
               content: parseResult.content
           });
       } catch (err) {
           console.error(`[SkillLoader] Falha fatal ao ler ${dir}:`, err);
       }
    }

    return loadedSkills;
  }

  /**
   * Parsa YAML entre tags "---"
   */
  private parseFrontmatter(fileContent: string): { metadata: any, content: string } | null {
      const regex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = fileContent.match(regex);
      
      if (!match) return null;

      try {
         const yamlContent = yaml.load(match[1]) as any;
         
         if (!yamlContent.name) return null; // Invalido sem nome
         
         return {
            metadata: yamlContent,
            content: match[2].trim()
         };
      } catch (e) {
         return null;
      }
  }
}
