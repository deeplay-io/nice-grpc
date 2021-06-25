module.exports = {
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '/lib/'],
};
