import {
    ExpressionEvaluationPolicy,
    ExpressionContext,
} from './expression-policy.js';

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
 * Error thrown when expression evaluation exceeds the maximum depth
 */
export class ExpressionRecursionError extends Error {
    constructor(expression: string) {
        super(
            `Expression evaluation exceeded the maximum recursion depth: ${expression}`
        );
        this.name = 'ExpressionRecursionError';
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
    private static readonly MAX_EVALUATION_DEPTH = 10;

    /** Regex pattern for environment variable expressions */
    private static readonly EXPRESSION_START = '${';

    /** Combined pattern for any expression start */
    private static readonly ANY_EXPRESSION_PATTERN = /\$\{(?:env|config):/;

    /**
     * Check if a value contains any expressions that can be evaluated.
     */
    public static isExpression(value: unknown): boolean {
        if (typeof value !== 'string') {
            return false;
        }

        if (!this.ANY_EXPRESSION_PATTERN.test(value)) {
            return false;
        }

        return this.findNextExpression(value, 0) !== null;
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

        if (
            policy === ExpressionEvaluationPolicy.ERROR &&
            this.isExpression(value)
        ) {
            throw new ExpressionNotAllowedError(value);
        }

        // Evaluate the string
        const evaluated = this.evaluateString(value, context, 0);

        // Convert to target type if specified
        if (targetType) {
            return this.convertToScalar(evaluated, targetType);
        }

        return evaluated;
    }

    /**
     * Evaluate all expressions in a string value using substitution.
     */
    private static evaluateString(
        value: string,
        context: ExpressionContext,
        depth: number
    ): string {
        if (depth > this.MAX_EVALUATION_DEPTH) {
            throw new ExpressionRecursionError(value);
        }

        let result = '';
        let index = 0;

        while (index < value.length) {
            const next = this.findNextExpression(value, index);
            if (!next) {
                result += value.slice(index);
                break;
            }

            if (next.start > index) {
                result += value.slice(index, next.start);
            }

            const evaluated = this.evaluateExpression(
                next.type,
                next.key,
                next.defaultValue,
                context,
                depth
            );
            result += evaluated;
            index = next.end + 1;
        }

        return result;
    }

    /**
     * Resolve an environment variable expression
     */
    private static resolveEnvironmentVariable(
        varName: string,
        defaultValue: string | undefined,
        context: ExpressionContext,
        depth: number
    ): string {
        // Check context environment first, then global process.env (Node.js)
        let envValue: string | undefined;

        if (context.env?.[varName] !== undefined) {
            envValue = context.env[varName];
        } else if (
            typeof globalThis !== 'undefined' &&
            'process' in globalThis
        ) {
            const nodeProcess = (globalThis as any).process;
            if (nodeProcess?.env?.[varName] !== undefined) {
                envValue = nodeProcess.env[varName];
            }
        }

        if (envValue !== undefined) {
            return envValue;
        } else if (defaultValue !== undefined) {
            return this.evaluateDefault(defaultValue, context, depth);
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
        context: ExpressionContext,
        depth: number
    ): string {
        const configValue = this.getNestedValue(context.config ?? {}, key);

        if (configValue !== undefined) {
            return String(configValue);
        } else if (defaultValue !== undefined) {
            return this.evaluateDefault(defaultValue, context, depth);
        } else {
            throw new Error(
                `Configuration key '${key}' is required but not defined`
            );
        }
    }

    /**
     * Get a nested value from an object using dot notation
     */
    private static getNestedValue(
        obj: Record<string, unknown>,
        path: string
    ): unknown {
        return path.split('.').reduce<unknown>((current, key) => {
            return current && typeof current === 'object' && key in current
                ? (current as Record<string, unknown>)[key]
                : undefined;
        }, obj);
    }

    /**
     * Convert a string value to the target scalar type if possible.
     */
    private static convertToScalar(
        value: string,
        targetType: 'string' | 'number' | 'boolean'
    ): unknown {
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

    private static evaluateExpression(
        type: 'env' | 'config',
        key: string,
        defaultValue: string | undefined,
        context: ExpressionContext,
        depth: number
    ): string {
        if (type === 'env') {
            return this.resolveEnvironmentVariable(
                key,
                defaultValue,
                context,
                depth
            );
        }

        return this.resolveConfigurationValue(
            key,
            defaultValue,
            context,
            depth
        );
    }

    private static evaluateDefault(
        defaultValue: string,
        context: ExpressionContext,
        depth: number
    ): string {
        if (!this.ANY_EXPRESSION_PATTERN.test(defaultValue)) {
            return defaultValue;
        }

        return this.evaluateString(defaultValue, context, depth + 1);
    }

    private static findNextExpression(
        value: string,
        fromIndex: number
    ): {
        start: number;
        end: number;
        type: 'env' | 'config';
        key: string;
        defaultValue?: string;
    } | null {
        let searchIndex = fromIndex;

        while (searchIndex < value.length) {
            const start = value.indexOf(this.EXPRESSION_START, searchIndex);
            if (start === -1) {
                return null;
            }

            const typeStart = start + this.EXPRESSION_START.length;
            const typeSeparator = value.indexOf(':', typeStart);
            if (typeSeparator === -1) {
                searchIndex = start + this.EXPRESSION_START.length;
                continue;
            }

            const type = value.slice(typeStart, typeSeparator);
            if (type !== 'env' && type !== 'config') {
                searchIndex = start + this.EXPRESSION_START.length;
                continue;
            }

            let index = typeSeparator + 1;
            const keyStart = index;
            while (index < value.length) {
                const char = value[index];
                if (char === ':' || char === '}') {
                    break;
                }
                index += 1;
            }

            if (index >= value.length) {
                return null;
            }

            const key = value.slice(keyStart, index);
            if (!key) {
                searchIndex = start + this.EXPRESSION_START.length;
                continue;
            }

            if (value[index] === '}') {
                return {
                    start,
                    end: index,
                    type,
                    key,
                };
            }

            const defaultStart = index + 1;
            let level = 1;
            index = defaultStart;

            while (index < value.length) {
                const char = value[index];
                const nextChar =
                    index + 1 < value.length ? value[index + 1] : '';

                if (char === '$' && nextChar === '{') {
                    level += 1;
                    index += 2;
                    continue;
                }

                if (char === '}') {
                    level -= 1;
                    if (level === 0) {
                        const defaultValue = value.slice(defaultStart, index);
                        return {
                            start,
                            end: index,
                            type,
                            key,
                            defaultValue,
                        };
                    }
                }

                index += 1;
            }

            return null;
        }

        return null;
    }
}
