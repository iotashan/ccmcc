// tests/config/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

const isDeveloperMode = process.env.DEVELOPER_MODE === 'true';
const isCI = process.env.CI === 'true';

export default defineConfig({
  testDir: '../e2e',
  timeout: isDeveloperMode ? 60000 : 30000, // Longer timeout for developer mode
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  fullyParallel: !isDeveloperMode, // Disable parallel in developer mode for easier debugging
  forbidOnly: !!isCI,
  
  use: {
    baseURL: isDeveloperMode 
      ? (process.env.CLIENT_URL || 'http://localhost:3021')
      : (process.env.CLIENT_URL || 'http://client:3021'),
    trace: isDeveloperMode ? 'on' : 'on-first-retry',
    screenshot: isDeveloperMode ? 'on' : 'only-on-failure',
    video: isDeveloperMode ? 'on' : 'retain-on-failure',
    actionTimeout: isDeveloperMode ? 30000 : 10000,
    navigationTimeout: isDeveloperMode ? 60000 : 30000,
    headless: !isDeveloperMode, // Headed mode in developer mode
    
    // Custom test attributes
    testIdAttribute: 'data-testid',
    
    // Authentication state
    storageState: undefined, // Will be set per project
    
    // Browser context options
    contextOptions: {
      ignoreHTTPSErrors: true
    }
  },

  projects: [
    // Authentication setup project (runs first)
    {
      name: 'setup',
      testMatch: '**/setup/*.setup.js',
      use: {
        storageState: undefined, // No auth state for setup
        baseURL: isDeveloperMode 
          ? (process.env.CLIENT_URL || 'http://localhost:3021')
          : (process.env.CLIENT_URL || 'http://localhost:3021'), // Use host networking for both modes
      }
    },

    // Desktop browsers
    {
      name: 'chromium-desktop',
      dependencies: ['setup'],
      testIgnore: '**/setup/*.setup.js',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'firefox-desktop',
      dependencies: ['setup'],
      testIgnore: '**/setup/*.setup.js',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'webkit-desktop',
      dependencies: ['setup'],
      testIgnore: '**/setup/*.setup.js',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    
    // Mobile browsers
    {
      name: 'mobile-chrome',
      dependencies: ['setup'],
      testIgnore: '**/setup/*.setup.js',
      use: { 
        ...devices['Pixel 5'],
        hasTouch: true,
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },
    {
      name: 'mobile-safari',
      dependencies: ['setup'],
      testIgnore: '**/setup/*.setup.js',
      use: { 
        ...devices['iPhone 12'],
        hasTouch: true,
        storageState: 'tests/e2e/fixtures/.auth/user.json'
      },
    },

  ],

  // Global setup/teardown
  // globalSetup: './global-setup',
  // globalTeardown: './global-teardown',

  // Folder for test artifacts
  outputDir: './test-results/artifacts',

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { 
      open: isDeveloperMode ? 'on-failure' : 'never',
      outputFolder: './test-results/playwright-report'
    }],
    ['json', { 
      outputFile: './test-results/report.json'
    }],
    ['junit', { 
      outputFile: './test-results/junit.xml'
    }],
    isCI ? ['github'] : null,
  ].filter(Boolean),

  // Web server configuration for local testing
  webServer: (isCI || isDeveloperMode) ? undefined : {
    command: 'npm run dev',
    port: 3021,
    timeout: 120 * 1000,
    reuseExistingServer: !isCI,
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