// tests/e2e/specs/ui-responsiveness.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('UI Responsiveness and Mobile Support', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
  });

  test('should adapt to mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Mobile menu should be visible
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Desktop navigation should be hidden
    await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();
    
    // Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-menu-drawer"]')).toBeVisible();
    
    // Navigate via mobile menu
    await page.click('[data-testid="mobile-nav-projects"]');
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
    
    // Close menu by clicking outside
    await page.click('body', { position: { x: 350, y: 400 } });
    await expect(page.locator('[data-testid="mobile-menu-drawer"]')).not.toBeVisible();
  });

  test('should handle tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Should show compact navigation
    await expect(page.locator('[data-testid="tablet-nav"]')).toBeVisible();
    
    // Sidebar should be collapsible
    await expect(page.locator('[data-testid="sidebar-toggle"]')).toBeVisible();
    
    // Projects should show in grid
    const projectGrid = page.locator('[data-testid="project-grid"]');
    const gridColumns = await projectGrid.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    );
    expect(gridColumns).toContain('2'); // 2 columns on tablet
  });

  test('should handle responsive breakpoints', async ({ page }) => {
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    const breakpoints = [
      { width: 320, height: 568, name: 'mobile-small' },
      { width: 375, height: 812, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 1280, height: 720, name: 'desktop' },
      { width: 1920, height: 1080, name: 'desktop-large' }
    ];
    
    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      
      // Check layout adaptation
      const layoutClass = await page.locator('body').getAttribute('data-viewport');
      expect(['mobile', 'tablet', 'desktop']).toContain(layoutClass);
      
      // Verify no horizontal scroll
      const hasHorizontalScroll = await page.evaluate(() => 
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalScroll).toBe(false);
    }
  });

  test('should support touch interactions on mobile', async ({ page, browser }) => {
    // Create mobile context with touch support
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await context.newPage();
    
    await testHelpers.loginTestUser(mobilePage);
    const mobileDashboard = new DashboardPage(mobilePage);
    await mobileDashboard.goto();
    
    // Swipe to show sidebar
    await mobilePage.touchscreen.swipe({
      start: { x: 10, y: 400 },
      end: { x: 200, y: 400 },
      steps: 10
    });
    
    await expect(mobilePage.locator('[data-testid="mobile-sidebar"]')).toBeVisible();
    
    // Swipe to hide sidebar
    await mobilePage.touchscreen.swipe({
      start: { x: 200, y: 400 },
      end: { x: 10, y: 400 },
      steps: 10
    });
    
    await expect(mobilePage.locator('[data-testid="mobile-sidebar"]')).not.toBeVisible();
    
    // Long press for context menu
    const projectElement = mobilePage.locator('[data-testid="project-nodejs"]');
    const box = await projectElement.boundingBox();
    
    await mobilePage.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2, { delay: 1000 });
    await expect(mobilePage.locator('[data-testid="touch-context-menu"]')).toBeVisible();
    
    await context.close();
  });

  test('should handle responsive chat interface', async ({ page }) => {
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('[data-testid="file-explorer-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-sidebar"]')).toBeVisible();
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="file-explorer-panel"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="toggle-panels-button"]')).toBeVisible();
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('[data-testid="mobile-chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-toolbar"]')).toBeVisible();
  });

  test('should handle orientation changes', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    const mobilePage = await context.newPage();
    
    await testHelpers.loginTestUser(mobilePage);
    await mobilePage.goto('/dashboard');
    
    // Portrait orientation
    await expect(mobilePage.locator('[data-testid="portrait-layout"]')).toBeVisible();
    
    // Switch to landscape
    await mobilePage.setViewportSize({ width: 812, height: 375 });
    
    // Should adapt layout
    await expect(mobilePage.locator('[data-testid="landscape-layout"]')).toBeVisible();
    
    // UI elements should reorganize
    const chatButton = mobilePage.locator('[data-testid="start-chat-button"]');
    const landscapePosition = await chatButton.boundingBox();
    
    // Switch back to portrait
    await mobilePage.setViewportSize({ width: 375, height: 812 });
    const portraitPosition = await chatButton.boundingBox();
    
    // Position should change
    expect(landscapePosition.y).not.toBe(portraitPosition.y);
    
    await context.close();
  });

  test('should optimize images for different screen sizes', async ({ page }) => {
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Check responsive images
    const checkImages = async (viewport) => {
      await page.setViewportSize(viewport);
      
      const images = await page.locator('img[data-testid^="responsive-"]').all();
      for (const img of images) {
        const srcset = await img.getAttribute('srcset');
        expect(srcset).toBeTruthy();
        
        const currentSrc = await img.evaluate(el => el.currentSrc);
        if (viewport.width <= 768) {
          expect(currentSrc).toContain('small');
        } else if (viewport.width <= 1280) {
          expect(currentSrc).toContain('medium');
        } else {
          expect(currentSrc).toContain('large');
        }
      }
    };
    
    await checkImages({ width: 375, height: 812 });
    await checkImages({ width: 1280, height: 720 });
    await checkImages({ width: 1920, height: 1080 });
  });

  test('should handle responsive typography', async ({ page }) => {
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Mobile typography
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileFontSize = await page.locator('h1').first().evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // Desktop typography
    await page.setViewportSize({ width: 1280, height: 720 });
    const desktopFontSize = await page.locator('h1').first().evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // Desktop should have larger font
    expect(parseInt(desktopFontSize)).toBeGreaterThan(parseInt(mobileFontSize));
    
    // Line height should also adapt
    const mobileLineHeight = await page.locator('p').first().evaluate(el => 
      window.getComputedStyle(el).lineHeight
    );
    await page.setViewportSize({ width: 375, height: 812 });
    const desktopLineHeight = await page.locator('p').first().evaluate(el => 
      window.getComputedStyle(el).lineHeight
    );
    
    expect(parseFloat(desktopLineHeight)).toBeGreaterThan(parseFloat(mobileLineHeight));
  });

  test('should handle mobile keyboard interactions', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await context.newPage();
    
    await testHelpers.loginTestUser(mobilePage);
    const mobileChat = new ChatPage(mobilePage);
    const mobileDashboard = new DashboardPage(mobilePage);
    
    await mobileDashboard.goto();
    await mobileDashboard.selectProject('project-nodejs');
    await mobilePage.click('[data-testid="start-chat-button"]');
    
    // Focus input
    await mobilePage.tap('[data-testid="mobile-chat-input"]');
    
    // Simulate virtual keyboard
    await mobilePage.evaluate(() => {
      window.visualViewport.height = window.innerHeight * 0.6; // Keyboard takes 40%
      window.dispatchEvent(new Event('resize'));
    });
    
    // Chat area should resize
    const chatHeight = await mobilePage.locator('[data-testid="chat-messages"]').evaluate(el => 
      el.getBoundingClientRect().height
    );
    expect(chatHeight).toBeLessThan(500); // Reduced height with keyboard
    
    // Input should remain visible
    await expect(mobilePage.locator('[data-testid="mobile-chat-input"]')).toBeInViewport();
    
    await context.close();
  });

  test('should optimize performance on mobile', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    const mobilePage = await context.newPage();
    
    // Monitor performance
    await mobilePage.evaluateOnNewDocument(() => {
      window.performanceMetrics = {
        fps: [],
        memory: []
      };
      
      let lastTime = performance.now();
      function measureFPS() {
        const currentTime = performance.now();
        const fps = 1000 / (currentTime - lastTime);
        window.performanceMetrics.fps.push(fps);
        lastTime = currentTime;
        requestAnimationFrame(measureFPS);
      }
      measureFPS();
    });
    
    await testHelpers.loginTestUser(mobilePage);
    await mobilePage.goto('/dashboard');
    
    // Perform interactions
    await mobilePage.tap('[data-testid="mobile-menu-button"]');
    await mobilePage.waitForTimeout(500);
    await mobilePage.tap('[data-testid="project-nodejs"]');
    await mobilePage.waitForTimeout(500);
    
    // Check performance metrics
    const metrics = await mobilePage.evaluate(() => window.performanceMetrics);
    
    // Average FPS should be above 30
    const avgFPS = metrics.fps.reduce((a, b) => a + b, 0) / metrics.fps.length;
    expect(avgFPS).toBeGreaterThan(30);
    
    // Check for reduced motion
    await mobilePage.emulateMedia({ reducedMotion: 'reduce' });
    const hasReducedAnimations = await mobilePage.evaluate(() => {
      const element = document.querySelector('[data-testid="animated-element"]');
      return window.getComputedStyle(element).animationDuration === '0s';
    });
    expect(hasReducedAnimations).toBe(true);
    
    await context.close();
  });

  test('should handle offline mode on mobile', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    const mobilePage = await context.newPage();
    
    await testHelpers.loginTestUser(mobilePage);
    await mobilePage.goto('/dashboard');
    
    // Go offline
    await context.setOffline(true);
    
    // Should show offline indicator
    await expect(mobilePage.locator('[data-testid="offline-banner"]')).toBeVisible();
    
    // Cached content should work
    await mobilePage.tap('[data-testid="project-nodejs"]');
    await expect(mobilePage.locator('[data-testid="offline-mode-notice"]')).toBeVisible();
    
    // Queue actions
    await mobilePage.tap('[data-testid="star-project-button"]');
    await expect(mobilePage.locator('[data-testid="action-queued-toast"]')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
    
    // Should sync queued actions
    await expect(mobilePage.locator('[data-testid="syncing-indicator"]')).toBeVisible();
    await expect(mobilePage.locator('[data-testid="sync-complete-toast"]')).toBeVisible({ timeout: 5000 });
    
    await context.close();
  });
});