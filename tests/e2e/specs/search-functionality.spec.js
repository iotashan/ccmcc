// tests/e2e/specs/search-functionality.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Search Functionality', () => {
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

  test('should search across all files in project', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Global search
    await chatPage.sendMessage('Search for "TODO" across all files');
    await testHelpers.waitForAssistantResponse(page);
    
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText(/found.*files|matches.*files/i);
    await expect(response).toMatch(/\d+.*matches?/);
    
    // Should show file paths and line numbers
    await expect(response).toMatch(/[\w/]+\.\w+:\d+/);
  });

  test('should search with regex patterns', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Regex search
    await chatPage.sendMessage('Search for regex pattern /function\\s+\\w+\\s*\\(/ to find function declarations');
    await testHelpers.waitForAssistantResponse(page);
    
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText('function');
    await expect(response).toMatch(/\d+.*matches?/);
    
    // Complex regex
    await chatPage.sendMessage('Find all email addresses using regex pattern');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toMatch(/email|@|regex/i);
  });

  test('should search within specific file types', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search only in JavaScript files
    await chatPage.sendMessage('Search for "require" only in .js files');
    await testHelpers.waitForAssistantResponse(page);
    
    const jsResponse = await chatPage.getLastResponse();
    await expect(jsResponse).toContainText('.js');
    await expect(jsResponse).not.toContainText('.json');
    await expect(jsResponse).not.toContainText('.md');
    
    // Search in multiple file types
    await chatPage.sendMessage('Search for "version" in .json and .yml files');
    await testHelpers.waitForAssistantResponse(page);
    
    const multiTypeResponse = await chatPage.getLastResponse();
    await expect(multiTypeResponse).toMatch(/\.(json|yml)/);
  });

  test('should perform case-sensitive and case-insensitive searches', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Case-insensitive search (default)
    await chatPage.sendMessage('Search for "Error" (case-insensitive)');
    await testHelpers.waitForAssistantResponse(page);
    
    const insensitiveResults = await chatPage.getLastResponse();
    await expect(insensitiveResults).toMatch(/error|Error|ERROR/);
    
    // Case-sensitive search
    await chatPage.sendMessage('Search for "Error" (case-sensitive only)');
    await testHelpers.waitForAssistantResponse(page);
    
    const sensitiveResults = await chatPage.getLastResponse();
    await expect(sensitiveResults).toContainText('Error');
    await expect(sensitiveResults).toMatch(/case.*sensitive|exact.*case/i);
  });

  test('should search and replace across files', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search and preview replacements
    await chatPage.sendMessage('Find all occurrences of "var " and show me what would change if replaced with "const "');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('var ');
    await expect(chatPage.getLastResponse()).toContainText('const ');
    await expect(chatPage.getLastResponse()).toMatch(/preview|would.*change/i);
    
    // Perform replacement
    await chatPage.sendMessage('Replace all "var " with "const " in all .js files');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toMatch(/replaced|updated.*files/i);
    await expect(chatPage.getLastResponse()).toMatch(/\d+.*replacements?/);
  });

  test('should search within specific directories', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search in src directory only
    await chatPage.sendMessage('Search for "import" only in the src/ directory');
    await testHelpers.waitForAssistantResponse(page);
    
    const srcResults = await chatPage.getLastResponse();
    await expect(srcResults).toContainText('src/');
    await expect(srcResults).not.toContainText('test/');
    await expect(srcResults).not.toContainText('node_modules/');
    
    // Exclude directories
    await chatPage.sendMessage('Search for "test" but exclude node_modules and .git directories');
    await testHelpers.waitForAssistantResponse(page);
    
    const excludedResults = await chatPage.getLastResponse();
    await expect(excludedResults).not.toContainText('node_modules/');
    await expect(excludedResults).not.toContainText('.git/');
  });

  test('should search git history', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search in git commits
    await chatPage.sendMessage('Search git history for commits containing "fix"');
    await testHelpers.waitForAssistantResponse(page);
    
    const commitResults = await chatPage.getLastResponse();
    await expect(commitResults).toMatch(/commit|commits/i);
    await expect(commitResults).toContainText('fix');
    await expect(commitResults).toMatch(/[a-f0-9]{7,}/); // Commit hashes
    
    // Search for code in git history
    await chatPage.sendMessage('Find when the function "authenticate" was added or modified');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('authenticate');
    await expect(chatPage.getLastResponse()).toMatch(/added|modified|changed/i);
  });

  test('should provide contextual search results', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search with context lines
    await chatPage.sendMessage('Search for "error" and show 3 lines of context around each match');
    await testHelpers.waitForAssistantResponse(page);
    
    const contextResults = await chatPage.getLastResponse();
    await expect(contextResults).toContainText('error');
    // Should show multiple lines around matches
    await expect(contextResults.split('\n').length).toBeGreaterThan(10);
  });

  test('should search symbols and definitions', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search for function definitions
    await chatPage.sendMessage('Find the definition of the function "processData"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('processData');
    await expect(chatPage.getLastResponse()).toContainText('function');
    
    // Search for class definitions
    await chatPage.sendMessage('Find all class definitions in the project');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('class');
    await expect(chatPage.getLastResponse()).toMatch(/class\s+\w+/);
    
    // Search for variable declarations
    await chatPage.sendMessage('Find where the variable "config" is declared');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('config');
    await expect(chatPage.getLastResponse()).toMatch(/const|let|var/);
  });

  test('should perform fuzzy file search', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Fuzzy file name search
    await chatPage.sendMessage('Find files matching "usr" (fuzzy search for user-related files)');
    await testHelpers.waitForAssistantResponse(page);
    
    const fuzzyResults = await chatPage.getLastResponse();
    await expect(fuzzyResults).toMatch(/user|usr/i);
    await expect(fuzzyResults).toMatch(/\.(js|json|ts)/);
    
    // Pattern-based file search
    await chatPage.sendMessage('Find all test files (files with "test" or "spec" in the name)');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toMatch(/test|spec/);
    await expect(chatPage.getLastResponse()).toMatch(/\.(test|spec)\.(js|ts)/);
  });

  test('should integrate search with navigation', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Search and navigate
    await chatPage.sendMessage('Search for "handleError" and take me to its definition');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should provide clickable link or navigation
    await expect(chatPage.getLastResponse()).toContainText('handleError');
    await expect(page.locator('[data-testid="code-link"]')).toBeVisible();
    
    // Click to navigate
    await page.click('[data-testid="code-link"]:first-child');
    await expect(page.locator('[data-testid="editor-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-content"]')).toContainText('handleError');
  });

  test('should save and reuse search queries', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await dashboardPage.clickStartChat();
    
    // Perform a search
    await chatPage.sendMessage('Search for "async function" and save this search as "async-functions"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('async function');
    await expect(chatPage.getLastResponse()).toMatch(/saved|stored/i);
    
    // Reuse saved search
    await chatPage.sendMessage('Run my saved search "async-functions"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('async function');
    
    // List saved searches
    await chatPage.sendMessage('Show me all my saved searches');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('async-functions');
  });

  test('should search across multiple projects', async ({ page }) => {
    // Start from dashboard
    await dashboardPage.clickStartChat();
    
    // Search across all projects
    await chatPage.sendMessage('Search for "API_KEY" across all my projects');
    await testHelpers.waitForAssistantResponse(page);
    
    const multiProjectResults = await chatPage.getLastResponse();
    await expect(multiProjectResults).toContainText('API_KEY');
    await expect(multiProjectResults).toMatch(/project-nodejs|project-python|project-react/);
    await expect(multiProjectResults).toMatch(/\d+.*projects?/);
    
    // Filter by project type
    await chatPage.sendMessage('Search for "package.json" only in Node.js projects');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('package.json');
    await expect(chatPage.getLastResponse()).toContainText('nodejs');
  });
});