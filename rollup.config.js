import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';
import del from 'rollup-plugin-delete';

export default {
  input: 'src/api.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
    },
    {
      file: pkg.module,
      format: 'es',
      exports: 'named',
    },
  ],
  external: ['axios'],
  plugins: [del({ targets: 'dist/*' }), typescript(), terser()],
};
