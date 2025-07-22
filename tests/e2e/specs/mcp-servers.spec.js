// tests/e2e/specs/mcp-servers.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('MCP (Model Context Protocol) Servers', () => {
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

  test('should list available MCP servers', async ({ page }) => {
    // Open MCP settings
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Should show installed servers
    await expect(page.locator('[data-testid="mcp-server-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-filesystem"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-github"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-sqlite"]')).toBeVisible();
    
    // Should show server status
    await expect(page.locator('[data-testid="mcp-server-filesystem"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'active');
  });

  test('should configure MCP server settings', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Configure GitHub MCP server
    await page.click('[data-testid="mcp-server-github"] [data-testid="configure-button"]');
    
    // Enter configuration
    await page.fill('[data-testid="github-token-input"]', 'ghp_test_token_12345');
    await page.fill('[data-testid="github-org-input"]', 'test-org');
    await page.check('[data-testid="github-enable-write"]');
    
    // Save configuration
    await page.click('[data-testid="save-mcp-config"]');
    await expect(page.locator('[data-testid="config-saved-toast"]')).toBeVisible();
    
    // Server should restart
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'restarting');
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'active', { timeout: 10000 });
  });

  test('should use filesystem MCP server', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Use filesystem operations via MCP
    await chatPage.sendMessage('Using the filesystem MCP server, list all files in the src directory');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should show MCP usage indicator
    await expect(page.locator('[data-testid="mcp-tool-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-tool-used"]')).toContainText('filesystem');
    
    // Response should contain file listing
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText(/files?.*src/i);
    await expect(response).toMatch(/\.(js|ts|json)/);
    
    // Create file via MCP
    await chatPage.sendMessage('Use the filesystem MCP to create a new file test-mcp.txt with content "Hello from MCP"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*test-mcp\.txt/i);
  });

  test('should use GitHub MCP server', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // List issues
    await chatPage.sendMessage('Use the GitHub MCP server to list open issues in this repository');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="mcp-tool-used"]')).toContainText('github');
    
    const response = await chatPage.getLastResponse();
    if (response.includes('no open issues')) {
      expect(response).toContainText(/no open issues/i);
    } else {
      expect(response).toMatch(/#\d+/); // Issue numbers
    }
    
    // Create an issue
    await chatPage.sendMessage('Create a GitHub issue titled "Test Issue from MCP" with body "This is a test issue created via MCP"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*issue|new issue/i);
    await expect(chatPage.getLastResponse()).toMatch(/#\d+/);
  });

  test('should use SQLite MCP server', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Create database
    await chatPage.sendMessage('Use the SQLite MCP server to create a database test.db and a table users with columns id, name, email');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="mcp-tool-used"]')).toContainText('sqlite');
    await expect(chatPage.getLastResponse()).toContainText(/created.*table.*users/i);
    
    // Insert data
    await chatPage.sendMessage('Insert a user with name "John Doe" and email "john@example.com"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/inserted|added/i);
    
    // Query data
    await chatPage.sendMessage('Query all users from the database');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('John Doe');
    await expect(chatPage.getLastResponse()).toContainText('john@example.com');
  });

  test('should install new MCP servers', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Browse available servers
    await page.click('[data-testid="browse-mcp-servers"]');
    
    // Should show server marketplace
    await expect(page.locator('[data-testid="mcp-marketplace"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-slack"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-jira"]')).toBeVisible();
    
    // Install Slack MCP server
    await page.click('[data-testid="mcp-server-slack"] [data-testid="install-button"]');
    
    // Should show installation progress
    await expect(page.locator('[data-testid="installing-mcp-server"]')).toBeVisible();
    await expect(page.locator('[data-testid="installation-progress"]')).toContainText(/downloading|installing/i);
    
    // Should complete installation
    await expect(page.locator('[data-testid="installation-complete"]')).toBeVisible({ timeout: 30000 });
    
    // Server should appear in list
    await page.click('[data-testid="close-marketplace"]');
    await expect(page.locator('[data-testid="mcp-server-slack"]')).toBeVisible();
  });

  test('should handle MCP server errors', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Try to use unconfigured server
    await chatPage.sendMessage('Use the Jira MCP server to create a ticket');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should show error about missing configuration
    await expect(chatPage.getLastResponse()).toContainText(/not configured|configuration required|setup.*Jira/i);
    
    // Try invalid operation
    await chatPage.sendMessage('Use the filesystem MCP to delete the entire root directory');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/not allowed|permission denied|dangerous/i);
  });

  test('should manage MCP server permissions', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Open permissions for filesystem MCP
    await page.click('[data-testid="mcp-server-filesystem"] [data-testid="permissions-button"]');
    
    // Should show current permissions
    await expect(page.locator('[data-testid="permission-read-files"]')).toBeChecked();
    await expect(page.locator('[data-testid="permission-write-files"]')).toBeChecked();
    await expect(page.locator('[data-testid="permission-delete-files"]')).toBeChecked();
    
    // Restrict permissions
    await page.uncheck('[data-testid="permission-delete-files"]');
    await page.fill('[data-testid="allowed-paths"]', '/project/src\n/project/tests');
    
    // Save permissions
    await page.click('[data-testid="save-permissions"]');
    await expect(page.locator('[data-testid="permissions-saved"]')).toBeVisible();
    
    // Test restricted permissions
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    await chatPage.sendMessage('Delete the file package.json using filesystem MCP');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/permission denied|not allowed/i);
  });

  test('should show MCP server logs', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // View logs for a server
    await page.click('[data-testid="mcp-server-filesystem"] [data-testid="view-logs-button"]');
    
    // Should show log viewer
    await expect(page.locator('[data-testid="mcp-log-viewer"]')).toBeVisible();
    await expect(page.locator('[data-testid="log-entries"]')).toBeVisible();
    
    // Should have log entries
    const logEntry = page.locator('[data-testid="log-entry"]').first();
    await expect(logEntry).toBeVisible();
    await expect(logEntry).toContainText(/\d{4}-\d{2}-\d{2}/); // Date
    await expect(logEntry).toContainText(/INFO|DEBUG|ERROR/); // Log level
    
    // Filter logs
    await page.selectOption('[data-testid="log-level-filter"]', 'ERROR');
    
    // Should only show error logs
    const visibleLogs = await page.locator('[data-testid="log-entry"]:visible').count();
    for (let i = 0; i < visibleLogs; i++) {
      await expect(page.locator('[data-testid="log-entry"]').nth(i)).toContainText('ERROR');
    }
  });

  test('should restart and stop MCP servers', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Stop a server
    await page.click('[data-testid="mcp-server-github"] [data-testid="stop-button"]');
    
    // Should show stopping status
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'stopping');
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'stopped', { timeout: 5000 });
    
    // Start button should appear
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="start-button"]')).toBeVisible();
    
    // Restart the server
    await page.click('[data-testid="mcp-server-github"] [data-testid="start-button"]');
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'starting');
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'active', { timeout: 10000 });
    
    // Restart all servers
    await page.click('[data-testid="restart-all-servers"]');
    await expect(page.locator('[data-testid="restarting-all-notice"]')).toBeVisible();
  });

  test('should handle multiple MCP operations in sequence', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Chain multiple MCP operations
    await chatPage.sendMessage(`
      1. Use filesystem MCP to create a data.json file
      2. Use SQLite MCP to create a database from that JSON
      3. Use GitHub MCP to create an issue about the data import
    `);
    
    await testHelpers.waitForAssistantResponse(page, 30000);
    
    // Should show multiple MCP tool uses
    const mcpTools = await page.locator('[data-testid="mcp-tool-used"]').count();
    expect(mcpTools).toBeGreaterThanOrEqual(3);
    
    // Response should indicate all operations completed
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText(/created.*data\.json/i);
    await expect(response).toContainText(/database|sqlite/i);
    await expect(response).toContainText(/issue|github/i);
  });

  test('should export and import MCP configurations', async ({ page }) => {
    await dashboardPage.switchToTab('settings');
    await page.click('[data-testid="mcp-servers-tab"]');
    
    // Export configurations
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-mcp-config"]')
    ]);
    
    expect(download.suggestedFilename()).toMatch(/mcp-config.*\.json$/);
    
    // Reset configurations
    await page.click('[data-testid="reset-mcp-config"]');
    await page.click('[data-testid="confirm-reset"]');
    
    // Import configurations
    const fileInput = page.locator('[data-testid="import-mcp-config-input"]');
    await fileInput.setInputFiles(await download.path());
    
    // Should restore configurations
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="mcp-server-github"] [data-testid="server-status"]')).toHaveAttribute('data-status', 'active');
  });
});