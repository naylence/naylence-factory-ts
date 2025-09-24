import { ExpressionEvaluationPolicy, ExpressionContext } from './expression-policy';

/**
 * Error thrown when a required environment variable is missing
 */
export class MissingEnvironmentVariableError extends Error {
  constructor(variableName: string) {
    super(
      `Environment variable '${variableName}' is required but not defined. ` +
      `Either set the environment variable or provide a default value in the expression.`
    );
    this.name = 'MissingEnvironmentVariableError';
  }
}

/**
 * Error thrown when expression evaluation is disabled but expressions are found
 */
export class ExpressionNotAllowedError extends Error {
  constructor(expression: string) {
    super(`Expression found but evaluation is not allowed: ${expression}`);
    this.name = 'ExpressionNotAllowedError';
  }
}

/**
 * Pure expression evaluator with no external dependencies.
 * 
 * Supports expressions like:
 * - ${env:VAR:default} - Environment variable with optional default
 * - ${config:key:default} - Configuration value with optional default
 * 
 * Can handle both full-string expressions and partial substitutions within strings.
 */
export class ExpressionEvaluator {
  /** Regex pattern for environment variable expressions */
  private static readonly ENV_PATTERN = /\$\{env:([^:}]+)(?::([^}]*))?\}/g;
  
  /** Regex pattern for configuration expressions */
  private static readonly CONFIG_PATTERN = /\$\{config:([^:}]+)(?::([^}]*))?\}/g;
  
  /** Combined pattern for any expression */
  private static readonly ANY_EXPRESSION_PATTERN = /\$\{(?:env|config):([^:}]+)(?::([^}]*))?\}/;

  /**
   * Check if a value contains any expressions that can be evaluated.
   */
  public static isExpression(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    
    return this.ANY_EXPRESSION_PATTERN.test(value);
  }

  /**
   * Evaluate expressions in the given value.
   * 
   * @param value The value to evaluate (only strings are processed)
   * @param context The evaluation context
   * @param targetType Optional target type for scalar conversion
   * @returns The evaluated value
   */
  public static evaluate(
    value: unknown, 
    context: ExpressionContext = {},
    targetType?: 'string' | 'number' | 'boolean'
  ): unknown {
    // Only process string values
    if (typeof value !== 'string') {
      return value;
    }
    
    // Get policy from context
    const policy = context.policy ?? ExpressionEvaluationPolicy.EVALUATE;
    
    // Handle policy
    if (policy === ExpressionEvaluationPolicy.LITERAL) {
      return value;
    }
    
    if (policy === ExpressionEvaluationPolicy.ERROR && this.isExpression(value)) {
      throw new ExpressionNotAllowedError(value);
    }
    
    // Evaluate the string
    const evaluated = this.evaluateString(value, context);
    
    // Convert to target type if specified
    if (targetType) {
      return this.convertToScalar(evaluated, targetType);
    }
    
    return evaluated;
  }

  /**
   * Evaluate all expressions in a string value using substitution.
   */
  private static evaluateString(value: string, context: ExpressionContext): string {
    let result = value;
    
    // Substitute environment variable expressions
    result = result.replace(this.ENV_PATTERN, (_match, varName: string, defaultValue?: string) => {
      return this.resolveEnvironmentVariable(varName, defaultValue, context);
    });
    
    // Substitute configuration expressions
    result = result.replace(this.CONFIG_PATTERN, (_match, key: string, defaultValue?: string) => {
      return this.resolveConfigurationValue(key, defaultValue, context);
    });
    
    return result;
  }

  /**
   * Resolve an environment variable expression
   */
  private static resolveEnvironmentVariable(
    varName: string, 
    defaultValue: string | undefined, 
    context: ExpressionContext
  ): string {
    // Check context environment first, then global process.env (Node.js)
    let envValue: string | undefined;
    
    if (context.env?.[varName] !== undefined) {
      envValue = context.env[varName];
    } else if (typeof globalThis !== 'undefined' && 
               'process' in globalThis) {
      const nodeProcess = (globalThis as any).process;
      if (nodeProcess?.env?.[varName] !== undefined) {
        envValue = nodeProcess.env[varName];
      }
    }
    
    if (envValue !== undefined) {
      return envValue;
    } else if (defaultValue !== undefined) {
      return defaultValue;
    } else {
      throw new MissingEnvironmentVariableError(varName);
    }
  }

  /**
   * Resolve a configuration value expression
   */
  private static resolveConfigurationValue(
    key: string,
    defaultValue: string | undefined,
    context: ExpressionContext
  ): string {
    const configValue = this.getNestedValue(context.config ?? {}, key);
    
    if (configValue !== undefined) {
      return String(configValue);
    } else if (defaultValue !== undefined) {
      return defaultValue;
    } else {
      throw new Error(`Configuration key '${key}' is required but not defined`);
    }
  }

  /**
   * Get a nested value from an object using dot notation
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      return current && typeof current === 'object' && key in current 
        ? (current as Record<string, unknown>)[key] 
        : undefined;
    }, obj);
  }

  /**
   * Convert a string value to the target scalar type if possible.
   */
  private static convertToScalar(value: string, targetType: 'string' | 'number' | 'boolean'): unknown {
    try {
      switch (targetType) {
        case 'boolean': {
          const lower = value.toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(lower)) {
            return true;
          } else if (['false', '0', 'no', 'off'].includes(lower)) {
            return false;
          }
          return value; // Keep as string if not clearly boolean
        }
        
        case 'number': {
          const num = Number(value);
          return isNaN(num) ? value : num;
        }
        
        case 'string':
        default:
          return value;
      }
    } catch {
      return value; // Return original if conversion fails
    }
  }
}