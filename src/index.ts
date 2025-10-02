// Core factory interfaces and base classes
export {
  type ResourceFactory,
  type FactoryConstructor,
  type FactoryInfo,
  AbstractResourceFactory,
} from './factory.js';

// Extension management
export { ExtensionManager } from './extension-manager.js';

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
} from './resource-config.js';

// Factory registry - main entry point
export {
  type CreateResourceOptions,
  ResourceFactoryRegistry,
  createResource,
  createDefaultResource,
  registerFactory,
  unregisterFactory,
  getFactory,
} from './factory-registry.js';

// Expression evaluation
export {
  type ExpressionContext,
  ExpressionEvaluationPolicy,
} from './expression-policy.js';

// Expression evaluator
export {
  ExpressionEvaluator,
  MissingEnvironmentVariableError,
  ExpressionNotAllowedError,
} from './expression-evaluator.js';

// Expression utilities  
export {
  Expressions,
} from './expressions.js';

// Plugin system
export {
  type FamePlugin,
  type PluginSpecifier,
  type PluginResolver,
  type PluginSpec,
  loadPlugins,
  loadPluginsFromEnv,
  loadPluginsFromSpecs,
} from './plugins.js';
export { ConventionPluginResolver } from './plugin-resolver.js';
export {
  type FactoryManifest,
  readFactoryManifestIfAny,
  registerFactoryManifest,
} from './manifest.js';

// Convenience aliases
export { ResourceFactoryRegistry as Registry } from './factory-registry.js';
export { ExtensionManager as Extensions } from './extension-manager.js';