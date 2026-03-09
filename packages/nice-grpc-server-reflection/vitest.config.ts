import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    exclude: ['**/node_modules/**', '**/lib/**', '**/fixtures/**'],
    server: {
      deps: {
        external: [/google-protobuf/, /reflection_pb/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**'],
    },
  },
});
