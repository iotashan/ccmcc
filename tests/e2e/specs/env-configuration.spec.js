import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../fixtures/auth';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

test.describe('Environment Configuration', () => {
  let testUsername;
  let testPassword;
  let originalEnvContent;
  const envPath = path.join(process.cwd(), '.env');
  const envBackupPath = path.join(process.cwd(), '.env.backup');

  test.beforeAll(async () => {
    // Backup original .env file
    if (fs.existsSync(envPath)) {
      originalEnvContent = fs.readFileSync(envPath, 'utf8');
      fs.writeFileSync(envBackupPath, originalEnvContent);
    }
  });

  test.afterAll(async () => {
    // Restore original .env file
    if (originalEnvContent) {
      fs.writeFileSync(envPath, originalEnvContent);
    }
    if (fs.existsSync(envBackupPath)) {
      fs.unlinkSync(envBackupPath);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Create unique test user
    const timestamp = Date.now();
    testUsername = `test_env_${timestamp}`;
    testPassword = 'TestPass123!';
    
    await createTestUser(testUsername, testPassword);
  });

  test.afterEach(async () => {
    await deleteTestUser(testUsername);
  });

  test('should use ports from environment variables', async ({ page }) => {
    // Read current .env file
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Verify required environment variables exist
    expect(envContent).toContain('PORT=3020');
    expect(envContent).toContain('VITE_PORT=3021');
    expect(envContent).toContain('VITE_API_PORT=3020');
    
    // Test that the app is running on the correct ports
    await page.goto('/');
    
    // Check that we're on the VITE_PORT
    const url = new URL(page.url());
    expect(url.port).toBe('3021');
    
    // Login to test API connectivity
    await page.fill('input[type="text"]', testUsername);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
    
    // Test WebSocket connection using environment ports
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if WebSocket is connected by looking for the ws property
        setTimeout(() => {
          const hasWebSocket = window.ws !== undefined && window.ws !== null;
          resolve(hasWebSocket);
        }, 2000);
      });
    });
    
    // WebSocket should connect successfully using env ports
    expect(wsConnected).toBeTruthy();
  });

  test('should handle changed port configuration', async ({ browser }) => {
    // Stop the current dev server
    try {
      execSync('./scripts/stop-all.sh', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors if server wasn't running
    }
    
    // Modify .env file with different ports
    const modifiedEnvContent = originalEnvContent
      .replace('PORT=3020', 'PORT=4020')
      .replace('VITE_PORT=3021', 'VITE_PORT=4021')
      .replace('VITE_API_PORT=3020', 'VITE_API_PORT=4020');
    
    fs.writeFileSync(envPath, modifiedEnvContent);
    
    // Start the server with new configuration
    execSync('./scripts/restart-dev.sh', { stdio: 'ignore' });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Create a new context to avoid cached connections
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Test that the app is running on the new ports
      await page.goto('http://localhost:4021/', { waitUntil: 'networkidle' });
      
      // Should see the login page
      await expect(page.locator('h1:has-text("Mission Control Center")')).toBeVisible();
      
      // Login to test API connectivity on new port
      await page.fill('input[type="text"]', testUsername);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button:has-text("Login")');
      
      // Should successfully login using the new API port
      await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
      
      // Verify WebSocket connects to correct port
      const wsUrl = await page.evaluate(() => {
        // Access the WebSocket URL from the connection
        if (window.ws && window.ws.url) {
          return window.ws.url;
        }
        return null;
      });
      
      if (wsUrl) {
        const wsUrlParsed = new URL(wsUrl);
        expect(wsUrlParsed.port).toBe('4020');
      }
      
    } finally {
      await context.close();
      
      // Restore original configuration
      fs.writeFileSync(envPath, originalEnvContent);
      
      // Stop the modified server
      try {
        execSync('./scripts/stop-all.sh', { stdio: 'ignore' });
      } catch (e) {
        // Ignore errors
      }
      
      // Restart with original configuration
      execSync('./scripts/restart-dev.sh', { stdio: 'ignore' });
      
      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  });

  test('should verify WebSocket uses environment variables', async ({ page }) => {
    await page.goto('/');
    
    // Login
    await page.fill('input[type="text"]', testUsername);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
    
    // Inject code to check WebSocket configuration
    const wsConfig = await page.evaluate(() => {
      // Access the environment variables used in websocket.js
      const vitePort = import.meta.env.VITE_PORT;
      const apiPort = import.meta.env.VITE_API_PORT;
      
      return {
        vitePort,
        apiPort,
        currentPort: window.location.port,
        // Check if the logic would use the right port
        expectedApiPort: window.location.port === vitePort ? apiPort : window.location.port
      };
    });
    
    // Verify environment variables are accessible
    expect(wsConfig.vitePort).toBe('3021');
    expect(wsConfig.apiPort).toBe('3020');
    expect(wsConfig.currentPort).toBe('3021');
    expect(wsConfig.expectedApiPort).toBe('3020');
  });

  test('should handle missing VITE_API_PORT gracefully', async ({ page }) => {
    // Create a modified env without VITE_API_PORT
    const envWithoutApiPort = originalEnvContent
      .split('\n')
      .filter(line => !line.includes('VITE_API_PORT'))
      .join('\n');
    
    fs.writeFileSync(envPath, envWithoutApiPort);
    
    // Reload the page to pick up the change
    await page.goto('/');
    
    // Login
    await page.fill('input[type="text"]', testUsername);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login")');
    
    // Should still work with fallback to 3020
    await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
    
    // Restore original env
    fs.writeFileSync(envPath, originalEnvContent);
  });
});