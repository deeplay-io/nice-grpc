/** @type {import('@jest/types').Config.GlobalConfig} */
module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/lib/', '/fixtures/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ['default', 'github-actions'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/lib/'],
  setupFilesAfterEnv: ['jest-os-detection'],
};
