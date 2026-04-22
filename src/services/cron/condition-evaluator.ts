/**
 * Conditional Triggers - Expression Evaluator
 * 
 * Evaluates conditional expressions for job dependencies.
 * 
 * Supported syntax:
 * - job:jobId.property - Access job properties
 * - AND, OR, NOT - Logical operators
 * - age(jobId) - Time since last run
 * - count(jobId, period) - Execution count in period
 * 
 * Examples:
 * - "job:abc.success"
 * - "job:abc.success AND job:xyz.success"
 * - "job:abc.lastRun < 2h"
 * - "age(abc) > 1h"
 */

import { CronStorage } from './cron-storage';
import type { CronJob, CronJobOutput } from './cron-types';

/**
 * Token types for expression parser
 */
type TokenType = 
  | 'JOB_REF'        // job:id.property
  | 'FUNCTION'       // age(), count()
  | 'OPERATOR'       // AND, OR, NOT
  | 'COMPARISON'     // <, >, <=, >=, ==, !=
  | 'TIME_VALUE'     // 2h, 30m, 1d
  | 'NUMBER'         // 123
  | 'BOOLEAN'        // true, false
  | 'IDENTIFIER'     // active, paused, etc.
  | 'LPAREN'         // (
  | 'RPAREN'         // )
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

/**
 * AST node types
 */
type ASTNode = 
  | { type: 'job_ref'; jobId: string; property: string }
  | { type: 'function'; name: string; args: string[] }
  | { type: 'logical_op'; operator: 'AND' | 'OR' | 'NOT'; left?: ASTNode; right?: ASTNode }
  | { type: 'comparison'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'literal'; value: string | number | boolean };

/**
 * Condition Evaluator
 */
export class ConditionEvaluator {
  private storage: CronStorage;

  constructor() {
    this.storage = CronStorage.getInstance();
  }

  /**
   * Evaluate condition expression
   * 
   * @param expression - Condition expression
   * @param currentJobId - ID of job being evaluated (to avoid circular deps)
   * @returns true if condition passes, false otherwise
   */
  async evaluate(expression: string, currentJobId?: string): Promise<boolean> {
    try {
      // Empty expression = always true
      if (!expression || expression.trim() === '') {
        return true;
      }

      const tokens = this.tokenize(expression);
      const ast = this.parse(tokens);
      const result = await this.evaluateNode(ast, currentJobId);
      return result;

      return result;
    } catch (error: any) {
      console.error('[ConditionEvaluator] Error evaluating expression:', error);
      // On error, fail-safe to false (don't run job if condition is broken)
      return false;
    }
  }

  /**
   * Extract job dependencies from expression
   * 
   * @param expression - Condition expression
   * @returns Array of job IDs referenced in expression
   */
  extractDependencies(expression: string): string[] {
    if (!expression || expression.trim() === '') {
      return [];
    }

    const jobIdPattern = /job:([a-zA-Z0-9_-]+)/g;
    const matches = [...expression.matchAll(jobIdPattern)];
    const dependencies = matches.map(m => m[1]);

    // Remove duplicates
    return Array.from(new Set(dependencies));
  }

  /**
   * Tokenize expression into tokens
   */
  private tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expression.length) {
      const char = expression[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Job reference: job:id.property
      if (expression.slice(i, i + 4) === 'job:') {
        const match = expression.slice(i).match(/^job:([a-zA-Z0-9_-]+)\.(\w+)/);
        if (match) {
          tokens.push({ type: 'JOB_REF', value: match[0] });
          i += match[0].length;
          continue;
        }
      }

      // Functions: age(), count()
      if (/[a-zA-Z]/.test(char)) {
        const match = expression.slice(i).match(/^(\w+)\(/);
        if (match) {
          // Function call
          tokens.push({ type: 'FUNCTION', value: match[1] });
          i += match[1].length;
          continue;
        }

        // Keywords: AND, OR, NOT, true, false
        const match2 = expression.slice(i).match(/^(AND|OR|NOT|true|false)\b/);
        if (match2) {
          const keyword = match2[1];
          if (keyword === 'AND' || keyword === 'OR' || keyword === 'NOT') {
            tokens.push({ type: 'OPERATOR', value: keyword });
          } else if (keyword === 'true' || keyword === 'false') {
            tokens.push({ type: 'BOOLEAN', value: keyword });
          }
          i += keyword.length;
          continue;
        }

        // String identifiers (for status values like 'active', 'paused')
        const identMatch = expression.slice(i).match(/^([a-z_][a-zA-Z0-9_]*)/);
        if (identMatch) {
          tokens.push({ type: 'IDENTIFIER', value: identMatch[0] });
          i += identMatch[0].length;
          continue;
        }
      }

      // Time values: 2h, 30m, 1d
      const timeMatch = expression.slice(i).match(/^(\d+)(h|m|d|s)/);
      if (timeMatch) {
        tokens.push({ type: 'TIME_VALUE', value: timeMatch[0] });
        i += timeMatch[0].length;
        continue;
      }

      // Numbers
      const numMatch = expression.slice(i).match(/^\d+/);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: numMatch[0] });
        i += numMatch[0].length;
        continue;
      }

      // Comparison operators
      const compMatch = expression.slice(i).match(/^(<=|>=|==|!=|<|>)/);
      if (compMatch) {
        tokens.push({ type: 'COMPARISON', value: compMatch[0] });
        i += compMatch[0].length;
        continue;
      }

      // Parentheses
      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }

      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      // Unknown character - skip
      i++;
    }

    tokens.push({ type: 'EOF', value: '' });
    return tokens;
  }

  /**
   * Parse tokens into AST (simple recursive descent parser)
   */
  private parse(tokens: Token[]): ASTNode {
    let pos = 0;

    const peek = (): Token => tokens[pos] || { type: 'EOF', value: '' };
    const consume = (): Token => tokens[pos++] || { type: 'EOF', value: '' };

    const parseExpression = (): ASTNode => {
      return parseOr();
    };

    const parseOr = (): ASTNode => {
      let left = parseAnd();

      while (peek().type === 'OPERATOR' && peek().value === 'OR') {
        consume(); // OR
        const right = parseAnd();
        left = { type: 'logical_op', operator: 'OR', left, right };
      }

      return left;
    };

    const parseAnd = (): ASTNode => {
      let left = parseNot();

      while (peek().type === 'OPERATOR' && peek().value === 'AND') {
        consume(); // AND
        const right = parseNot();
        left = { type: 'logical_op', operator: 'AND', left, right };
      }

      return left;
    };

    const parseNot = (): ASTNode => {
      if (peek().type === 'OPERATOR' && peek().value === 'NOT') {
        consume(); // NOT
        const operand = parseComparison();
        return { type: 'logical_op', operator: 'NOT', right: operand };
      }

      return parseComparison();
    };

    const parseComparison = (): ASTNode => {
      let left = parsePrimary();

      if (peek().type === 'COMPARISON') {
        const operator = consume().value;
        const right = parsePrimary();
        return { type: 'comparison', operator, left, right };
      }

      return left;
    };

    const parsePrimary = (): ASTNode => {
      const token = peek();

      // Parentheses
      if (token.type === 'LPAREN') {
        consume(); // (
        const expr = parseExpression();
        consume(); // )
        return expr;
      }

      // Job reference
      if (token.type === 'JOB_REF') {
        const match = token.value.match(/^job:([a-zA-Z0-9_-]+)\.(\w+)/);
        consume();
        if (match) {
          return { type: 'job_ref', jobId: match[1], property: match[2] };
        }
      }

      // Function
      if (token.type === 'FUNCTION') {
        const funcName = consume().value;
        consume(); // (
        
        const args: string[] = [];
        while (peek().type !== 'RPAREN' && peek().type !== 'EOF') {
          const argToken = consume();
          if (argToken.value) {
            args.push(argToken.value);
          }
        }
        
        consume(); // )
        return { type: 'function', name: funcName, args };
      }

      // Boolean literal
      if (token.type === 'BOOLEAN') {
        consume();
        return { type: 'literal', value: token.value === 'true' };
      }

      // Number literal
      if (token.type === 'NUMBER') {
        consume();
        return { type: 'literal', value: parseInt(token.value) };
      }

      // Time value
      if (token.type === 'TIME_VALUE') {
        consume();
        return { type: 'literal', value: token.value };
      }

      // String identifier (e.g., status values)
      if (token.type === 'IDENTIFIER') {
        consume();
        return { type: 'literal', value: token.value };
      }

      throw new Error(`Unexpected token: ${token.type} ${token.value}`);
    };

    return parseExpression();
  }

  /**
   * Evaluate AST node
   */
  private async evaluateNode(node: ASTNode, currentJobId?: string): Promise<boolean> {
    switch (node.type) {
      case 'logical_op':
        return this.evaluateLogicalOp(node, currentJobId);

      case 'comparison':
        return this.evaluateComparison(node, currentJobId);

      case 'job_ref':
        return this.evaluateJobRef(node, currentJobId);

      case 'function':
        return this.evaluateFunction(node, currentJobId);

      case 'literal':
        return Boolean(node.value);

      default:
        return false;
    }
  }

  /**
   * Evaluate logical operator (AND, OR, NOT)
   */
  private async evaluateLogicalOp(
    node: Extract<ASTNode, { type: 'logical_op' }>,
    currentJobId?: string
  ): Promise<boolean> {
    if (node.operator === 'NOT') {
      const right = await this.evaluateNode(node.right!, currentJobId);
      return !right;
    }

    if (node.operator === 'AND') {
      const left = await this.evaluateNode(node.left!, currentJobId);
      if (!left) return false; // Short-circuit
      const right = await this.evaluateNode(node.right!, currentJobId);
      return left && right;
    }

    if (node.operator === 'OR') {
      const left = await this.evaluateNode(node.left!, currentJobId);
      if (left) return true; // Short-circuit
      const right = await this.evaluateNode(node.right!, currentJobId);
      return left || right;
    }

    return false;
  }

  /**
   * Evaluate comparison (<, >, <=, >=, ==, !=)
   */
  private async evaluateComparison(
    node: Extract<ASTNode, { type: 'comparison' }>,
    currentJobId?: string
  ): Promise<boolean> {
    // Evaluate left and right sides
    let leftValue: any;
    let rightValue: any;
    let isTimeComparison = false;

    if (node.left.type === 'job_ref') {
      leftValue = await this.getJobProperty(node.left.jobId, node.left.property);
      // Check if this is a timestamp property (lastRun/nextRun)
      if (node.left.property === 'lastRun' || node.left.property === 'nextRun') {
        isTimeComparison = true;
      }
    } else if (node.left.type === 'function') {
      leftValue = await this.evaluateFunctionValue(node.left, currentJobId);
    } else if (node.left.type === 'literal') {
      leftValue = node.left.value;
    }

    if (node.right.type === 'literal') {
      rightValue = this.parseValue(node.right.value);
    } else if (node.right.type === 'job_ref') {
      rightValue = await this.getJobProperty(node.right.jobId, node.right.property);
      if (node.right.property === 'lastRun' || node.right.property === 'nextRun') {
        isTimeComparison = true;
      }
    } else if (node.right.type === 'function') {
      rightValue = await this.evaluateFunctionValue(node.right, currentJobId);
    }

    // Special handling for timestamp comparisons with time values
    // e.g., "job:abc.lastRun < 2h" means "job ran less than 2h ago"
    if (isTimeComparison && typeof rightValue === 'number' && typeof leftValue === 'number') {
      // Check if rightValue looks like a duration (< 1 year in ms)
      if (rightValue < 365 * 24 * 60 * 60 * 1000) {
        // Convert: "lastRun < 2h" → "(now - lastRun) < 2h" → "lastRun > (now - 2h)"
        const now = Date.now();
        const age = now - leftValue; // Age in milliseconds
        
        // Transform comparison: we compare age with duration
        // Original: lastRun < 2h (means: age < 2h)
        // Original: lastRun > 2h (means: age > 2h)
        switch (node.operator) {
          case '<':
            return age < rightValue;
          case '>':
            return age > rightValue;
          case '<=':
            return age <= rightValue;
          case '>=':
            return age >= rightValue;
          case '==':
            return Math.abs(age - rightValue) < 1000; // Within 1 second
          case '!=':
            return Math.abs(age - rightValue) >= 1000;
          default:
            return false;
        }
      }
    }

    // Perform comparison
    switch (node.operator) {
      case '<':
        return leftValue < rightValue;
      case '>':
        return leftValue > rightValue;
      case '<=':
        return leftValue <= rightValue;
      case '>=':
        return leftValue >= rightValue;
      case '==':
        return leftValue == rightValue;
      case '!=':
        return leftValue != rightValue;
      default:
        return false;
    }
  }

  /**
   * Evaluate job reference (job:id.property)
   */
  private async evaluateJobRef(
    node: Extract<ASTNode, { type: 'job_ref' }>,
    currentJobId?: string
  ): Promise<boolean> {
    const value = await this.getJobProperty(node.jobId, node.property);
    return Boolean(value);
  }

  /**
   * Evaluate function (age(), count())
   */
  private async evaluateFunction(
    node: Extract<ASTNode, { type: 'function' }>,
    currentJobId?: string
  ): Promise<boolean> {
    const value = await this.evaluateFunctionValue(node, currentJobId);
    return Boolean(value);
  }

  /**
   * Get function return value
   */
  private async evaluateFunctionValue(
    node: Extract<ASTNode, { type: 'function' }>,
    currentJobId?: string
  ): Promise<any> {
    const { name, args } = node;

    if (name === 'age' && args.length >= 1) {
      // age(jobId) - returns milliseconds since last run
      const jobId = args[0].replace(/^job:/, '').replace(/\..*/, '');
      const job = this.storage.getJob(jobId);
      if (!job || !job.lastRun) return -1; // Return -1 for jobs with no runs (age comparisons will fail)

      const lastRun = new Date(job.lastRun);
      const now = new Date();
      return now.getTime() - lastRun.getTime();
    }

    if (name === 'count' && args.length >= 2) {
      // count(jobId, period) - returns execution count in period
      const jobId = args[0].replace(/^job:/, '').replace(/\..*/, '');
      const period = args[1];
      const periodMs = this.parseTimeValue(period);

      const outputs = this.storage.getJobOutputs(jobId, 1000);
      const cutoff = Date.now() - periodMs;

      return outputs.filter(o => new Date(o.timestamp).getTime() >= cutoff).length;
    }

    return null;
  }

  /**
   * Get job property value
   */
  private async getJobProperty(jobId: string, property: string): Promise<any> {
    const job = this.storage.getJob(jobId);
    if (!job) return null;

    switch (property) {
      case 'success':
        // Last execution was successful
        const outputs = this.storage.getJobOutputs(jobId, 1);
        return outputs.length > 0 && outputs[0].success;

      case 'failed':
        // Last execution failed
        const outputs2 = this.storage.getJobOutputs(jobId, 1);
        return outputs2.length > 0 && !outputs2[0].success;

      case 'status':
        return job.status;

      case 'lastRun':
        if (!job.lastRun) return null;
        return new Date(job.lastRun).getTime();

      case 'nextRun':
        if (!job.nextRun) return null;
        return new Date(job.nextRun).getTime();

      default:
        return null;
    }
  }

  /**
   * Parse literal value (time, number, boolean)
   */
  private parseValue(value: string | number | boolean): any {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value;

    // Time value (2h, 30m, etc.)
    if (typeof value === 'string' && /^\d+(h|m|d|s)$/.test(value)) {
      return this.parseTimeValue(value);
    }

    return value;
  }

  /**
   * Parse time value to milliseconds
   */
  private parseTimeValue(value: string): number {
    const match = value.match(/^(\d+)(h|m|d|s)$/);
    if (!match) return 0;

    const num = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }
}
