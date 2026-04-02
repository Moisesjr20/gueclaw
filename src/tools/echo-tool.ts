import { buildTool, z } from './core';

/**
 * Example tool demonstrating buildTool() factory pattern
 * This is a reference implementation showing best practices
 */
export const EchoTool = buildTool({
  name: 'echo',
  description: 'Echoes back the input text with optional transformations. Useful for testing tool calls and demonstrating buildTool() pattern.',

  parameters: z.object({
    text: z
      .string()
      .describe('The text to echo back'),
    
    uppercase: z
      .boolean()
      .optional()
      .describe('Convert text to uppercase (default: false)'),
    
    repeat: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of times to repeat the text (default: 1)'),
    
    prefix: z
      .string()
      .optional()
      .describe('Optional prefix to add before each line'),
    
    format: z
      .enum(['plain', 'markdown', 'json'])
      .optional()
      .describe('Output format (default: plain)'),
  }),

  execute: async (args, { success, error }) => {
    try {
      // Validate input (already validated by Zod, but additional business logic check)
      if (args.text.length === 0) {
        return error('Text cannot be empty');
      }

      // Apply transformations
      let output = args.text;

      // Uppercase transformation
      if (args.uppercase) {
        output = output.toUpperCase();
      }

      // Prefix addition
      if (args.prefix) {
        output = `${args.prefix}${output}`;
      }

      // Repeat transformation
      const repeatCount = args.repeat || 1;
      if (repeatCount > 1) {
        output = Array(repeatCount).fill(output).join('\n');
      }

      // Format transformation
      const format = args.format || 'plain';
      switch (format) {
        case 'markdown':
          output = `\`\`\`\n${output}\n\`\`\``;
          break;
        case 'json':
          output = JSON.stringify({ text: output, processed: true }, null, 2);
          break;
        // 'plain' format requires no transformation
      }

      // Return success with metadata
      return success(output, {
        originalLength: args.text.length,
        finalLength: output.length,
        transformed: Boolean(args.uppercase) || Boolean(args.prefix) || repeatCount > 1,
      });
    } catch (err) {
      return error(`Failed to echo text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  },

  examples: [
    {
      description: 'Simple echo',
      args: { text: 'Hello, World!' },
      expectedOutput: 'Hello, World!',
    },
    {
      description: 'Echo with uppercase',
      args: { text: 'Hello, World!', uppercase: true },
      expectedOutput: 'HELLO, WORLD!',
    },
    {
      description: 'Echo with repeat and prefix',
      args: { text: 'Test', repeat: 3, prefix: '> ' },
      expectedOutput: '> Test\n> Test\n> Test',
    },
    {
      description: 'Echo in markdown format',
      args: { text: 'console.log("Hello");', format: 'markdown' },
      expectedOutput: '```\nconsole.log("Hello");\n```',
    },
  ],
});
