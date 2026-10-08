import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// TEST_PLAN §3.7: component tests in jsdom. No API or database; the units under test take their
// collaborators as props or through mocked hooks.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup.ts'],
  },
});
