/**
 * Policy for handling expression evaluation in resource configurations.
 */
export enum ExpressionEvaluationPolicy {
    /** Evaluate expressions and replace with resolved values */
    EVALUATE = 'evaluate',

    /** Keep expressions as literal strings */
    LITERAL = 'literal',

    /** Raise an error when expressions are encountered */
    ERROR = 'error',
}

/**
 * Context for expression evaluation
 */
export interface ExpressionContext {
    /** The evaluation policy to use */
    policy?: ExpressionEvaluationPolicy;

    /** Environment variables (for Node.js or custom environments) */
    env?: Record<string, string>;

    /** Configuration values (for config expressions) */
    config?: Record<string, unknown>;

    /** Additional custom variables */
    variables?: Record<string, unknown>;
}
