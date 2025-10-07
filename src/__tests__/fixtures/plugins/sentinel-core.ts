import type { FamePlugin } from '../../../plugins.js';
import { AbstractResourceFactory } from '../../../factory.js';
import { ExtensionManager } from '../../../extension-manager.js';

interface TestResource {
    name: string;
    source: string;
}

interface TestConfig {
    type: string;
}

class TestBFactory extends AbstractResourceFactory<TestResource, TestConfig> {
    public readonly type = 'TestB';
    public readonly isDefault = false;
    public readonly priority = 5;

    public async create(config?: TestConfig): Promise<TestResource> {
        return {
            name: config?.type ?? this.type,
            source: 'sentinel:core',
        };
    }
}

const BASE_TYPE = 'TestFactory';

export const sentinelCorePluginState = {
    registerCalls: 0,
};

const sentinelCorePlugin: FamePlugin = {
    name: 'sentinel:core',
    async register(): Promise<void> {
        sentinelCorePluginState.registerCalls += 1;

        ExtensionManager.registerGlobalFactory(
            BASE_TYPE,
            'TestB',
            TestBFactory
        );
    },
};

export default sentinelCorePlugin;
