/** @type {import('@jest/types').Config.GlobalConfig} */
module.exports = {
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/src/__tests__/utils/',
    '/fixtures/',
  ],
  snapshotSerializers: ['./src/__tests__/utils/snapshotSerializer'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 15000,
  reporters: ['default', 'github-actions'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/src/__tests__/utils/',
  ],
};