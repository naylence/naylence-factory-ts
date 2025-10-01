import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/browser/index.js',
      format: 'umd',
      name: 'NaylenceFactory',
      sourcemap: true,
      globals: {
        // Add any globals needed for browser builds
      }
    },
    {
      file: 'dist/browser/index.esm.js',
      format: 'es',
      sourcemap: true
    }
  ],
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        sourceMap: true
      },
      outDir: 'dist/browser'
    })
  ],
  external: []
};