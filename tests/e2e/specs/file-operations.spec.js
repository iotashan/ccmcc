// tests/e2e/specs/file-operations.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('File Operations', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
  });

  test('should create new files', async ({ page }) => {
    // Create a simple file
    await chatPage.sendMessage('Create a new file called hello.js with a simple hello world function');
    await testHelpers.waitForAssistantResponse(page);
    
    // Verify file was created
    await expect(chatPage.getLastResponse()).toContainText(/created.*hello\.js/i);
    await expect(page.locator('[data-testid="file-created-notice"]')).toBeVisible();
    
    // File should appear in file explorer
    await expect(page.locator('[data-testid="file-explorer"] [data-testid="file-hello.js"]')).toBeVisible();
    
    // Create file in subdirectory
    await chatPage.sendMessage('Create a file src/utils/helper.js with utility functions');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*src\/utils\/helper\.js/i);
    await expect(page.locator('[data-testid="file-explorer"] [data-testid="file-src/utils/helper.js"]')).toBeVisible();
  });

  test('should read and display file contents', async ({ page }) => {
    // Read existing file
    await chatPage.sendMessage('Show me the contents of package.json');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should display file contents
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText('"name"');
    await expect(response).toContainText('"version"');
    
    // Should show in code block with syntax highlighting
    await expect(page.locator('[data-testid="code-block"][data-language="json"]')).toBeVisible();
    
    // Read file with line numbers
    await chatPage.sendMessage('Show me app.js with line numbers');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="code-block-line-numbers"]')).toBeVisible();
  });

  test('should edit existing files', async ({ page }) => {
    // Edit a file
    await chatPage.sendMessage('Edit package.json and change the version to 2.0.0');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/updated.*package\.json/i);
    await expect(page.locator('[data-testid="file-modified-notice"]')).toBeVisible();
    
    // Show diff
    await expect(page.locator('[data-testid="file-diff"]')).toBeVisible();
    await expect(page.locator('[data-testid="diff-removed"]')).toContainText('1.0.0');
    await expect(page.locator('[data-testid="diff-added"]')).toContainText('2.0.0');
    
    // Multiple edits
    await chatPage.sendMessage('Also add a new script "test:e2e": "playwright test" to package.json');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/added.*script/i);
  });

  test('should delete files', async ({ page }) => {
    // Create a file first
    await chatPage.sendMessage('Create a temporary file temp.txt');
    await testHelpers.waitForAssistantResponse(page);
    
    // Delete the file
    await chatPage.sendMessage('Delete the file temp.txt');
    
    // Should show confirmation dialog
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toContainText('temp.txt');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/deleted.*temp\.txt/i);
    await expect(page.locator('[data-testid="file-deleted-notice"]')).toBeVisible();
    
    // File should disappear from explorer
    await expect(page.locator('[data-testid="file-explorer"] [data-testid="file-temp.txt"]')).not.toBeVisible();
  });

  test('should rename and move files', async ({ page }) => {
    // Create a file
    await chatPage.sendMessage('Create a file old-name.js');
    await testHelpers.waitForAssistantResponse(page);
    
    // Rename file
    await chatPage.sendMessage('Rename old-name.js to new-name.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/renamed.*old-name\.js.*new-name\.js/i);
    
    // Move file to different directory
    await chatPage.sendMessage('Move new-name.js to src/components/');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/moved.*src\/components/i);
    await expect(page.locator('[data-testid="file-moved-notice"]')).toBeVisible();
  });

  test('should handle file permissions', async ({ page }) => {
    // Try to modify read-only file
    await chatPage.sendMessage('Edit the file .git/config');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/permission|denied|cannot.*modify|protected/i);
    
    // Try to create file in protected directory
    await chatPage.sendMessage('Create a file in /etc/system.conf');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/permission|denied|cannot.*create/i);
  });

  test('should work with binary files', async ({ page }) => {
    // Try to read binary file
    await chatPage.sendMessage('Show me the contents of logo.png');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should handle gracefully
    await expect(chatPage.getLastResponse()).toContainText(/binary|image|cannot.*display.*text/i);
    
    // Should offer alternatives
    await expect(chatPage.getLastResponse()).toContainText(/size|dimensions|format/i);
    
    // Copy binary file
    await chatPage.sendMessage('Copy logo.png to assets/logo-backup.png');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/copied.*logo\.png/i);
  });

  test('should handle large files efficiently', async ({ page }) => {
    // Request large file
    await chatPage.sendMessage('Show me the large-data.json file');
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="large-file-loading"]')).toBeVisible({ timeout: 2000 });
    
    await testHelpers.waitForAssistantResponse(page, 30000);
    
    // Should truncate or paginate
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText(/truncated|showing.*first|large.*file/i);
    
    // Should offer to view specific parts
    await chatPage.sendMessage('Show me lines 1000-1100 of large-data.json');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="line-range-display"]')).toBeVisible();
  });

  test('should create directory structures', async ({ page }) => {
    // Create nested directories
    await chatPage.sendMessage('Create a directory structure: src/components/common/buttons/');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*director/i);
    
    // Create with files
    await chatPage.sendMessage('Create directories src/api/v2/ and add an index.js file in it');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*src\/api\/v2.*index\.js/i);
    
    // Directory should appear in explorer
    await expect(page.locator('[data-testid="directory-src/api/v2"]')).toBeVisible();
  });

  test('should perform batch file operations', async ({ page }) => {
    // Create multiple files
    await chatPage.sendMessage('Create three test files: test1.js, test2.js, and test3.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*3.*files/i);
    
    // Batch rename
    await chatPage.sendMessage('Rename all test*.js files to spec*.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/renamed.*files/i);
    await expect(page.locator('[data-testid="batch-operation-summary"]')).toBeVisible();
    
    // Batch delete
    await chatPage.sendMessage('Delete all spec*.js files');
    
    // Should show batch confirmation
    await expect(page.locator('[data-testid="batch-delete-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="batch-delete-count"]')).toContainText('3');
    
    await page.click('[data-testid="confirm-batch-delete"]');
    await testHelpers.waitForAssistantResponse(page);
  });

  test('should handle file templates', async ({ page }) => {
    // Create from template
    await chatPage.sendMessage('Create a new React component called Button using the standard template');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*Button/i);
    
    // Should use proper template structure
    await chatPage.sendMessage('Show me the Button component');
    await testHelpers.waitForAssistantResponse(page);
    
    const componentCode = await chatPage.getLastResponse();
    await expect(componentCode).toContainText('import React');
    await expect(componentCode).toContainText('export default Button');
    
    // Create with custom template
    await chatPage.sendMessage('Create a new API endpoint for users using REST conventions');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*endpoint|route/i);
  });

  test('should show file metadata', async ({ page }) => {
    // Get file info
    await chatPage.sendMessage('Show me information about package.json');
    await testHelpers.waitForAssistantResponse(page);
    
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText(/size|modified|created/i);
    await expect(response).toMatch(/\d+.*bytes/i);
    
    // Get directory info
    await chatPage.sendMessage('How many files are in the src directory?');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toMatch(/\d+.*files/);
    await expect(chatPage.getLastResponse()).toContainText('src');
  });

  test('should handle symbolic links', async ({ page }) => {
    // Create symlink
    await chatPage.sendMessage('Create a symbolic link from config/dev.json to config.json');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*symbolic.*link|symlink/i);
    
    // Show symlink in explorer
    await expect(page.locator('[data-testid="file-config.json"][data-type="symlink"]')).toBeVisible();
    
    // Follow symlink
    await chatPage.sendMessage('Show me the contents of the config.json symlink');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('dev.json');
  });

  test('should integrate with version control', async ({ page }) => {
    // Create file and check git status
    await chatPage.sendMessage('Create a new file feature.js and show me the git status');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/untracked.*feature\.js/i);
    
    // File explorer should show git status
    await expect(page.locator('[data-testid="file-feature.js"][data-git-status="untracked"]')).toBeVisible();
    
    // Modify tracked file
    await chatPage.sendMessage('Edit README.md and add a new section');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="file-README.md"][data-git-status="modified"]')).toBeVisible();
  });
});