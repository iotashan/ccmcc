// tests/config/jest.config.mjs
export default {
  rootDir: '../..',
  preset: undefined,
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  testEnvironment: 'node',
  coverageDirectory: '<rootDir>/test-results/coverage',
  collectCoverageFrom: [
    'server/**/*.js',
    'client/**/*.js',
    'shared/**/*.js',
    'src/utils/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**',
    '!**/test-data/**'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  setupFiles: ['<rootDir>/tests/config/test-env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: 1,  // Run tests sequentially to avoid database conflicts
  transform: {},
  forceExit: true,  // Force Jest to exit after tests complete
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Claude Code UI Test Report',
      outputPath: '<rootDir>/test-results/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true
    }]
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@client/(.*)$': '<rootDir>/client/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@test/(.*)$': '<rootDir>/tests/$1'
  }
};