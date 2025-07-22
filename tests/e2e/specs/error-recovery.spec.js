// tests/e2e/specs/error-recovery.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Error Recovery and Resilience', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
  });

  test('should recover from API errors gracefully', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Intercept API calls to simulate errors
    await context.route('**/api/chat/message', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Send message that will fail
    await chatPage.sendMessage('This will trigger an error');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/error|failed/i);
    
    // Should offer retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Fix the API and retry
    await context.unroute('**/api/chat/message');
    await page.click('[data-testid="retry-button"]');
    
    // Should succeed on retry
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should handle authentication failures', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Simulate token expiration
    await page.evaluate(() => {
      localStorage.setItem('token', 'expired-token');
    });
    
    // Intercept auth check to return 401
    await context.route('**/api/auth/verify', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Token expired' })
      });
    });
    
    // Try to start chat
    await dashboardPage.clickStartChat();
    
    // Should redirect to login with message
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    
    // Should preserve intended destination
    await testHelpers.loginTestUser(page);
    
    // Should redirect back to chat after login
    await expect(page).toHaveURL(/\/chat|\/session/, { timeout: 5000 });
  });

  test('should handle network disconnection', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Go offline
    await context.setOffline(true);
    
    // Try to send message
    await chatPage.sendMessage('Message while offline');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="message-status-queued"]')).toBeVisible();
    
    // Should queue the message
    await expect(page.locator('[data-testid="queued-messages-count"]')).toContainText('1');
    
    // Go back online
    await context.setOffline(false);
    
    // Should automatically send queued messages
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="message-status-sent"]')).toBeVisible();
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should handle file operation errors', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Try to read non-existent file
    await chatPage.sendMessage('Read the file /nonexistent/path/file.txt');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should handle gracefully
    await expect(chatPage.getLastResponse()).toContainText(/not found|doesn't exist|no such file/i);
    
    // Try to write to read-only location
    await chatPage.sendMessage('Create a file at /system/readonly/test.txt');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/permission|denied|cannot write/i);
    
    // Should suggest alternatives
    await expect(chatPage.getLastResponse()).toContainText(/try|instead|alternative/i);
  });

  test('should recover from browser crashes', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Send some messages
    await chatPage.sendMessage('Message before crash');
    await testHelpers.waitForAssistantResponse(page);
    
    // Store session data
    const sessionId = page.url().split('/').pop();
    await testHelpers.setLocalStorageItem(page, 'lastSessionId', sessionId);
    await testHelpers.setLocalStorageItem(page, 'unsavedWork', 'Important work in progress');
    
    // Simulate crash by closing and reopening
    await page.close();
    const newPage = await context.newPage();
    
    // Reopen app
    await testHelpers.loginTestUser(newPage);
    const newDashboard = new DashboardPage(newPage);
    await newDashboard.goto();
    
    // Should detect crash and offer recovery
    await expect(newPage.locator('[data-testid="crash-recovery-dialog"]')).toBeVisible({ timeout: 5000 });
    await expect(newPage.locator('[data-testid="crash-recovery-dialog"]')).toContainText('Restore your previous session');
    
    // Recover session
    await newPage.click('[data-testid="recover-session-button"]');
    
    // Should restore to previous state
    await expect(newPage).toHaveURL(new RegExp(`/session/${sessionId}`));
    await expect(newPage.locator('[data-testid="recovery-notice"]')).toContainText('Session restored');
  });

  test('should handle memory pressure gracefully', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Generate large amount of content
    for (let i = 0; i < 100; i++) {
      await chatPage.sendMessage(`Generate message ${i}`);
      // Don't wait for responses to build up queue
    }
    
    // Should show memory warning if approaching limits
    await page.waitForTimeout(5000);
    
    // Check if memory optimization kicked in
    const hasOptimization = await page.evaluate(() => {
      return document.querySelector('[data-testid="memory-optimization-active"]') !== null ||
             document.querySelector('[data-testid="virtual-scroll-active"]') !== null;
    });
    
    expect(hasOptimization).toBe(true);
    
    // Should offer to clear old messages
    if (await page.locator('[data-testid="clear-old-messages-prompt"]').isVisible()) {
      await page.click('[data-testid="clear-old-messages-button"]');
      
      // Should free up memory
      await expect(page.locator('[data-testid="memory-freed-notice"]')).toBeVisible();
    }
  });

  test('should handle rate limiting gracefully', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Simulate rate limiting
    let requestCount = 0;
    await context.route('**/api/chat/message', route => {
      requestCount++;
      if (requestCount > 3) {
        route.fulfill({
          status: 429,
          headers: { 'Retry-After': '60' },
          body: JSON.stringify({ error: 'Rate limit exceeded' })
        });
      } else {
        route.continue();
      }
    });
    
    // Send multiple messages rapidly
    for (let i = 0; i < 5; i++) {
      await chatPage.sendMessage(`Message ${i + 1}`);
      await page.waitForTimeout(100);
    }
    
    // Should show rate limit message
    await expect(page.locator('[data-testid="rate-limit-warning"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="rate-limit-warning"]')).toContainText(/rate limit|too many requests/i);
    
    // Should show retry timer
    await expect(page.locator('[data-testid="retry-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-timer"]')).toContainText(/\d+ seconds?/);
    
    // Should queue messages for later
    await expect(page.locator('[data-testid="messages-queued-notice"]')).toBeVisible();
  });

  test('should handle corrupted data gracefully', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Inject corrupted session data
    await page.evaluate(() => {
      localStorage.setItem('sessionData', '{"invalid json}');
      localStorage.setItem('projectCache', 'not-json-at-all');
    });
    
    // Try to load chat
    await dashboardPage.clickStartChat();
    
    // Should not crash, should handle gracefully
    await expect(chatPage.chatInput).toBeVisible({ timeout: 5000 });
    
    // Should show data recovery notice
    await expect(page.locator('[data-testid="data-recovery-notice"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-recovery-notice"]')).toContainText(/recovered|repaired/i);
    
    // Should still be functional
    await chatPage.sendMessage('Test after data recovery');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should handle plugin/extension errors', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Simulate MCP server failure
    await chatPage.sendMessage('Use the GitHub MCP server to create an issue');
    
    // If MCP fails, should show error but continue
    const response = await chatPage.getLastResponse();
    if (response.includes('MCP') && response.includes('error')) {
      await expect(page.locator('[data-testid="mcp-error-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcp-error-notice"]')).toContainText(/MCP.*failed|unavailable/i);
      
      // Should offer fallback
      await expect(response).toContainText(/alternatively|instead|manually/i);
    }
    
    // Core functionality should still work
    await chatPage.sendMessage('What is 2 + 2?');
    await expect(chatPage.getLastResponse()).toContainText('4');
  });

  test('should handle disk space issues', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Try to create a very large file
    await chatPage.sendMessage('Create a 10GB test file filled with random data');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should detect disk space issue
    const response = await chatPage.getLastResponse();
    await expect(response).toMatch(/disk space|storage|insufficient/i);
    
    // Should show storage indicator if low
    if (await page.locator('[data-testid="low-storage-warning"]').isVisible()) {
      await expect(page.locator('[data-testid="storage-cleanup-button"]')).toBeVisible();
      
      // Click cleanup
      await page.click('[data-testid="storage-cleanup-button"]');
      await expect(page.locator('[data-testid="cleanup-progress"]')).toBeVisible();
    }
  });

  test('should handle concurrent modification conflicts', async ({ page, browser }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Open same file in two tabs
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await testHelpers.loginTestUser(page2);
    const dashboard2 = new DashboardPage(page2);
    const chat2 = new ChatPage(page2);
    
    await dashboard2.goto();
    await dashboard2.selectProject('project-nodejs');
    await dashboard2.clickStartChat();
    
    // Edit same file from both tabs
    await chatPage.sendMessage('Edit config.js and add a new setting: debugMode: true');
    await chat2.sendMessage('Edit config.js and add a new setting: verboseLogging: true');
    
    // Wait for both to process
    await testHelpers.waitForAssistantResponse(page);
    await testHelpers.waitForAssistantResponse(page2);
    
    // Should detect conflict
    const hasConflictWarning = 
      await page.locator('[data-testid="file-conflict-warning"]').isVisible() ||
      await page2.locator('[data-testid="file-conflict-warning"]').isVisible();
    
    expect(hasConflictWarning).toBe(true);
    
    // Should offer merge options
    if (await page.locator('[data-testid="merge-changes-button"]').isVisible()) {
      await page.click('[data-testid="merge-changes-button"]');
      await expect(page.locator('[data-testid="merge-success"]')).toBeVisible();
    }
    
    await context2.close();
  });

  test('should provide helpful error messages', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Various error scenarios
    const errorScenarios = [
      {
        message: 'Delete the folder /',
        expectedError: /dangerous|cannot delete|root/i
      },
      {
        message: 'Run the command: sudo rm -rf /',
        expectedError: /dangerous|not allowed|prohibited/i
      },
      {
        message: 'Access the file ../../../etc/passwd',
        expectedError: /access denied|outside project|security/i
      }
    ];
    
    for (const scenario of errorScenarios) {
      await chatPage.sendMessage(scenario.message);
      await testHelpers.waitForAssistantResponse(page);
      
      const response = await chatPage.getLastResponse();
      await expect(response).toMatch(scenario.expectedError);
      
      // Should explain why it's not allowed
      await expect(response).toMatch(/because|reason|why/i);
    }
  });
});