// tests/e2e/specs/websocket-stability.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('WebSocket Stability and Recovery', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    // Login and navigate to a project
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    await dashboardPage.selectProject('project-nodejs');
  });

  test('should establish WebSocket connection on page load', async ({ page }) => {
    // Wait for WebSocket connection
    const wsPromise = testHelpers.waitForWebSocketConnection(page, '/ws');
    await page.goto('/chat');
    const ws = await wsPromise;
    
    expect(ws.url()).toContain('/ws');
    
    // Verify connection is established
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected');
  });

  test('should maintain heartbeat with server', async ({ page }) => {
    await page.goto('/chat');
    
    // Listen for heartbeat messages
    const heartbeatPromises = [];
    for (let i = 0; i < 3; i++) {
      heartbeatPromises.push(
        testHelpers.waitForWebSocketMessage(page, 'heartbeat', 30000)
      );
    }
    
    // Wait for at least 3 heartbeats
    await Promise.all(heartbeatPromises);
    
    // Connection should still be active
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected');
  });

  test('should automatically reconnect after connection loss', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Wait for initial connection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected');
    
    // Simulate network disconnection by blocking WebSocket
    await context.route('**/ws', route => route.abort());
    
    // Wait for disconnection to be detected
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    
    // Should show reconnecting status
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'reconnecting', { timeout: 5000 });
    
    // Restore network connection
    await context.unroute('**/ws');
    
    // Should automatically reconnect
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    
    // Verify functionality is restored
    await chatPage.sendMessage('Test message after reconnect');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should buffer messages during disconnection', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Send initial message to establish session
    await chatPage.sendMessage('Initial message');
    await testHelpers.waitForAssistantResponse(page);
    
    // Simulate network disconnection
    await context.route('**/ws', route => route.abort());
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    
    // Try to send messages while disconnected
    await chatPage.chatInput.fill('Message sent while offline');
    await page.keyboard.press('Enter');
    
    // Message should be queued
    await expect(page.locator('[data-testid="message-status-pending"]')).toBeVisible();
    
    // Restore connection
    await context.unroute('**/ws');
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    
    // Queued message should be sent automatically
    await expect(page.locator('[data-testid="message-status-sent"]')).toBeVisible({ timeout: 5000 });
    
    // Should receive response for the buffered message
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should handle rapid reconnections gracefully', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Rapidly disconnect and reconnect multiple times
    for (let i = 0; i < 5; i++) {
      // Block WebSocket
      await context.route('**/ws', route => route.abort());
      await page.waitForTimeout(1000);
      
      // Unblock WebSocket
      await context.unroute('**/ws');
      await page.waitForTimeout(1000);
    }
    
    // Connection should stabilize
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 10000 });
    
    // Functionality should still work
    await chatPage.sendMessage('Test after rapid reconnections');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should maintain session state across reconnections', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Send messages to establish session state
    await chatPage.sendMessage('First message');
    await testHelpers.waitForAssistantResponse(page);
    await chatPage.sendMessage('Second message');
    await testHelpers.waitForAssistantResponse(page);
    
    // Get message count before disconnection
    const messagesBefore = await chatPage.getAllMessages();
    const messageCountBefore = messagesBefore.length;
    
    // Simulate disconnection
    await context.route('**/ws', route => route.abort());
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    
    // Wait and reconnect
    await page.waitForTimeout(3000);
    await context.unroute('**/ws');
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    
    // All messages should still be visible
    const messagesAfter = await chatPage.getAllMessages();
    expect(messagesAfter.length).toBe(messageCountBefore);
    
    // Session should continue normally
    await chatPage.sendMessage('Third message after reconnect');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should handle server restart gracefully', async ({ page, request }) => {
    await page.goto('/chat');
    
    // Send initial message
    await chatPage.sendMessage('Before server restart');
    await testHelpers.waitForAssistantResponse(page);
    
    // Simulate server restart by calling health check endpoint
    // In real scenario, this would be a server restart
    try {
      await request.post('/api/admin/restart-websocket', {
        headers: {
          'Authorization': `Bearer ${await testHelpers.getLocalStorageItem(page, 'token')}`
        }
      });
    } catch (error) {
      // Server might not have this endpoint, that's okay
    }
    
    // Should detect disconnection and reconnect
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'reconnecting', { timeout: 10000 });
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 20000 });
    
    // Should be able to continue conversation
    await chatPage.sendMessage('After server restart');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should show appropriate error messages for connection issues', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Block WebSocket connection
    await context.route('**/ws', route => route.abort('connectionrefused'));
    
    // Should show connection error
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="connection-error"]')).toContainText(/connection|network/i);
    
    // User should be able to manually retry
    await page.click('[data-testid="retry-connection"]');
    
    // Unblock and verify reconnection
    await context.unroute('**/ws');
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    await expect(page.locator('[data-testid="connection-error"]')).not.toBeVisible();
  });

  test('should handle message timeout gracefully', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Intercept WebSocket to delay responses
    let delayResponse = false;
    await context.route('**/ws', async route => {
      if (delayResponse) {
        await page.waitForTimeout(35000); // Longer than typical timeout
      }
      await route.continue();
    });
    
    // Send message that will timeout
    delayResponse = true;
    await chatPage.sendMessage('This message will timeout');
    
    // Should show timeout error after 30 seconds
    await expect(page.locator('[data-testid="message-timeout-error"]')).toBeVisible({ timeout: 35000 });
    
    // User should be able to retry
    delayResponse = false;
    await page.click('[data-testid="retry-message"]');
    
    // Message should be resent successfully
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should sync connection status across multiple tabs', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Open second tab
    const page2 = await context.newPage();
    const chatPage2 = new ChatPage(page2);
    await page2.goto('/chat');
    
    // Both tabs should show connected
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected');
    await expect(page2.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected');
    
    // Send message from first tab
    await chatPage.sendMessage('Message from tab 1');
    
    // Message should appear in both tabs
    await expect(chatPage.getLastMessage()).toContainText('Message from tab 1');
    await expect(chatPage2.getLastMessage()).toContainText('Message from tab 1', { timeout: 5000 });
    
    // Simulate disconnection
    await context.route('**/ws', route => route.abort());
    
    // Both tabs should show disconnected
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    await expect(page2.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    
    // Restore connection
    await context.unroute('**/ws');
    
    // Both tabs should reconnect
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    await expect(page2.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 15000 });
    
    await page2.close();
  });

  test('should handle WebSocket upgrade failures', async ({ page, context }) => {
    // Block WebSocket upgrade
    await context.route('**/ws', route => {
      route.fulfill({
        status: 400,
        body: 'WebSocket upgrade failed'
      });
    });
    
    await page.goto('/chat');
    
    // Should show upgrade error
    await expect(page.locator('[data-testid="websocket-upgrade-error"]')).toBeVisible({ timeout: 10000 });
    
    // Should fall back to polling or show appropriate message
    await expect(page.locator('[data-testid="connection-fallback-notice"]')).toBeVisible();
  });

  test('should respect maximum reconnection attempts', async ({ page, context }) => {
    await page.goto('/chat');
    
    // Block all WebSocket connections permanently
    await context.route('**/ws', route => route.abort());
    
    // Wait for initial disconnection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected', { timeout: 10000 });
    
    // Should attempt reconnection multiple times
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'reconnecting', { timeout: 15000 });
      await page.waitForTimeout(2000);
    }
    
    // After max attempts, should show persistent error
    await expect(page.locator('[data-testid="connection-failed-permanently"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="manual-reconnect-button"]')).toBeVisible();
  });
});