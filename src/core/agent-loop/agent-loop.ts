import { ILLMProvider, CompletionOptions } from '../providers/base-provider';
import { Message, AgentAction, ToolCall } from '../../types';
import { ToolRegistry } from '../../tools/tool-registry';

/**
 * Agent Loop - ReAct Pattern Implementation
 * Implements Reasoning and Acting loop for agent behavior
 */
export class AgentLoop {
  private provider: ILLMProvider;
  private conversationHistory: Message[];
  private systemPrompt: string;
  private maxIterations: number;

  constructor(
    provider: ILLMProvider,
    conversationHistory: Message[] = [],
    systemPrompt?: string
  ) {
    this.provider = provider;
    this.conversationHistory = [...conversationHistory];
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
    this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5', 10);
  }

  /**
   * Run the agent loop with the given user input
   */
  public async run(userInput: string): Promise<string> {
    console.log('\n🔄 Starting Agent Loop (ReAct Pattern)');
    console.log(`📝 User Input: ${userInput.substring(0, 100)}${userInput.length > 100 ? '...' : ''}`);

    // Add user message to history
    this.conversationHistory.push({
      conversationId: 'temp',
      role: 'user',
      content: userInput,
    });

    let iteration = 0;
    let finalResponse = '';

    while (iteration < this.maxIterations) {
      iteration++;
      console.log(`\n🔁 Iteration ${iteration}/${this.maxIterations}`);

      try {
        // Get available tools
        const tools = ToolRegistry.getAllDefinitions();

        // Generate completion
        const options: CompletionOptions = {
          systemPrompt: this.systemPrompt,
          temperature: 0.7,
          maxTokens: 4096,
        };

        // Add tools if provider supports them
        if (this.provider.supportsToolCalls && tools.length > 0) {
          options.tools = tools;
          options.toolChoice = 'auto';
        }

        const response = await this.provider.generateCompletion(
          this.conversationHistory,
          options
        );

        console.log(`💭 Thought: ${response.content.substring(0, 100)}${response.content.length > 100 ? '...' : ''}`);

        // Check if we have tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Execute all tool calls
          await this.executeToolCalls(response.toolCalls);
          
          // Continue loop
          continue;
        }

        // Check finish reason
        if (response.finishReason === 'stop') {
          // We have a final answer
          finalResponse = response.content;
          
          // Add assistant response to history
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'assistant',
            content: finalResponse,
          });

          console.log('\n✅ Agent Loop completed successfully');
          break;
        }

        if (response.finishReason === 'length') {
          console.warn('⚠️  Response truncated due to length limit');
          finalResponse = response.content + '\n\n[Response was truncated due to length limit]';
          break;
        }

        if (response.finishReason === 'error') {
          console.error('❌ LLM returned error');
          finalResponse = 'I encountered an error while processing your request. Please try again.';
          break;
        }

        // If we get here with no tool calls and no stop, treat as final response
        finalResponse = response.content;
        break;

      } catch (error: any) {
        console.error(`❌ Error in iteration ${iteration}:`, error.message);
        
        if (iteration >= this.maxIterations) {
          finalResponse = 'I encountered too many errors while processing your request. Please try again or rephrase your question.';
          break;
        }

        // Add error as observation and continue
        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'user',
          content: `[System Error]: ${error.message}. Please try a different approach.`,
        });
      }
    }

    // Check if max iterations reached
    if (iteration >= this.maxIterations && !finalResponse) {
      console.warn('⚠️  Max iterations reached without final answer');
      finalResponse = 'I apologize, but I reached the maximum number of reasoning steps without completing the task. The task may be too complex or require clarification. Please try breaking it down into smaller steps.';
    }

    return finalResponse;
  }

  /**
   * Execute tool calls and add results to conversation history
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
    console.log(`🔧 Executing ${toolCalls.length} tool call(s)...`);

    for (const toolCall of toolCalls) {
      try {
        const toolName = toolCall.function.name;
        const toolArgs = toolCall.function.arguments;
        
        console.log(`   → ${toolName}(${JSON.stringify(toolArgs).substring(0, 50)}...)`);

        // Get the tool from registry
        const tool = ToolRegistry.get(toolName);

        if (!tool) {
          const errorMsg = `Tool "${toolName}" not found in registry`;
          console.error(`   ❌ ${errorMsg}`);
          
          this.conversationHistory.push({
            conversationId: 'temp',
            role: 'tool',
            content: `Error: ${errorMsg}`,
            metadata: { toolName, toolCallId: toolCall.id },
          });
          continue;
        }

        // Execute the tool
        const result = await tool.execute(toolArgs);

        if (result.success) {
          console.log(`   ✅ Success: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`);
        } else {
          console.error(`   ❌ Failed: ${result.error}`);
        }

        // Add tool result to history
        const observation = result.success
          ? `[Tool Result - ${toolName}]:\n${result.output}`
          : `[Tool Error - ${toolName}]:\n${result.error}`;

        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'tool',
          content: observation,
          metadata: { toolName, toolCallId: toolCall.id, success: result.success },
        });

      } catch (error: any) {
        console.error(`   ❌ Tool execution error: ${error.message}`);
        
        this.conversationHistory.push({
          conversationId: 'temp',
          role: 'tool',
          content: `[Tool Execution Error - ${toolCall.function.name}]: ${error.message}`,
          metadata: { toolName: toolCall.function.name, toolCallId: toolCall.id, error: true },
        });
      }
    }
  }

  /**
   * Get default system prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are GueClaw, an advanced AI agent with access to tools and the ability to control a VPS environment.

**Core Capabilities:**
- Execute shell commands on the VPS
- Manage Docker containers and images
- Perform file operations (read, write, create, delete)
- Make HTTP API requests
- Problem-solve using step-by-step reasoning

**Instructions:**
1. Think carefully about each request before acting
2. Use tools when necessary to accomplish tasks
3. Provide clear, accurate, and helpful responses
4. If you need more information, ask the user
5. If a tool fails, try alternative approaches
6. Be concise but thorough in your explanations

**Response Format:**
- For simple questions: Answer directly
- For complex tasks: Break down into steps and use tools as needed
- Always confirm when tasks are completed
- Report errors clearly if they occur

Remember: You have full control over the VPS environment. Be careful with destructive operations.`;
  }

  /**
   * Get current conversation history
   */
  public getConversationHistory(): Message[] {
    return this.conversationHistory;
  }
}
