import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './tests/helpers/testEnv.ts';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: loadTestEnv(),
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Every file truncates the same test database, so files must not run concurrently.
    fileParallelism: false,
    // `npm run test:coverage`; TEST_PLAN §1 targets ≥ 80% lines for src/modules.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
