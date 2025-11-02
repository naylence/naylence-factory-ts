import { ExtensionManager } from '../extension-manager.js';
import {
    ConventionPluginResolver,
    _internal as resolverInternal,
} from '../plugin-resolver.js';
import {
    loadPlugins,
    loadPluginsFromEnv,
    loadPluginsFromSpecs,
    _internal as pluginsInternal,
} from '../plugins.js';
import { deliveryCorePluginState } from './fixtures/plugins/delivery-core.js';
import { sentinelCorePluginState } from './fixtures/plugins/sentinel-core.js';

const BASE_TYPE = 'TestFactory';
const FIXTURE_PLUGIN_MAP = {
    'delivery:core': './__tests__/fixtures/plugins/delivery-core.js',
    'sentinel:core': './__tests__/fixtures/plugins/sentinel-core.js',
};

function resetGlobalExtensions(): void {
    const managers = ExtensionManager.getAllExtensionManagers();
    for (const manager of managers.values()) {
        manager.unregisterFactory();
        manager.clearInstanceCache();
    }
}

describe('Plugin loading', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetGlobalExtensions();
        resolverInternal.setDefaultPluginMap(FIXTURE_PLUGIN_MAP);
        deliveryCorePluginState.registerCalls = 0;
        sentinelCorePluginState.registerCalls = 0;
        process.env = { ...originalEnv };
        pluginsInternal.resetImportOverrides();
    });

    afterAll(() => {
        resolverInternal.setDefaultPluginMap({});
        process.env = originalEnv;
        pluginsInternal.resetImportOverrides();
    });

    it('loads plugins via resolver and registers factories without side effects', async () => {
        const resolver = new ConventionPluginResolver();

        await loadPlugins('delivery:core,sentinel:core', resolver);

        const testA = ExtensionManager.getGlobalFactory(BASE_TYPE, 'TestA');
        const testB = ExtensionManager.getGlobalFactory(BASE_TYPE, 'TestB');
        const [bestFactory, bestType] =
            ExtensionManager.getBestGlobalDefaultFactory(BASE_TYPE) ?? [];

        expect(testA.type).toBe('TestA');
        expect(testA.isDefault).toBe(true);

        expect(testB.type).toBe('TestB');
        expect(testB.isDefault).toBe(false);

        expect(bestType).toBe('TestC');
        expect(bestFactory?.priority).toBe(20);
        expect(bestFactory?.isDefault).toBe(true);

        expect(deliveryCorePluginState.registerCalls).toBe(1);
        expect(sentinelCorePluginState.registerCalls).toBe(1);
    });

    it('loads plugins from environment and de-duplicates specs', async () => {
        process.env.FAME_PLUGINS = 'delivery:core, delivery:core';

        await loadPluginsFromEnv();

        expect(deliveryCorePluginState.registerCalls).toBe(1);
    });

    it('falls back to process cwd resolution when direct import fails', async () => {
        const register = jest.fn();
        const pluginModule = { default: { register } } as Record<
            string,
            unknown
        >;
        const error = Object.assign(
            new Error(
                "Cannot find package '@naylence/runtime' imported from test"
            ),
            { code: 'ERR_MODULE_NOT_FOUND' }
        );
        const importer = jest
            .fn<Promise<Record<string, unknown>>, [string]>()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(pluginModule);

        pluginsInternal.setDynamicImporter(importer);
        pluginsInternal.setResolveFromCwd(
            async () => 'file:///resolved/plugin.mjs'
        );

    await loadPluginsFromSpecs([{ name: '@naylence/runtime/plugin' }]);

        expect(importer).toHaveBeenCalledTimes(2);
    expect(importer).toHaveBeenNthCalledWith(1, '@naylence/runtime/plugin');
        expect(importer).toHaveBeenNthCalledWith(
            2,
            'file:///resolved/plugin.mjs'
        );
        expect(register).toHaveBeenCalledTimes(1);
    });

    it('appends /plugin to bare package specs before falling back to cwd resolution', async () => {
        const register = jest.fn();
        const pluginModule = { default: { register } } as Record<
            string,
            unknown
        >;
        const error = Object.assign(new Error('Cannot find module'), {
            code: 'ERR_MODULE_NOT_FOUND',
        });

        const importer = jest
            .fn<Promise<Record<string, unknown>>, [string]>()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(pluginModule);

        pluginsInternal.setDynamicImporter(importer);
        pluginsInternal.setResolveFromCwd(async () => null);

        await loadPluginsFromSpecs([{ name: '@naylence/runtime' }]);

        expect(importer).toHaveBeenCalledTimes(2);
    expect(importer).toHaveBeenNthCalledWith(1, '@naylence/runtime/plugin');
        expect(importer).toHaveBeenNthCalledWith(2, '@naylence/runtime');
        expect(register).toHaveBeenCalledTimes(1);
    });
});
