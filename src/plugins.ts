export type {
    FamePlugin,
    PluginResolver,
    PluginSpecifier,
} from './plugin-types.js';

import type {
    FamePlugin,
    PluginResolver,
    PluginSpecifier,
} from './plugin-types.js';

const isNodeEnvironment =
    typeof process !== 'undefined' && Boolean(process?.versions?.node);

type NodeRequireLike = { resolve: (specifier: string) => string };
type DynamicImporter = (specifier: string) => Promise<Record<string, unknown>>;
type RuntimeImporter = (specifier: string) => Promise<unknown>;

let customDynamicImporter: DynamicImporter | null = null;
let customResolveFromCwd:
    | ((specifier: string) => Promise<string | null>)
    | null = null;
let cachedNodeRequire: NodeRequireLike | null = null;
let cachedPathToFileURL: ((path: string) => URL) | null = null;
let cachedRuntimeImporter: RuntimeImporter | null = null;

const NODE_MODULE_SPECIFIER = 'module';
const NODE_URL_SPECIFIER = 'url';
const NODE_FS_PROMISES_SPECIFIER = 'fs/promises';

export interface PluginSpec {
    name: string;
    export?: string;
}

function getGlobalDynamicImporter(): DynamicImporter | null {
    try {
        const candidate = globalThis as {
            __naylenceFactoryDynamicImporter?: unknown;
        };

        const override = candidate?.__naylenceFactoryDynamicImporter;
        if (typeof override === 'function') {
            return override as DynamicImporter;
        }
    } catch {
        // Ignore access errors (e.g., globalThis not defined)
    }

    return null;
}

function getDynamicImporter(): DynamicImporter {
    if (customDynamicImporter) {
        return customDynamicImporter;
    }

    const globalImporter = getGlobalDynamicImporter();
    if (globalImporter) {
        return globalImporter;
    }

    return (specifier: string) =>
        import(specifier) as Promise<Record<string, unknown>>;
}

function getRuntimeImporter(): RuntimeImporter {
    if (!cachedRuntimeImporter) {
        // Lazily create a dynamic importer so bundlers do not eagerly resolve
        // optional Node.js built-ins when compiling for the browser.
        cachedRuntimeImporter = new Function(
            'specifier',
            'return import(specifier);'
        ) as RuntimeImporter;
    }

    return cachedRuntimeImporter;
}

async function importNodeModule<T>(specifier: string): Promise<T> {
    const importer = getRuntimeImporter();
    const target = specifier.startsWith('node:')
        ? specifier
        : `node:${specifier}`;

    return (await importer(target)) as T;
}

function shouldAttemptNodeFallback(error: unknown): boolean {
    if (!isNodeEnvironment || !error || typeof error !== 'object') {
        return false;
    }

    const candidate = error as { code?: string; message?: string };
    const code = candidate.code ?? '';
    const message = candidate.message ?? '';

    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
        return true;
    }

    return (
        message.includes('Cannot find package') ||
        message.includes('Cannot find module')
    );
}

function isBarePackageSpecifier(value: string): boolean {
    if (!value) {
        return false;
    }

    if (
        value.startsWith('.') ||
        value.startsWith('/') ||
        value.startsWith('node:') ||
        value.startsWith('file:') ||
        value.startsWith('data:')
    ) {
        return false;
    }

    if (value.startsWith('@')) {
        const parts = value.split('/');
        return parts.length === 2;
    }

    return !value.includes('/');
}

function deriveDefaultModuleSpecifier(spec: PluginSpec): string | null {
    const exportName = spec.export ?? 'default';
    if (exportName !== 'default') {
        return null;
    }

    if (!isBarePackageSpecifier(spec.name)) {
        return null;
    }

    const trimmed = spec.name.replace(/\/+$/u, '');
    return `${trimmed}/plugin`;
}

async function resolveFromProcessCwd(
    specifier: string
): Promise<string | null> {
    if (customResolveFromCwd) {
        return customResolveFromCwd(specifier);
    }

    if (!isNodeEnvironment) {
        return null;
    }

    if (!cachedNodeRequire) {
        try {
            const [{ createRequire }, urlModule] = await Promise.all([
                importNodeModule<{
                    createRequire: (filename: string | URL) => NodeRequireLike;
                }>(NODE_MODULE_SPECIFIER),
                importNodeModule<{
                    pathToFileURL: (path: string) => URL;
                }>(NODE_URL_SPECIFIER),
            ]);

            cachedPathToFileURL = urlModule.pathToFileURL;
            const baseUrl = cachedPathToFileURL(`${process.cwd()}/`);
            const virtualEntry = new URL(
                './__naylence_plugin_resolver__.js',
                baseUrl
            );
            cachedNodeRequire = createRequire(virtualEntry);
        } catch (error) {
            if (process?.env?.FAME_PLUGINS_DEBUG) {
                console.warn(
                    '[plugins] unable to create require from cwd',
                    error
                );
            }
            cachedNodeRequire = null;
        }
    }

    if (!cachedNodeRequire) {
        return null;
    }

    try {
        const resolved = cachedNodeRequire.resolve(specifier);
        if (!cachedPathToFileURL) {
            const { pathToFileURL } = await importNodeModule<{
                pathToFileURL: (path: string) => URL;
            }>(NODE_URL_SPECIFIER);
            cachedPathToFileURL = pathToFileURL;
        }

        let candidatePath = resolved;
        if (/dist[\\/]+cjs[\\/]+/u.test(resolved)) {
            const esmPath = resolved.replace(
                /dist[\\/]+cjs[\\/]+/u,
                'dist/esm/'
            );
            try {
                const { access } = await importNodeModule<{
                    access: (path: string) => Promise<void>;
                }>(NODE_FS_PROMISES_SPECIFIER);
                await access(esmPath);
                candidatePath = esmPath;
            } catch {
                // Ignore missing ESM build and fall back to the original resolved path.
            }
        }

        return cachedPathToFileURL(candidatePath).href;
    } catch (error) {
        if (process?.env?.FAME_PLUGINS_DEBUG) {
            console.debug('[plugins] cwd resolution failed', {
                specifier,
                error,
            });
        }
        return null;
    }
}

async function importPluginModule(
    spec: PluginSpec
): Promise<Record<string, unknown>> {
    const importer = getDynamicImporter();
    const attempted = new Set<string>();
    const defaultSpecifier = deriveDefaultModuleSpecifier(spec);
    const queue: string[] = [];

    if (defaultSpecifier && defaultSpecifier !== spec.name) {
        queue.push(defaultSpecifier);
    }

    queue.push(spec.name);

    let lastError: unknown;

    while (queue.length > 0) {
        const target = queue.shift() as string;
        if (!target || attempted.has(target)) {
            continue;
        }

        attempted.add(target);

        try {
            return await importer(target);
        } catch (error) {
            lastError = error;

            if (!shouldAttemptNodeFallback(error)) {
                continue;
            }

            const resolved = await resolveFromProcessCwd(target);
            if (resolved && !attempted.has(resolved)) {
                queue.push(resolved);
            }
        }
    }

    if (lastError) {
        throw lastError;
    }

    throw new Error(`Unable to import plugin spec '${spec.name}'`);
}

function toArray(input: string | string[]): string[] {
    if (Array.isArray(input)) {
        return input;
    }

    if (typeof input === 'string') {
        return input.split(/[,\s]+/);
    }

    return String(input ?? '').split(/[\s,]+/);
}

function parsePluginSpecs(input: string | string[]): string[] {
    const values = toArray(input)
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set(values));
}

async function getDefaultResolver(): Promise<PluginResolver> {
    const module = await import('./plugin-resolver.js');
    const resolverCtor = (
        module as {
            ConventionPluginResolver?: new () => PluginResolver;
        }
    ).ConventionPluginResolver;

    if (typeof resolverCtor !== 'function') {
        throw new Error('ConventionPluginResolver is not available');
    }

    return new resolverCtor();
}

export async function loadPlugins(
    specs: PluginSpecifier[] | string,
    resolver?: PluginResolver
): Promise<void> {
    const parsed = parsePluginSpecs(specs);
    if (parsed.length === 0) {
        return;
    }

    const activeResolver = resolver ?? (await getDefaultResolver());

    for (const spec of parsed) {
        const plugin = await activeResolver.resolve(spec);
        if (plugin) {
            await plugin.register();
        }
    }
}

function readEnv(key: string): string {
    if (typeof process === 'undefined' || typeof process.env === 'undefined') {
        return '';
    }

    return process.env[key] ?? '';
}

export async function loadPluginsFromEnv(
    envKey = 'FAME_PLUGINS'
): Promise<void> {
    const value = readEnv(envKey);
    await loadPlugins(value);
}

function ensurePlugin(candidate: unknown, spec: PluginSpec): FamePlugin {
    if (!candidate || typeof candidate !== 'object') {
        throw new Error(
            `Plugin '${spec.name}' export '${spec.export ?? 'default'}' is not an object`
        );
    }

    const plugin = candidate as Partial<FamePlugin>;
    if (typeof plugin.register !== 'function') {
        throw new Error(
            `Plugin '${spec.name}' export '${spec.export ?? 'default'}' does not expose a register() function`
        );
    }

    return plugin as FamePlugin;
}

export async function loadPluginsFromSpecs(
    specs: Iterable<PluginSpec>
): Promise<void> {
    const entries = Array.from(specs);
    if (entries.length === 0) {
        return;
    }

    for (const spec of entries) {
        if (!spec?.name) {
            throw new Error('Plugin spec missing name');
        }

        const module = await importPluginModule(spec);
        const exportName = spec.export ?? 'default';
        const candidate = (module as Record<string, unknown>)[exportName];
        const plugin = ensurePlugin(candidate, spec);
        await plugin.register();
    }
}

// Exported for testing purposes
export const _internal = {
    parsePluginSpecs,
    importPluginModule,
    resolveFromProcessCwd,
    setDynamicImporter(importer: DynamicImporter | null): void {
        customDynamicImporter = importer;
    },
    setResolveFromCwd(
        resolver: ((specifier: string) => Promise<string | null>) | null
    ): void {
        customResolveFromCwd = resolver;
    },
    resetImportOverrides(): void {
        customDynamicImporter = null;
        customResolveFromCwd = null;
        cachedNodeRequire = null;
        cachedPathToFileURL = null;
        cachedRuntimeImporter = null;
    },
};
