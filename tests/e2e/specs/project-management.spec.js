// tests/e2e/specs/project-management.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Project Management', () => {
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

  test('should create new projects', async ({ page }) => {
    // Click new project button
    await dashboardPage.newProjectButton.click();
    
    // Fill project details
    await page.fill('[data-testid="project-name-input"]', 'my-awesome-project');
    await page.selectOption('[data-testid="project-type-select"]', 'nodejs');
    await page.fill('[data-testid="project-description"]', 'A test project for E2E testing');
    
    // Select project template
    await page.click('[data-testid="use-template-checkbox"]');
    await page.selectOption('[data-testid="template-select"]', 'express-api');
    
    // Create project
    await page.click('[data-testid="create-project-button"]');
    
    // Should show progress
    await expect(page.locator('[data-testid="project-creation-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-creation-progress"]')).toContainText(/creating|initializing/i);
    
    // Should complete and show in list
    await expect(page.locator('[data-testid="project-my-awesome-project"]')).toBeVisible({ timeout: 10000 });
    
    // Should navigate to project
    await page.click('[data-testid="project-my-awesome-project"]');
    await expect(page).toHaveURL(/\/project\/my-awesome-project/);
  });

  test('should import existing projects', async ({ page }) => {
    // Click import project
    await page.click('[data-testid="import-project-button"]');
    
    // Enter Git URL
    await page.fill('[data-testid="git-url-input"]', 'https://github.com/example/sample-project.git');
    
    // Configure import options
    await page.check('[data-testid="install-dependencies-checkbox"]');
    await page.check('[data-testid="create-env-file-checkbox"]');
    
    // Start import
    await page.click('[data-testid="start-import-button"]');
    
    // Should show import progress
    await expect(page.locator('[data-testid="import-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="import-step-clone"]')).toHaveClass(/completed|in-progress/);
    
    // Should complete import
    await expect(page.locator('[data-testid="import-success"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="project-sample-project"]')).toBeVisible();
  });

  test('should manage project dependencies', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Open project settings
    await page.click('[data-testid="project-settings-button"]');
    await page.click('[data-testid="dependencies-tab"]');
    
    // Should show current dependencies
    await expect(page.locator('[data-testid="dependency-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="dependency-express"]')).toBeVisible();
    
    // Add new dependency
    await page.click('[data-testid="add-dependency-button"]');
    await page.fill('[data-testid="package-name-input"]', 'lodash');
    await page.selectOption('[data-testid="dependency-type-select"]', 'production');
    await page.click('[data-testid="install-package-button"]');
    
    // Should install and show
    await expect(page.locator('[data-testid="installing-package"]')).toBeVisible();
    await expect(page.locator('[data-testid="dependency-lodash"]')).toBeVisible({ timeout: 15000 });
    
    // Update dependency
    await page.click('[data-testid="dependency-express"] [data-testid="update-button"]');
    await expect(page.locator('[data-testid="update-available-notice"]')).toBeVisible();
    await page.click('[data-testid="confirm-update-button"]');
    
    // Remove dependency
    await page.click('[data-testid="dependency-lodash"] [data-testid="remove-button"]');
    await page.click('[data-testid="confirm-remove-button"]');
    await expect(page.locator('[data-testid="dependency-lodash"]')).not.toBeVisible({ timeout: 5000 });
  });

  test('should configure project settings', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await page.click('[data-testid="project-settings-button"]');
    
    // General settings
    await page.fill('[data-testid="project-display-name"]', 'My Node.js App');
    await page.fill('[data-testid="project-description"]', 'Updated description');
    await page.selectOption('[data-testid="node-version-select"]', '18.x');
    
    // Environment variables
    await page.click('[data-testid="environment-tab"]');
    await page.click('[data-testid="add-env-variable"]');
    await page.fill('[data-testid="env-key-input"]', 'API_KEY');
    await page.fill('[data-testid="env-value-input"]', 'secret123');
    await page.click('[data-testid="save-env-variable"]');
    
    // Scripts configuration
    await page.click('[data-testid="scripts-tab"]');
    await page.click('[data-testid="add-script-button"]');
    await page.fill('[data-testid="script-name-input"]', 'test:custom');
    await page.fill('[data-testid="script-command-input"]', 'jest --coverage');
    await page.click('[data-testid="save-script-button"]');
    
    // Save all settings
    await page.click('[data-testid="save-project-settings"]');
    await expect(page.locator('[data-testid="settings-saved-toast"]')).toBeVisible();
  });

  test('should run project scripts', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Open scripts panel
    await page.click('[data-testid="scripts-panel-button"]');
    
    // Should list available scripts
    await expect(page.locator('[data-testid="script-start"]')).toBeVisible();
    await expect(page.locator('[data-testid="script-test"]')).toBeVisible();
    await expect(page.locator('[data-testid="script-build"]')).toBeVisible();
    
    // Run a script
    await page.click('[data-testid="script-test"] [data-testid="run-button"]');
    
    // Should show output
    await expect(page.locator('[data-testid="script-output-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="script-output"]')).toContainText(/test.*running|jest|mocha/i);
    
    // Should show status
    await expect(page.locator('[data-testid="script-status"]')).toContainText(/running|executing/i);
    
    // Should complete
    await expect(page.locator('[data-testid="script-status"]')).toContainText(/completed|passed|failed/, { timeout: 30000 });
    
    // Stop running script
    await page.click('[data-testid="script-start"] [data-testid="run-button"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="stop-script-button"]');
    await expect(page.locator('[data-testid="script-status"]')).toContainText(/stopped|terminated/i);
  });

  test('should manage project branches', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Open branch selector
    await page.click('[data-testid="branch-selector"]');
    
    // Should show current branch
    await expect(page.locator('[data-testid="current-branch"]')).toContainText('main');
    
    // Should list all branches
    await expect(page.locator('[data-testid="branch-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="branch-main"]')).toBeVisible();
    
    // Create new branch
    await page.click('[data-testid="create-branch-button"]');
    await page.fill('[data-testid="new-branch-name"]', 'feature/test-branch');
    await page.selectOption('[data-testid="branch-from-select"]', 'main');
    await page.click('[data-testid="create-branch-confirm"]');
    
    // Should switch to new branch
    await expect(page.locator('[data-testid="current-branch"]')).toContainText('feature/test-branch');
    
    // Switch branches
    await page.click('[data-testid="branch-selector"]');
    await page.click('[data-testid="branch-main"]');
    await expect(page.locator('[data-testid="current-branch"]')).toContainText('main');
    
    // Delete branch
    await page.click('[data-testid="branch-selector"]');
    await page.click('[data-testid="branch-feature/test-branch"] [data-testid="delete-branch"]');
    await page.click('[data-testid="confirm-delete-branch"]');
    await expect(page.locator('[data-testid="branch-feature/test-branch"]')).not.toBeVisible();
  });

  test('should clone and fork projects', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Clone project
    await page.click('[data-testid="project-actions-menu"]');
    await page.click('[data-testid="clone-project"]');
    
    await page.fill('[data-testid="clone-name-input"]', 'project-nodejs-clone');
    await page.check('[data-testid="clone-with-history"]');
    await page.click('[data-testid="start-clone-button"]');
    
    // Should show cloning progress
    await expect(page.locator('[data-testid="clone-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="clone-success"]')).toBeVisible({ timeout: 15000 });
    
    // Cloned project should appear
    await dashboardPage.goto();
    await expect(page.locator('[data-testid="project-project-nodejs-clone"]')).toBeVisible();
    
    // Fork project (different from clone - maintains link)
    await dashboardPage.selectProject('project-nodejs');
    await page.click('[data-testid="project-actions-menu"]');
    await page.click('[data-testid="fork-project"]');
    
    await expect(page.locator('[data-testid="fork-info"]')).toContainText(/forked from/i);
  });

  test('should archive and delete projects', async ({ page }) => {
    // Create a test project first
    await testHelpers.createNewProject(page, 'project-to-archive', 'nodejs');
    
    // Archive project
    await dashboardPage.selectProject('project-to-archive');
    await page.click('[data-testid="project-settings-button"]');
    await page.click('[data-testid="danger-zone-tab"]');
    
    await page.click('[data-testid="archive-project-button"]');
    await page.fill('[data-testid="confirm-project-name"]', 'project-to-archive');
    await page.click('[data-testid="confirm-archive-button"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Project should be in archived section
    await page.click('[data-testid="show-archived-projects"]');
    await expect(page.locator('[data-testid="project-project-to-archive"][data-archived="true"]')).toBeVisible();
    
    // Restore project
    await page.click('[data-testid="project-project-to-archive"] [data-testid="restore-project"]');
    await expect(page.locator('[data-testid="project-project-to-archive"][data-archived="false"]')).toBeVisible();
    
    // Delete project
    await dashboardPage.selectProject('project-to-archive');
    await page.click('[data-testid="project-settings-button"]');
    await page.click('[data-testid="danger-zone-tab"]');
    
    await page.click('[data-testid="delete-project-button"]');
    await page.fill('[data-testid="confirm-project-name"]', 'project-to-archive');
    await page.check('[data-testid="understand-consequences"]');
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Project should be gone
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="project-project-to-archive"]')).not.toBeVisible();
  });

  test('should export project data', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    
    // Export project
    await page.click('[data-testid="project-actions-menu"]');
    await page.click('[data-testid="export-project"]');
    
    // Configure export options
    await page.check('[data-testid="export-code"]');
    await page.check('[data-testid="export-git-history"]');
    await page.check('[data-testid="export-sessions"]');
    await page.uncheck('[data-testid="export-node-modules"]');
    
    // Start export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="start-export-button"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/project-nodejs.*\.zip$/);
    
    // Should show export complete
    await expect(page.locator('[data-testid="export-complete"]')).toBeVisible();
  });

  test('should manage project collaborators', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await page.click('[data-testid="project-settings-button"]');
    await page.click('[data-testid="collaborators-tab"]');
    
    // Add collaborator
    await page.click('[data-testid="add-collaborator-button"]');
    await page.fill('[data-testid="collaborator-email"]', 'colleague@example.com');
    await page.selectOption('[data-testid="collaborator-role"]', 'editor');
    await page.click('[data-testid="send-invite-button"]');
    
    // Should show pending invite
    await expect(page.locator('[data-testid="invite-colleague@example.com"]')).toBeVisible();
    await expect(page.locator('[data-testid="invite-colleague@example.com"]')).toContainText('Pending');
    
    // Update permissions
    await page.click('[data-testid="collaborator-testuser"] [data-testid="edit-permissions"]');
    await page.selectOption('[data-testid="permission-select"]', 'admin');
    await page.click('[data-testid="save-permissions"]');
    
    // Remove collaborator
    await page.click('[data-testid="invite-colleague@example.com"] [data-testid="remove-collaborator"]');
    await page.click('[data-testid="confirm-remove-collaborator"]');
    await expect(page.locator('[data-testid="invite-colleague@example.com"]')).not.toBeVisible();
  });

  test('should search and filter projects', async ({ page }) => {
    // Search projects
    await dashboardPage.searchProjects('node');
    
    // Should filter results
    await expect(page.locator('[data-testid="project-nodejs"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-python"]')).not.toBeVisible();
    
    // Clear search
    await page.fill('[data-testid="project-search"]', '');
    
    // Filter by type
    await page.selectOption('[data-testid="project-type-filter"]', 'python');
    await expect(page.locator('[data-testid="project-python"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-nodejs"]')).not.toBeVisible();
    
    // Filter by status
    await page.selectOption('[data-testid="project-type-filter"]', 'all');
    await page.click('[data-testid="filter-active-only"]');
    
    // Sort projects
    await page.selectOption('[data-testid="sort-projects"]', 'modified');
    
    // Projects should be reordered
    const firstProject = await page.locator('[data-testid^="project-"]').first().getAttribute('data-testid');
    
    await page.selectOption('[data-testid="sort-projects"]', 'name');
    const firstProjectAfterSort = await page.locator('[data-testid^="project-"]').first().getAttribute('data-testid');
    
    expect(firstProject).not.toBe(firstProjectAfterSort);
  });

  test('should show project statistics', async ({ page }) => {
    await dashboardPage.selectProject('project-nodejs');
    await page.click('[data-testid="project-stats-button"]');
    
    // Should show various stats
    await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-files-count"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="stat-lines-of-code"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="stat-commits-count"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="stat-last-modified"]')).toBeVisible();
    
    // Language breakdown
    await expect(page.locator('[data-testid="language-breakdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="language-javascript"]')).toBeVisible();
    
    // Activity graph
    await expect(page.locator('[data-testid="activity-graph"]')).toBeVisible();
  });
});