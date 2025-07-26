// tests/config/vitest.config.js
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test files
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js'
    ],
    
    // Environment
    environment: 'node',
    
    // Setup files
    setupFiles: [
      'tests/config/test-env.js',
      'tests/config/vitest.setup.js'
    ],
    
    // Global test configuration
    globals: true,
    
    // Coverage
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'test-results/coverage',
      include: [
        'server/**/*.js',
        'client/**/*.js',
        'shared/**/*.js',
        'src/utils/**/*.js'
      ],
      exclude: [
        '**/*.test.js',
        '**/node_modules/**',
        '**/test-data/**'
      ],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
      }
    },
    
    // Test execution
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Reporters
    reporters: ['verbose'],
    
    // Pool options for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true  // Sequential execution to avoid database conflicts
      }
    }
  },
  
  // Resolve aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@server': path.resolve(__dirname, '../../server'),
      '@client': path.resolve(__dirname, '../../client'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@test': path.resolve(__dirname, '../../tests')
    }
  }
});