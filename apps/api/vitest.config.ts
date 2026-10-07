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
  },
});
