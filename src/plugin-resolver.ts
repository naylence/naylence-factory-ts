import type { FamePlugin, PluginResolver, PluginSpecifier } from './plugin-types.js';

export type PluginModuleLoader = () => Promise<unknown>;

let defaultPluginMap: Record<PluginSpecifier, string> = {};

function cloneMap(map: Record<PluginSpecifier, string>): Record<PluginSpecifier, string> {
  return Object.assign({}, map);
}

function extractPlugin(module: unknown): FamePlugin | null {
  if (!module || typeof module !== 'object') {
    return null;
  }

  const maybeModule = module as Partial<{ default: FamePlugin; plugin: FamePlugin }> & {
    [key: string]: unknown;
  };

  const candidate = maybeModule.default ?? maybeModule.plugin;
  if (candidate && typeof candidate === 'object' && typeof candidate.register === 'function') {
    return candidate as FamePlugin;
  }

  return null;
}

export class ConventionPluginResolver implements PluginResolver {
  private readonly map: Record<PluginSpecifier, string>;

  constructor(map?: Record<PluginSpecifier, string>) {
    this.map = cloneMap(map ?? defaultPluginMap);
  }

  public async resolve(spec: PluginSpecifier): Promise<FamePlugin | null> {
    const modulePath = this.map[spec];
    if (!modulePath) {
      return null;
    }

    const module = await import(modulePath);
    return extractPlugin(module);
  }

  public extend(map: Record<PluginSpecifier, string>): void {
    Object.assign(this.map, map);
  }
}

export const _internal = {
  getDefaultPluginMap(): Record<PluginSpecifier, string> {
    return cloneMap(defaultPluginMap);
  },
  setDefaultPluginMap(map: Record<PluginSpecifier, string>): void {
    defaultPluginMap = cloneMap(map);
  },
  extractPlugin,
};
