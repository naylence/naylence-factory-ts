// Core factory interfaces and base classes
export {
  type ResourceFactory,
  type FactoryConstructor,
  type FactoryInfo,
  AbstractResourceFactory,
} from './factory';

// Extension management
export { ExtensionManager } from './extension-manager';

// Resource configuration and validation
export {
  type ResourceConfig,
  type ConfigSchema,
  type PropertySchema,
  type ValidationContext,
  type ValidationResult,
  type ValidationError,
  ResourceConfigValidator,
  configValidator,
} from './resource-config';

// Factory registry - main entry point
export {
  type CreateResourceOptions,
  ResourceFactoryRegistry,
  createResource,
  createDefaultResource,
  registerFactory,
  getFactory,
} from './factory-registry';

// Expression evaluation
export {
  type ExpressionContext,
  ExpressionEvaluationPolicy,
} from './expression-policy';

// Expression evaluator
export {
  ExpressionEvaluator,
  MissingEnvironmentVariableError,
  ExpressionNotAllowedError,
} from './expression-evaluator';

// Expression utilities  
export {
  Expressions,
} from './expressions';

// Convenience aliases
export { ResourceFactoryRegistry as Registry } from './factory-registry';
export { ExtensionManager as Extensions } from './extension-manager';