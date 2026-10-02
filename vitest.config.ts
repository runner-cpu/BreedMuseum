import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // The jsdom suite renders the full museum shell and large breed lists.
    // Four workers keep CI responsive without starving cold lazy-route imports.
    maxWorkers: 4,
    testTimeout: 15000,
    hookTimeout: 15000,
    exclude: ['**/node_modules/**', '**/dist*/**', 'e2e/**'],
  },
});
