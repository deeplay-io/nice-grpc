import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**'],
    },
  },
});
