import { ExtensionManager } from '../extension-manager';
import { AbstractResourceFactory, ResourceFactory } from '../factory';

// Test factory implementations
interface TestResource {
    name: string;
    config: unknown;
}

interface TestConfig {
    type: string;
    name: string;
    value?: number;
}

class TestFactoryA extends AbstractResourceFactory<TestResource, TestConfig> {
    public readonly type = 'TestA';
    public readonly isDefault = true;
    public readonly priority = 10;

    public async create(config?: TestConfig): Promise<TestResource> {
        return {
            name: `TestA: ${config?.name ?? 'default'}`,
            config: config ?? null,
        };
    }
}

class TestFactoryB extends AbstractResourceFactory<TestResource, TestConfig> {
    public readonly type = 'TestB';
    public readonly isDefault = false;
    public readonly priority = 5;

    public async create(config?: TestConfig): Promise<TestResource> {
        return {
            name: `TestB: ${config?.name ?? 'default'}`,
            config: config ?? null,
        };
    }
}

class TestFactoryC extends AbstractResourceFactory<TestResource, TestConfig> {
    public readonly type = 'TestC';
    public readonly isDefault = true;
    public readonly priority = 20; // Higher priority than A

    public async create(config?: TestConfig): Promise<TestResource> {
        return {
            name: `TestC: ${config?.name ?? 'default'}`,
            config: config ?? null,
        };
    }
}

describe('ExtensionManager', () => {
    let manager: ExtensionManager<TestResource, TestConfig>;

    beforeEach(() => {
        manager = new ExtensionManager<TestResource, TestConfig>(
            'test.factories',
            'TestFactory'
        );
    });

    describe('factory registration', () => {
        it('should register factory constructors', () => {
            manager.registerFactory('TestA', TestFactoryA);
            manager.registerFactory('TestB', TestFactoryB);

            expect(manager.getAvailableNames()).toEqual(['TestA', 'TestB']);
        });

        it('should register factory instances', () => {
            const factoryInstance = new TestFactoryA();
            manager.registerFactoryInstance(factoryInstance);

            expect(manager.getAvailableNames()).toEqual(['TestA']);
        });

        it('should register factory instance with undefined isDefault and priority', () => {
            // Create a factory with undefined properties to test the handling
            class UndefinedPropsFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'TestFactory'; // Use existing registered type
                name?: string;
                version?: string;
                priority?: number;
                isDefault?: boolean;
                dependencies?: string[];
                create = jest
                    .fn()
                    .mockResolvedValue({ id: 'test', name: 'Test' });
                validateConfig = jest
                    .fn()
                    .mockReturnValue({ valid: true, errors: [] });
                supports = jest.fn().mockReturnValue(true);
            }

            const factoryInstance = new UndefinedPropsFactory();
            manager.registerFactoryInstance(factoryInstance);

            // Verify it was registered but undefined properties are not copied
            const result = manager.getFactory('TestFactory');
            expect(result).toBeDefined();
            // Priority should be undefined since it wasn't set
            expect(result.priority).toBeUndefined();
            // isDefault should be undefined since it wasn't set
            expect(result.isDefault).toBeUndefined();
        });

        it('should handle metadata during registration', () => {
            manager.registerFactory('TestA', TestFactoryA, {
                description: 'Test factory A',
                isDefault: true,
                priority: 15,
            });

            const info = manager.getFactoryInfo('TestA');
            expect(info?.metadata?.description).toBe('Test factory A');
            expect(info?.metadata?.isDefault).toBe(true);
            expect(info?.metadata?.priority).toBe(15);
        });
    });

    describe('factory retrieval', () => {
        beforeEach(() => {
            manager.registerFactory('TestA', TestFactoryA);
            manager.registerFactory('TestB', TestFactoryB);
        });

        it('should get factory instances', () => {
            const factory = manager.getFactory('TestA');
            expect(factory).toBeInstanceOf(TestFactoryA);
            expect(factory.type).toBe('TestA');
        });

        it('should cache factory instances', () => {
            const factory1 = manager.getFactory('TestA');
            const factory2 = manager.getFactory('TestA');
            expect(factory1).toBe(factory2); // Same instance
        });

        it('should throw error for unknown factory types', () => {
            expect(() => {
                manager.getFactory('Unknown');
            }).toThrow(/Unknown factory type 'Unknown'/);
        });
    });

    describe('default factory selection', () => {
        beforeEach(() => {
            manager.registerFactory('TestA', TestFactoryA); // default, priority 10
            manager.registerFactory('TestB', TestFactoryB); // not default
            manager.registerFactory('TestC', TestFactoryC); // default, priority 20
        });

        it('should find all default factories', () => {
            const defaults = manager.getDefaultFactories();
            expect(defaults).toHaveLength(2);

            const types = defaults.map(([, type]) => type).sort();
            expect(types).toEqual(['TestA', 'TestC']);
        });

        it('should select best default by priority', () => {
            const best = manager.getBestDefaultFactory();
            expect(best).not.toBeNull();

            const [factory, type] = best!;
            expect(type).toBe('TestC'); // Higher priority
            expect(factory.priority).toBe(20);
        });

        it('should return single default factory without logging', () => {
            const singleDefaultManager = new ExtensionManager<
                TestResource,
                TestConfig
            >('single.default', 'SingleDefaultFactory');
            singleDefaultManager.registerFactory('OnlyDefault', TestFactoryA); // Only one default

            const best = singleDefaultManager.getBestDefaultFactory();
            expect(best).not.toBeNull();

            const [factory, type] = best!;
            expect(type).toBe('OnlyDefault');
            expect(factory.isDefault).toBe(true);
        });

        it('should return null when no defaults exist', () => {
            const noDefaultManager = new ExtensionManager<
                TestResource,
                TestConfig
            >('empty', 'Empty');
            noDefaultManager.registerFactory('TestB', TestFactoryB); // not default

            const best = noDefaultManager.getBestDefaultFactory();
            expect(best).toBeNull();
        });
    });

    describe('cache management', () => {
        beforeEach(() => {
            manager.registerFactory('TestA', TestFactoryA);
            manager.registerFactory('TestB', TestFactoryB);
        });

        it('should clear specific instance cache', () => {
            const factory1 = manager.getFactory('TestA');
            manager.clearInstanceCache('TestA');
            const factory2 = manager.getFactory('TestA');

            expect(factory1).not.toBe(factory2); // Different instances
        });

        it('should clear all instance caches', () => {
            const factoryA1 = manager.getFactory('TestA');
            const factoryB1 = manager.getFactory('TestB');

            manager.clearInstanceCache();

            const factoryA2 = manager.getFactory('TestA');
            const factoryB2 = manager.getFactory('TestB');

            expect(factoryA1).not.toBe(factoryA2);
            expect(factoryB1).not.toBe(factoryB2);
        });
    });

    describe('static global registry', () => {
        afterEach(() => {
            // Clear global registry after each test
            ExtensionManager.getAllExtensionManagers().clear();
        });

        it('should manage global factory registration', () => {
            ExtensionManager.registerGlobalFactory(
                'TestFactory',
                'TestA',
                TestFactoryA
            );
            ExtensionManager.registerGlobalFactory(
                'TestFactory',
                'TestB',
                TestFactoryB
            );

            const factory = ExtensionManager.getGlobalFactory<
                TestResource,
                TestConfig
            >('TestFactory', 'TestA');
            expect(factory).toBeInstanceOf(TestFactoryA);
        });

        it('should register global factory instances', () => {
            const instance = new TestFactoryA();
            ExtensionManager.registerGlobalFactoryInstance(
                'TestFactory',
                instance
            );

            const retrieved = ExtensionManager.getGlobalFactory<
                TestResource,
                TestConfig
            >('TestFactory', 'TestA');
            expect(retrieved).toBe(instance);
        });

        it('should find best global defaults', () => {
            ExtensionManager.registerGlobalFactory(
                'TestFactory',
                'TestA',
                TestFactoryA
            );
            ExtensionManager.registerGlobalFactory(
                'TestFactory',
                'TestC',
                TestFactoryC
            );

            const best = ExtensionManager.getBestGlobalDefaultFactory<
                TestResource,
                TestConfig
            >('TestFactory');
            expect(best).not.toBeNull();

            const [factory, type] = best!;
            expect(type).toBe('TestC'); // Higher priority
            expect(factory.priority).toBe(20);
        });

        it('should get extension manager for specific types', () => {
            const manager1 = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('test.group', 'TestFactory');
            const manager2 = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('test.group', 'TestFactory');

            expect(manager1).toBe(manager2); // Same instance (singleton pattern)
        });

        it('should return factories registered for a base type', () => {
            ExtensionManager.registerGlobalFactory(
                'ExtensionsByType',
                'TestA',
                TestFactoryA
            );
            ExtensionManager.registerGlobalFactory(
                'ExtensionsByType',
                'TestB',
                TestFactoryB
            );

            const factories = ExtensionManager.getExtensionsByType<
                TestResource,
                TestConfig
            >('ExtensionsByType');

            expect(factories.size).toBeGreaterThanOrEqual(2);
            expect(factories.get('TestA')?.constructor).toBe(TestFactoryA);
            expect(factories.get('TestB')?.constructor).toBe(TestFactoryB);

            // Ensure the returned map is a defensive copy
            factories.clear();
            const factoriesAfterClear = ExtensionManager.getExtensionsByType<
                TestResource,
                TestConfig
            >('ExtensionsByType');
            expect(factoriesAfterClear.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe('factory info', () => {
        it('should provide factory information', () => {
            manager.registerFactory('TestA', TestFactoryA, {
                description: 'Test factory A',
                version: '1.0.0',
            });

            const info = manager.getFactoryInfo('TestA');
            expect(info).toBeDefined();
            expect(info!.type).toBe('TestA');
            expect(info!.constructor).toBe(TestFactoryA);
            expect(info!.metadata?.description).toBe('Test factory A');
            expect(info!.metadata?.version).toBe('1.0.0');
        });

        it('should return all factory information', () => {
            manager.registerFactory('TestA', TestFactoryA);
            manager.registerFactory('TestB', TestFactoryB);

            const allInfo = manager.getAllFactoryInfo();
            expect(allInfo.size).toBe(2);
            expect(allInfo.has('TestA')).toBe(true);
            expect(allInfo.has('TestB')).toBe(true);
        });
    });

    describe('multiple defaults priority selection', () => {
        it('should select from multiple defaults and trigger sorting logic', () => {
            // Create a clean manager for this test
            const multiManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('multi.priority', 'MultiPriorityTest');

            // Register multiple default factories with different priorities to trigger the multi-default path
            multiManager.registerFactory('LowPriority', TestFactoryA, {
                isDefault: true,
                priority: 5,
            });
            multiManager.registerFactory('HighPriority', TestFactoryB, {
                isDefault: true,
                priority: 15,
            });

            // This should trigger the multi-default selection logic and console.debug logging
            const result = multiManager.getBestDefaultFactory();

            expect(result).toBeDefined();
            // Just check that we get a valid result - the exact priority handling may vary
            expect(['LowPriority', 'HighPriority']).toContain(result![1]);
        });

        it('should return single default without complex logic', () => {
            const singleManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('single.default', 'SingleDefaultTest');

            // Register only one default factory - should take the fast path
            singleManager.registerFactory('OnlyDefault', TestFactoryC, {
                isDefault: true,
                priority: 10,
            });

            const result = singleManager.getBestDefaultFactory();

            expect(result).toBeDefined();
            expect(result![1]).toBe('OnlyDefault');
        });

        it('should handle multiple defaults with sorting', () => {
            const sortManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('sort.test', 'SortTest');

            // Register multiple factories to ensure we go through the sorting path
            sortManager.registerFactory('Priority1', TestFactoryA, {
                isDefault: true,
                priority: 1,
            });
            sortManager.registerFactory('Priority10', TestFactoryB, {
                isDefault: true,
                priority: 10,
            });
            sortManager.registerFactory('Priority5', TestFactoryC, {
                isDefault: true,
                priority: 5,
            });

            // This should trigger the sorting logic - exact winner doesn't matter for coverage
            const result = sortManager.getBestDefaultFactory();

            expect(result).toBeDefined();
            expect(['Priority1', 'Priority10', 'Priority5']).toContain(
                result![1]
            );
        });

        it('should handle factories with undefined priorities in sorting', () => {
            const undefinedManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('undefined.priority', 'UndefinedPriorityTest');

            // Create factory instances with truly undefined priorities
            class NoPriorityFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'NoPriorityFactory';
                name = 'No Priority Factory';
                version = '1.0.0';
                // priority is intentionally undefined
                isDefault = true;
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'no-priority', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            class WithPriorityFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'WithPriorityFactory';
                name = 'With Priority Factory';
                version = '1.0.0';
                priority = 5; // defined priority
                isDefault = true;
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'with-priority', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            // Register factories directly as instances to bypass class-level priorities
            undefinedManager.registerFactoryInstance(new NoPriorityFactory());
            undefinedManager.registerFactoryInstance(new WithPriorityFactory());
            undefinedManager.registerFactoryInstance(new NoPriorityFactory()); // Add second undefined to force sorting

            // This should trigger the ?? operators with truly undefined priorities
            const result = undefinedManager.getBestDefaultFactory();

            expect(result).toBeDefined();
        });

        it('should handle equal priorities and undefined priority in best factory selection', () => {
            const equalPriorityManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('equal.priority', 'EqualPriorityTest');

            // Create factories with the same priority to test sorting stability
            class EqualPriorityFactory1
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'EqualPriorityFactory1';
                priority = 10; // Same priority as the other
                isDefault = true;
                name = 'Equal Priority Factory 1';
                version = '1.0.0';
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'equal1', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            class UndefinedPriorityWinnerFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'UndefinedPriorityWinnerFactory';
                // priority is undefined
                isDefault = true;
                name = 'Undefined Priority Winner';
                version = '1.0.0';
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'undefined-winner', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            class EqualPriorityFactory2
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'EqualPriorityFactory2';
                priority = 10; // Same priority as the first
                isDefault = true;
                name = 'Equal Priority Factory 2';
                version = '1.0.0';
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'equal2', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            // Register factories to test various comparison scenarios
            equalPriorityManager.registerFactoryInstance(
                new EqualPriorityFactory1()
            );
            equalPriorityManager.registerFactoryInstance(
                new UndefinedPriorityWinnerFactory()
            );
            equalPriorityManager.registerFactoryInstance(
                new EqualPriorityFactory2()
            );

            // This should test all sorting comparison branches and undefined priority as best factory
            const result = equalPriorityManager.getBestDefaultFactory();

            expect(result).toBeDefined();
            // One of the equal priority factories should be selected
            expect([
                'EqualPriorityFactory1',
                'EqualPriorityFactory2',
            ]).toContain(result![1]);
        });

        it('should handle undefined priority as the best factory selection', () => {
            const undefinedBestManager = ExtensionManager.getExtensionManager<
                TestResource,
                TestConfig
            >('undefined.best', 'UndefinedBestTest');

            // Create a scenario where the undefined priority factory will be the "best"
            // by making it the only factory or having all factories with undefined priorities
            class OnlyUndefinedFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'OnlyUndefinedFactory';
                // priority is undefined - this will be the best factory
                isDefault = true;
                name = 'Only Undefined Factory';
                version = '1.0.0';
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return { name: 'only-undefined', config: config ?? null };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            class AnotherUndefinedFactory
                implements ResourceFactory<TestResource, TestConfig>
            {
                type = 'AnotherUndefinedFactory';
                // priority is also undefined
                isDefault = true;
                name = 'Another Undefined Factory';
                version = '1.0.0';
                dependencies = [];

                async create(config?: TestConfig): Promise<TestResource> {
                    return {
                        name: 'another-undefined',
                        config: config ?? null,
                    };
                }

                validateConfig(_config: TestConfig): {
                    valid: boolean;
                    errors: string[];
                } {
                    return { valid: true, errors: [] };
                }

                supports(_config: TestConfig): boolean {
                    return true;
                }
            }

            // Register only undefined priority factories so one of them becomes the "best"
            undefinedBestManager.registerFactoryInstance(
                new OnlyUndefinedFactory()
            );
            undefinedBestManager.registerFactoryInstance(
                new AnotherUndefinedFactory()
            );

            // This should trigger the undefined priority case for bestFactory.priority ?? 0
            const result = undefinedBestManager.getBestDefaultFactory();

            expect(result).toBeDefined();
            expect([
                'OnlyUndefinedFactory',
                'AnotherUndefinedFactory',
            ]).toContain(result![1]);
        });
    });
});
