// tests/e2e/specs/authentication-flow.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { testHelpers } from '../../utils/test-helpers.js';
import { pauseBeforeNavigation, pauseBeforeClose, logTestMode } from '../../helpers/developer-utils.js';

test.describe('Authentication Flow', () => {
  let loginPage;
  let dashboardPage;

  test.beforeAll(async () => {
    // Log the current test mode
    logTestMode();
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Pause before navigation in developer mode
    await pauseBeforeNavigation(page);
    
    // Start from login page
    await page.goto('/login');
  });

  test.afterEach(async ({ page }) => {
    // Pause before closing in developer mode
    await pauseBeforeClose(page);
  });

  test('should login with valid credentials', async ({ page }) => {
    // Fill in credentials
    await loginPage.usernameInput.fill('testuser');
    await loginPage.passwordInput.fill('testpass123');
    
    // Submit form
    await loginPage.loginButton.click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    
    // Should show welcome message
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, testuser');
    
    // Should store auth token
    const token = await testHelpers.getLocalStorageItem(page, 'token');
    expect(token).toBeTruthy();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Try invalid credentials
    await loginPage.usernameInput.fill('wronguser');
    await loginPage.passwordInput.fill('wrongpass');
    await loginPage.loginButton.click();
    
    // Should show error message
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText(/invalid|incorrect|wrong/i);
    
    // Should not redirect
    await expect(page).toHaveURL('/login');
    
    // Should not store token
    const token = await testHelpers.getLocalStorageItem(page, 'token');
    expect(token).toBeFalsy();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await testHelpers.login(page, 'testuser', 'testpass123');
    
    // Pause before navigation to dashboard
    await pauseBeforeNavigation(page);
    await page.goto('/dashboard');
    
    // Click logout
    await dashboardPage.userMenu.click();
    await dashboardPage.logoutButton.click();
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should clear token
    const token = await testHelpers.getLocalStorageItem(page, 'token');
    expect(token).toBeFalsy();
  });

  test('should redirect to login when accessing protected routes', async ({ page }) => {
    // Try to access dashboard without auth
    await pauseBeforeNavigation(page);
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show redirect message
    await expect(page.locator('[data-testid="redirect-message"]')).toContainText(/login required|please login/i);
  });

  test('should persist login across page refreshes', async ({ page }) => {
    // Login first
    await testHelpers.login(page, 'testuser', 'testpass123');
    await expect(page).toHaveURL('/dashboard');
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, testuser');
  });

  test('should handle session expiration gracefully', async ({ page }) => {
    // Login
    await testHelpers.login(page, 'testuser', 'testpass123');
    
    // Simulate expired token
    await page.evaluate(() => {
      const expiredToken = 'expired.token.here';
      localStorage.setItem('token', expiredToken);
    });
    
    // Try to perform authenticated action
    await pauseBeforeNavigation(page);
    await page.goto('/projects');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
  });

  test('should validate form fields before submission', async ({ page }) => {
    // Try to submit empty form
    await loginPage.loginButton.click();
    
    // Should show validation errors
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
    
    // Fill only username
    await loginPage.usernameInput.fill('testuser');
    await loginPage.loginButton.click();
    
    // Should only show password error
    await expect(loginPage.usernameError).not.toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
  });

  test('should remember username if "Remember me" is checked', async ({ page }) => {
    // Login with remember me
    await loginPage.usernameInput.fill('testuser');
    await loginPage.passwordInput.fill('testpass123');
    await loginPage.rememberMeCheckbox.check();
    await loginPage.loginButton.click();
    
    // Logout
    await dashboardPage.userMenu.click();
    await dashboardPage.logoutButton.click();
    
    // Username should be pre-filled
    await expect(loginPage.usernameInput).toHaveValue('testuser');
    await expect(loginPage.rememberMeCheckbox).toBeChecked();
  });
});