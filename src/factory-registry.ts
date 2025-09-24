import { ResourceFactory } from './factory';
import { ExtensionManager } from './extension-manager';
import { ResourceConfig, ResourceConfigValidator, ValidationContext, configValidator } from './resource-config';

/**
 * Options for resource creation
 */
export interface CreateResourceOptions extends ValidationContext {
  /** Additional arguments to pass to the factory */
  factoryArgs?: unknown[];
  
  /** Whether to validate the configuration before creation */
  validate?: boolean;
  
  /** Custom validator to use instead of the global one */
  validator?: ResourceConfigValidator;
}

/**
 * Central registry for resource factories with type-based dispatch.
 * 
 * This is the main entry point for creating resources and replaces the
 * Python ResourceFactoryRegistry functionality.
 */
export class ResourceFactoryRegistry {
  /**
   * Create a resource from configuration using registered factories.
   * 
   * @param baseTypeName The base factory type (e.g., "ConnectorFactory")
   * @param config The resource configuration
   * @param options Creation options
   * @returns Promise resolving to the created resource
   */
  public static async createResource<T = unknown>(
    baseTypeName: string,
    config: ResourceConfig | Record<string, unknown> | null | undefined,
    options: CreateResourceOptions = {}
  ): Promise<T | null> {
    if (!config) {
      return null;
    }

    // Ensure config has a type field
    const configObj = config as Record<string, unknown>;
    const resourceType = configObj.type;
    
    if (!resourceType || typeof resourceType !== 'string') {
      throw new Error(`Configuration must have a 'type' field, got: ${JSON.stringify(config)}`);
    }

    // Validate configuration if requested
    let validatedConfig: ResourceConfig = config as ResourceConfig;
    if (options.validate !== false) {
      const validator = options.validator ?? configValidator;
      const validationResult = validator.validate(config, options);
      
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map(e => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`Configuration validation failed: ${errorMessages}`);
      }
      
      if (validationResult.config) {
        validatedConfig = validationResult.config;
      }
    }

    // Get the factory
    const factory = ExtensionManager.getGlobalFactory<T, ResourceConfig>(
      baseTypeName,
      resourceType,
      ...(options.factoryArgs ?? [])
    );

    // Create the resource
    return await factory.create(validatedConfig, ...(options.factoryArgs ?? []));
  }

  /**
   * Create a resource using the best available default implementation.
   * 
   * @param baseTypeName The base factory type
   * @param config Optional configuration (without 'type' field)
   * @param options Creation options
   * @returns Promise resolving to the created resource
   */
  public static async createDefaultResource<T = unknown>(
    baseTypeName: string,
    config: Record<string, unknown> | null | undefined = null,
    options: CreateResourceOptions = {}
  ): Promise<T | null> {
    // Get the best default factory
    const defaultResult = ExtensionManager.getBestGlobalDefaultFactory<T, ResourceConfig>(baseTypeName);
    
    if (!defaultResult) {
      console.warn(`No default factory found for base type: ${baseTypeName}`);
      return null;
    }

    const [defaultFactory, factoryType] = defaultResult;

    // Merge config with default type
    const finalConfig: ResourceConfig = {
      type: factoryType,
      ...(config ?? {}),
    };

    // Validate configuration if requested
    let validatedConfig: ResourceConfig = finalConfig;
    if (options.validate !== false) {
      const validator = options.validator ?? configValidator;
      const validationResult = validator.validate(finalConfig, options);
      
      if (!validationResult.valid) {
        const errorMessages = validationResult.errors.map(e => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`Configuration validation failed: ${errorMessages}`);
      }
      
      if (validationResult.config) {
        validatedConfig = validationResult.config;
      }
    }

    // Create the resource
    return await defaultFactory.create(validatedConfig, ...(options.factoryArgs ?? []));
  }

  /**
   * Register a factory for a specific base type and resource type.
   * 
   * @param baseTypeName The base factory type (e.g., "ConnectorFactory")
   * @param resourceTypeName The specific resource type (e.g., "HttpConnector")
   * @param factoryConstructor The factory constructor
   * @param metadata Optional factory metadata
   */
  public static registerFactory<T = unknown, C = unknown>(
    baseTypeName: string,
    resourceTypeName: string,
    factoryConstructor: new (...args: unknown[]) => ResourceFactory<T, C>,
    metadata?: {
      isDefault?: boolean;
      priority?: number;
      description?: string;
      [key: string]: unknown;
    }
  ): void {
    ExtensionManager.registerGlobalFactory(
      baseTypeName,
      resourceTypeName,
      factoryConstructor,
      metadata
    );
  }

  /**
   * Register a factory instance directly.
   * 
   * @param baseTypeName The base factory type
   * @param factory The factory instance
   */
  public static registerFactoryInstance<T = unknown, C = unknown>(
    baseTypeName: string,
    factory: ResourceFactory<T, C>
  ): void {
    ExtensionManager.registerGlobalFactoryInstance(baseTypeName, factory);
  }

  /**
   * Get a factory by base type and resource type.
   * 
   * @param baseTypeName The base factory type
   * @param resourceTypeName The resource type
   * @param args Arguments to pass to factory constructor
   * @returns The factory instance
   */
  public static getFactory<T = unknown, C = unknown>(
    baseTypeName: string,
    resourceTypeName: string,
    ...args: unknown[]
  ): ResourceFactory<T, C> {
    return ExtensionManager.getGlobalFactory<T, C>(baseTypeName, resourceTypeName, ...args);
  }

  /**
   * Get all available resource types for a base factory type.
   * 
   * @param baseTypeName The base factory type
   * @returns Array of available resource type names
   */
  public static getAvailableTypes(baseTypeName: string): string[] {
    const group = `naylence.${baseTypeName}`;
    const manager = ExtensionManager.getExtensionManager(group, baseTypeName);
    return manager.getAvailableNames();
  }

  /**
   * Get default resource types for a base factory type.
   * 
   * @param baseTypeName The base factory type
   * @returns Array of [factory, type name] pairs that are marked as defaults
   */
  public static getDefaultTypes<T = unknown, C = unknown>(
    baseTypeName: string
  ): Array<[ResourceFactory<T, C>, string]> {
    const group = `naylence.${baseTypeName}`;
    const manager = ExtensionManager.getExtensionManager<T, C>(group, baseTypeName);
    return manager.getDefaultFactories();
  }

  /**
   * Clear factory instance caches.
   * 
   * @param baseTypeName Optional base type to clear, or undefined to clear all
   * @param resourceTypeName Optional resource type to clear within the base type
   */
  public static clearCache(baseTypeName?: string, resourceTypeName?: string): void {
    if (baseTypeName) {
      const group = `naylence.${baseTypeName}`;
      const manager = ExtensionManager.getExtensionManager(group, baseTypeName);
      manager.clearInstanceCache(resourceTypeName);
    } else {
      // Clear all caches
      const allManagers = ExtensionManager.getAllExtensionManagers();
      for (const manager of allManagers.values()) {
        manager.clearInstanceCache();
      }
    }
  }
}

// Convenience functions that mirror the class methods
export async function createResource<T = unknown>(
  baseTypeName: string,
  config: ResourceConfig | Record<string, unknown> | null | undefined,
  options: CreateResourceOptions = {}
): Promise<T | null> {
  return ResourceFactoryRegistry.createResource<T>(baseTypeName, config, options);
}

export async function createDefaultResource<T = unknown>(
  baseTypeName: string,
  config: Record<string, unknown> | null | undefined = null,
  options: CreateResourceOptions = {}
): Promise<T | null> {
  return ResourceFactoryRegistry.createDefaultResource<T>(baseTypeName, config, options);
}

export function registerFactory<T = unknown, C = unknown>(
  baseTypeName: string,
  resourceTypeName: string,
  factoryConstructor: new (...args: unknown[]) => ResourceFactory<T, C>,
  metadata?: {
    isDefault?: boolean;
    priority?: number;
    description?: string;
    [key: string]: unknown;
  }
): void {
  ResourceFactoryRegistry.registerFactory(baseTypeName, resourceTypeName, factoryConstructor, metadata);
}

export function getFactory<T = unknown, C = unknown>(
  baseTypeName: string,
  resourceTypeName: string,
  ...args: unknown[]
): ResourceFactory<T, C> {
  return ResourceFactoryRegistry.getFactory<T, C>(baseTypeName, resourceTypeName, ...args);
}