import { SkillLoader } from './skill-loader';
import { AgentLoop } from '../agent-loop/agent-loop';
import { ToolRegistry } from '../../tools/tool-registry';
import { ILLMProvider } from '../providers/base-provider';
import { ProviderFactory } from '../providers/provider-factory';

/**
 * Skill Executor - Executes a skill with the Agent Loop
 */
export class SkillExecutor {
  /**
   * Execute a skill with the given user input
   */
  public static async execute(
    skillName: string,
    userInput: string,
    conversationHistory: any[],
    useReasoning: boolean = false
  ): Promise<string> {
    try {
      console.log(`🎯 Executing skill: ${skillName}`);

      // Load skill content
      const skillContent = SkillLoader.loadSkillContent(skillName);

      if (!skillContent) {
        return `Error: Skill "${skillName}" not found or could not be loaded.`;
      }

      // Determine which provider to use
      const provider: ILLMProvider = useReasoning
        ? ProviderFactory.getReasoningProvider()
        : ProviderFactory.getFastProvider();

      console.log(`🧠 Using provider: ${provider.name} (reasoning: ${useReasoning})`);

      // Get available tools for this skill
      const availableTools = ToolRegistry.getAllDefinitions();

      // Build enhanced system prompt with skill content
      const systemPrompt = `${skillContent}

Available Tools:
You have access to the following tools:
${availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Instructions:
- Follow the guidelines and specifications in the skill documentation above
- Use the available tools when necessary to accomplish the task
- Think step by step
- Respond in PLAIN TEXT, conversationally. Do NOT use Markdown formatting (no **, no ##, no __, no \`\`\`)
- Use emojis and line breaks naturally but avoid all Markdown syntax
- Be direct and concise in your answers
`;

      // Initialize Agent Loop
      const agentLoop = new AgentLoop(provider, conversationHistory, systemPrompt);

      // Execute the loop
      const result = await agentLoop.run(userInput);

      console.log(`✅ Skill execution completed: ${skillName}`);

      return result;

    } catch (error: any) {
      console.error(`❌ Skill execution error:`, error.message);
      return `Error executing skill "${skillName}": ${error.message}`;
    }
  }

  /**
   * Execute with automatic reasoning detection
   * Uses reasoning provider for programming/complex tasks
   */
  public static async executeAuto(
    skillName: string,
    userInput: string,
    conversationHistory: any[]
  ): Promise<string> {
    // Keywords that indicate need for deep reasoning
    const reasoningKeywords = [
      'code', 'program', 'develop', 'implement', 'algorithm',
      'debug', 'refactor', 'optimize', 'architecture', 'design',
      'complex', 'analyze', 'solve', 'calculate', 'plan'
    ];

    const needsReasoning = reasoningKeywords.some(keyword =>
      userInput.toLowerCase().includes(keyword) ||
      skillName.toLowerCase().includes(keyword)
    );

    return this.execute(skillName, userInput, conversationHistory, needsReasoning);
  }
}
