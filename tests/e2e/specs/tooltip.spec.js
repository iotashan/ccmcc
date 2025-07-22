import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../fixtures/auth';

test.describe('Tooltip Component', () => {
  let testUsername;
  let testPassword;

  test.beforeEach(async ({ page }) => {
    // Create unique test user
    const timestamp = Date.now();
    testUsername = `test_tooltip_${timestamp}`;
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

  test('should show tooltip on hover for truncated project paths', async ({ page }) => {
    // Create a project with a long path
    const longPath = '/Users/testuser/very/long/path/to/project/folder/that/will/be/truncated';
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', longPath);
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created
    await page.waitForSelector('text=...', { timeout: 10000 });
    
    // Find the truncated path element
    const truncatedPath = page.locator('span.opacity-60:has-text("...")');
    
    // Hover over the truncated path
    await truncatedPath.hover();
    
    // Check that tooltip appears with full path
    const tooltip = page.locator('.fixed.z-50.px-2.py-1.text-xs.bg-gray-900');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(longPath);
  });

  test('should hide tooltip when mouse leaves', async ({ page }) => {
    // Create a project with a long path
    const longPath = '/Users/testuser/another/very/long/path/to/test/tooltip/hiding';
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', longPath);
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created
    await page.waitForSelector('text=...', { timeout: 10000 });
    
    // Find the truncated path element
    const truncatedPath = page.locator('span.opacity-60:has-text("...")');
    
    // Hover over the truncated path
    await truncatedPath.hover();
    
    // Check that tooltip appears
    const tooltip = page.locator('.fixed.z-50.px-2.py-1.text-xs.bg-gray-900');
    await expect(tooltip).toBeVisible();
    
    // Move mouse away
    await page.mouse.move(0, 0);
    
    // Check that tooltip disappears
    await expect(tooltip).not.toBeVisible();
  });

  test('should show tooltip for full path during project name editing', async ({ page }) => {
    // Create a project with a long path
    const longPath = '/Users/testuser/edit/mode/long/path/for/tooltip/test';
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', longPath);
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created
    await page.waitForSelector(`text=${longPath.slice(-22)}`, { timeout: 10000 });
    
    // Click on the project to expand it
    const project = page.locator(`div:has-text("${longPath.slice(-22)}")`).first();
    await project.click();
    
    // Click the edit button for the project
    await page.click('button[title="Edit project name"]');
    
    // Find the full path element in edit mode
    const fullPathInEditMode = page.locator('.text-xs.text-muted-foreground.truncate.cursor-help');
    
    // Hover over the full path
    await fullPathInEditMode.hover();
    
    // Check that tooltip appears with full path
    const tooltip = page.locator('.fixed.z-50.px-2.py-1.text-xs.bg-gray-900');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(longPath);
  });

  test('should have cursor-help style on hoverable elements', async ({ page }) => {
    // Create a project with a long path
    const longPath = '/Users/testuser/cursor/help/test/for/long/path';
    await page.click('button:has-text("Create Project")');
    await page.fill('input[placeholder*="project path"]', longPath);
    await page.click('button:has-text("Create")');
    
    // Wait for project to be created
    await page.waitForSelector('text=...', { timeout: 10000 });
    
    // Find the truncated path element
    const truncatedPath = page.locator('span.opacity-60.cursor-help:has-text("...")');
    
    // Check that it has cursor-help class
    await expect(truncatedPath).toHaveClass(/cursor-help/);
  });
});