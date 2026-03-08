import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    pool: 'forks',
    fileParallelism: false,
    include: ['src/__tests__/**/*.ts'],
    exclude: [
      '**/node_modules/**',
      '**/lib/**',
      '**/src/__tests__/utils/**',
      '**/fixtures/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**'],
    },
  },
});
