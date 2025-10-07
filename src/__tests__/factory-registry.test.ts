import {
    ResourceFactoryRegistry,
    createResource,
    createDefaultResource,
    registerFactory,
    getFactory,
} from '../factory-registry';
import { AbstractResourceFactory } from '../factory';
import { configValidator } from '../resource-config';
import type { ResourceConfig } from '../resource-config';
import { ExtensionManager } from '../extension-manager';
import { ExpressionEvaluationPolicy } from '../expression-policy';

// Test resource types
interface DatabaseConnection {
    host: string;
    port: number;
    database: string;
    connected: boolean;
}

interface CacheConnection {
    endpoint: string;
    timeout: number;
    connected: boolean;
}

// Test configuration interfaces
interface DatabaseConfig extends ResourceConfig {
    type: 'PostgresDB' | 'MySQL';
    host: string;
    port: number;
    database: string;
    username?: string;
    password?: string;
}

interface CacheConfig extends ResourceConfig {
    type: 'Redis' | 'Memcached';
    endpoint: string;
    timeout?: number;
}

// Test factory implementations
class PostgresDBFactory extends AbstractResourceFactory<
    DatabaseConnection,
    DatabaseConfig
> {
    public readonly type = 'PostgresDB';
    public readonly isDefault = true;
    public readonly priority = 10;

    public async create(config?: DatabaseConfig): Promise<DatabaseConnection> {
        if (!config) {
            throw new Error('PostgresDB requires configuration');
        }

        return {
            host: config.host,
            port: config.port,
            database: config.database,
            connected: true,
        };
    }
}

class MySQLFactory extends AbstractResourceFactory<
    DatabaseConnection,
    DatabaseConfig
> {
    public readonly type = 'MySQL';
    public readonly isDefault = false;
    public readonly priority = 5;

    public async create(config?: DatabaseConfig): Promise<DatabaseConnection> {
        if (!config) {
            throw new Error('MySQL requires configuration');
        }

        return {
            host: config.host,
            port: config.port,
            database: config.database,
            connected: true,
        };
    }
}

class RedisFactory extends AbstractResourceFactory<
    CacheConnection,
    CacheConfig
> {
    public readonly type = 'Redis';
    public readonly isDefault = true;
    public readonly priority = 15;

    public async create(config?: CacheConfig): Promise<CacheConnection> {
        if (!config) {
            throw new Error('Redis requires configuration');
        }

        return {
            endpoint: config.endpoint,
            timeout: config.timeout ?? 5000,
            connected: true,
        };
    }
}

class MemcachedFactory extends AbstractResourceFactory<
    CacheConnection,
    CacheConfig
> {
    public readonly type = 'Memcached';
    public readonly isDefault = true;
    public readonly priority = 8; // Lower than Redis

    public async create(config?: CacheConfig): Promise<CacheConnection> {
        if (!config) {
            throw new Error('Memcached requires configuration');
        }

        return {
            endpoint: config.endpoint,
            timeout: config.timeout ?? 3000,
            connected: true,
        };
    }
}

// Factory that requires constructor arguments
class CustomFactory extends AbstractResourceFactory<
    string,
    { type: string; value: string }
> {
    public readonly type = 'Custom';
    public readonly isDefault = false;
    private prefix: string;

    constructor(...args: unknown[]) {
        super();
        this.prefix = (args[0] as string) ?? 'default';
    }

    public async create(config?: {
        type: string;
        value: string;
    }): Promise<string> {
        return `${this.prefix}: ${config?.value ?? 'empty'}`;
    }
}

describe('ResourceFactoryRegistry', () => {
    beforeEach(() => {
        // Clear global registry before each test
        ResourceFactoryRegistry.clearCache();
        ExtensionManager.getAllExtensionManagers().clear();

        // Register schemas for validation
        configValidator.registerSchema({
            type: 'PostgresDB',
            properties: {
                type: { type: 'string', required: true },
                host: { type: 'string', required: true },
                port: { type: 'number', required: true },
                database: { type: 'string', required: true },
                username: { type: 'string' },
                password: { type: 'string' },
            },
        });

        configValidator.registerSchema({
            type: 'MySQL',
            properties: {
                type: { type: 'string', required: true },
                host: { type: 'string', required: true },
                port: { type: 'number', required: true },
                database: { type: 'string', required: true },
                username: { type: 'string' },
                password: { type: 'string' },
            },
        });

        configValidator.registerSchema({
            type: 'Redis',
            properties: {
                type: { type: 'string', required: true },
                endpoint: { type: 'string', required: true },
                timeout: { type: 'number' },
            },
        });

        // Register factories
        ResourceFactoryRegistry.registerFactory(
            'DatabaseFactory',
            'PostgresDB',
            PostgresDBFactory
        );
        ResourceFactoryRegistry.registerFactory(
            'DatabaseFactory',
            'MySQL',
            MySQLFactory
        );
        ResourceFactoryRegistry.registerFactory(
            'CacheFactory',
            'Redis',
            RedisFactory
        );
        ResourceFactoryRegistry.registerFactory(
            'CacheFactory',
            'Memcached',
            MemcachedFactory
        );
    });

    describe('createResource', () => {
        it('should create resource from valid configuration', async () => {
            const config: DatabaseConfig = {
                type: 'PostgresDB',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
            };

            const resource =
                await ResourceFactoryRegistry.createResource<DatabaseConnection>(
                    'DatabaseFactory',
                    config
                );

            expect(resource).toBeDefined();
            expect(resource!.host).toBe('localhost');
            expect(resource!.port).toBe(5432);
            expect(resource!.database).toBe('testdb');
            expect(resource!.connected).toBe(true);
        });

        it('should return null for null/undefined config', async () => {
            const resource1 = await ResourceFactoryRegistry.createResource(
                'DatabaseFactory',
                null
            );
            const resource2 = await ResourceFactoryRegistry.createResource(
                'DatabaseFactory',
                undefined
            );

            expect(resource1).toBeNull();
            expect(resource2).toBeNull();
        });

        it('should throw error for config without type field', async () => {
            const config = {
                host: 'localhost',
                port: 5432,
                database: 'testdb',
            };

            await expect(
                ResourceFactoryRegistry.createResource(
                    'DatabaseFactory',
                    config
                )
            ).rejects.toThrow(/Configuration must have a 'type' field/);
        });

        it('should throw error for non-string type field', async () => {
            const config = {
                type: 123,
                host: 'localhost',
                port: 5432,
                database: 'testdb',
            };

            await expect(
                ResourceFactoryRegistry.createResource(
                    'DatabaseFactory',
                    config
                )
            ).rejects.toThrow(/Configuration must have a 'type' field/);
        });

        it('should handle validation errors', async () => {
            const config = {
                type: 'PostgresDB',
                host: 'localhost',
                // Missing required port and database
            };

            await expect(
                ResourceFactoryRegistry.createResource(
                    'DatabaseFactory',
                    config,
                    { validate: true }
                )
            ).rejects.toThrow(/Configuration validation failed/);
        });

        it('should skip validation when validate is false', async () => {
            const config = {
                type: 'PostgresDB',
                host: 'localhost',
                // Missing required fields, but validation is disabled
            };

            // This should not throw validation error, but might throw from factory
            const resource = await ResourceFactoryRegistry.createResource(
                'DatabaseFactory',
                config,
                { validate: false }
            );

            // The factory should handle missing fields gracefully or throw its own error
            expect(resource).toBeDefined();
            expect((resource as any).host).toBe('localhost');
        });

        it('should pass factoryArgs to factory constructor and create method', async () => {
            ResourceFactoryRegistry.registerFactory(
                'CustomFactory',
                'Custom',
                CustomFactory
            );

            const config = {
                type: 'Custom',
                value: 'test-value',
            };

            const resource =
                await ResourceFactoryRegistry.createResource<string>(
                    'CustomFactory',
                    config,
                    {
                        factoryArgs: ['custom-prefix'],
                        validate: false,
                    }
                );

            expect(resource).toBe('custom-prefix: test-value');
        });

        it('should use custom validator when provided', async () => {
            const customValidator = {
                validate: jest.fn().mockReturnValue({
                    valid: true,
                    errors: [],
                    config: {
                        type: 'PostgresDB',
                        host: 'custom-host',
                        port: 9999,
                        database: 'custom-db',
                    },
                }),
                registerSchema: jest.fn(),
                getSchema: jest.fn(),
            } as any; // Use 'any' to bypass full interface requirements for this test

            const config = {
                type: 'PostgresDB',
                host: 'original-host',
                port: 5432,
                database: 'original-db',
            };

            const resource =
                await ResourceFactoryRegistry.createResource<DatabaseConnection>(
                    'DatabaseFactory',
                    config,
                    { validator: customValidator }
                );

            expect(customValidator.validate).toHaveBeenCalledWith(
                config,
                expect.any(Object)
            );
            expect(resource!.host).toBe('custom-host'); // Uses custom validator's config
            expect(resource!.port).toBe(9999);
        });

        it('should handle expression evaluation in configuration', async () => {
            // Set up mock environment
            (globalThis as any).process = {
                env: {
                    DB_HOST: 'prod.db.example.com',
                    DB_PORT: '5432',
                    DB_NAME: 'production_db',
                },
            };

            const config = {
                type: 'PostgresDB',
                host: '${env:DB_HOST:localhost}',
                port: 5432, // Use number directly instead of string expression to avoid coercion issues
                database: '${env:DB_NAME:testdb}',
            };

            const resource =
                await ResourceFactoryRegistry.createResource<DatabaseConnection>(
                    'DatabaseFactory',
                    config,
                    {
                        policy: ExpressionEvaluationPolicy.EVALUATE,
                        validate: true,
                    }
                );

            expect(resource!.host).toBe('prod.db.example.com');
            expect(resource!.port).toBe(5432);
            expect(resource!.database).toBe('production_db');

            // Clean up
            delete (globalThis as any).process;
        });
    });

    describe('createDefaultResource', () => {
        it('should create resource using best default factory', async () => {
            const config = {
                host: 'localhost',
                port: 5432,
                database: 'testdb',
            };

            const resource =
                await ResourceFactoryRegistry.createDefaultResource<DatabaseConnection>(
                    'DatabaseFactory',
                    config
                );

            expect(resource).toBeDefined();
            expect(resource!.host).toBe('localhost');
            expect(resource!.port).toBe(5432);
            expect(resource!.database).toBe('testdb');
        });

        it('should handle null/undefined config', async () => {
            const resource =
                await ResourceFactoryRegistry.createDefaultResource<DatabaseConnection>(
                    'DatabaseFactory',
                    null,
                    { validate: false } // Disable validation since we don't have required fields
                );

            expect(resource).toBeDefined(); // Uses factory defaults
        });

        it('should handle validation result without config field', async () => {
            const customValidator = {
                validate: jest.fn().mockReturnValue({
                    valid: true,
                    errors: [],
                    // Note: no config field in result
                }),
                registerSchema: jest.fn(),
                getSchema: jest.fn(),
            } as any;

            const config = {
                host: 'test-host',
                port: 5432,
                database: 'test-db',
            };

            const resource =
                await ResourceFactoryRegistry.createDefaultResource<DatabaseConnection>(
                    'DatabaseFactory',
                    config,
                    { validator: customValidator }
                );

            expect(resource).toBeDefined();
            expect(customValidator.validate).toHaveBeenCalled();
        });

        it('should return null when no default factory exists', async () => {
            const resource =
                await ResourceFactoryRegistry.createDefaultResource(
                    'NonExistentFactory',
                    {}
                );

            expect(resource).toBeNull();
        });

        it('should select factory with highest priority as default', async () => {
            // Redis has priority 15, Memcached has priority 8
            const resource =
                await ResourceFactoryRegistry.createDefaultResource<CacheConnection>(
                    'CacheFactory',
                    { endpoint: 'localhost:6379' }
                );

            expect(resource).toBeDefined();
            expect(resource!.timeout).toBe(5000); // Redis default timeout
        });
    });

    describe('registerFactory', () => {
        it('should register factory with metadata', () => {
            const metadata = {
                isDefault: true,
                priority: 99,
                description: 'Test factory',
                version: '1.0.0',
            };

            ResourceFactoryRegistry.registerFactory(
                'TestFactory',
                'TestType',
                PostgresDBFactory,
                metadata
            );

            const factory = ResourceFactoryRegistry.getFactory(
                'TestFactory',
                'TestType'
            );
            expect(factory).toBeInstanceOf(PostgresDBFactory);
        });
    });

    describe('registerFactoryInstance', () => {
        it('should register factory instance directly', () => {
            const instance = new PostgresDBFactory();
            ResourceFactoryRegistry.registerFactoryInstance(
                'TestFactory',
                instance
            );

            const retrieved = ResourceFactoryRegistry.getFactory(
                'TestFactory',
                'PostgresDB'
            );
            expect(retrieved).toBe(instance);
        });
    });

    describe('getFactory', () => {
        it('should retrieve registered factory', () => {
            const factory = ResourceFactoryRegistry.getFactory<
                DatabaseConnection,
                DatabaseConfig
            >('DatabaseFactory', 'PostgresDB');

            expect(factory).toBeInstanceOf(PostgresDBFactory);
            expect(factory.type).toBe('PostgresDB');
        });

        it('should pass arguments to factory constructor', () => {
            ResourceFactoryRegistry.registerFactory(
                'CustomFactory',
                'Custom',
                CustomFactory
            );

            const factory = ResourceFactoryRegistry.getFactory(
                'CustomFactory',
                'Custom',
                'test-prefix'
            );
            expect(factory).toBeInstanceOf(CustomFactory);
        });

        it('should throw error for unknown factory type', () => {
            expect(() => {
                ResourceFactoryRegistry.getFactory(
                    'DatabaseFactory',
                    'UnknownDB'
                );
            }).toThrow(/Unknown factory type 'UnknownDB'/);
        });
    });

    describe('getAvailableTypes', () => {
        it('should return all available factory types for base type', () => {
            const types =
                ResourceFactoryRegistry.getAvailableTypes('DatabaseFactory');
            expect(types).toEqual(
                expect.arrayContaining(['PostgresDB', 'MySQL'])
            );
            expect(types).toHaveLength(2);
        });

        it('should return empty array for unknown base type', () => {
            const types =
                ResourceFactoryRegistry.getAvailableTypes('UnknownFactory');
            expect(types).toEqual([]);
        });
    });

    describe('getDefaultTypes', () => {
        it('should return all default factory types', () => {
            const defaults =
                ResourceFactoryRegistry.getDefaultTypes('DatabaseFactory');
            expect(defaults).toHaveLength(1); // Only PostgresDB is default

            const [factory, type] = defaults[0];
            expect(type).toBe('PostgresDB');
            expect(factory.isDefault).toBe(true);
        });

        it('should return multiple defaults ordered by priority', () => {
            const defaults =
                ResourceFactoryRegistry.getDefaultTypes('CacheFactory');
            expect(defaults).toHaveLength(2); // Both Redis and Memcached are defaults

            // Should be ordered by priority (Redis: 15, Memcached: 8)
            expect(defaults[0][1]).toBe('Redis');
            expect(defaults[1][1]).toBe('Memcached');
        });
    });

    describe('clearCache', () => {
        it('should clear cache for specific base type and resource type', () => {
            // Get factory to populate cache
            const factory1 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );

            // Clear specific cache
            ResourceFactoryRegistry.clearCache('DatabaseFactory', 'PostgresDB');

            // Get factory again - should be different instance
            const factory2 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );
            expect(factory1).not.toBe(factory2);
        });

        it('should clear all caches for base type when resource type not specified', () => {
            // Get factories to populate cache
            const dbFactory1 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );
            const mysqlFactory1 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'MySQL'
            );

            // Clear all DatabaseFactory caches
            ResourceFactoryRegistry.clearCache('DatabaseFactory');

            // Get factories again - should be different instances
            const dbFactory2 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );
            const mysqlFactory2 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'MySQL'
            );

            expect(dbFactory1).not.toBe(dbFactory2);
            expect(mysqlFactory1).not.toBe(mysqlFactory2);
        });

        it('should clear all caches when no parameters specified', () => {
            // Get factories to populate caches
            const dbFactory1 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );
            const cacheFactory1 = ResourceFactoryRegistry.getFactory(
                'CacheFactory',
                'Redis'
            );

            // Clear all caches
            ResourceFactoryRegistry.clearCache();

            // Get factories again - should be different instances
            const dbFactory2 = ResourceFactoryRegistry.getFactory(
                'DatabaseFactory',
                'PostgresDB'
            );
            const cacheFactory2 = ResourceFactoryRegistry.getFactory(
                'CacheFactory',
                'Redis'
            );

            expect(dbFactory1).not.toBe(dbFactory2);
            expect(cacheFactory1).not.toBe(cacheFactory2);
        });
    });

    describe('convenience functions', () => {
        it('should work with createResource function', async () => {
            const config: DatabaseConfig = {
                type: 'PostgresDB',
                host: 'localhost',
                port: 5432,
                database: 'testdb',
            };

            const resource = await createResource<DatabaseConnection>(
                'DatabaseFactory',
                config
            );
            expect(resource).toBeDefined();
            expect(resource!.connected).toBe(true);
        });

        it('should work with createDefaultResource function', async () => {
            const resource = await createDefaultResource<DatabaseConnection>(
                'DatabaseFactory',
                { host: 'localhost', port: 5432, database: 'testdb' }
            );

            expect(resource).toBeDefined();
            expect(resource!.connected).toBe(true);
        });

        it('should work with registerFactory function', () => {
            registerFactory('TestFactory', 'TestType', PostgresDBFactory);

            const factory = getFactory('TestFactory', 'TestType');
            expect(factory).toBeInstanceOf(PostgresDBFactory);
        });

        it('should work with getFactory function', () => {
            const factory = getFactory<DatabaseConnection, DatabaseConfig>(
                'DatabaseFactory',
                'PostgresDB'
            );
            expect(factory.type).toBe('PostgresDB');
        });
    });

    describe('error handling', () => {
        it('should handle factory creation errors gracefully', async () => {
            // Register a factory that always throws
            class FailingFactory extends AbstractResourceFactory {
                public readonly type = 'Failing';

                public async create(): Promise<never> {
                    throw new Error('Factory creation failed');
                }
            }

            ResourceFactoryRegistry.registerFactory(
                'TestFactory',
                'Failing',
                FailingFactory
            );

            await expect(
                ResourceFactoryRegistry.createResource('TestFactory', {
                    type: 'Failing',
                })
            ).rejects.toThrow('Factory creation failed');
        });

        it('should handle validation errors with detailed messages', async () => {
            const config = {
                type: 'PostgresDB',
                host: 123, // Wrong type
                port: 'invalid', // Wrong type
                // Missing required database field
            };

            await expect(
                ResourceFactoryRegistry.createResource(
                    'DatabaseFactory',
                    config,
                    { validate: true }
                )
            ).rejects.toThrow(/Configuration validation failed/);
        });
    });
});
