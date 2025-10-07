import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
    input: 'src/index.ts',
    output: {
        file: 'dist/browser/index.js',
        format: 'esm',
        sourcemap: true,
        name: 'NaylenceFactory',
    },
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: false,
            declarationMap: false,
            outDir: 'dist/browser',
            sourceMap: true,
        }),
    ],
    external: ['zod'],
};
