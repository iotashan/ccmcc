// tests/e2e/specs/performance-stress.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Performance and Stress Testing', () => {
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

  test('should handle large file operations efficiently', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    const startTime = Date.now();
    
    // Request to read a large file
    await chatPage.sendMessage('Read and analyze the large-dataset.json file (5MB)');
    await testHelpers.waitForAssistantResponse(page);
    
    const responseTime = Date.now() - startTime;
    
    // Should complete within reasonable time (30 seconds for 5MB file)
    expect(responseTime).toBeLessThan(30000);
    
    // Should show progress indicator for large files
    await chatPage.sendMessage('Process the huge-log-file.log (50MB)');
    
    // Progress indicator should appear
    await expect(page.locator('[data-testid="file-processing-progress"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-testid="file-processing-progress"]')).toContainText(/\d+%/);
    
    // Should complete eventually
    await testHelpers.waitForAssistantResponse(page, 60000);
  });

  test('should maintain responsiveness with many concurrent messages', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Send multiple messages rapidly
    const messagePromises = [];
    for (let i = 0; i < 10; i++) {
      messagePromises.push((async () => {
        await page.fill('[data-testid="chat-input"]', `Quick question ${i + 1}: What is ${i + 1} + ${i + 1}?`);
        await page.keyboard.press('Enter');
      })());
      await page.waitForTimeout(100); // Small delay between messages
    }
    
    await Promise.all(messagePromises);
    
    // UI should remain responsive
    const inputEnabled = await page.locator('[data-testid="chat-input"]').isEnabled();
    expect(inputEnabled).toBe(true);
    
    // Should queue messages appropriately
    await expect(page.locator('[data-testid="message-queue-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-queue-indicator"]')).toContainText(/\d+ messages? in queue/);
    
    // All messages should eventually be processed
    await page.waitForTimeout(30000); // Allow time for processing
    const responses = await page.locator('[data-testid="assistant-message"]').count();
    expect(responses).toBeGreaterThanOrEqual(10);
  });

  test('should handle memory efficiently with long sessions', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Generate a long conversation
    for (let i = 0; i < 50; i++) {
      await chatPage.sendMessage(`Message ${i + 1}: Generate a paragraph about topic ${i + 1}`);
      // Don't wait for each response to simulate continuous interaction
      if (i % 10 === 0) {
        await page.waitForTimeout(5000); // Periodic pauses
      }
    }
    
    // Check memory after extended use
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory increase should be reasonable (less than 100MB)
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    
    // Should implement virtual scrolling for long conversations
    await expect(page.locator('[data-testid="virtual-scroll-container"]')).toBeVisible();
  });

  test('should optimize rendering for code-heavy responses', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Request large code generation
    await chatPage.sendMessage('Generate a complete REST API with 20 endpoints including all CRUD operations');
    
    // Measure time to first render
    const renderStartTime = Date.now();
    await page.waitForSelector('[data-testid="code-block"]', { timeout: 10000 });
    const timeToFirstRender = Date.now() - renderStartTime;
    
    // Should start rendering quickly even for large responses
    expect(timeToFirstRender).toBeLessThan(2000);
    
    // Should use syntax highlighting efficiently
    await testHelpers.waitForAssistantResponse(page, 30000);
    
    // All code blocks should be highlighted
    const codeBlocks = await page.locator('[data-testid="code-block"]').count();
    expect(codeBlocks).toBeGreaterThan(0);
    
    // Scrolling should remain smooth
    const scrollStartTime = Date.now();
    await page.evaluate(() => {
      document.querySelector('[data-testid="chat-container"]').scrollTop = 1000;
    });
    const scrollTime = Date.now() - scrollStartTime;
    expect(scrollTime).toBeLessThan(100); // Scrolling should be instant
  });

  test('should handle rapid file switching efficiently', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    const files = ['app.js', 'server.js', 'config.js', 'database.js', 'routes.js'];
    const switchTimes = [];
    
    // Rapidly switch between files
    for (let i = 0; i < 20; i++) {
      const file = files[i % files.length];
      const startTime = Date.now();
      
      await chatPage.sendMessage(`Show me ${file}`);
      await page.waitForSelector(`[data-testid="file-content-${file}"]`, { timeout: 5000 });
      
      switchTimes.push(Date.now() - startTime);
    }
    
    // Average file switch time should be fast
    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    expect(avgSwitchTime).toBeLessThan(1000);
    
    // Should cache frequently accessed files
    const lastFiveSwitches = switchTimes.slice(-5);
    const avgLastFive = lastFiveSwitches.reduce((a, b) => a + b, 0) / 5;
    
    // Later switches should be faster due to caching
    expect(avgLastFive).toBeLessThan(avgSwitchTime * 0.8);
  });

  test('should handle multiple browser tabs efficiently', async ({ browser, page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Open multiple tabs
    const contexts = [];
    const pages = [];
    
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const newPage = await context.newPage();
      await testHelpers.loginTestUser(newPage);
      contexts.push(context);
      pages.push(newPage);
    }
    
    // Start chat sessions in all tabs
    const startTime = Date.now();
    await Promise.all(pages.map(async (p) => {
      const dashboard = new DashboardPage(p);
      await dashboard.goto();
      await dashboard.selectProject('project-nodejs');
      await dashboard.clickStartChat();
    }));
    
    const loadTime = Date.now() - startTime;
    
    // Should handle multiple tabs without significant slowdown
    expect(loadTime).toBeLessThan(10000);
    
    // Send messages from multiple tabs
    await Promise.all(pages.map(async (p, index) => {
      const chat = new ChatPage(p);
      await chat.sendMessage(`Message from tab ${index + 1}`);
    }));
    
    // All tabs should remain responsive
    for (const p of pages) {
      const responsive = await p.locator('[data-testid="chat-input"]').isEnabled();
      expect(responsive).toBe(true);
    }
    
    // Cleanup
    await Promise.all(contexts.map(c => c.close()));
  });

  test('should implement efficient search with large codebases', async ({ page }) => {
    await dashboardPage.selectProject('project-large'); // Large project with many files
    await dashboardPage.clickStartChat();
    
    // Perform complex search
    const searchStartTime = Date.now();
    await chatPage.sendMessage('Search for all TODO comments across the entire codebase');
    
    // Should show search progress
    await expect(page.locator('[data-testid="search-progress"]')).toBeVisible({ timeout: 2000 });
    
    await testHelpers.waitForAssistantResponse(page, 30000);
    const searchTime = Date.now() - searchStartTime;
    
    // Search should complete in reasonable time
    expect(searchTime).toBeLessThan(15000);
    
    // Should display results efficiently
    const resultCount = await page.locator('[data-testid="search-result-item"]').count();
    expect(resultCount).toBeGreaterThan(0);
    
    // Results should be paginated or virtualized if many
    if (resultCount > 50) {
      await expect(page.locator('[data-testid="results-pagination"]')).toBeVisible();
    }
  });

  test('should handle network latency gracefully', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async route => {
      await page.waitForTimeout(500); // 500ms delay
      await route.continue();
    });
    
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // UI should show loading states
    await chatPage.chatInput.fill('Test message with slow network');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('[data-testid="message-sending"]')).toBeVisible();
    
    // Should not block UI during network delays
    const inputEnabled = await chatPage.chatInput.isEnabled();
    expect(inputEnabled).toBe(true);
    
    // Should eventually succeed
    await testHelpers.waitForAssistantResponse(page, 30000);
  });

  test('should optimize CPU usage during idle times', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Send a message and wait for response
    await chatPage.sendMessage('Hello');
    await testHelpers.waitForAssistantResponse(page);
    
    // Monitor CPU usage during idle
    const cpuUsageStart = await page.evaluate(() => {
      return performance.now();
    });
    
    // Wait for 5 seconds of idle time
    await page.waitForTimeout(5000);
    
    // Check for unnecessary re-renders or animations
    const unnecessaryActivity = await page.evaluate(() => {
      let renderCount = 0;
      const observer = new MutationObserver(() => renderCount++);
      observer.observe(document.body, { childList: true, subtree: true });
      
      return new Promise(resolve => {
        setTimeout(() => {
          observer.disconnect();
          resolve(renderCount);
        }, 1000);
      });
    });
    
    // Should have minimal DOM changes during idle
    expect(unnecessaryActivity).toBeLessThan(10);
  });

  test('should handle rapid project switching', async ({ page }) => {
    const projects = ['project-nodejs', 'project-python', 'project-react'];
    const switchTimes = [];
    
    for (let i = 0; i < 15; i++) {
      const project = projects[i % projects.length];
      const startTime = Date.now();
      
      await dashboardPage.goto();
      await dashboardPage.selectProject(project);
      await dashboardPage.clickStartChat();
      
      // Wait for chat to be ready
      await expect(chatPage.chatInput).toBeEnabled();
      
      switchTimes.push(Date.now() - startTime);
    }
    
    // Average project switch should be fast
    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
    expect(avgSwitchTime).toBeLessThan(2000);
    
    // Performance should not degrade over time
    const firstFive = switchTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const lastFive = switchTimes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    
    // Last switches should not be significantly slower
    expect(lastFive).toBeLessThan(firstFive * 1.5);
  });

  test('should measure and respect performance budgets', async ({ page }) => {
    await dashboardPage.goto();
    
    // Measure initial page load metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    // Performance budgets
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // FCP < 2s
    expect(metrics.domContentLoaded).toBeLessThan(3000); // DOM ready < 3s
    expect(metrics.loadComplete).toBeLessThan(5000); // Full load < 5s
    
    // Check bundle size warnings
    const bundleSize = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(r => r.name.includes('.js'))
        .reduce((total, r) => total + r.transferSize, 0);
    });
    
    // JavaScript bundle should be reasonable (< 2MB)
    expect(bundleSize).toBeLessThan(2 * 1024 * 1024);
  });
});