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
      globals: {
        // Add any globals needed for browser builds
      }
    },
    {
      file: 'dist/browser/index.esm.js',
      format: 'es'
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
      declaration: false,
      outDir: 'dist/browser'
    })
  ],
  external: []
};