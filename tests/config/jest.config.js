// tests/config/jest.config.js
export default {
  rootDir: '../..',
  preset: 'default',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
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
    '!**/*.test.js',
    '!**/node_modules/**',
    '!**/test-data/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/config/jest.setup.js'],
  testTimeout: 30000,
  maxWorkers: '50%',
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/unit/server/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/unit/client/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node'
    }
  ],
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