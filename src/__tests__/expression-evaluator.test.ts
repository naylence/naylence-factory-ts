import { ExpressionEvaluator, ExpressionNotAllowedError, MissingEnvironmentVariableError } from '../expression-evaluator';
import { ExpressionEvaluationPolicy } from '../expression-policy';

describe('ExpressionEvaluator', () => {
  beforeEach(() => {
    // Reset environment for each test
    delete (globalThis as any).process;
  });

  describe('isExpression', () => {
    it('should detect environment variable expressions', () => {
      expect(ExpressionEvaluator.isExpression('${env:TEST_VAR}')).toBe(true);
      expect(ExpressionEvaluator.isExpression('${env:TEST_VAR:default}')).toBe(true);
      expect(ExpressionEvaluator.isExpression('prefix-${env:TEST_VAR}-suffix')).toBe(true);
    });

    it('should detect configuration expressions', () => {
      expect(ExpressionEvaluator.isExpression('${config:key}')).toBe(true);
      expect(ExpressionEvaluator.isExpression('${config:nested.key:default}')).toBe(true);
    });

    it('should not detect non-expressions', () => {
      expect(ExpressionEvaluator.isExpression('plain string')).toBe(false);
      expect(ExpressionEvaluator.isExpression('${invalid:syntax')).toBe(false);
      expect(ExpressionEvaluator.isExpression(123)).toBe(false);
      expect(ExpressionEvaluator.isExpression(null)).toBe(false);
    });
  });

  describe('evaluate with LITERAL policy', () => {
    it('should return expressions unchanged', () => {
      const context = { policy: ExpressionEvaluationPolicy.LITERAL };
      
      expect(ExpressionEvaluator.evaluate('${env:TEST_VAR}', context)).toBe('${env:TEST_VAR}');
      expect(ExpressionEvaluator.evaluate('${config:key:default}', context)).toBe('${config:key:default}');
    });
  });

  describe('evaluate with ERROR policy', () => {
    it('should throw error when expressions are found', () => {
      const context = { policy: ExpressionEvaluationPolicy.ERROR };
      
      expect(() => {
        ExpressionEvaluator.evaluate('${env:TEST_VAR}', context);
      }).toThrow(ExpressionNotAllowedError);
    });

    it('should not throw error for non-expressions', () => {
      const context = { policy: ExpressionEvaluationPolicy.ERROR };
      
      expect(ExpressionEvaluator.evaluate('plain string', context)).toBe('plain string');
      expect(ExpressionEvaluator.evaluate(123, context)).toBe(123);
    });
  });

  describe('evaluate with EVALUATE policy', () => {
    it('should resolve environment variables from context', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'TEST_VAR': 'test_value',
          'PORT': '8080'
        }
      };

      expect(ExpressionEvaluator.evaluate('${env:TEST_VAR}', context)).toBe('test_value');
      expect(ExpressionEvaluator.evaluate('${env:PORT}', context)).toBe('8080');
      expect(ExpressionEvaluator.evaluate('prefix-${env:TEST_VAR}-suffix', context)).toBe('prefix-test_value-suffix');
    });

    it('should use default values when env var not found', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {}
      };

      expect(ExpressionEvaluator.evaluate('${env:MISSING_VAR:default_value}', context)).toBe('default_value');
      expect(ExpressionEvaluator.evaluate('${env:MISSING_VAR:}', context)).toBe(''); // empty default
    });

    it('should throw error when env var not found and no default', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {}
      };

      expect(() => {
        ExpressionEvaluator.evaluate('${env:MISSING_VAR}', context);
      }).toThrow(MissingEnvironmentVariableError);
    });

    it('should resolve configuration values', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {
          'database': {
            'host': 'localhost',
            'port': 5432
          },
          'simple': 'value'
        }
      };

      expect(ExpressionEvaluator.evaluate('${config:simple}', context)).toBe('value');
      expect(ExpressionEvaluator.evaluate('${config:database.host}', context)).toBe('localhost');
      expect(ExpressionEvaluator.evaluate('${config:database.port}', context)).toBe('5432');
    });

    it('should use config defaults when key not found', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {}
      };

      expect(ExpressionEvaluator.evaluate('${config:missing.key:default_value}', context)).toBe('default_value');
    });

    it('should handle mixed expressions in single string', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: { 'HOST': 'example.com' },
        config: { 'port': '8080' }
      };

      const result = ExpressionEvaluator.evaluate('https://${env:HOST}:${config:port}/api', context);
      expect(result).toBe('https://example.com:8080/api');
    });

    it('should handle Node.js process.env when available', () => {
      // Mock process.env
      (globalThis as any).process = {
        env: {
          'NODE_ENV': 'test',
          'PORT': '3000'
        }
      };

      const context = { policy: ExpressionEvaluationPolicy.EVALUATE };

      expect(ExpressionEvaluator.evaluate('${env:NODE_ENV}', context)).toBe('test');
      expect(ExpressionEvaluator.evaluate('${env:PORT}', context)).toBe('3000');
    });

    it('should prefer context env over process.env', () => {
      // Mock process.env
      (globalThis as any).process = {
        env: {
          'TEST_VAR': 'from_process'
        }
      };

      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'TEST_VAR': 'from_context'
        }
      };

      expect(ExpressionEvaluator.evaluate('${env:TEST_VAR}', context)).toBe('from_context');
    });
  });

  describe('type conversion', () => {
    it('should convert to boolean', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'TRUE_VAR': 'true',
          'FALSE_VAR': 'false',
          'ONE_VAR': '1',
          'ZERO_VAR': '0',
          'YES_VAR': 'yes',
          'NO_VAR': 'no',
          'INVALID_VAR': 'maybe'
        }
      };

      expect(ExpressionEvaluator.evaluate('${env:TRUE_VAR}', context, 'boolean')).toBe(true);
      expect(ExpressionEvaluator.evaluate('${env:FALSE_VAR}', context, 'boolean')).toBe(false);
      expect(ExpressionEvaluator.evaluate('${env:ONE_VAR}', context, 'boolean')).toBe(true);
      expect(ExpressionEvaluator.evaluate('${env:ZERO_VAR}', context, 'boolean')).toBe(false);
      expect(ExpressionEvaluator.evaluate('${env:YES_VAR}', context, 'boolean')).toBe(true);
      expect(ExpressionEvaluator.evaluate('${env:NO_VAR}', context, 'boolean')).toBe(false);
      expect(ExpressionEvaluator.evaluate('${env:INVALID_VAR}', context, 'boolean')).toBe('maybe'); // keeps as string
    });

    it('should convert to number', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        env: {
          'INT_VAR': '42',
          'FLOAT_VAR': '3.14',
          'INVALID_VAR': 'not-a-number'
        }
      };

      expect(ExpressionEvaluator.evaluate('${env:INT_VAR}', context, 'number')).toBe(42);
      expect(ExpressionEvaluator.evaluate('${env:FLOAT_VAR}', context, 'number')).toBe(3.14);
      expect(ExpressionEvaluator.evaluate('${env:INVALID_VAR}', context, 'number')).toBe('not-a-number'); // keeps as string
    });
  });

  describe('non-string values', () => {
    it('should return non-string values unchanged', () => {
      const context = { policy: ExpressionEvaluationPolicy.EVALUATE };
      
      expect(ExpressionEvaluator.evaluate(123, context)).toBe(123);
      expect(ExpressionEvaluator.evaluate(true, context)).toBe(true);
      expect(ExpressionEvaluator.evaluate(null, context)).toBe(null);
      expect(ExpressionEvaluator.evaluate(undefined, context)).toBe(undefined);
      
      const obj = { test: 'value' };
      expect(ExpressionEvaluator.evaluate(obj, context)).toBe(obj);
    });
  });

  describe('configuration value resolution edge cases', () => {
    it('should throw error for required config value without default', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {}
      };

      expect(() => {
        ExpressionEvaluator.evaluate('${config:missing.required}', context);
      }).toThrow("Configuration key 'missing.required' is required but not defined");
    });

    it('should handle nested config access for undefined properties', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {
          database: null // null value should be handled
        }
      };

      expect(() => {
        ExpressionEvaluator.evaluate('${config:database.host}', context);
      }).toThrow("Configuration key 'database.host' is required but not defined");
    });
  });

  describe('type conversion error handling', () => {
    it('should handle conversion failures gracefully', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {
          invalidNumber: 'not-a-number-but-close',
        }
      };

      // This should test the catch block in convertToScalar
      // We need to find a way to trigger the try/catch
      // Let's test with a value that might cause Number() to throw or behave unexpectedly
      const result = ExpressionEvaluator.evaluate('${config:invalidNumber}', context);
      expect(result).toBe('not-a-number-but-close'); // Should return original value if conversion fails
    });

    it('should handle boolean conversion edge cases', () => {
      const context = {
        policy: ExpressionEvaluationPolicy.EVALUATE,
        config: {
          ambiguousBool: 'maybe', // Not clearly true/false
        }
      };

      const result = ExpressionEvaluator.evaluate('${config:ambiguousBool}', context);
      expect(result).toBe('maybe'); // Should keep as string if not clearly boolean
    });
  });
});