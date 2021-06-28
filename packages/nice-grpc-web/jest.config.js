module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/lib/', '/src/__tests__/utils/'],
  snapshotSerializers: ['./src/__tests__/utils/snapshotSerializer'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/src/__tests__/utils/',
  ],
};
