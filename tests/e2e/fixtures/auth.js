// tests/e2e/fixtures/auth.js
import { test as base } from '@playwright/test';
import { getServerURL } from '../../helpers/developer-utils.js';

// Test user management functions
export async function createTestUser(username, password) {
  const serverUrl = getServerURL();
  const response = await fetch(`${serverUrl}/api/test/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create test user: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deleteTestUser(username) {
  const serverUrl = getServerURL();
  const response = await fetch(`${serverUrl}/api/test/users/${username}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete test user: ${response.statusText}`);
  }
}

// Extend base test with authentication
export const test = base.extend({
  // Add authenticated page fixture
  authenticatedPage: async ({ page }, use) => {
    // Perform authentication
    await page.goto('/login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'testpass123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 5000 });
    
    // Use the authenticated page in tests
    await use(page);
  },
});

export { expect } from '@playwright/test';