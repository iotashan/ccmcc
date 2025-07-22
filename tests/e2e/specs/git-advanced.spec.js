// tests/e2e/specs/git-advanced.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Git Advanced Operations', () => {
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
  });

  test('should create and switch branches', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create a new branch
    await chatPage.sendMessage('Create a new branch called feature/user-auth');
    await testHelpers.waitForAssistantResponse(page);
    
    // Verify branch was created
    await expect(page.locator('[data-testid="git-branch-indicator"]')).toContainText('feature/user-auth');
    await expect(chatPage.getLastResponse()).toContainText(/created.*branch.*feature\/user-auth/i);
    
    // Switch to another branch
    await chatPage.sendMessage('Switch to the main branch');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(page.locator('[data-testid="git-branch-indicator"]')).toContainText('main');
    await expect(chatPage.getLastResponse()).toContainText(/switched.*main/i);
    
    // List all branches
    await chatPage.sendMessage('Show me all git branches');
    await testHelpers.waitForAssistantResponse(page);
    
    const response = await chatPage.getLastResponse();
    await expect(response).toContainText('main');
    await expect(response).toContainText('feature/user-auth');
  });

  test('should handle merge operations', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create feature branch with changes
    await chatPage.sendMessage('Create a branch called feature/add-logging and switch to it');
    await testHelpers.waitForAssistantResponse(page);
    
    // Make changes on feature branch
    await chatPage.sendMessage('Create a file logger.js with a simple console logger function');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit this change with message "Add logger utility"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Switch back to main
    await chatPage.sendMessage('Switch back to main branch');
    await testHelpers.waitForAssistantResponse(page);
    
    // Merge feature branch
    await chatPage.sendMessage('Merge feature/add-logging into main');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/merged.*feature\/add-logging.*into.*main/i);
    
    // Verify file exists on main
    await chatPage.sendMessage('Show me the contents of logger.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('console');
  });

  test('should resolve merge conflicts', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create conflicting changes on two branches
    await chatPage.sendMessage('Create a file config.js with content: { port: 3000 }');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit with message "Add initial config"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Create first branch
    await chatPage.sendMessage('Create and switch to branch feature/update-port');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Update config.js to use port 4000');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit with message "Update port to 4000"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Create conflicting change on main
    await chatPage.sendMessage('Switch to main');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Update config.js to use port 5000');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit with message "Update port to 5000"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Attempt merge (will conflict)
    await chatPage.sendMessage('Try to merge feature/update-port');
    await testHelpers.waitForAssistantResponse(page);
    
    // Should detect conflict
    await expect(chatPage.getLastResponse()).toContainText(/conflict|CONFLICT/);
    await expect(page.locator('[data-testid="merge-conflict-indicator"]')).toBeVisible();
    
    // Resolve conflict
    await chatPage.sendMessage('Resolve the conflict by keeping port 5000 from main');
    await testHelpers.waitForAssistantResponse(page);
    
    // Complete merge
    await chatPage.sendMessage('Complete the merge');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/merge.*completed|resolved/i);
    await expect(page.locator('[data-testid="merge-conflict-indicator"]')).not.toBeVisible();
  });

  test('should handle git stash operations', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Make uncommitted changes
    await chatPage.sendMessage('Create a file temp-work.js with some test code');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Also modify package.json by adding a new script');
    await testHelpers.waitForAssistantResponse(page);
    
    // Stash changes
    await chatPage.sendMessage('Stash my current changes with message "WIP: temporary work"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/stashed|saved/i);
    
    // Verify working directory is clean
    await chatPage.sendMessage('Show git status');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/clean|nothing to commit/i);
    
    // List stashes
    await chatPage.sendMessage('Show me all git stashes');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('WIP: temporary work');
    
    // Apply stash
    await chatPage.sendMessage('Apply the most recent stash');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/applied|restored/i);
    
    // Verify files are restored
    await chatPage.sendMessage('Show me temp-work.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('test code');
  });

  test('should manage git tags', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create a tag
    await chatPage.sendMessage('Create a git tag v1.0.0 with message "First stable release"');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*tag.*v1\.0\.0/i);
    
    // List tags
    await chatPage.sendMessage('Show all git tags');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('v1.0.0');
    
    // Create annotated tag
    await chatPage.sendMessage('Create an annotated tag v1.1.0 with detailed release notes');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/created.*annotated.*tag.*v1\.1\.0/i);
    
    // Push tags to remote
    await chatPage.sendMessage('Push all tags to origin');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/pushed.*tags/i);
    
    // Delete a tag
    await chatPage.sendMessage('Delete the tag v1.0.0 locally');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/deleted.*tag.*v1\.0\.0/i);
  });

  test('should handle git rebase operations', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Setup: Create multiple commits
    await chatPage.sendMessage('Create a series of 3 commits: first adds file1.js, second adds file2.js, third adds file3.js');
    await testHelpers.waitForAssistantResponse(page);
    
    // Create feature branch
    await chatPage.sendMessage('Create and switch to branch feature/rebase-test');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Add a commit that creates feature.js');
    await testHelpers.waitForAssistantResponse(page);
    
    // Add commits to main
    await chatPage.sendMessage('Switch to main and add a commit that creates main-update.js');
    await testHelpers.waitForAssistantResponse(page);
    
    // Rebase feature branch
    await chatPage.sendMessage('Switch to feature/rebase-test and rebase onto main');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/rebased|rebase.*successful/i);
    
    // Verify commit history
    await chatPage.sendMessage('Show the git log with one line per commit');
    await testHelpers.waitForAssistantResponse(page);
    
    const log = await chatPage.getLastResponse();
    await expect(log).toContainText('feature.js');
    await expect(log).toContainText('main-update.js');
  });

  test('should show git blame information', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create a file with multiple contributors (simulated)
    await chatPage.sendMessage('Create a file shared-code.js with multiple functions');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit with message "Initial shared code"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Add more changes
    await chatPage.sendMessage('Add a new function to shared-code.js');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Commit with message "Add helper function"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Show blame
    await chatPage.sendMessage('Show git blame for shared-code.js');
    await testHelpers.waitForAssistantResponse(page);
    
    const blameOutput = await chatPage.getLastResponse();
    await expect(blameOutput).toContainText('Initial shared code');
    await expect(blameOutput).toContainText('Add helper function');
    await expect(blameOutput).toMatch(/[a-f0-9]{7,}/); // Commit hashes
  });

  test('should handle git cherry-pick', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create a commit on feature branch
    await chatPage.sendMessage('Create branch feature/cherry-pick-source and switch to it');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Create important-fix.js and commit with message "Critical bug fix"');
    await testHelpers.waitForAssistantResponse(page);
    
    // Get commit hash
    await chatPage.sendMessage('Show the latest commit hash');
    await testHelpers.waitForAssistantResponse(page);
    
    const commitInfo = await chatPage.getLastResponse();
    const commitHashMatch = commitInfo.match(/[a-f0-9]{7,}/);
    
    // Switch to main and cherry-pick
    await chatPage.sendMessage('Switch to main branch');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage(`Cherry-pick the commit with the critical bug fix`);
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/cherry-picked|applied/i);
    
    // Verify file exists on main
    await chatPage.sendMessage('Check if important-fix.js exists');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('important-fix.js');
  });

  test('should show git diff with various options', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Make changes
    await chatPage.sendMessage('Modify package.json by updating the version');
    await testHelpers.waitForAssistantResponse(page);
    
    // Show basic diff
    await chatPage.sendMessage('Show git diff');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('package.json');
    await expect(chatPage.getLastResponse()).toMatch(/\+.*version|@@/);
    
    // Stage changes and show staged diff
    await chatPage.sendMessage('Stage package.json');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Show git diff --staged');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('package.json');
    
    // Create another file for unstaged diff
    await chatPage.sendMessage('Create a new file test.js without staging it');
    await testHelpers.waitForAssistantResponse(page);
    
    await chatPage.sendMessage('Show only unstaged changes');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('test.js');
    await expect(chatPage.getLastResponse()).not.toContainText('package.json');
  });

  test('should handle git reset operations', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Create commits to reset
    await chatPage.sendMessage('Create three commits: first adds a.js, second adds b.js, third adds c.js');
    await testHelpers.waitForAssistantResponse(page);
    
    // Soft reset
    await chatPage.sendMessage('Do a soft reset to HEAD~1');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/reset.*soft|soft reset/i);
    
    await chatPage.sendMessage('Show git status');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/staged|to be committed/);
    await expect(chatPage.getLastResponse()).toContainText('c.js');
    
    // Hard reset
    await chatPage.sendMessage('Do a hard reset to HEAD~1');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/reset.*hard|hard reset/i);
    
    await chatPage.sendMessage('Check if b.js exists');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/not found|doesn't exist|no such file/i);
  });

  test('should work with git submodules', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Add a submodule
    await chatPage.sendMessage('Add a git submodule from https://github.com/example/shared-utils to libs/shared');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/submodule.*added|added.*submodule/i);
    
    // Initialize submodules
    await chatPage.sendMessage('Initialize and update all submodules');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/initialized|updated/i);
    
    // List submodules
    await chatPage.sendMessage('Show all git submodules');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('libs/shared');
    await expect(chatPage.getLastResponse()).toContainText('shared-utils');
  });

  test('should handle git remote operations', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // List remotes
    await chatPage.sendMessage('Show all git remotes with URLs');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('origin');
    
    // Add new remote
    await chatPage.sendMessage('Add a new remote called upstream with URL https://github.com/original/repo.git');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/added.*remote.*upstream/i);
    
    // Fetch from remote
    await chatPage.sendMessage('Fetch from upstream remote');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/fetch|fetching|fetched/i);
    
    // Show remote branches
    await chatPage.sendMessage('Show all remote branches');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText('origin/');
    await expect(chatPage.getLastResponse()).toContainText('upstream/');
    
    // Remove remote
    await chatPage.sendMessage('Remove the upstream remote');
    await testHelpers.waitForAssistantResponse(page);
    
    await expect(chatPage.getLastResponse()).toContainText(/removed.*remote.*upstream/i);
  });
});