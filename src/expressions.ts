/**
 * Error thrown when an environment variable is required but not defined.
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
 * Expression composition utilities for ResourceConfig.
 * 
 * Provides helper functions to create expressions in a more readable way
 * than manually constructing the ${env:VAR:default} syntax.
 */
export class Expressions {
  /**
   * Create an environment variable expression.
   * 
   * @param varName The name of the environment variable
   * @param defaultValue Optional default value if the environment variable is not set
   * @returns A formatted expression string like ${env:VAR:default}
   * 
   * @example
   * ```typescript
   * Expressions.env("AUTH_ISSUER") // -> "${env:AUTH_ISSUER}"
   * Expressions.env("AUTH_ISSUER", "https://auth.dev.local") // -> "${env:AUTH_ISSUER:https://auth.dev.local}"
   * Expressions.env("PORT", "8080") // -> "${env:PORT:8080}"
   * ```
   */
  public static env(varName: string, defaultValue?: string): string {
    if (defaultValue === undefined) {
      return `\${env:${varName}}`;
    } else {
      return `\${env:${varName}:${defaultValue}}`;
    }
  }

  /**
   * Create a configuration value expression.
   * 
   * @param key The configuration key (supports dot notation)
   * @param defaultValue Optional default value if the configuration key is not set
   * @returns A formatted expression string like ${config:KEY:default}
   * 
   * @example
   * ```typescript
   * Expressions.config("database.host") // -> "${config:database.host}"
   * Expressions.config("database.port", "5432") // -> "${config:database.port:5432}"
   * ```
   */
  public static config(key: string, defaultValue?: string): string {
    if (defaultValue === undefined) {
      return `\${config:${key}}`;
    } else {
      return `\${config:${key}:${defaultValue}}`;
    }
  }

  /**
   * Return a literal string value (no expression).
   * 
   * This is mainly for consistency when mixing literal and expression values
   * in configuration objects, making it clear what's an expression vs literal.
   * 
   * @param value The literal string value
   * @returns The same string value unchanged
   * 
   * @example
   * ```typescript
   * Expressions.literal("https://api.example.com") // -> "https://api.example.com"
   * ```
   */
  public static literal(value: string): string {
    return value;
  }

  // Convenience aliases
  public static environment = Expressions.env;
  public static setting = Expressions.config;
}

// Backward compatibility - keep the function-based API available
export function env(varName: string, defaultValue?: string): string {
  return Expressions.env(varName, defaultValue);
}

export function config(key: string, defaultValue?: string): string {
  return Expressions.config(key, defaultValue);
}

export function literal(value: string): string {
  return Expressions.literal(value);
}

// Convenience aliases
export const environment = env;
export const setting = config;