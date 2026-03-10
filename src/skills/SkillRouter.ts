import { SkillLoader, SkillMetadata } from './SkillLoader';
import { ProviderFactory } from '../engine/ProviderFactory';

export class SkillRouter {
  private loader: SkillLoader;

  constructor() {
    this.loader = new SkillLoader();
  }

  /**
   * O "Passo Zero" para roteamento de Skills ativas usando chamada MOCK rápida
   * TODO: Implementar chamada real pra LLM barata pedindo retorno de string do nome da skill.
   */
  public async determineSkill(userIntent: string): Promise<SkillMetadata | null> {
    const allSkills = this.loader.loadAllSkills();
    
    if (allSkills.length === 0) return null;

    // TODO: Num cenário Real com api_key Gemini/DeepSeek:
    // Enviar prompt pro LLM: "Dado userIntent, e a lista [allSkills...], me retorne APENAS o JSON {skillName: 'x'}"
    
    // Fallback Dummy/Fake (retorna a primeira q der match de description com a string, por simplicidade)
    for (const s of allSkills) {
       if (userIntent.toLowerCase().includes(s.name.toLowerCase())) {
          return s;
       }
    }
    
    return null; // Volta pro Chatbot Genérico
  }

  public getAllSkills(): SkillMetadata[] {
      return this.loader.loadAllSkills();
  }
}
