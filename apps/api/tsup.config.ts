import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @tidyr/shared ships TypeScript source (D-001), so it has to be bundled into the output.
  noExternal: ['@tidyr/shared'],
});
