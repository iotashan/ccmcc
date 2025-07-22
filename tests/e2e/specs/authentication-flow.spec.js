// tests/e2e/specs/authentication-flow.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { testHelpers } from '../../utils/test-helpers.js';

test.describe('Authentication Flow', () => {
  let loginPage;
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    
    // Start from login page
    await page.goto('/login');
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

  test('should handle empty form submission', async ({ page }) => {
    // Try to submit empty form
    await loginPage.loginButton.click();
    
    // Should show validation errors
    await expect(page.locator('[data-testid="username-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="username-error"]')).toContainText('required');
    
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toContainText('required');
    
    // Should not make API call
    await expect(page).toHaveURL('/login');
  });

  test('should remember me functionality', async ({ page }) => {
    // Check remember me
    await loginPage.rememberMeCheckbox.check();
    
    // Login
    await loginPage.usernameInput.fill('testuser');
    await loginPage.passwordInput.fill('testpass123');
    await loginPage.loginButton.click();
    
    await expect(page).toHaveURL('/dashboard');
    
    // Check persistent storage
    const rememberToken = await testHelpers.getLocalStorageItem(page, 'rememberToken');
    expect(rememberToken).toBeTruthy();
    
    // Close and reopen browser
    await page.close();
    const newPage = await page.context().newPage();
    await newPage.goto('/');
    
    // Should auto-login
    await expect(newPage).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Logout
    await dashboardPage.logout();
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should clear auth token
    const token = await testHelpers.getLocalStorageItem(page, 'token');
    expect(token).toBeFalsy();
    
    // Should show logout message
    await expect(page.locator('[data-testid="logout-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-message"]')).toContainText(/logged out|goodbye/i);
  });

  test('should handle session expiration', async ({ page, context }) => {
    // Login
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Simulate expired token by intercepting auth check
    await context.route('**/api/auth/verify', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Token expired' })
      });
    });
    
    // Try to navigate
    await dashboardPage.selectProject('project-nodejs');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login', { timeout: 5000 });
    
    // Should show session expired message
    await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-expired"]')).toContainText(/session.*expired/i);
  });

  test('should support social login', async ({ page }) => {
    // Check for social login buttons
    const githubButton = page.locator('[data-testid="login-github"]');
    const googleButton = page.locator('[data-testid="login-google"]');
    
    await expect(githubButton).toBeVisible();
    await expect(googleButton).toBeVisible();
    
    // Click GitHub login
    await githubButton.click();
    
    // Should redirect to OAuth provider (mocked in test environment)
    await expect(page).toHaveURL(/github\.com|mock-oauth/);
    
    // Simulate OAuth callback
    await page.goto('/auth/callback?code=mock-auth-code&state=mock-state');
    
    // Should process callback and redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should handle two-factor authentication', async ({ page }) => {
    // Login with 2FA-enabled account
    await loginPage.usernameInput.fill('2fa-user');
    await loginPage.passwordInput.fill('testpass123');
    await loginPage.loginButton.click();
    
    // Should show 2FA prompt
    await expect(page.locator('[data-testid="2fa-prompt"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="2fa-prompt"]')).toContainText(/verification code|two-factor/i);
    
    // Enter 2FA code
    await page.fill('[data-testid="2fa-code-input"]', '123456');
    await page.click('[data-testid="verify-2fa-button"]');
    
    // Should complete login
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should enforce password requirements', async ({ page }) => {
    // Try weak password during registration
    await page.goto('/register');
    
    await page.fill('[data-testid="register-username"]', 'newuser');
    await page.fill('[data-testid="register-email"]', 'newuser@example.com');
    await page.fill('[data-testid="register-password"]', '123'); // Too short
    
    // Should show password requirements
    await expect(page.locator('[data-testid="password-requirements"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-requirement-length"]')).toHaveClass(/invalid/);
    await expect(page.locator('[data-testid="password-requirement-complexity"]')).toHaveClass(/invalid/);
    
    // Enter strong password
    await page.fill('[data-testid="register-password"]', 'StrongP@ssw0rd123');
    
    // Requirements should be satisfied
    await expect(page.locator('[data-testid="password-requirement-length"]')).toHaveClass(/valid/);
    await expect(page.locator('[data-testid="password-requirement-complexity"]')).toHaveClass(/valid/);
  });

  test('should handle rate limiting on login attempts', async ({ page }) => {
    // Make multiple failed login attempts
    for (let i = 0; i < 5; i++) {
      await loginPage.usernameInput.fill('testuser');
      await loginPage.passwordInput.fill(`wrongpass${i}`);
      await loginPage.loginButton.click();
      await page.waitForTimeout(100);
    }
    
    // Should show rate limit message
    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText(/too many attempts|rate limit/i);
    
    // Login button should be disabled
    await expect(loginPage.loginButton).toBeDisabled();
    
    // Should show countdown timer
    await expect(page.locator('[data-testid="rate-limit-timer"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-limit-timer"]')).toContainText(/\d+ seconds?/);
  });

  test('should persist authentication across tabs', async ({ page, context }) => {
    // Login in first tab
    await testHelpers.loginTestUser(page);
    await dashboardPage.goto();
    
    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/');
    
    // Should be logged in automatically
    await expect(page2).toHaveURL('/dashboard', { timeout: 5000 });
    
    // Logout from second tab
    const dashboard2 = new DashboardPage(page2);
    await dashboard2.logout();
    
    // First tab should detect logout
    await page.waitForTimeout(1000); // Allow sync time
    await page.reload();
    await expect(page).toHaveURL('/login');
    
    await page2.close();
  });

  test('should handle password reset flow', async ({ page }) => {
    // Click forgot password
    await page.click('[data-testid="forgot-password-link"]');
    
    // Should navigate to reset page
    await expect(page).toHaveURL('/auth/forgot-password');
    
    // Enter email
    await page.fill('[data-testid="reset-email-input"]', 'testuser@example.com');
    await page.click('[data-testid="send-reset-button"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="reset-email-sent"]')).toBeVisible();
    await expect(page.locator('[data-testid="reset-email-sent"]')).toContainText(/email.*sent/i);
    
    // Simulate clicking reset link (in test environment)
    await page.goto('/auth/reset-password?token=mock-reset-token');
    
    // Enter new password
    await page.fill('[data-testid="new-password-input"]', 'NewSecureP@ss123');
    await page.fill('[data-testid="confirm-password-input"]', 'NewSecureP@ss123');
    await page.click('[data-testid="reset-password-button"]');
    
    // Should redirect to login with success message
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="password-reset-success"]')).toBeVisible();
  });

  test('should handle API key authentication', async ({ page }) => {
    // Direct API key auth
    await page.goto('/login');
    await page.click('[data-testid="use-api-key-link"]');
    
    // Enter API key
    await page.fill('[data-testid="api-key-input"]', 'test-api-key-12345');
    await page.click('[data-testid="authenticate-api-key"]');
    
    // Should authenticate and redirect
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
    
    // Should show API key indicator
    await expect(page.locator('[data-testid="auth-type-indicator"]')).toContainText('API Key');
    
    // Should have limited permissions
    await dashboardPage.switchToTab('settings');
    await expect(page.locator('[data-testid="settings-readonly-notice"]')).toBeVisible();
  });

  test('should enforce secure headers', async ({ page }) => {
    // Check security headers on login page
    const response = await page.goto('/login');
    const headers = response.headers();
    
    // Should have security headers
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');
    
    // Should not allow embedding in iframe
    const iframeTest = await page.evaluate(() => {
      const iframe = document.createElement('iframe');
      iframe.src = window.location.href;
      document.body.appendChild(iframe);
      return new Promise(resolve => {
        iframe.onload = () => resolve('loaded');
        iframe.onerror = () => resolve('blocked');
        setTimeout(() => resolve('blocked'), 1000);
      });
    });
    
    expect(iframeTest).toBe('blocked');
  });
});