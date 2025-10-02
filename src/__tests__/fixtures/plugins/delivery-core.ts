import type { FamePlugin } from '../../../plugins.js';
import { AbstractResourceFactory } from '../../../factory.js';
import { ExtensionManager } from '../../../extension-manager.js';

interface TestResource {
  name: string;
  payload?: string;
  source: string;
}

interface TestConfig {
  type: string;
  payload?: string;
}

class TestAFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'TestA';
  public readonly isDefault = true;
  public readonly priority = 10;

  public async create(config?: TestConfig): Promise<TestResource> {
    const resource: TestResource = {
      name: config?.type ?? this.type,
      source: 'delivery:core',
    };

    if (config?.payload !== undefined) {
      resource.payload = config.payload;
    }

    return resource;
  }
}

class TestCFactory extends AbstractResourceFactory<TestResource, TestConfig> {
  public readonly type = 'TestC';
  public readonly isDefault = true;
  public readonly priority = 20;

  public async create(config?: TestConfig): Promise<TestResource> {
    const resource: TestResource = {
      name: config?.type ?? this.type,
      source: 'delivery:core',
    };

    if (config?.payload !== undefined) {
      resource.payload = config.payload;
    }

    return resource;
  }
}

const BASE_TYPE = 'TestFactory';

export const deliveryCorePluginState = {
  registerCalls: 0,
};

const deliveryCorePlugin: FamePlugin = {
  name: 'delivery:core',
  async register(): Promise<void> {
    deliveryCorePluginState.registerCalls += 1;

    ExtensionManager.registerGlobalFactory(BASE_TYPE, 'TestA', TestAFactory);

    const testCInstance = new TestCFactory();
    ExtensionManager.registerGlobalFactoryInstance(BASE_TYPE, testCInstance);
  },
};

export default deliveryCorePlugin;
