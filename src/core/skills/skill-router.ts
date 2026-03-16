import { ILLMProvider } from '../providers/base-provider';
import { ProviderFactory } from '../providers/provider-factory';
import { SkillMetadata } from '../../types';
import { Message } from '../../types';

/**
 * Skill Router - Determines which skill to use based on user intent
 */
export class SkillRouter {
  private provider: ILLMProvider;

  constructor() {
    // Use fast provider for routing (cheap and quick)
    this.provider = ProviderFactory.getFastProvider();
  }

  /**
   * Route user input to the most appropriate skill
   * Returns the skill name or null if no specific skill is needed
   */
  public async route(
    userInput: string,
    availableSkills: SkillMetadata[]
  ): Promise<string | null> {
    try {
      // If no skills available, return null
      if (availableSkills.length === 0) {
        return null;
      }

      // Build routing prompt
      const systemPrompt = this.buildRoutingPrompt(availableSkills);

      const messages: Message[] = [
        {
          conversationId: 'routing',
          role: 'user',
          content: userInput,
        },
      ];

      console.log('🧭 Routing user request to appropriate skill...');

      // Get LLM decision
      const response = await this.provider.generateCompletion(messages, {
        systemPrompt,
        temperature: 0.1, // Low temperature for consistent routing
        maxTokens: 100,
      });

      // Reject error responses immediately — don't parse error text as a skill name
      if (response.finishReason === 'error') {
        console.warn('⚠️  Skill routing failed (provider error) — falling back to general chat');
        return null;
      }

      // Parse response, validating against known skill names
      const skillName = this.parseRoutingResponse(response.content, availableSkills);

      if (skillName) {
        console.log(`✅ Routed to skill: ${skillName}`);
      } else {
        console.log('ℹ️  No specific skill needed (general chat)');
      }

      return skillName;

    } catch (error: any) {
      console.error('❌ Skill routing error:', error.message);
      // On error, return null to fallback to general chat
      return null;
    }
  }

  /**
   * Build the routing prompt with skill descriptions
   */
  private buildRoutingPrompt(skills: SkillMetadata[]): string {
    const skillsList = skills
      .map(skill => `- **${skill.name}**: ${skill.description}`)
      .join('\n');

    return `You are a skill router. Your job is to determine which skill (if any) should handle the user's request.

Available skills:
${skillsList}

**Instructions:**
1. Analyze the user's request carefully
2. If the request clearly matches one of the available skills, respond with ONLY the skill name (e.g., "vps-manager")
3. If no skill is a good match, respond with "null"
4. Do NOT add explanations or extra text
5. Be precise: only route to a skill if there's a clear match

Examples:
- User: "Create a new skill for managing databases" → "skill-creator"
- User: "Check Docker containers status" → "vps-manager"
- User: "What's the weather like?" → "null"
- User: "Tell me a joke" → "null"

Respond with the skill name or "null":`;
  }

  /**
   * Parse the LLM response to extract skill name.
   * Validates the candidate against the list of available skills to prevent
   * accidental matches on error messages (e.g. "erro", "i").
   */
  private parseRoutingResponse(response: string, availableSkills: SkillMetadata[]): string | null {
    const cleaned = response.trim().toLowerCase();

    // Check for explicit null
    if (cleaned === 'null' || cleaned === 'none' || cleaned === '') {
      return null;
    }

    // Try to extract skill name (remove quotes, backticks, etc.)
    const match = cleaned.match(/[\w-]+/);

    if (match) {
      const candidate = match[0];
      // Only accept if it exactly matches a known skill directory name
      if (availableSkills.some(s => s.name === candidate)) {
        return candidate;
      }
      console.warn(`⚠️  Routing response "${candidate}" is not a known skill — ignoring`);
    }

    return null;
  }

  /**
   * Force route to a specific skill (bypass LLM)
   */
  public forceRoute(skillName: string): string {
    console.log(`🎯 Force routing to skill: ${skillName}`);
    return skillName;
  }
}
