// tests/e2e/specs/session-recovery.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Session Recovery and Persistence', () => {
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

  test('should persist session across page refreshes', async ({ page }) => {
    // Start a new session
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Send multiple messages
    await chatPage.sendMessage('First message in session');
    await testHelpers.waitForAssistantResponse(page);
    await chatPage.sendMessage('Second message in session');
    await testHelpers.waitForAssistantResponse(page);
    
    // Get session URL and message count
    const sessionUrl = page.url();
    const messageCount = (await chatPage.getAllMessages()).length;
    
    // Refresh the page
    await page.reload();
    await testHelpers.waitForLoadingToComplete(page);
    
    // Should be on same session URL
    expect(page.url()).toBe(sessionUrl);
    
    // All messages should be restored
    const restoredMessages = await chatPage.getAllMessages();
    expect(restoredMessages.length).toBe(messageCount);
    
    // Should be able to continue conversation
    await chatPage.sendMessage('Third message after refresh');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
  });

  test('should recover from browser crash', async ({ page, context }) => {
    // Start a session and send messages
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    await chatPage.sendMessage('Message before crash');
    await testHelpers.waitForAssistantResponse(page);
    
    // Get session ID from URL
    const sessionId = page.url().split('/').pop();
    
    // Store some state in localStorage
    await testHelpers.setLocalStorageItem(page, 'lastSessionId', sessionId);
    await testHelpers.setLocalStorageItem(page, 'draftMessage', 'This was being typed...');
    
    // Simulate browser crash by closing and reopening
    await page.close();
    
    // Open new page and login again
    const newPage = await context.newPage();
    const newDashboard = new DashboardPage(newPage);
    const newChat = new ChatPage(newPage);
    
    await testHelpers.loginTestUser(newPage);
    await newDashboard.goto();
    
    // Should show session recovery prompt
    await expect(newPage.locator('[data-testid="session-recovery-prompt"]')).toBeVisible({ timeout: 5000 });
    await expect(newPage.locator('[data-testid="session-recovery-prompt"]')).toContainText(sessionId);
    
    // Click recover session
    await newPage.click('[data-testid="recover-session-button"]');
    
    // Should restore to the session
    await expect(newPage).toHaveURL(new RegExp(`/session/${sessionId}`));
    
    // Messages should be restored
    const messages = await newChat.getAllMessages();
    expect(messages.some(m => m.content.includes('Message before crash'))).toBeTruthy();
    
    // Draft message should be restored
    const draftValue = await newChat.chatInput.inputValue();
    expect(draftValue).toBe('This was being typed...');
  });

  test('should handle partial message recovery', async ({ page, context }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Start typing a long message
    const longMessage = 'This is a very long message that might get partially saved. '.repeat(10);
    await chatPage.chatInput.fill(longMessage);
    
    // Simulate connection interruption while typing
    await context.route('**/ws', route => route.abort());
    
    // Wait a bit to simulate auto-save
    await page.waitForTimeout(2000);
    
    // Refresh page
    await page.reload();
    
    // Restore connection
    await context.unroute('**/ws');
    
    // Draft should be recovered
    await testHelpers.waitForLoadingToComplete(page);
    const recoveredDraft = await chatPage.chatInput.inputValue();
    expect(recoveredDraft).toBe(longMessage);
  });

  test('should sync session across multiple machines', async ({ page, browser }) => {
    // Create session on machine 1
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    await chatPage.sendMessage('Message from machine 1');
    await testHelpers.waitForAssistantResponse(page);
    
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split('/').pop();
    
    // Open same session on machine 2 (different browser context)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const dashboard2 = new DashboardPage(page2);
    const chat2 = new ChatPage(page2);
    
    await testHelpers.loginTestUser(page2);
    await dashboard2.goto();
    await dashboard2.resumeSession(sessionId);
    
    // Messages should be synced
    const messages2 = await chat2.getAllMessages();
    expect(messages2.some(m => m.content.includes('Message from machine 1'))).toBeTruthy();
    
    // Send message from machine 2
    await chat2.sendMessage('Message from machine 2');
    await testHelpers.waitForAssistantResponse(page2);
    
    // Machine 1 should see the new message
    await page.waitForTimeout(2000); // Wait for sync
    const messages1 = await chatPage.getAllMessages();
    expect(messages1.some(m => m.content.includes('Message from machine 2'))).toBeTruthy();
    
    await context2.close();
  });

  test('should handle session conflicts gracefully', async ({ page, context }) => {
    // Start session and send message
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    await chatPage.sendMessage('Original message');
    await testHelpers.waitForAssistantResponse(page);
    
    const sessionId = page.url().split('/').pop();
    
    // Open same session in another tab
    const page2 = await context.newPage();
    const chat2 = new ChatPage(page2);
    await page2.goto(`/session/${sessionId}`);
    
    // Both tabs type messages simultaneously
    await chatPage.chatInput.fill('Message from tab 1');
    await chat2.chatInput.fill('Message from tab 2');
    
    // Send from tab 1 first
    await page.keyboard.press('Enter');
    
    // Tab 2 should show conflict warning
    await page2.keyboard.press('Enter');
    await expect(page2.locator('[data-testid="message-conflict-warning"]')).toBeVisible({ timeout: 5000 });
    
    // User can choose to send anyway or discard
    await page2.click('[data-testid="send-anyway-button"]');
    
    // Both messages should appear in order
    await page.waitForTimeout(2000);
    const allMessages = await chatPage.getAllMessages();
    const messageTexts = allMessages.map(m => m.content);
    expect(messageTexts).toContain('Message from tab 1');
    expect(messageTexts).toContain('Message from tab 2');
  });

  test('should export and import sessions', async ({ page }) => {
    // Create session with messages
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    await chatPage.sendMessage('Test export functionality');
    await testHelpers.waitForAssistantResponse(page);
    await chatPage.sendMessage('Another message to export');
    await testHelpers.waitForAssistantResponse(page);
    
    // Export session
    await page.click('[data-testid="session-menu"]');
    await page.click('[data-testid="export-session"]');
    
    // Download should start
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-as-markdown"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/session.*\.md$/);
    
    // Import into new session
    await dashboardPage.goto();
    await dashboardPage.clickStartChat();
    
    await page.click('[data-testid="session-menu"]');
    await page.click('[data-testid="import-session"]');
    
    // Upload the exported file
    const fileInput = page.locator('[data-testid="import-file-input"]');
    await fileInput.setInputFiles(await download.path());
    
    // Messages should be imported
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    const importedMessages = await chatPage.getAllMessages();
    expect(importedMessages.some(m => m.content.includes('Test export functionality'))).toBeTruthy();
  });

  test('should maintain session history and allow searching', async ({ page }) => {
    // Create multiple sessions
    const sessionNames = ['Debug Session', 'Feature Development', 'Bug Fix Session'];
    const sessionIds = [];
    
    for (const name of sessionNames) {
      await dashboardPage.goto();
      await dashboardPage.selectProject('project-nodejs');
      await testHelpers.createNewSession(page, name);
      
      await chatPage.sendMessage(`This is ${name}`);
      await testHelpers.waitForAssistantResponse(page);
      
      sessionIds.push(page.url().split('/').pop());
    }
    
    // Go to sessions tab
    await dashboardPage.goto();
    await dashboardPage.switchToTab('sessions');
    
    // All sessions should be listed
    for (const name of sessionNames) {
      await expect(page.locator(`[data-testid="session-${name}"]`)).toBeVisible();
    }
    
    // Search for specific session
    await page.fill('[data-testid="session-search"]', 'Debug');
    await page.waitForTimeout(300); // Debounce
    
    // Only matching session should be visible
    await expect(page.locator(`[data-testid="session-Debug Session"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="session-Feature Development"]`)).not.toBeVisible();
    await expect(page.locator(`[data-testid="session-Bug Fix Session"]`)).not.toBeVisible();
    
    // Clear search and verify all return
    await page.fill('[data-testid="session-search"]', '');
    await page.waitForTimeout(300);
    
    for (const name of sessionNames) {
      await expect(page.locator(`[data-testid="session-${name}"]`)).toBeVisible();
    }
  });

  test('should auto-save session periodically', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Type a message but don't send
    const draftMessage = 'This is an auto-saved draft message';
    await chatPage.chatInput.fill(draftMessage);
    
    // Wait for auto-save (typically every 30 seconds, but might be faster in test mode)
    await page.waitForTimeout(5000);
    
    // Check for auto-save indicator
    await expect(page.locator('[data-testid="auto-save-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="auto-save-indicator"]')).toContainText('Saved');
    
    // Refresh page
    await page.reload();
    await testHelpers.waitForLoadingToComplete(page);
    
    // Draft should be restored
    const restoredDraft = await chatPage.chatInput.inputValue();
    expect(restoredDraft).toBe(draftMessage);
  });

  test('should handle large session restoration', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Send many messages to create a large session
    for (let i = 0; i < 20; i++) {
      await chatPage.sendMessage(`Message number ${i + 1}`);
      // Don't wait for responses to speed up test
      await page.waitForTimeout(100);
    }
    
    // Get session URL
    const sessionUrl = page.url();
    
    // Navigate away and come back
    await dashboardPage.goto();
    await page.goto(sessionUrl);
    
    // Should show loading state for large session
    await expect(page.locator('[data-testid="session-loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-loading-progress"]')).toBeVisible();
    
    // Eventually all messages should load
    await testHelpers.waitForLoadingToComplete(page);
    const messages = await chatPage.getAllMessages();
    expect(messages.length).toBeGreaterThanOrEqual(20);
    
    // Virtual scrolling should be active for performance
    await expect(page.locator('[data-testid="virtual-scroll-container"]')).toBeVisible();
  });

  test('should preserve session metadata', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Set session metadata
    await page.click('[data-testid="session-menu"]');
    await page.click('[data-testid="session-settings"]');
    
    // Add tags
    await page.fill('[data-testid="session-tags-input"]', 'debugging, nodejs, api');
    await page.keyboard.press('Enter');
    
    // Add description
    await page.fill('[data-testid="session-description"]', 'Debugging API endpoint issues');
    
    // Save settings
    await page.click('[data-testid="save-session-settings"]');
    
    const sessionId = page.url().split('/').pop();
    
    // Navigate away and back
    await dashboardPage.goto();
    await dashboardPage.resumeSession(sessionId);
    
    // Open settings again
    await page.click('[data-testid="session-menu"]');
    await page.click('[data-testid="session-settings"]');
    
    // Metadata should be preserved
    await expect(page.locator('[data-testid="session-tag-debugging"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-tag-nodejs"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-tag-api"]')).toBeVisible();
    
    const description = await page.locator('[data-testid="session-description"]').inputValue();
    expect(description).toBe('Debugging API endpoint issues');
  });

  test('should handle session cleanup and archival', async ({ page }) => {
    // Create old sessions
    const oldSessionIds = [];
    for (let i = 0; i < 3; i++) {
      await dashboardPage.goto();
      await dashboardPage.selectProject('project-nodejs');
      await testHelpers.createNewSession(page, `Old Session ${i}`);
      await chatPage.sendMessage(`Old message ${i}`);
      oldSessionIds.push(page.url().split('/').pop());
    }
    
    // Go to sessions management
    await dashboardPage.goto();
    await dashboardPage.switchToTab('sessions');
    
    // Select old sessions for archival
    for (const id of oldSessionIds) {
      await page.click(`[data-testid="select-session-${id}"]`);
    }
    
    // Archive selected sessions
    await page.click('[data-testid="bulk-actions-menu"]');
    await page.click('[data-testid="archive-selected"]');
    
    // Confirm archival
    await page.click('[data-testid="confirm-archive"]');
    
    // Sessions should move to archived section
    await page.click('[data-testid="show-archived-sessions"]');
    
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`[data-testid="session-Old Session ${i}"][data-archived="true"]`)).toBeVisible();
    }
    
    // Can still access archived sessions
    await page.click(`[data-testid="session-Old Session 0"]`);
    await expect(page.locator('[data-testid="archived-session-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="read-only-mode"]')).toBeVisible();
  });
});