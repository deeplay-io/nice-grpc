import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/lib/**', '**/fixtures/**'],
    server: {
      deps: {
        external: [/google-protobuf/, /fixtures\/grpc-js/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**'],
    },
  },
});
