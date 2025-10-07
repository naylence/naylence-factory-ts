/**
 * Generic factory interface for creating resources from configuration.
 *
 * @template T The type of resource this factory creates
 * @template C The configuration type used to create the resource
 */
export interface ResourceFactory<T = unknown, C = unknown> {
    /** The type identifier for this factory */
    readonly type: string;

    /** Whether this factory should be considered a default implementation */
    readonly isDefault?: boolean;

    /** Priority for default selection (higher values win) */
    readonly priority?: number;

    /**
     * Create a resource instance from the provided configuration.
     *
     * @param config The configuration object or null/undefined
     * @param kwargs Additional options
     * @returns Promise resolving to the created resource
     */
    create(
        config?: C | Record<string, unknown> | null,
        ...kwargs: unknown[]
    ): Promise<T>;
}

/**
 * Abstract base class for implementing ResourceFactory.
 * Provides default implementations for common properties.
 */
export abstract class AbstractResourceFactory<T = unknown, C = unknown>
    implements ResourceFactory<T, C>
{
    public abstract readonly type: string;
    public readonly isDefault: boolean = false;
    public readonly priority: number = 0;

    public abstract create(
        config?: C | Record<string, unknown> | null,
        ...kwargs: unknown[]
    ): Promise<T>;
}

/**
 * Type constraint for factory constructor functions
 */
export type FactoryConstructor<T = unknown, C = unknown> = new (
    ...args: unknown[]
) => ResourceFactory<T, C>;

/**
 * Information about a registered factory
 */
export interface FactoryInfo<T = unknown, C = unknown> {
    /** The factory type identifier */
    type: string;

    /** The factory constructor */
    constructor: FactoryConstructor<T, C>;

    /** The factory instance (cached) */
    instance?: ResourceFactory<T, C>;

    /** Factory metadata */
    metadata?: {
        isDefault?: boolean;
        priority?: number;
        description?: string;
        [key: string]: unknown;
    };
}
