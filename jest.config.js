module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/environment.js',
    '!**/node_modules/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/models/': {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/middleware/authMiddleware.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/utils/tokenGenerator.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Module paths
  modulePaths: ['<rootDir>/src'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Global teardown
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js'
};
