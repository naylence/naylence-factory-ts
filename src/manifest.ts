import type { PluginSpec } from './plugins.js';

export interface FactoryManifest {
    plugins?: PluginSpec[];
}

let manifest: FactoryManifest | null = null;

export function registerFactoryManifest(
    data: FactoryManifest | null | undefined
): void {
    manifest = data ? { ...data } : null;
}

export function readFactoryManifestIfAny(): FactoryManifest | null {
    return manifest;
}

export const _internal = {
    reset(): void {
        manifest = null;
    },
};
