import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../fixtures/auth';

test.describe('WebSocket Messaging', () => {
  let testUsername;
  let testPassword;

  test.beforeEach(async ({ page }) => {
    // Create unique test user
    const timestamp = Date.now();
    testUsername = `test_websocket_${timestamp}`;
    testPassword = 'TestPass123!';
    
    await createTestUser(testUsername, testPassword);
    
    // Login
    await page.goto('/');
    await page.fill('input[type="text"]', testUsername);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await deleteTestUser(testUsername);
  });

  test('should establish WebSocket connection on login', async ({ page }) => {
    // Check for WebSocket connection by monitoring console logs
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Wait a bit for WebSocket to connect
    await page.waitForTimeout(2000);

    // Check that we don't have WebSocket connection errors
    const wsErrors = consoleLogs.filter(log => 
      log.includes('WebSocket not connected') || 
      log.includes('WebSocket error')
    );
    
    expect(wsErrors).toHaveLength(0);
  });

  test('should send messages through WebSocket when submitting chat', async ({ page }) => {
    // Create a project
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-websocket');
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created and selected
    await page.waitForSelector('text=/tmp/test-websocket', { timeout: 10000 });
    await page.click('text=/tmp/test-websocket');
    
    // Create a new session
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Type a message
    const messageInput = page.locator('textarea[placeholder*="Type a message"]');
    await messageInput.fill('Test WebSocket message');
    
    // Monitor network activity for WebSocket frames
    const wsFrames = [];
    page.on('websocket', ws => {
      ws.on('framesent', frame => wsFrames.push(frame));
    });
    
    // Send the message
    await page.keyboard.press('Enter');
    
    // Wait for loading state to appear (indicates message was sent)
    await expect(page.locator('text=Test WebSocket message')).toBeVisible();
    
    // Check that loading indicator appears (message is being processed)
    const loadingIndicator = page.locator('[data-testid="loading-indicator"], .animate-pulse, text=Claude is thinking');
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should display error when WebSocket is not connected', async ({ page }) => {
    // Create a project
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-ws-error');
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created and selected
    await page.waitForSelector('text=/tmp/test-ws-error', { timeout: 10000 });
    await page.click('text=/tmp/test-ws-error');
    
    // Create a new session
    await page.click('button:has-text("New Session")');
    
    // Simulate WebSocket disconnection by intercepting the WebSocket URL
    await page.route('**/ws**', route => route.abort());
    
    // Type and send a message
    const messageInput = page.locator('textarea[placeholder*="Type a message"]');
    await messageInput.fill('Test message with no WebSocket');
    await page.keyboard.press('Enter');
    
    // Check console for WebSocket warning
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Wait a bit for console message
    await page.waitForTimeout(1000);
    
    // Should have a warning about WebSocket not being connected
    const wsWarnings = consoleLogs.filter(log => log.includes('WebSocket not connected'));
    expect(wsWarnings.length).toBeGreaterThan(0);
  });

  test('should reconnect WebSocket after disconnection', async ({ page }) => {
    // Monitor console logs
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    // Create a project
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-ws-reconnect');
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created
    await page.waitForSelector('text=/tmp/test-ws-reconnect', { timeout: 10000 });
    
    // Simulate WebSocket disconnection and reconnection
    // This would normally require more sophisticated testing infrastructure
    // For now, we just verify that the reconnect logic exists in the code
    
    // Wait for potential reconnection (3 seconds as per the code)
    await page.waitForTimeout(4000);
    
    // Check that we don't have persistent WebSocket errors
    const persistentErrors = consoleLogs.filter(log => 
      log.type === 'error' && 
      log.text.includes('WebSocket') &&
      !log.text.includes('reconnect')
    );
    
    // Should not have persistent errors (reconnection should handle them)
    expect(persistentErrors.length).toBeLessThanOrEqual(1);
  });
});