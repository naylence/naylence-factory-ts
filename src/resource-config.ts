import { ExpressionEvaluator } from './expression-evaluator';
import { ExpressionContext } from './expression-policy';

/**
 * Base interface for resource configurations.
 * All resource configs must have a 'type' field for polymorphic dispatch.
 */
export interface ResourceConfig {
  /** The type identifier for this resource configuration */
  type: string;
  
  /** Additional properties are allowed */
  [key: string]: unknown;
}

/**
 * Validation context for resource configuration
 */
export interface ValidationContext extends ExpressionContext {
  /** Whether to validate unknown properties */
  allowUnknownProperties?: boolean;
  
  /** Custom property validators */
  propertyValidators?: Record<string, (value: unknown) => boolean>;
}

/**
 * Schema definition for a resource configuration property
 */
export interface PropertySchema {
  /** The expected type of the property */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  
  /** Whether the property is required */
  required?: boolean;
  
  /** Default value if not provided */
  defaultValue?: unknown;
  
  /** Custom validation function */
  validator?: (value: unknown) => boolean | string;
  
  /** Description of the property */
  description?: string;
  
  /** For object types, nested schema */
  properties?: Record<string, PropertySchema>;
  
  /** For array types, schema for items */
  items?: PropertySchema;
}

/**
 * Schema definition for a resource configuration
 */
export interface ConfigSchema {
  /** The type this schema validates */
  type: string;
  
  /** Schema for each property */
  properties: Record<string, PropertySchema>;
  
  /** Whether unknown properties are allowed */
  allowUnknownProperties?: boolean;
  
  /** Description of this configuration type */
  description?: string;
}

/**
 * Validation error information
 */
export interface ValidationError {
  /** The property path where the error occurred */
  path: string;
  
  /** The error message */
  message: string;
  
  /** The actual value that failed validation */
  value: unknown;
  
  /** The expected type or constraint */
  expected?: string;
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether validation succeeded */
  valid: boolean;
  
  /** List of validation errors */
  errors: ValidationError[];
  
  /** The validated and processed configuration */
  config?: ResourceConfig;
}

/**
 * Resource configuration validator and processor.
 * 
 * Provides validation, expression evaluation, and type coercion for resource configurations.
 * This replaces Pydantic's validation in the Python version.
 */
export class ResourceConfigValidator {
  private readonly schemas = new Map<string, ConfigSchema>();

  /**
   * Register a configuration schema for a specific type.
   * 
   * @param schema The schema to register
   */
  public registerSchema(schema: ConfigSchema): void {
    this.schemas.set(schema.type, schema);
  }

  /**
   * Get a registered schema by type.
   * 
   * @param type The configuration type
   * @returns The schema or undefined if not found
   */
  public getSchema(type: string): ConfigSchema | undefined {
    return this.schemas.get(type);
  }

  /**
   * Validate and process a resource configuration.
   * 
   * @param config The configuration to validate
   * @param context The validation context
   * @returns The validation result
   */
  public validate(
    config: unknown,
    context: ValidationContext = {}
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Basic type check
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: 'Configuration must be an object',
          value: config,
          expected: 'object',
        }],
      };
    }

    const configObj = config as Record<string, unknown>;

    // Check for type field
    if (!('type' in configObj) || typeof configObj.type !== 'string') {
      return {
        valid: false,
        errors: [{
          path: 'type',
          message: 'Configuration must have a string "type" field',
          value: configObj.type,
          expected: 'string',
        }],
      };
    }

    const configType = configObj.type;
    const schema = this.schemas.get(configType);

    // If no schema is registered, do basic validation
    if (!schema) {
      const processedConfig = this.processExpressions(configObj, context);
      return {
        valid: true,
        errors: [],
        config: processedConfig as ResourceConfig,
      };
    }

    // Validate against schema
    const processedConfig = { ...configObj };
    this.validateObject(processedConfig, schema, '', errors, context);

    // Process expressions if validation passed
    if (errors.length === 0) {
      const finalConfig = this.processExpressions(processedConfig, context);
      return {
        valid: true,
        errors: [],
        config: finalConfig as ResourceConfig,
      };
    }

    return {
      valid: false,
      errors,
    };
  }

  /**
   * Validate an object against a schema.
   */
  private validateObject(
    obj: Record<string, unknown>,
    schema: ConfigSchema,
    basePath: string,
    errors: ValidationError[],
    context: ValidationContext
  ): void {
    // Check required properties and validate existing ones
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const propPath = basePath ? `${basePath}.${propName}` : propName;
      const value = obj[propName];

      if (value === undefined || value === null) {
        if (propSchema.required) {
          errors.push({
            path: propPath,
            message: `Required property '${propName}' is missing`,
            value,
            expected: propSchema.type,
          });
        } else if (propSchema.defaultValue !== undefined) {
          obj[propName] = propSchema.defaultValue;
        }
        continue;
      }

      // Validate property
      this.validateProperty(value, propSchema, propPath, errors, context);
    }

    // Check for unknown properties
    const allowUnknown = schema.allowUnknownProperties ?? context.allowUnknownProperties ?? false;
    if (!allowUnknown) {
      for (const propName of Object.keys(obj)) {
        if (!(propName in schema.properties)) {
          const propPath = basePath ? `${basePath}.${propName}` : propName;
          errors.push({
            path: propPath,
            message: `Unknown property '${propName}'`,
            value: obj[propName],
          });
        }
      }
    }
  }

  /**
   * Validate a single property value.
   */
  private validateProperty(
    value: unknown,
    schema: PropertySchema,
    path: string,
    errors: ValidationError[],
    context: ValidationContext
  ): void {
    // Type validation
    const actualType = this.getValueType(value);
    if (actualType !== schema.type) {
      // Try type coercion for primitive types
      const coerced = this.coerceType(value, schema.type);
      if (coerced.success) {
        // Note: Type coercion would update the value in place
        // For now, we'll accept the coerced value
        // In a full implementation, you'd need to update the parent object
      } else {
        errors.push({
          path,
          message: `Expected ${schema.type} but got ${actualType}`,
          value,
          expected: schema.type,
        });
        return;
      }
    }

    // Custom validation
    if (schema.validator) {
      const result = schema.validator(value);
      if (typeof result === 'string') {
        errors.push({
          path,
          message: result,
          value,
        });
      } else if (!result) {
        errors.push({
          path,
          message: `Custom validation failed for property '${path}'`,
          value,
        });
      }
    }

    // Nested validation for objects
    if (schema.type === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      const nestedSchema: ConfigSchema = {
        type: 'nested',
        properties: schema.properties,
      };
      
      if (context.allowUnknownProperties !== undefined) {
        nestedSchema.allowUnknownProperties = context.allowUnknownProperties;
      }
      
      this.validateObject(value as Record<string, unknown>, nestedSchema, path, errors, context);
    }

    // Array validation
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        this.validateProperty(item, schema.items!, `${path}[${index}]`, errors, context);
      });
    }
  }

  /**
   * Get the type of a value as a string.
   */
  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Attempt to coerce a value to the target type.
   */
  private coerceType(value: unknown, targetType: string): { success: boolean; value?: unknown } {
    try {
      switch (targetType) {
        case 'string':
          return { success: true, value: String(value) };
        
        case 'number': {
          const num = Number(value);
          return { success: !isNaN(num), value: num };
        }
        
        case 'boolean': {
          if (typeof value === 'boolean') return { success: true, value };
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', '1', 'yes', 'on'].includes(lower)) {
              return { success: true, value: true };
            }
            if (['false', '0', 'no', 'off'].includes(lower)) {
              return { success: true, value: false };
            }
          }
          return { success: false };
        }
        
        default:
          return { success: false };
      }
    } catch {
      return { success: false };
    }
  }

  /**
   * Process expressions in a configuration object.
   */
  private processExpressions(
    config: Record<string, unknown>,
    context: ValidationContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      result[key] = this.processValue(value, context);
    }

    return result;
  }

  /**
   * Process expressions in a single value recursively.
   */
  private processValue(value: unknown, context: ValidationContext): unknown {
    if (typeof value === 'string') {
      // Process string expressions
      const evaluated = ExpressionEvaluator.evaluate(value, context);
      if (typeof evaluated === 'string') {
        return this.coerceEvaluatedScalar(evaluated);
      }
      return evaluated;
    } else if (Array.isArray(value)) {
      // Process array elements
      return value.map(item => this.processValue(item, context));
    } else if (value && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      const isPlainObject = !prototype || prototype === Object.prototype;

      if (!isPlainObject) {
        return value;
      }

      const processedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        processedObj[key] = this.processValue(val, context);
      }
      return processedObj;
    }

    return value;
  }

  private coerceEvaluatedScalar(value: string): unknown {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'true') {
      return true;
    }
    if (lower === 'false') {
      return false;
    }

    if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }

    return value;
  }
}

/**
 * Global configuration validator instance
 */
export const configValidator = new ResourceConfigValidator();