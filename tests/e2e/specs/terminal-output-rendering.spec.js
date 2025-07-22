// tests/e2e/specs/terminal-output-rendering.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';

test.describe('Terminal Output Rendering', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // Create a test user for terminal output tests
    testUser = {
      username: 'terminal_test_user',
      email: 'terminal@example.com',
      password: 'Terminal123!'
    };
    
    // Register user if not exists
    const page = await browser.newPage();
    const login = new LoginPage(page);
    await page.goto('/');
    
    try {
      await login.clickRegisterLink();
      await login.fillRegistrationForm(testUser);
      await login.submitRegistration();
    } catch (error) {
      // User might already exist, try to login
      await page.goto('/');
      await login.fillLoginForm(testUser.username, testUser.password);
      await login.submitLogin();
    }
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    await page.goto('/');
    await loginPage.fillLoginForm(testUser.username, testUser.password);
    await loginPage.submitLogin();
    
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should render bash-stdout tags properly in terminal output', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request a simple bash command
    const bashRequest = 'Run the command: ls -la';
    await chatPage.sendMessage(bashRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for bash tool usage
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    // Verify terminal output is rendered with proper styling
    const terminalOutput = response.locator('.bg-gray-900'); // Terminal background
    await expect(terminalOutput).toBeVisible();
    
    // Check for command prompt styling
    const commandPrompt = terminalOutput.locator('.text-green-500');
    await expect(commandPrompt).toContainText('$');
    
    // Check for command text
    const commandText = terminalOutput.locator('.text-gray-100');
    await expect(commandText).toContainText('ls -la');
    
    // Verify stdout content is displayed
    const stdoutContent = terminalOutput.locator('.text-gray-300');
    await expect(stdoutContent).toBeVisible();
    
    // Ensure no raw bash tags are visible
    const rawTags = await response.textContent();
    expect(rawTags).not.toContain('<bash-stdout>');
    expect(rawTags).not.toContain('</bash-stdout>');
    expect(rawTags).not.toContain('&lt;bash-stdout&gt;');
    expect(rawTags).not.toContain('&lt;/bash-stdout&gt;');
  });

  test('should render bash-stderr tags with red color for errors', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request a command that will produce stderr output
    const errorRequest = 'Run this command that will produce an error: ls /nonexistent/directory';
    await chatPage.sendMessage(errorRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for bash tool usage
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    // Verify terminal output container
    const terminalOutput = response.locator('.bg-gray-900');
    await expect(terminalOutput).toBeVisible();
    
    // Check for error output with red color
    const stderrContent = terminalOutput.locator('.text-red-400');
    await expect(stderrContent).toBeVisible();
    
    // Verify error message contains expected text
    await expect(stderrContent).toContainText('No such file or directory') || 
           await expect(stderrContent).toContainText('cannot access');
    
    // Ensure no raw bash-stderr tags are visible
    const rawTags = await response.textContent();
    expect(rawTags).not.toContain('<bash-stderr>');
    expect(rawTags).not.toContain('</bash-stderr>');
    expect(rawTags).not.toContain('&lt;bash-stderr&gt;');
    expect(rawTags).not.toContain('&lt;/bash-stderr&gt;');
  });

  test('should render mixed stdout and stderr output correctly', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request a command that produces both stdout and stderr
    const mixedRequest = 'Run these commands: echo "This is stdout" && ls /nonexistent/file 2>&1';
    await chatPage.sendMessage(mixedRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    const terminalOutput = response.locator('.bg-gray-900');
    
    // Check for both stdout and stderr content
    const stdoutContent = terminalOutput.locator('.text-gray-300');
    const stderrContent = terminalOutput.locator('.text-red-400');
    
    await expect(stdoutContent).toBeVisible();
    await expect(stderrContent).toBeVisible();
    
    // Verify stdout contains expected text
    await expect(stdoutContent).toContainText('This is stdout');
    
    // Verify stderr styling is applied
    await expect(stderrContent).toContainText('No such file or directory') ||
           await expect(stderrContent).toContainText('cannot access');
  });

  test('should render multiple bash commands in sequence', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request multiple commands
    const multiCommandRequest = 'Run these commands in sequence: pwd, echo "Hello World", date';
    await chatPage.sendMessage(multiCommandRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // There might be multiple bash tool invocations
    const bashTools = response.locator('[data-tool="Bash"]');
    const bashCount = await bashTools.count();
    expect(bashCount).toBeGreaterThanOrEqual(1);
    
    // Check each bash output
    for (let i = 0; i < bashCount; i++) {
      const bashTool = bashTools.nth(i);
      const terminalOutput = bashTool.locator('.bg-gray-900');
      await expect(terminalOutput).toBeVisible();
      
      // Each should have a command prompt
      await expect(terminalOutput.locator('.text-green-500')).toBeVisible();
    }
  });

  test('should handle empty stderr output without showing raw tags', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request a successful command that might have empty stderr
    const successRequest = 'Create a new directory called test-dir using mkdir';
    await chatPage.sendMessage(successRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for bash tool usage
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    // Verify no raw tags are shown
    const responseText = await response.textContent();
    expect(responseText).not.toContain('<bash-stderr></bash-stderr>');
    expect(responseText).not.toContain('<bash-stderr/>');
    expect(responseText).not.toContain('&lt;bash-stderr&gt;&lt;/bash-stderr&gt;');
  });

  test('should render bash-input tags with proper command styling', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request a git command
    const gitRequest = 'Initialize a new git repository in the current directory';
    await chatPage.sendMessage(gitRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for bash tool usage
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    // Verify terminal output
    const terminalOutput = response.locator('.bg-gray-900');
    await expect(terminalOutput).toBeVisible();
    
    // Check command prompt and text
    await expect(terminalOutput.locator('.text-green-500')).toContainText('$');
    await expect(terminalOutput.locator('.text-gray-100')).toContainText('git init');
    
    // Ensure no raw bash-input tags
    const rawTags = await response.textContent();
    expect(rawTags).not.toContain('<bash-input>');
    expect(rawTags).not.toContain('</bash-input>');
    expect(rawTags).not.toContain('&lt;bash-input&gt;');
  });

  test('should maintain terminal output formatting across message updates', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // First command
    await chatPage.sendMessage('Show current directory with pwd');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // Second command that might reference the first
    await chatPage.sendMessage('Now list files in that directory');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // Check that both responses maintain proper terminal formatting
    const allResponses = await chatPage.getAllAssistantResponses();
    
    for (const response of allResponses) {
      const bashTools = response.locator('[data-tool="Bash"]');
      if (await bashTools.count() > 0) {
        // Each bash output should have proper terminal styling
        const terminalOutput = bashTools.first().locator('.bg-gray-900');
        await expect(terminalOutput).toBeVisible();
        
        // No raw tags should be visible
        const responseText = await response.textContent();
        expect(responseText).not.toMatch(/<bash-(input|stdout|stderr)>/);
        expect(responseText).not.toMatch(/&lt;bash-(input|stdout|stderr)&gt;/);
      }
    }
  });

  test('should render special characters in terminal output correctly', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request command with special characters
    const specialCharRequest = 'Echo this text with special characters: "Hello & <World> with \'quotes\'"';
    await chatPage.sendMessage(specialCharRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    const terminalOutput = response.locator('.bg-gray-900');
    
    // Verify special characters are rendered correctly
    const outputText = await terminalOutput.textContent();
    expect(outputText).toContain('Hello & <World> with \'quotes\'');
    
    // Ensure HTML entities are not shown
    expect(outputText).not.toContain('&amp;');
    expect(outputText).not.toContain('&lt;');
    expect(outputText).not.toContain('&gt;');
    expect(outputText).not.toContain('&quot;');
  });

  test('should handle multiline terminal output properly', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request command with multiline output
    const multilineRequest = 'Create a simple shell script that outputs multiple lines and run it';
    await chatPage.sendMessage(multilineRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Look for file creation
    await expect(response.locator('[data-tool="Write"]')).toBeVisible();
    
    // Look for script execution
    const bashExecution = response.locator('[data-tool="Bash"]').last();
    await expect(bashExecution).toBeVisible();
    
    // Check terminal output preserves line breaks
    const terminalOutput = bashExecution.locator('.bg-gray-900');
    await expect(terminalOutput).toBeVisible();
    
    // Verify whitespace-pre-wrap class for proper formatting
    const outputElements = terminalOutput.locator('.whitespace-pre-wrap');
    const count = await outputElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should render terminal output in tool use messages correctly', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request that will use multiple tools including bash
    const toolChainRequest = 'Create a package.json file and then run npm install to set up the project';
    await chatPage.sendMessage(toolChainRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 20000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for Write tool (package.json creation)
    await expect(response.locator('[data-tool="Write"]')).toBeVisible();
    
    // Check for Bash tool (npm install)
    const bashTool = response.locator('[data-tool="Bash"]');
    await expect(bashTool).toBeVisible();
    
    // Expand the tool output if needed
    const toolDetails = bashTool.locator('details');
    if (await toolDetails.count() > 0) {
      const isOpen = await toolDetails.getAttribute('open');
      if (!isOpen) {
        await toolDetails.click();
      }
    }
    
    // Verify terminal styling in tool output
    const terminalInTool = bashTool.locator('.bg-gray-900');
    await expect(terminalInTool).toBeVisible();
    
    // Check for npm command
    await expect(terminalInTool.locator('.text-gray-100')).toContainText('npm install');
    
    // Ensure no raw tags in tool output
    const toolText = await bashTool.textContent();
    expect(toolText).not.toMatch(/<bash-(input|stdout|stderr)>/);
  });
});