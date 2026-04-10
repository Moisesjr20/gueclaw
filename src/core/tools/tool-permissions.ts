/**
 * Tool Permission System (DVACE Phase 5.2)
 * 
 * Validates if a tool can be used based on allowedTools patterns.
 * Supports wildcards, negation, and parameter matching.
 */

export type ToolPattern = string;

export interface ToolPermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a tool call is allowed based on permission patterns
 * 
 * @param toolName - Name of the tool being called (e.g., "Bash", "FileRead")
 * @param toolArgs - Arguments passed to the tool (e.g., "git status", "/etc/passwd")
 * @param allowedTools - Array of permission patterns
 * 
 * @returns ToolPermissionResult indicating if allowed and why
 * 
 * @example
 * canUseTool('Bash', 'git status', ['Bash(git *)']) // ✅ allowed
 * canUseTool('Bash', 'rm -rf /', ['Bash(git *)']) // ❌ blocked (não combina com git *)
 * canUseTool('FileRead', '/etc/passwd', ['FileRead(*)', '!FileRead(/etc/*)']) // ❌ blocked (negação)
 * canUseTool('FileWrite', 'test.txt', ['*']) // ✅ allowed (wildcard total)
 */
export function canUseTool(
  toolName: string,
  toolArgs: string | Record<string, any>,
  allowedTools: string[]
): ToolPermissionResult {
  // Special case: '*' allows everything
  if (allowedTools.includes('*')) {
    return { allowed: true };
  }

  // Convert toolArgs to string for pattern matching
  const argsStr = typeof toolArgs === 'string' ? toolArgs : JSON.stringify(toolArgs);

  // Check negation patterns first (they take precedence)
  for (const pattern of allowedTools) {
    if (pattern.startsWith('!')) {
      const negationPattern = pattern.slice(1);
      if (matchesPattern(toolName, argsStr, negationPattern)) {
        return {
          allowed: false,
          reason: `Tool blocked by negation pattern: ${pattern}`,
        };
      }
    }
  }

  // Check positive patterns
  for (const pattern of allowedTools) {
    if (pattern.startsWith('!')) continue; // Skip negations

    if (matchesPattern(toolName, argsStr, pattern)) {
      return { allowed: true };
    }
  }

  // No pattern matched
  return {
    allowed: false,
    reason: `Tool "${toolName}" not in allowedTools. Available: ${allowedTools.join(', ')}`,
  };
}

/**
 * Check if a tool call matches a permission pattern
 * 
 * Patterns:
 * - "ToolName" → matches exact tool name (any args)
 * - "ToolName(*)" → matches tool name with any args
 * - "ToolName(pattern)" → matches tool name + args containing pattern
 * - "ToolName(prefix*)" → matches tool name + args starting with prefix
 * 
 * @param toolName - Name of the tool
 * @param toolArgs - Arguments as string
 * @param pattern - Permission pattern to match
 */
function matchesPattern(toolName: string, toolArgs: string, pattern: string): boolean {
  // Extract tool name and arg pattern from permission string
  const match = pattern.match(/^([^(]+)(?:\(([^)]*)\))?$/);
  if (!match) {
    // Invalid pattern format, treat as exact tool name match
    return toolName === pattern;
  }

  const [, patternTool, patternArgs] = match;

  // Tool name must match
  if (toolName !== patternTool.trim()) {
    return false;
  }

  // If no args pattern specified, allow any args
  if (!patternArgs) {
    return true;
  }

  // "*" in pattern means any args
  if (patternArgs === '*') {
    return true;
  }

  // Check if args match the pattern
  return matchesArgPattern(toolArgs, patternArgs);
}

/**
 * Match tool arguments against a pattern
 * 
 * Supports:
 * - "*" → any args
 * - "prefix*" → args starting with prefix
 * - "*suffix" → args ending with suffix
 * - "exact" → exact match
 * - "substring" → args containing substring
 */
function matchesArgPattern(args: string, pattern: string): boolean {
  // Wildcard at end: prefix match
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return args.startsWith(prefix);
  }

  // Wildcard at start: suffix match
  if (pattern.startsWith('*')) {
    const suffix = pattern.slice(1);
    return args.endsWith(suffix);
  }

  // Exact match
  if (!pattern.includes('*')) {
    return args.includes(pattern);
  }

  // Complex wildcard pattern (convert to regex)
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  return new RegExp(`^${regexPattern}$`, 'i').test(args);
}

/**
 * Validate a list of tool permission patterns
 * Returns invalid patterns for early detection
 */
export function validateToolPatterns(patterns: string[]): { valid: boolean; invalid: string[] } {
  const invalid: string[] = [];

  for (const pattern of patterns) {
    if (pattern === '*') continue; // Valid wildcard

    if (pattern.startsWith('!')) {
      // Validate negation pattern
      const innerPattern = pattern.slice(1);
      if (!innerPattern.match(/^[^(]+(?:\([^)]*\))?$/)) {
        invalid.push(pattern);
      }
      continue;
    }

    // Validate regular pattern
    if (!pattern.match(/^[^(]+(?:\([^)]*\))?$/)) {
      invalid.push(pattern);
    }
  }

  return {
    valid: invalid.length === 0,
    invalid,
  };
}
