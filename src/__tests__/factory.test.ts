import { 
  ResourceFactory, 
  AbstractResourceFactory, 
  type FactoryConstructor, 
  type FactoryInfo 
} from '../factory';

// Test resource types
interface TestResource {
  id: string;
  data: unknown;
  timestamp: number;
}

interface SimpleResource {
  value: string;
}

// Test configuration interfaces
interface TestConfig {
  type: string;
  id: string;
  data?: unknown;
}

interface SimpleConfig {
  type: string;
  value: string;
}

// Test implementations
class BasicTestFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'BasicTest';
  public readonly isDefault = false;
  public readonly priority = 5;

  public async create(config?: TestConfig): Promise<TestResource> {
    if (!config) {
      throw new Error('Configuration is required');
    }

    return {
      id: config.id,
      data: config.data ?? null,
      timestamp: Date.now(),
    };
  }
}

class DefaultTestFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'DefaultTest';
  public readonly isDefault = true;
  public readonly priority = 10;

  public async create(config?: TestConfig): Promise<TestResource> {
    return {
      id: config?.id ?? 'default-id',
      data: config?.data ?? 'default-data',
      timestamp: Date.now(),
    };
  }
}

class HighPriorityFactory extends AbstractResourceFactory<SimpleResource, SimpleConfig> {
  public readonly type = 'HighPriority';
  public readonly isDefault = true;
  public readonly priority = 100;

  public async create(config?: SimpleConfig): Promise<SimpleResource> {
    return {
      value: config?.value ?? 'high-priority-default',
    };
  }
}

class ConfigurableFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'Configurable';
  
  constructor(
    public readonly isDefault: boolean = false,
    public readonly priority: number = 0,
    private customData?: string
  ) {
    super();
  }

  public async create(config?: TestConfig): Promise<TestResource> {
    return {
      id: config?.id ?? 'configurable-id',
      data: {
        config: config?.data,
        custom: this.customData,
      },
      timestamp: Date.now(),
    };
  }
}

// Factory that implements ResourceFactory directly (not extending AbstractResourceFactory)
class DirectFactory implements ResourceFactory<SimpleResource, SimpleConfig> {
  public readonly type = 'Direct';
  public readonly isDefault = false;
  public readonly priority = 1;

  public async create(config?: SimpleConfig): Promise<SimpleResource> {
    return {
      value: `direct: ${config?.value ?? 'none'}`,
    };
  }
}

// Async factory with complex logic
class AsyncComplexFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'AsyncComplex';
  public readonly isDefault = false;
  public readonly priority = 0;

  public async create(config?: TestConfig): Promise<TestResource> {
    // Simulate async operations
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (config?.id === 'error') {
      throw new Error('Simulated factory error');
    }

    // Complex processing
    const processedData = await this.processData(config?.data);

    return {
      id: config?.id ?? 'async-id',
      data: processedData,
      timestamp: Date.now(),
    };
  }

  private async processData(data: unknown): Promise<unknown> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return {
      original: data,
      processed: true,
      timestamp: Date.now(),
    };
  }
}

describe('ResourceFactory Interface', () => {
  describe('AbstractResourceFactory', () => {
    it('should provide default property values', () => {
      const factory = new BasicTestFactory();

      expect(factory.type).toBe('BasicTest');
      expect(factory.isDefault).toBe(false);
      expect(factory.priority).toBe(5);
    });

    it('should create resources from configuration', async () => {
      const factory = new BasicTestFactory();
      const config: TestConfig = {
        type: 'BasicTest',
        id: 'test-123',
        data: { custom: 'value' },
      };

      const resource = await factory.create(config);

      expect(resource.id).toBe('test-123');
      expect(resource.data).toEqual({ custom: 'value' });
      expect(resource.timestamp).toBeGreaterThan(0);
    });

    it('should handle missing configuration appropriately', async () => {
      const factory = new BasicTestFactory();

      await expect(factory.create()).rejects.toThrow('Configuration is required');
    });

    it('should handle null configuration', async () => {
      const factory = new BasicTestFactory();

      await expect(factory.create(null as any)).rejects.toThrow('Configuration is required');
    });

    it('should provide defaults when marked as default factory', async () => {
      const factory = new DefaultTestFactory();

      const resource = await factory.create();

      expect(factory.isDefault).toBe(true);
      expect(resource.id).toBe('default-id');
      expect(resource.data).toBe('default-data');
    });

    it('should support configurable properties via constructor', () => {
      const factory1 = new ConfigurableFactory(true, 50, 'custom-data');
      const factory2 = new ConfigurableFactory(false, 25);

      expect(factory1.isDefault).toBe(true);
      expect(factory1.priority).toBe(50);
      expect(factory2.isDefault).toBe(false);
      expect(factory2.priority).toBe(25);
    });

    it('should pass custom data through to created resources', async () => {
      const factory = new ConfigurableFactory(false, 0, 'injected-data');
      const config: TestConfig = {
        type: 'Configurable',
        id: 'test-id',
        data: 'config-data',
      };

      const resource = await factory.create(config);

      expect(resource.id).toBe('test-id');
      expect((resource.data as any).config).toBe('config-data');
      expect((resource.data as any).custom).toBe('injected-data');
    });
  });

  describe('Direct ResourceFactory Implementation', () => {
    it('should work without extending AbstractResourceFactory', async () => {
      const factory = new DirectFactory();
      const config: SimpleConfig = {
        type: 'Direct',
        value: 'test-value',
      };

      expect(factory.type).toBe('Direct');
      expect(factory.isDefault).toBe(false);
      expect(factory.priority).toBe(1);

      const resource = await factory.create(config);
      expect(resource.value).toBe('direct: test-value');
    });

    it('should handle missing config gracefully', async () => {
      const factory = new DirectFactory();

      const resource = await factory.create();
      expect(resource.value).toBe('direct: none');
    });
  });

  describe('Async and Complex Operations', () => {
    let factory: AsyncComplexFactory;

    beforeEach(() => {
      factory = new AsyncComplexFactory();
    });

    it('should handle async creation properly', async () => {
      const config: TestConfig = {
        type: 'AsyncComplex',
        id: 'async-test',
        data: { input: 'data' },
      };

      const startTime = Date.now();
      const resource = await factory.create(config);
      const endTime = Date.now();

      expect(resource.id).toBe('async-test');
      expect((resource.data as any).original).toEqual({ input: 'data' });
      expect((resource.data as any).processed).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(10); // At least 15ms delay
    });

    it('should propagate errors from factory', async () => {
      const config: TestConfig = {
        type: 'AsyncComplex',
        id: 'error',
        data: 'some-data',
      };

      await expect(factory.create(config)).rejects.toThrow('Simulated factory error');
    });

    it('should work with default values in async context', async () => {
      const resource = await factory.create();

      expect(resource.id).toBe('async-id');
      expect((resource.data as any).original).toBeUndefined();
      expect((resource.data as any).processed).toBe(true);
    });
  });

  describe('Factory Constructor Type', () => {
    it('should properly type factory constructors', () => {
      const constructors: FactoryConstructor<TestResource, TestConfig>[] = [
        BasicTestFactory,
        DefaultTestFactory,
        AsyncComplexFactory,
      ];

      // This test ensures the type constraints work correctly
      expect(constructors).toHaveLength(3);
      
      // Create instances using the constructors
      const instances = constructors.map(Constructor => new Constructor());
      
      expect(instances[0]).toBeInstanceOf(BasicTestFactory);
      expect(instances[1]).toBeInstanceOf(DefaultTestFactory);
      expect(instances[2]).toBeInstanceOf(AsyncComplexFactory);
    });

    it('should support parameterized constructors', () => {
      // Use any to bypass strict typing for this test
      const ParameterizedConstructor = ConfigurableFactory as any;
      
      const instance1 = new ParameterizedConstructor();
      const instance2 = new ParameterizedConstructor(true, 99, 'test-data');

      expect(instance1.isDefault).toBe(false);
      expect(instance1.priority).toBe(0);
      
      expect(instance2.isDefault).toBe(true);
      expect(instance2.priority).toBe(99);
    });
  });

  describe('FactoryInfo Structure', () => {
    it('should properly structure factory information', () => {
      const factoryInfo: FactoryInfo<TestResource, TestConfig> = {
        type: 'TestFactory',
        constructor: BasicTestFactory,
        metadata: {
          isDefault: true,
          priority: 15,
          description: 'Test factory for unit tests',
          version: '1.0.0',
          author: 'Test Suite',
        },
      };

      expect(factoryInfo.type).toBe('TestFactory');
      expect(factoryInfo.constructor).toBe(BasicTestFactory);
      expect(factoryInfo.metadata?.isDefault).toBe(true);
      expect(factoryInfo.metadata?.priority).toBe(15);
      expect(factoryInfo.metadata?.description).toBe('Test factory for unit tests');
      expect(factoryInfo.metadata?.version).toBe('1.0.0');
      expect(factoryInfo.metadata?.author).toBe('Test Suite');
    });

    it('should support factory instances in info', () => {
      const factoryInstance = new DefaultTestFactory();
      const factoryInfo: FactoryInfo<TestResource, TestConfig> = {
        type: 'CachedFactory',
        constructor: DefaultTestFactory,
        instance: factoryInstance,
        metadata: {
          cached: true,
        },
      };

      expect(factoryInfo.instance).toBe(factoryInstance);
      expect(factoryInfo.instance?.type).toBe('DefaultTest');
      expect(factoryInfo.metadata?.cached).toBe(true);
    });

    it('should allow optional metadata', () => {
      const minimalInfo: FactoryInfo<TestResource, TestConfig> = {
        type: 'MinimalFactory',
        constructor: BasicTestFactory,
      };

      expect(minimalInfo.metadata).toBeUndefined();
      expect(minimalInfo.instance).toBeUndefined();
    });
  });

  describe('Priority and Default Behavior', () => {
    it('should correctly identify default factories', () => {
      const factories = [
        new BasicTestFactory(),        // not default
        new DefaultTestFactory(),      // default, priority 10
        new HighPriorityFactory(),     // default, priority 100
      ];

      const defaults = factories.filter(f => f.isDefault);
      expect(defaults).toHaveLength(2);
      expect(defaults[0].type).toBe('DefaultTest');
      expect(defaults[1].type).toBe('HighPriority');
    });

    it('should sort factories by priority', () => {
      const factories = [
        new BasicTestFactory(),        // priority 5
        new DefaultTestFactory(),      // priority 10
        new HighPriorityFactory(),     // priority 100
        new ConfigurableFactory(false, 1), // priority 1
      ];

      const sortedByPriority = factories.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      expect(sortedByPriority[0].type).toBe('HighPriority');      // 100
      expect(sortedByPriority[1].type).toBe('DefaultTest');       // 10
      expect(sortedByPriority[2].type).toBe('BasicTest');         // 5
      expect(sortedByPriority[3].type).toBe('Configurable');      // 1
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle factories that return null', async () => {
      class NullFactory extends AbstractResourceFactory<TestResource | null, TestConfig> {
        public readonly type = 'Null';
        
        public async create(): Promise<TestResource | null> {
          return null;
        }
      }

      const factory = new NullFactory();
      const result = await factory.create();

      expect(result).toBeNull();
    });

    it('should handle factories with complex generic types', async () => {
      interface ComplexResource<T> {
        data: T;
        metadata: {
          type: string;
          timestamp: number;
        };
      }

      class GenericFactory<T> extends AbstractResourceFactory<ComplexResource<T>, { type: string; value: T }> {
        public readonly type = 'Generic';

        public async create(config?: { type: string; value: T }): Promise<ComplexResource<T>> {
          return {
            data: config?.value as T,
            metadata: {
              type: config?.type ?? this.type,
              timestamp: Date.now(),
            },
          };
        }
      }

      const stringFactory = new GenericFactory<string>();
      const numberFactory = new GenericFactory<number>();

      const stringResult = await stringFactory.create({ type: 'string', value: 'test' });
      const numberResult = await numberFactory.create({ type: 'number', value: 42 });

      expect(stringResult.data).toBe('test');
      expect(numberResult.data).toBe(42);
      expect(stringResult.metadata.type).toBe('string');
      expect(numberResult.metadata.type).toBe('number');
    });

    it('should handle undefined and empty configurations', async () => {
      const factory = new DefaultTestFactory();

      // Test various falsy values
      const undefinedResult = await factory.create(undefined);
      const nullResult = await factory.create(null as any);
      const emptyResult = await factory.create({} as TestConfig);

      expect(undefinedResult.id).toBe('default-id');
      expect(nullResult.id).toBe('default-id');
      expect(emptyResult.id).toBe('default-id'); // Uses defaults when properties missing
    });
  });
});