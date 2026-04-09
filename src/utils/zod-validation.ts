import { ZodError, ZodIssue } from 'zod';

/**
 * Format Zod validation error into human-readable message for LLM
 * Inspired by Dvace's formatZodValidationError pattern
 */
export function formatZodValidationError(toolName: string, error: ZodError): string {
  const issues = error.issues.map((issue: ZodIssue) => {
    const path = issue.path.join('.');
    const field = path || 'root';
    
    let message = `• **${field}**: ${issue.message}`;
    
    // Add context based on issue code
    switch (issue.code) {
      case 'invalid_type':
        const expected = (issue as any).expected;
        const received = (issue as any).received;
        message += `\n  Expected: ${expected}, Received: ${received}`;
        break;
      
      case 'too_small':
        const minimum = (issue as any).minimum;
        message += `\n  Minimum required: ${minimum}`;
        break;
      
      case 'too_big':
        const maximum = (issue as any).maximum;
        message += `\n  Maximum allowed: ${maximum}`;
        break;
      
      case 'invalid_string':
        const validation = (issue as any).validation;
        message += `\n  Must match pattern: ${validation}`;
        break;
      
      case 'invalid_enum_value':
        const options = (issue as any).options;
        message += `\n  Valid options: ${options.join(', ')}`;
        break;
    }
    
    return message;
  }).join('\n\n');
  
  return (
    `❌ **Validation Error in ${toolName}**\n\n` +
    `The arguments provided do not match the expected schema.\n\n` +
    `**Issues Found:**\n${issues}\n\n` +
    `**What to do:**\n` +
    `1. Check that all required parameters are provided\n` +
    `2. Ensure parameter types match the expected types\n` +
    `3. Verify that values are within allowed ranges/options\n` +
    `4. Review the tool definition for correct parameter names\n\n` +
    `**DO NOT retry with the same invalid arguments.**`
  );
}

/**
 * Check if error is a Zod validation error
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
