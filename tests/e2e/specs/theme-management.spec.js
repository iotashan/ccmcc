// tests/e2e/specs/theme-management.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Theme Management and UI Customization', () => {
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

  test('should switch between light and dark themes', async ({ page }) => {
    // Check default theme
    const htmlElement = page.locator('html');
    const initialTheme = await htmlElement.getAttribute('data-theme');
    
    // Open settings
    await dashboardPage.switchToTab('settings');
    
    // Toggle theme
    await page.click('[data-testid="theme-toggle"]');
    
    // Verify theme changed
    const newTheme = await htmlElement.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(newTheme);
    
    // Verify visual changes
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    if (newTheme === 'dark') {
      expect(backgroundColor).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      // Dark theme should have low RGB values
    } else {
      expect(backgroundColor).toMatch(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      // Light theme should have high RGB values
    }
    
    // Theme should persist after navigation
    await dashboardPage.goto();
    const persistedTheme = await htmlElement.getAttribute('data-theme');
    expect(persistedTheme).toBe(newTheme);
  });

  test('should apply system theme preference', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Enable system theme
    await page.click('[data-testid="use-system-theme"]');
    
    // Emulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500);
    
    const darkTheme = await page.locator('html').getAttribute('data-theme');
    expect(darkTheme).toBe('dark');
    
    // Emulate light mode preference
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(500);
    
    const lightTheme = await page.locator('html').getAttribute('data-theme');
    expect(lightTheme).toBe('light');
  });

  test('should customize editor theme independently', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Open editor settings
    await page.click('[data-testid="editor-settings"]');
    
    // Change editor theme
    await page.selectOption('[data-testid="editor-theme-select"]', 'monokai');
    
    // Send message to trigger code display
    await chatPage.sendMessage('Show me a sample JavaScript function');
    await testHelpers.waitForAssistantResponse(page);
    
    // Verify editor theme applied
    const codeBlock = page.locator('[data-testid="code-block"]').first();
    await expect(codeBlock).toHaveAttribute('data-theme', 'monokai');
    
    // Verify syntax highlighting colors changed
    const keyword = codeBlock.locator('.token.keyword').first();
    const keywordColor = await keyword.evaluate(el => 
      window.getComputedStyle(el).color
    );
    expect(keywordColor).toBeTruthy();
  });

  test('should adjust font size and family', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Get initial font size
    const initialFontSize = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontSize;
    });
    
    // Increase font size
    await page.click('[data-testid="font-size-increase"]');
    
    const increasedFontSize = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontSize;
    });
    expect(parseInt(increasedFontSize)).toBeGreaterThan(parseInt(initialFontSize));
    
    // Change font family
    await page.selectOption('[data-testid="font-family-select"]', 'monospace');
    
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily).toContain('monospace');
    
    // Test accessibility - minimum and maximum sizes
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="font-size-decrease"]');
    }
    
    const minFontSize = await page.evaluate(() => {
      return parseInt(window.getComputedStyle(document.body).fontSize);
    });
    expect(minFontSize).toBeGreaterThanOrEqual(12); // Minimum readable size
  });

  test('should toggle UI density modes', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Switch to compact mode
    await page.click('[data-testid="density-compact"]');
    
    // Verify compact spacing
    const compactPadding = await page.locator('.dashboard-item').first().evaluate(el => {
      return window.getComputedStyle(el).padding;
    });
    
    // Switch to comfortable mode
    await page.click('[data-testid="density-comfortable"]');
    
    const comfortablePadding = await page.locator('.dashboard-item').first().evaluate(el => {
      return window.getComputedStyle(el).padding;
    });
    
    // Comfortable should have more padding than compact
    expect(parseInt(comfortablePadding)).toBeGreaterThan(parseInt(compactPadding));
    
    // Switch to spacious mode
    await page.click('[data-testid="density-spacious"]');
    
    const spaciousPadding = await page.locator('.dashboard-item').first().evaluate(el => {
      return window.getComputedStyle(el).padding;
    });
    
    expect(parseInt(spaciousPadding)).toBeGreaterThan(parseInt(comfortablePadding));
  });

  test('should customize accent colors', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Open color customization
    await page.click('[data-testid="customize-colors"]');
    
    // Pick a custom accent color
    await page.fill('[data-testid="accent-color-input"]', '#FF5722');
    await page.click('[data-testid="apply-accent-color"]');
    
    // Verify accent color applied to buttons
    const primaryButton = page.locator('[data-testid="primary-button"]').first();
    const buttonColor = await primaryButton.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // Convert hex to RGB and verify
    expect(buttonColor).toContain('rgb(255, 87, 34)');
    
    // Test color contrast warnings
    await page.fill('[data-testid="accent-color-input"]', '#FFFF00'); // Yellow - poor contrast
    await page.click('[data-testid="apply-accent-color"]');
    
    await expect(page.locator('[data-testid="contrast-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="contrast-warning"]')).toContainText(/contrast|accessibility/i);
  });

  test('should toggle sidebar and panel visibility', async ({ page }) => {
    // Verify sidebar is visible by default
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // Toggle sidebar
    await page.click('[data-testid="toggle-sidebar"]');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    
    // Content should expand
    const contentWidth = await page.locator('[data-testid="main-content"]').evaluate(el => {
      return el.offsetWidth;
    });
    
    // Toggle sidebar back
    await page.click('[data-testid="toggle-sidebar"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    const contentWidthWithSidebar = await page.locator('[data-testid="main-content"]').evaluate(el => {
      return el.offsetWidth;
    });
    
    expect(contentWidth).toBeGreaterThan(contentWidthWithSidebar);
    
    // Test panel toggles in chat view
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Toggle file explorer panel
    await page.click('[data-testid="toggle-file-explorer"]');
    const fileExplorerHidden = await page.locator('[data-testid="file-explorer-panel"]').isHidden();
    expect(fileExplorerHidden).toBe(true);
  });

  test('should save and load theme presets', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Customize multiple settings
    await page.click('[data-testid="theme-toggle"]'); // Dark theme
    await page.selectOption('[data-testid="font-family-select"]', 'serif');
    await page.click('[data-testid="density-compact"]');
    
    // Save as preset
    await page.click('[data-testid="save-theme-preset"]');
    await page.fill('[data-testid="preset-name-input"]', 'My Custom Theme');
    await page.click('[data-testid="confirm-save-preset"]');
    
    await expect(page.locator('[data-testid="preset-saved-toast"]')).toBeVisible();
    
    // Reset to defaults
    await page.click('[data-testid="reset-theme-defaults"]');
    
    // Load saved preset
    await page.click('[data-testid="theme-presets-dropdown"]');
    await page.click('[data-testid="preset-My Custom Theme"]');
    
    // Verify settings restored
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
    
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(fontFamily).toContain('serif');
  });

  test('should support high contrast mode', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Enable high contrast mode
    await page.click('[data-testid="high-contrast-toggle"]');
    
    // Verify high contrast styles applied
    await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');
    
    // Check border visibility
    const borderWidth = await page.locator('[data-testid="card-component"]').first().evaluate(el => {
      return window.getComputedStyle(el).borderWidth;
    });
    expect(parseInt(borderWidth)).toBeGreaterThan(0);
    
    // Verify focus indicators are more prominent
    await page.keyboard.press('Tab');
    const focusOutline = await page.evaluate(() => {
      const focusedElement = document.activeElement;
      return window.getComputedStyle(focusedElement).outline;
    });
    expect(focusOutline).toMatch(/\d+px/); // Should have visible outline
  });

  test('should animate theme transitions smoothly', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Enable transition animations
    await page.click('[data-testid="enable-theme-transitions"]');
    
    // Listen for transition events
    const transitionPromise = page.evaluate(() => {
      return new Promise(resolve => {
        document.body.addEventListener('transitionend', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), 2000); // Timeout fallback
      });
    });
    
    // Toggle theme
    await page.click('[data-testid="theme-toggle"]');
    
    // Verify transition occurred
    const transitioned = await transitionPromise;
    expect(transitioned).toBe(true);
  });

  test('should export and import theme settings', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Customize settings
    await page.click('[data-testid="theme-toggle"]');
    await page.fill('[data-testid="accent-color-input"]', '#2196F3');
    await page.click('[data-testid="apply-accent-color"]');
    
    // Export theme settings
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-theme-settings"]')
    ]);
    
    expect(download.suggestedFilename()).toMatch(/theme.*\.json$/);
    
    // Reset settings
    await page.click('[data-testid="reset-theme-defaults"]');
    
    // Import theme settings
    const fileInput = page.locator('[data-testid="import-theme-input"]');
    await fileInput.setInputFiles(await download.path());
    
    // Verify settings restored
    await expect(page.locator('[data-testid="import-success-toast"]')).toBeVisible();
    
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('dark');
    
    const accentColor = await page.locator('[data-testid="accent-color-input"]').inputValue();
    expect(accentColor.toUpperCase()).toBe('#2196F3');
  });

  test('should sync theme across multiple browser tabs', async ({ page, context }) => {
    await dashboardPage.switchToTab('settings');
    
    // Open second tab
    const page2 = await context.newPage();
    const dashboard2 = new DashboardPage(page2);
    await testHelpers.loginTestUser(page2);
    await dashboard2.goto();
    
    // Change theme in first tab
    await page.click('[data-testid="theme-toggle"]');
    
    // Theme should sync to second tab
    await page2.waitForTimeout(1000); // Allow time for sync
    const theme2 = await page2.locator('html').getAttribute('data-theme');
    const theme1 = await page.locator('html').getAttribute('data-theme');
    
    expect(theme2).toBe(theme1);
    
    // Change font size in second tab
    await dashboard2.switchToTab('settings');
    await page2.click('[data-testid="font-size-increase"]');
    
    // Should sync to first tab
    await page.waitForTimeout(1000);
    const fontSize1 = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontSize;
    });
    const fontSize2 = await page2.evaluate(() => {
      return window.getComputedStyle(document.body).fontSize;
    });
    
    expect(fontSize1).toBe(fontSize2);
    
    await page2.close();
  });

  test('should respect reduced motion preferences', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    // Verify animations are disabled
    const animationDuration = await page.evaluate(() => {
      const element = document.querySelector('[data-testid="animated-element"]');
      return window.getComputedStyle(element).animationDuration;
    });
    
    expect(animationDuration).toBe('0s');
    
    // Verify transitions are instant
    await page.click('[data-testid="theme-toggle"]');
    
    const transitionDuration = await page.evaluate(() => {
      return window.getComputedStyle(document.body).transitionDuration;
    });
    
    expect(transitionDuration).toBe('0s');
  });
});