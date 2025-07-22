// tests/config/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e/specs',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  
  use: {
    baseURL: process.env.CLIENT_URL || 'http://localhost:3021',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // Custom test attributes
    testIdAttribute: 'data-testid',
    
    // Authentication state
    storageState: undefined, // Will be set per project
    
    // Browser context options
    contextOptions: {
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write']
    }
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    
    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        hasTouch: true,
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        hasTouch: true,
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    
    // Authentication setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      use: {
        storageState: undefined
      }
    }
  ],

  // Global setup/teardown
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  // Folder for test artifacts
  outputDir: 'test-results/artifacts',

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { 
      open: 'never',
      outputFolder: 'test-results/playwright-report'
    }],
    ['json', { 
      outputFile: 'test-results/report.json' 
    }],
    ['junit', { 
      outputFile: 'test-results/junit.xml' 
    }],
    process.env.CI ? ['github'] : null,
  ].filter(Boolean),

  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3021,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },

  // Advanced options
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled'
    }
  },

  // Shared test data
  metadata: {
    testEnvironment: process.env.TEST_ENV || 'local',
    testRun: new Date().toISOString()
  }
});