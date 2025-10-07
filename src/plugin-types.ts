export interface FamePlugin {
    name: string;
    register(): Promise<void> | void;
}

export type PluginSpecifier = string;

export interface PluginResolver {
    resolve(spec: PluginSpecifier): Promise<FamePlugin | null>;
}
