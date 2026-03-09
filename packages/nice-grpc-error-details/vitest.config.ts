import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/lib/**', '**/fixtures/**'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**'],
    },
  },
});
