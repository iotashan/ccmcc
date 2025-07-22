// tests/e2e/specs/multi-machine.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ChatPage } from '../pages/chat.page';
import { testHelpers } from '../../utils/test-helpers';

test.describe('Multi-Machine Tests', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    // Login before each test
    await loginPage.goto();
    await loginPage.login('testuser', 'testpass123');
    await dashboardPage.goto();
  });

  test('should display multiple machines and their status', async ({ page }) => {
    await dashboardPage.switchToTab('machines');
    
    // Check machine 1 status
    const machine1Status = await dashboardPage.getMachineStatus('machine-1');
    expect(machine1Status).toBe('online');
    
    // Check machine 2 status
    const machine2Status = await dashboardPage.getMachineStatus('machine-2');
    expect(machine2Status).toBe('online');
    
    // Check offline machine
    const offlineStatus = await dashboardPage.getMachineStatus('machine-offline');
    expect(offlineStatus).toBe('offline');
  });

  test('should switch between machines', async ({ page }) => {
    // Start on machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    
    // Verify we're connected to machine 1
    await expect(page.locator('[data-testid="active-machine-machine-1"]')).toBeVisible();
    
    // Switch to machine 2
    await testHelpers.switchMachine(page, 'machine-1', 'machine-2');
    
    // Verify we're now on machine 2
    await expect(page.locator('[data-testid="active-machine-machine-2"]')).toBeVisible();
  });

  test('should maintain separate project lists per machine', async ({ page }) => {
    // Connect to machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    await dashboardPage.switchToTab('projects');
    
    // Create project on machine 1
    await dashboardPage.createNewProject('machine1-project', 'nodejs');
    
    // Switch to machine 2
    await testHelpers.switchMachine(page, 'machine-1', 'machine-2');
    await dashboardPage.switchToTab('projects');
    
    // Verify project from machine 1 is not visible
    await expect(page.locator('[data-testid="project-machine1-project"]')).not.toBeVisible();
    
    // Create different project on machine 2
    await dashboardPage.createNewProject('machine2-project', 'python');
    
    // Switch back to machine 1
    await testHelpers.switchMachine(page, 'machine-2', 'machine-1');
    await dashboardPage.switchToTab('projects');
    
    // Verify original project is still there
    await expect(page.locator('[data-testid="project-machine1-project"]')).toBeVisible();
    
    // Verify machine 2 project is not visible
    await expect(page.locator('[data-testid="project-machine2-project"]')).not.toBeVisible();
  });

  test('should sync session across machines', async ({ page, context }) => {
    // Create session on machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    await dashboardPage.selectProject('project-nodejs');
    await testHelpers.createNewSession(page, 'shared-session');
    
    // Send a message
    await chatPage.sendMessage('Hello from machine 1');
    const sessionUrl = page.url();
    const sessionId = sessionUrl.split('/').pop();
    
    // Open new page for machine 2
    const page2 = await context.newPage();
    const dashboardPage2 = new DashboardPage(page2);
    const chatPage2 = new ChatPage(page2);
    
    await page2.goto('/dashboard');
    await testHelpers.connectMachine(page2, 'machine-2');
    
    // Resume the same session
    await dashboardPage2.resumeSession(sessionId);
    
    // Verify message from machine 1 is visible
    const lastMessage = await chatPage2.getLastMessage();
    expect(lastMessage.content).toContain('Hello from machine 1');
    
    // Send message from machine 2
    await chatPage2.sendMessage('Hello from machine 2');
    
    // Switch back to machine 1 and verify new message
    await page.reload();
    const messages = await chatPage.getMessageCount();
    expect(messages).toBeGreaterThanOrEqual(4); // User + assistant messages from both machines
  });

  test('should handle concurrent operations on different machines', async ({ page, context }) => {
    // Setup two pages for two machines
    const page2 = await context.newPage();
    
    // Connect both machines
    await testHelpers.connectMachine(page, 'machine-1');
    await page2.goto('/dashboard');
    await testHelpers.connectMachine(page2, 'machine-2');
    
    // Select same project on both machines
    await dashboardPage.selectProject('project-nodejs');
    const dashboardPage2 = new DashboardPage(page2);
    await dashboardPage2.selectProject('project-nodejs');
    
    // Create different files simultaneously
    await Promise.all([
      testHelpers.createFile(page, 'file1.js', 'console.log("machine 1");'),
      testHelpers.createFile(page2, 'file2.js', 'console.log("machine 2");')
    ]);
    
    // Verify both files exist
    await page.reload();
    await expect(page.locator('[data-testid="file-file1.js"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-file2.js"]')).toBeVisible();
  });

  test('should show machine-specific MCP configurations', async ({ page }) => {
    // Connect to machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    await dashboardPage.switchToTab('settings');
    
    // Check MCP servers for machine 1
    await page.click('[data-testid="mcp-settings"]');
    await expect(page.locator('[data-testid="mcp-server-filesystem"]')).toBeVisible();
    
    // Switch to machine 2
    await testHelpers.switchMachine(page, 'machine-1', 'machine-2');
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-settings"]');
    
    // Machine 2 might have different MCP configuration
    const mcpServers = await page.locator('[data-testid^="mcp-server-"]').all();
    expect(mcpServers.length).toBeGreaterThan(0);
  });

  test('should handle machine disconnection gracefully', async ({ page }) => {
    // Connect to offline machine (should fail)
    await dashboardPage.switchToTab('machines');
    
    // Try to connect to offline machine
    await page.click('[data-testid="connect-machine-offline"]');
    
    // Should show error
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
    const errorText = await page.locator('[data-testid="connection-error"]').textContent();
    expect(errorText).toContain('Failed to connect');
    
    // Machine should still show as offline
    const status = await dashboardPage.getMachineStatus('machine-offline');
    expect(status).toBe('offline');
  });

  test('should display machine activity indicators', async ({ page, context }) => {
    // Setup two pages
    const page2 = await context.newPage();
    
    // Connect both machines
    await testHelpers.connectMachine(page, 'machine-1');
    await page2.goto('/dashboard');
    await testHelpers.connectMachine(page2, 'machine-2');
    
    // Create session on machine 1
    await dashboardPage.selectProject('project-nodejs');
    await testHelpers.createNewSession(page, 'activity-test');
    
    // Start typing on machine 1
    const chatPage = new ChatPage(page);
    await chatPage.chatInput.fill('Testing activity indicator...');
    
    // Machine 2 should see activity indicator
    await page2.goto('/dashboard');
    await page2.click('[data-testid="machines-tab"]');
    await expect(page2.locator('[data-testid="machine-1-activity"]')).toBeVisible();
  });

  test('should handle session conflicts between machines', async ({ page, context }) => {
    // Create session on machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    await dashboardPage.selectProject('project-nodejs');
    await testHelpers.createNewSession(page, 'conflict-test');
    
    // Edit same file on machine 1
    await testHelpers.createFile(page, 'conflict.js', 'console.log("version 1");');
    
    // Connect machine 2 and edit same file
    const page2 = await context.newPage();
    await page2.goto('/dashboard');
    await testHelpers.connectMachine(page2, 'machine-2');
    const dashboardPage2 = new DashboardPage(page2);
    await dashboardPage2.selectProject('project-nodejs');
    
    // Try to edit the same file
    await testHelpers.editFile(page2, 'conflict.js', 'console.log("version 2");');
    
    // Should show conflict resolution dialog
    await expect(page2.locator('[data-testid="conflict-dialog"]')).toBeVisible();
    
    // Choose to keep machine 2 version
    await page2.click('[data-testid="keep-current"]');
    
    // Verify file has machine 2 version
    const fileContent = await page2.locator('[data-testid="editor-content"]').textContent();
    expect(fileContent).toContain('version 2');
  });

  test('should track machine-specific metrics', async ({ page }) => {
    // Connect to machine 1
    await testHelpers.connectMachine(page, 'machine-1');
    await dashboardPage.switchToTab('settings');
    
    // View machine metrics
    await page.click('[data-testid="machine-metrics"]');
    
    // Should show metrics for machine 1
    await expect(page.locator('[data-testid="cpu-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="disk-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-sessions"]')).toBeVisible();
    
    // Metrics should have reasonable values
    const cpuUsage = await page.locator('[data-testid="cpu-usage"]').textContent();
    expect(parseInt(cpuUsage)).toBeGreaterThanOrEqual(0);
    expect(parseInt(cpuUsage)).toBeLessThanOrEqual(100);
  });
});