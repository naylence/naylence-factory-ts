import { ResourceFactory, FactoryConstructor, FactoryInfo } from './factory';

/**
 * TypeScript Extension Manager - replaces Python entry points with manual registration.
 * 
 * In Python, entry points allow automatic discovery of plugins. In TypeScript/JavaScript,
 * we use explicit registration instead. This provides better tree-shaking and bundle optimization.
 */
export class ExtensionManager<T = unknown, C = unknown> {
  private readonly group: string;
  private readonly baseType: string;
  private readonly registry = new Map<string, FactoryInfo<T, C>>();
  private readonly instanceCache = new Map<string, ResourceFactory<T, C>>();
  
  // Global registry for all extension managers
  private static readonly globalRegistry = new Map<string, ExtensionManager<any, any>>();
  
  constructor(group: string, baseType: string) {
    this.group = group;
    this.baseType = baseType;
  }

  /**
   * Register a factory constructor for a given type name.
   * 
   * @param typeName The type identifier for this factory
   * @param factoryConstructor The factory constructor function
   * @param metadata Optional metadata about the factory
   */
  public registerFactory(
    typeName: string,
    factoryConstructor: FactoryConstructor<T, C>,
    metadata?: FactoryInfo<T, C>['metadata']
  ): void {
    const factoryInfo: FactoryInfo<T, C> = {
      type: typeName,
      constructor: factoryConstructor,
    };
    
    if (metadata) {
      factoryInfo.metadata = metadata;
    }
    
    this.registry.set(typeName, factoryInfo);
    
    // Clear instance cache for this type
    this.instanceCache.delete(typeName);
  }

  /**
   * Register a factory instance directly.
   * 
   * @param factory The factory instance to register
   */
  public registerFactoryInstance(factory: ResourceFactory<T, C>): void {
    const metadata: FactoryInfo<T, C>['metadata'] = {};
    
    if (factory.isDefault !== undefined) {
      metadata.isDefault = factory.isDefault;
    }
    
    if (factory.priority !== undefined) {
      metadata.priority = factory.priority;
    }

    const info: FactoryInfo<T, C> = {
      type: factory.type,
      constructor: factory.constructor as FactoryConstructor<T, C>,
      instance: factory,
      metadata,
    };
    
    this.registry.set(factory.type, info);
    this.instanceCache.set(factory.type, factory);
  }

  /**
   * Get available factory type names.
   */
  public getAvailableNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get a factory instance by type name.
   * 
   * @param typeName The factory type name
   * @param args Arguments to pass to the factory constructor (only used on first creation)
   * @returns The factory instance
   */
  public getFactory(typeName: string, ...args: unknown[]): ResourceFactory<T, C> {
    const cached = this.instanceCache.get(typeName);
    if (cached) {
      return cached;
    }

    const info = this.registry.get(typeName);
    if (!info) {
      throw new Error(
        `Unknown factory type '${typeName}' in group '${this.group}'. ` +
        `Available types: [${this.getAvailableNames().join(', ')}]`
      );
    }

    // Create new instance
    const instance = new info.constructor(...args);
    this.instanceCache.set(typeName, instance);
    
    // Update the registry info with the instance
    info.instance = instance;
    
    return instance;
  }

  /**
   * Get all factories marked as default implementations.
   * 
   * @returns Array of [factory instance, type name] pairs
   */
  public getDefaultFactories(): Array<[ResourceFactory<T, C>, string]> {
    const defaults: Array<[ResourceFactory<T, C>, string]> = [];
    
    for (const [typeName, info] of this.registry) {
      const instance = info.instance ?? this.getFactory(typeName);
      if (instance.isDefault) {
        defaults.push([instance, typeName]);
      }
    }
    
    return defaults;
  }

  /**
   * Get the best default factory by priority.
   * 
   * @returns The best default factory and its type name, or null if no defaults
   */
  public getBestDefaultFactory(): [ResourceFactory<T, C>, string] | null {
    const defaults = this.getDefaultFactories();
    
    if (defaults.length === 0) {
      return null;
    }
    
    if (defaults.length === 1) {
      return defaults[0];
    }
    
    // Sort by priority (highest first)
    defaults.sort(([a], [b]) => (b.priority ?? 0) - (a.priority ?? 0));
    
    const [bestFactory, bestType] = defaults[0];
    const bestPriority = bestFactory.priority ?? 0;
    
    // Log selection since multiple candidates exist (defaults.length > 1 is guaranteed here)
    console.debug(
      `Selected best default for ${this.baseType}: '${bestType}' ` +
      `(priority=${bestPriority}) among [${defaults.map(([f, t]) => `${t}(p=${f.priority ?? 0})`).join(', ')}]`
    );
    
    return [bestFactory, bestType];
  }

  /**
   * Clear the instance cache for a specific type or all types.
   * 
   * @param typeName Optional specific type to clear, or undefined to clear all
   */
  public clearInstanceCache(typeName?: string): void {
    if (typeName === undefined) {
      this.instanceCache.clear();
    } else {
      this.instanceCache.delete(typeName);
    }
  }

  /**
   * Get information about a registered factory.
   * 
   * @param typeName The factory type name
   * @returns Factory information or undefined if not found
   */
  public getFactoryInfo(typeName: string): FactoryInfo<T, C> | undefined {
    return this.registry.get(typeName);
  }

  /**
   * Get all registered factory information.
   * 
   * @returns Map of type names to factory information
   */
  public getAllFactoryInfo(): Map<string, FactoryInfo<T, C>> {
    return new Map(this.registry);
  }

  // ═══ Static methods for global registry management ═══

  /**
   * Get or create an extension manager for a specific group and base type.
   * 
   * @param group The extension group name (e.g., "naylence.ConnectorFactory")
   * @param baseType The base type name for type checking
   * @returns The extension manager instance
   */
  public static getExtensionManager<T = unknown, C = unknown>(
    group: string,
    baseType: string
  ): ExtensionManager<T, C> {
    const key = `${group}:${baseType}`;
    
    let manager = this.globalRegistry.get(key);
    if (!manager) {
      manager = new ExtensionManager<T, C>(group, baseType);
      this.globalRegistry.set(key, manager);
    }
    
    return manager as ExtensionManager<T, C>;
  }

  /**
   * Register a factory globally using the base type as the group.
   * 
   * @param baseTypeName The base type name (e.g., "ConnectorFactory")
   * @param typeName The specific factory type name
   * @param factoryConstructor The factory constructor
   * @param metadata Optional factory metadata
   */
  public static registerGlobalFactory<T = unknown, C = unknown>(
    baseTypeName: string,
    typeName: string,
    factoryConstructor: FactoryConstructor<T, C>,
    metadata?: FactoryInfo<T, C>['metadata']
  ): void {
    const group = `naylence.${baseTypeName}`;
    const manager = this.getExtensionManager<T, C>(group, baseTypeName);
    manager.registerFactory(typeName, factoryConstructor, metadata);
  }

  /**
   * Register a factory instance globally.
   * 
   * @param baseTypeName The base type name (e.g., "ConnectorFactory")
   * @param factory The factory instance
   */
  public static registerGlobalFactoryInstance<T = unknown, C = unknown>(
    baseTypeName: string,
    factory: ResourceFactory<T, C>
  ): void {
    const group = `naylence.${baseTypeName}`;
    const manager = this.getExtensionManager<T, C>(group, baseTypeName);
    manager.registerFactoryInstance(factory);
  }

  /**
   * Get a factory by base type and factory type name.
   * 
   * @param baseTypeName The base type name
   * @param typeName The factory type name
   * @param args Arguments to pass to factory constructor
   * @returns The factory instance
   */
  public static getGlobalFactory<T = unknown, C = unknown>(
    baseTypeName: string,
    typeName: string,
    ...args: unknown[]
  ): ResourceFactory<T, C> {
    const group = `naylence.${baseTypeName}`;
    const manager = this.getExtensionManager<T, C>(group, baseTypeName);
    return manager.getFactory(typeName, ...args);
  }

  /**
   * Get the best default factory for a base type.
   * 
   * @param baseTypeName The base type name
   * @returns The best default factory and its type name, or null
   */
  public static getBestGlobalDefaultFactory<T = unknown, C = unknown>(
    baseTypeName: string
  ): [ResourceFactory<T, C>, string] | null {
    const group = `naylence.${baseTypeName}`;
    const manager = this.getExtensionManager<T, C>(group, baseTypeName);
    return manager.getBestDefaultFactory();
  }

  /**
   * Get all extension managers.
   * 
   * @returns Map of group:baseType keys to extension manager instances
   */
  public static getAllExtensionManagers(): Map<string, ExtensionManager<any, any>> {
    return new Map(this.globalRegistry);
  }
}