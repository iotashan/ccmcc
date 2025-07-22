// tests/e2e/specs/keyboard-shortcuts.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Keyboard Shortcuts and Accessibility', () => {
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

  test('should show keyboard shortcuts help', async ({ page }) => {
    // Press help shortcut
    await page.keyboard.press('?');
    
    // Should show shortcuts modal
    await expect(page.locator('[data-testid="shortcuts-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcuts-modal"]')).toContainText('Keyboard Shortcuts');
    
    // Should list shortcuts by category
    await expect(page.locator('[data-testid="shortcuts-navigation"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcuts-editing"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcuts-chat"]')).toBeVisible();
    
    // Close with ESC
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="shortcuts-modal"]')).not.toBeVisible();
  });

  test('should navigate with keyboard shortcuts', async ({ page }) => {
    // Go to projects (Cmd/Ctrl+P)
    await page.keyboard.press('Control+P');
    await expect(page.locator('[data-testid="project-quick-switcher"]')).toBeVisible();
    
    // Type to filter
    await page.keyboard.type('nodejs');
    await expect(page.locator('[data-testid="project-result-nodejs"]')).toBeVisible();
    
    // Select with Enter
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/project\/.*nodejs/);
    
    // Go to dashboard (Cmd/Ctrl+D)
    await page.keyboard.press('Control+D');
    await expect(page).toHaveURL('/dashboard');
    
    // Quick search (Cmd/Ctrl+K)
    await page.keyboard.press('Control+K');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Search for action
    await page.keyboard.type('new session');
    await expect(page.locator('[data-testid="command-new-session"]')).toBeVisible();
    
    await page.keyboard.press('Escape');
  });

  test('should use chat keyboard shortcuts', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Focus chat input (/)
    await page.keyboard.press('/');
    await expect(chatPage.chatInput).toBeFocused();
    
    // Type message
    await chatPage.chatInput.fill('Test message');
    
    // Send with Ctrl+Enter
    await page.keyboard.press('Control+Enter');
    
    // Message should be sent
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('Test message');
    
    // Clear input (Cmd/Ctrl+Shift+K)
    await chatPage.chatInput.fill('Another message');
    await page.keyboard.press('Control+Shift+K');
    await expect(chatPage.chatInput).toHaveValue('');
    
    // Navigate messages with arrows
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-testid="previous-message-loaded"]')).toBeVisible();
  });

  test('should support editor shortcuts', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Request code
    await chatPage.sendMessage('Show me a sample JavaScript function');
    await testHelpers.waitForAssistantResponse(page);
    
    // Copy code block (Cmd/Ctrl+C when focused)
    const codeBlock = page.locator('[data-testid="code-block"]').first();
    await codeBlock.click();
    await page.keyboard.press('Control+C');
    
    // Should show copied notification
    await expect(page.locator('[data-testid="code-copied-toast"]')).toBeVisible();
    
    // Open in editor (Cmd/Ctrl+E)
    await codeBlock.click();
    await page.keyboard.press('Control+E');
    await expect(page.locator('[data-testid="code-editor-modal"]')).toBeVisible();
    
    // Editor shortcuts
    await page.keyboard.press('Control+A'); // Select all
    await page.keyboard.press('Control+/'); // Toggle comment
    
    // Save and close
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="code-saved-toast"]')).toBeVisible();
    
    await page.keyboard.press('Escape');
  });

  test('should navigate with Tab key', async ({ page }) => {
    // Start from dashboard
    await page.keyboard.press('Tab');
    
    // Should focus first interactive element
    const firstFocused = await page.evaluate(() => document.activeElement.getAttribute('data-testid'));
    expect(firstFocused).toBeTruthy();
    
    // Tab through main navigation
    const tabSequence = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => ({
        testId: document.activeElement.getAttribute('data-testid'),
        tagName: document.activeElement.tagName
      }));
      tabSequence.push(focused);
    }
    
    // Should have logical tab order
    const interactiveElements = tabSequence.filter(el => 
      ['BUTTON', 'A', 'INPUT', 'SELECT'].includes(el.tagName)
    );
    expect(interactiveElements.length).toBeGreaterThan(5);
    
    // Shift+Tab to go backwards
    await page.keyboard.press('Shift+Tab');
    const previousFocused = await page.evaluate(() => document.activeElement.getAttribute('data-testid'));
    expect(previousFocused).toBe(tabSequence[8].testId);
  });

  test('should support screen reader announcements', async ({ page }) => {
    // Enable screen reader mode
    await page.evaluate(() => {
      document.body.setAttribute('data-screen-reader', 'true');
    });
    
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Check for ARIA live regions
    await chatPage.sendMessage('Hello');
    
    // Should have live region for new messages
    await expect(page.locator('[aria-live="polite"]')).toContainText(/assistant.*typing/i);
    
    await testHelpers.waitForAssistantResponse(page);
    
    // Should announce when complete
    await expect(page.locator('[aria-live="polite"]')).toContainText(/response.*complete/i);
    
    // Check ARIA labels
    const ariaLabels = await page.evaluate(() => {
      const elements = document.querySelectorAll('[aria-label]');
      return Array.from(elements).map(el => el.getAttribute('aria-label'));
    });
    
    expect(ariaLabels.length).toBeGreaterThan(10);
    expect(ariaLabels.some(label => label.includes('Send message'))).toBe(true);
  });

  test('should handle modal navigation', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Open a modal
    await page.click('[data-testid="theme-settings"]');
    
    // Focus should be trapped in modal
    await page.keyboard.press('Tab');
    const firstModalElement = await page.evaluate(() => document.activeElement.closest('[role="dialog"]'));
    expect(firstModalElement).toBeTruthy();
    
    // Tab through modal elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const inModal = await page.evaluate(() => document.activeElement.closest('[role="dialog"]'));
      if (!inModal) break;
    }
    
    // Should cycle back to first element
    const focusedAfterCycle = await page.evaluate(() => document.activeElement.closest('[role="dialog"]'));
    expect(focusedAfterCycle).toBeTruthy();
    
    // ESC to close
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should support custom keyboard shortcuts', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="keyboard-shortcuts-tab"]');
    
    // View current shortcuts
    await expect(page.locator('[data-testid="shortcut-list"]')).toBeVisible();
    
    // Customize a shortcut
    await page.click('[data-testid="shortcut-new-chat"] [data-testid="edit-shortcut"]');
    await page.click('[data-testid="record-shortcut"]');
    
    // Press new key combination
    await page.keyboard.press('Control+Shift+N');
    
    // Save new shortcut
    await page.click('[data-testid="save-shortcut"]');
    await expect(page.locator('[data-testid="shortcut-saved"]')).toBeVisible();
    
    // Test new shortcut
    await dashboardPage.goto();
    await page.keyboard.press('Control+Shift+N');
    
    // Should start new chat
    await expect(page).toHaveURL(/\/chat|\/session/);
  });

  test('should handle vim mode keybindings', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Enable vim mode
    await page.click('[data-testid="editor-settings-tab"]');
    await page.check('[data-testid="enable-vim-mode"]');
    
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Type in normal mode
    await chatPage.chatInput.click();
    await page.keyboard.press('i'); // Insert mode
    await page.keyboard.type('Test vim mode');
    await page.keyboard.press('Escape'); // Normal mode
    
    // Vim navigation
    await page.keyboard.press('0'); // Beginning of line
    await page.keyboard.press('$'); // End of line
    await page.keyboard.press('w'); // Next word
    
    // Vim commands
    await page.keyboard.press('d');
    await page.keyboard.press('d'); // Delete line
    
    await expect(chatPage.chatInput).toHaveValue('');
  });

  test('should show contextual shortcuts', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Hover over elements to show shortcuts
    await page.hover('[data-testid="chat-input"]');
    await expect(page.locator('[data-testid="shortcut-hint"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-hint"]')).toContainText('Ctrl+Enter');
    
    // Context menu with shortcuts
    await page.click('[data-testid="message-options"]', { button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-item-copy"] [data-testid="shortcut"]')).toContainText('Ctrl+C');
  });

  test('should handle international keyboard layouts', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Test with different characters
    const internationalChars = 'café münchën 北京 мосkва';
    await chatPage.chatInput.fill(internationalChars);
    await page.keyboard.press('Enter');
    
    // Should handle correctly
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText(internationalChars);
    
    // Test IME input
    await page.evaluate(() => {
      const event = new CompositionEvent('compositionstart');
      document.querySelector('[data-testid="chat-input"]').dispatchEvent(event);
    });
    
    // Should show IME indicator
    await expect(page.locator('[data-testid="ime-active"]')).toBeVisible();
  });

  test('should provide focus indicators', async ({ page }) => {
    // Check focus visibility
    await page.keyboard.press('Tab');
    
    const focusVisible = await page.evaluate(() => {
      const focused = document.activeElement;
      const styles = window.getComputedStyle(focused);
      return styles.outlineWidth !== '0px' || styles.boxShadow.includes('rgb');
    });
    
    expect(focusVisible).toBe(true);
    
    // High contrast mode
    await page.emulateMedia({ colorScheme: 'high-contrast' });
    
    await page.keyboard.press('Tab');
    const highContrastFocus = await page.evaluate(() => {
      const focused = document.activeElement;
      const styles = window.getComputedStyle(focused);
      return parseInt(styles.outlineWidth) > 2; // Thicker outline in high contrast
    });
    
    expect(highContrastFocus).toBe(true);
  });
});