// tests/e2e/specs/ime-ctrl-enter.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';

test.describe('IME and Ctrl+Enter Input Feature', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login('testuser', 'TestPassword123!');
    
    // Navigate to chat
    await dashboardPage.selectFirstProject();
    await dashboardPage.createNewSession();
  });

  test('should send message with Enter key by default', async ({ page }) => {
    // Type a message
    await chatPage.chatInput.fill('Test message with Enter key');
    
    // Press Enter
    await page.keyboard.press('Enter');
    
    // Wait for message to be sent
    await chatPage.waitForAssistantResponse();
    
    // Verify message was sent
    const lastMessage = await chatPage.getLastMessage();
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('Test message with Enter key');
  });

  test('should create new line with Shift+Enter', async ({ page }) => {
    // Type first line
    await chatPage.chatInput.fill('First line');
    
    // Press Shift+Enter
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
    
    // Type second line
    await page.keyboard.type('Second line');
    
    // Verify multiline content
    const inputValue = await chatPage.chatInput.inputValue();
    expect(inputValue).toBe('First line\nSecond line');
    
    // Send with Enter
    await page.keyboard.press('Enter');
    await chatPage.waitForAssistantResponse();
    
    // Verify multiline message was sent
    const lastMessage = await chatPage.getLastMessage();
    expect(lastMessage.content).toContain('First line');
    expect(lastMessage.content).toContain('Second line');
  });

  test('should send message with Ctrl+Enter', async ({ page }) => {
    // Type a message
    await chatPage.chatInput.fill('Test message with Ctrl+Enter');
    
    // Press Ctrl+Enter (use Meta on Mac)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.keyboard.press('Enter');
    await page.keyboard.up(modifier);
    
    // Wait for message to be sent
    await chatPage.waitForAssistantResponse();
    
    // Verify message was sent
    const lastMessage = await chatPage.getLastMessage();
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('Test message with Ctrl+Enter');
  });

  test.describe('Send by Ctrl+Enter Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Open quick settings
      await page.locator('[data-testid="quick-settings-toggle"]').click();
      
      // Enable Send by Ctrl+Enter
      await page.locator('text=Send by Ctrl+Enter').click();
      
      // Close settings
      await page.locator('[data-testid="quick-settings-toggle"]').click();
    });

    test('should NOT send message with plain Enter when Ctrl+Enter mode is enabled', async ({ page }) => {
      // Type a message
      await chatPage.chatInput.fill('Test message');
      
      // Press Enter
      await page.keyboard.press('Enter');
      
      // Wait a bit to ensure message is not sent
      await page.waitForTimeout(1000);
      
      // Verify message was NOT sent (input should still contain text)
      const inputValue = await chatPage.chatInput.inputValue();
      expect(inputValue).toBe('Test message');
      
      // Verify no messages in chat
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBe(0);
    });

    test('should send message with Ctrl+Enter when mode is enabled', async ({ page }) => {
      // Type a message
      await chatPage.chatInput.fill('Test message with Ctrl+Enter mode');
      
      // Press Ctrl+Enter
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.press('Enter');
      await page.keyboard.up(modifier);
      
      // Wait for message to be sent
      await chatPage.waitForAssistantResponse();
      
      // Verify message was sent
      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toContain('Test message with Ctrl+Enter mode');
    });

    test('should show IME-safe hint text when enabled', async ({ page }) => {
      // Check hint text
      const hintText = await page.locator('text=/Ctrl\\+Enter to send \\(IME safe\\)/').textContent();
      expect(hintText).toContain('Ctrl+Enter to send (IME safe)');
    });
  });

  test.describe('IME Composition', () => {
    test('should not send message during IME composition', async ({ page }) => {
      // This test simulates IME composition events
      // Note: Full IME testing requires specific OS/browser configurations
      
      // Focus input
      await chatPage.chatInput.focus();
      
      // Dispatch composition start event
      await page.evaluate(() => {
        const input = document.querySelector('[data-testid="chat-input"]');
        const event = new CompositionEvent('compositionstart', {
          data: '',
          bubbles: true,
          cancelable: true
        });
        input.dispatchEvent(event);
      });
      
      // Type during composition
      await page.keyboard.type('テスト'); // Japanese "test"
      
      // Try to send with Enter (should not send during composition)
      await page.keyboard.press('Enter');
      
      // Verify message was not sent
      await page.waitForTimeout(500);
      const messageCount = await chatPage.getMessageCount();
      expect(messageCount).toBe(0);
      
      // End composition
      await page.evaluate(() => {
        const input = document.querySelector('[data-testid="chat-input"]');
        const event = new CompositionEvent('compositionend', {
          data: 'テスト',
          bubbles: true,
          cancelable: true
        });
        input.dispatchEvent(event);
      });
      
      // Now Enter should work
      await page.keyboard.press('Enter');
      await chatPage.waitForAssistantResponse();
      
      // Verify message was sent
      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toContain('テスト');
    });
  });

  test('should persist Ctrl+Enter setting', async ({ page }) => {
    // Enable Send by Ctrl+Enter
    await page.locator('[data-testid="quick-settings-toggle"]').click();
    await page.locator('text=Send by Ctrl+Enter').click();
    await page.locator('[data-testid="quick-settings-toggle"]').click();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open settings and verify it's still enabled
    await page.locator('[data-testid="quick-settings-toggle"]').click();
    const checkbox = await page.locator('input[type="checkbox"]').filter({ 
      has: page.locator('text=Send by Ctrl+Enter') 
    });
    await expect(checkbox).toBeChecked();
  });

  test('should work correctly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Type a message
    await chatPage.chatInput.fill('Mobile test message');
    
    // On mobile, Enter should still send by default
    await page.keyboard.press('Enter');
    
    // Wait for message to be sent
    await chatPage.waitForAssistantResponse();
    
    // Verify message was sent
    const lastMessage = await chatPage.getLastMessage();
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('Mobile test message');
    
    // Check mobile hint text
    const mobileHint = await page.locator('.sm\\:hidden').filter({
      hasText: /Enter to send/
    }).isVisible();
    expect(mobileHint).toBe(true);
  });
});