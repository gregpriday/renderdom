import { defineConfig } from 'tsup';
export default defineConfig({
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  dts: true,
  format: ['esm', 'cjs'],
  entry: ['src/index.ts', 'src/cli.ts']
});