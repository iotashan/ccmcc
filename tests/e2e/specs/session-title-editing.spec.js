import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../fixtures/auth';

test.describe('Session Title Editing', () => {
  let testUsername;
  let testPassword;

  test.beforeEach(async ({ page }) => {
    // Create unique test user
    const timestamp = Date.now();
    testUsername = `test_session_edit_${timestamp}`;
    testPassword = 'TestPass123!';
    
    await createTestUser(testUsername, testPassword);
    
    // Login
    await page.goto('/');
    await page.fill('input[type="text"]', testUsername);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Login")');
    
    // Wait for dashboard
    await page.waitForSelector('text=Mission Control Center', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await deleteTestUser(testUsername);
  });

  test('should display edit button next to session title in chat interface', async ({ page }) => {
    // Create a new project
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-project');
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created and selected
    await page.waitForSelector('text=/tmp/test-project', { timeout: 10000 });
    
    // Click on the project to select it
    await page.click('text=/tmp/test-project');
    
    // Create a new session
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Check that edit button is visible
    const editButton = page.locator('button[title="Edit session name"]');
    await expect(editButton).toBeVisible();
  });

  test('should allow editing session title from chat interface', async ({ page }) => {
    // Create a project and session
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-project-2');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=/tmp/test-project-2');
    await page.click('text=/tmp/test-project-2');
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Click edit button
    await page.click('button[title="Edit session name"]');
    
    // Check that input field appears
    const input = page.locator('input[value="New Session"]');
    await expect(input).toBeVisible();
    
    // Edit the session name
    await input.fill('My Custom Session Name');
    
    // Save the changes
    await page.click('button[title="Save"]');
    
    // Verify the session name was updated
    await expect(page.locator('text=Session: My Custom Session Name')).toBeVisible();
  });

  test('should cancel editing when escape key is pressed', async ({ page }) => {
    // Create a project and session
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-project-3');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=/tmp/test-project-3');
    await page.click('text=/tmp/test-project-3');
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Click edit button
    await page.click('button[title="Edit session name"]');
    
    // Edit the session name
    const input = page.locator('input[value="New Session"]');
    await input.fill('Temporary Name');
    
    // Press Escape to cancel
    await page.keyboard.press('Escape');
    
    // Verify the session name was NOT updated
    await expect(page.locator('text=Session: New Session')).toBeVisible();
    await expect(page.locator('text=Session: Temporary Name')).not.toBeVisible();
  });

  test('should save editing when enter key is pressed', async ({ page }) => {
    // Create a project and session
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-project-4');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=/tmp/test-project-4');
    await page.click('text=/tmp/test-project-4');
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Click edit button
    await page.click('button[title="Edit session name"]');
    
    // Edit the session name
    const input = page.locator('input[value="New Session"]');
    await input.fill('Enter Key Test');
    
    // Press Enter to save
    await page.keyboard.press('Enter');
    
    // Verify the session name was updated
    await expect(page.locator('text=Session: Enter Key Test')).toBeVisible();
  });

  test('should update session name in sidebar when edited from chat interface', async ({ page }) => {
    // Create a project and session
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', '/tmp/test-project-5');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=/tmp/test-project-5');
    await page.click('text=/tmp/test-project-5');
    await page.click('button:has-text("New Session")');
    
    // Wait for session to be created
    await page.waitForSelector('text=Session: New Session');
    
    // Click edit button in chat interface
    await page.click('button[title="Edit session name"]');
    
    // Edit the session name
    const input = page.locator('input[value="New Session"]');
    await input.fill('Sidebar Update Test');
    
    // Save the changes
    await page.click('button[title="Save"]');
    
    // Verify the session name was updated in chat interface
    await expect(page.locator('text=Session: Sidebar Update Test')).toBeVisible();
    
    // Verify the session name was also updated in the sidebar
    const sidebarSession = page.locator('.sidebar').locator('text=Sidebar Update Test');
    await expect(sidebarSession).toBeVisible();
  });
});