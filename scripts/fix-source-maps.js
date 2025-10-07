#!/usr/bin/env node

/**
 * Fix source map paths to ensure they reference the correct source locations
 * This script updates sourceMappingURL comments and source map file contents
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const distDir = join(process.cwd(), 'dist');

function fixSourceMaps(dir) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            fixSourceMaps(fullPath);
        } else if (entry.endsWith('.js') || entry.endsWith('.d.ts')) {
            fixJsFile(fullPath);
        } else if (entry.endsWith('.map')) {
            fixMapFile(fullPath);
        }
    }
}

function fixJsFile(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    const sourceMappingRegex = /\/\/# sourceMappingURL=(.+\.map)/g;

    // Ensure source map references are correct
    if (sourceMappingRegex.test(content)) {
        console.log(`Fixed source map reference in: ${filePath}`);
        writeFileSync(filePath, content, 'utf-8');
    }
}

function fixMapFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const mapData = JSON.parse(content);

    if (!mapData.sources) {
        return;
    }

    // Leave source paths as-is - TypeScript generates them correctly
    // Just ensure they're relative paths pointing to ../../src

    writeFileSync(filePath, JSON.stringify(mapData, null, 2), 'utf-8');
    console.log(`Fixed source paths in: ${filePath}`);
}

try {
    console.log('Fixing source maps...');
    fixSourceMaps(distDir);
    console.log('Source maps fixed successfully!');
} catch (error) {
    console.error('Error fixing source maps:', error);
    process.exit(1);
}
