import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 15000,
    include: ['src/__tests__/**/*.ts'],
    exclude: [
      '**/node_modules/**',
      '**/lib/**',
      '**/src/__tests__/utils/**',
      '**/fixtures/**',
    ],
    snapshotSerializers: ['./src/__tests__/utils/snapshotSerializer.js'],
    server: {
      deps: {
        external: [/google-protobuf/, /fixtures\/grpc-js/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      exclude: ['**/node_modules/**', '**/lib/**', '**/src/__tests__/utils/**'],
    },
  },
});
