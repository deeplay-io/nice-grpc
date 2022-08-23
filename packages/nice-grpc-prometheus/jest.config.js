module.exports = {
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/src/__tests__/utils/',
    '/fixtures/',
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/lib/'],
};
