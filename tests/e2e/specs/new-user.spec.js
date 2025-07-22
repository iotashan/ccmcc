// tests/e2e/specs/new-user.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';

test.describe('New User Onboarding Flow', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    await page.goto('/');
  });

  test('should complete new user registration flow', async ({ page }) => {
    // Navigate to registration
    await loginPage.clickRegisterLink();
    
    // Fill registration form
    const newUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'SecurePass123!'
    };
    
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Should be redirected to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(dashboardPage.welcomeMessage).toBeVisible();
    await expect(dashboardPage.welcomeMessage).toContainText('Welcome');
  });

  test('should show validation errors for invalid registration data', async ({ page }) => {
    await loginPage.clickRegisterLink();
    
    // Try to register with invalid data
    await loginPage.fillRegistrationForm({
      username: 'ab', // Too short
      email: 'invalid-email', // Invalid format
      password: '123' // Too short
    });
    
    await loginPage.submitRegistration();
    
    // Should show validation errors
    await expect(loginPage.usernameError).toBeVisible();
    await expect(loginPage.emailError).toBeVisible();
    await expect(loginPage.passwordError).toBeVisible();
    
    await expect(loginPage.usernameError).toContainText('Username must be at least 3 characters');
    await expect(loginPage.emailError).toContainText('Please enter a valid email');
    await expect(loginPage.passwordError).toContainText('Password must be at least 8 characters');
  });

  test('should prevent duplicate user registration', async ({ page }) => {
    const existingUser = {
      username: 'existinguser',
      email: 'existing@example.com',
      password: 'ExistingPass123!'
    };
    
    // First registration should succeed
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(existingUser);
    await loginPage.submitRegistration();
    
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Logout
    await dashboardPage.logout();
    
    // Try to register with same credentials
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(existingUser);
    await loginPage.submitRegistration();
    
    // Should show error message
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('User already exists');
  });

  test('should complete first-time login after registration', async ({ page }) => {
    const newUser = {
      username: `firstlogin_${Date.now()}`,
      email: `firstlogin_${Date.now()}@example.com`,
      password: 'FirstLogin123!'
    };
    
    // Register new user
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Should be automatically logged in and redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check that user info is displayed
    await expect(dashboardPage.userProfile).toBeVisible();
    await expect(dashboardPage.userProfile).toContainText(newUser.username);
    
    // Check that onboarding tour or welcome guide is shown
    await expect(dashboardPage.onboardingTour).toBeVisible();
    await expect(dashboardPage.getStartedButton).toBeVisible();
  });

  test('should show empty state for new user dashboard', async ({ page }) => {
    const newUser = {
      username: `emptystate_${Date.now()}`,
      email: `emptystate_${Date.now()}@example.com`,
      password: 'EmptyState123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Check empty state elements
    await expect(dashboardPage.emptyProjectsState).toBeVisible();
    await expect(dashboardPage.emptySessionsState).toBeVisible();
    
    await expect(dashboardPage.emptyProjectsState).toContainText('No projects yet');
    await expect(dashboardPage.emptySessionsState).toContainText('No chat sessions');
    
    // Check call-to-action buttons
    await expect(dashboardPage.createProjectButton).toBeVisible();
    await expect(dashboardPage.startChatButton).toBeVisible();
  });

  test('should guide new user through first chat session', async ({ page }) => {
    const newUser = {
      username: `firstchat_${Date.now()}`,
      email: `firstchat_${Date.now()}@example.com`,
      password: 'FirstChat123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Start first chat session
    await dashboardPage.clickStartChat();
    
    // Should navigate to chat page
    await expect(page).toHaveURL(/\/chat/);
    
    // Check for first-time user guidance
    await expect(chatPage.welcomeGuide).toBeVisible();
    await expect(chatPage.examplePrompts).toBeVisible();
    
    // Send first message
    const firstMessage = 'Hello Claude, this is my first message!';
    await chatPage.sendMessage(firstMessage);
    
    // Wait for response
    await expect(chatPage.getLastResponse()).toBeVisible();
    await expect(chatPage.getLastResponse()).toContainText('Hello');
    
    // Check that session is saved
    await page.goto('/dashboard');
    await expect(dashboardPage.recentSessions).toBeVisible();
    await expect(dashboardPage.getSessionByText(firstMessage.substring(0, 20))).toBeVisible();
  });

  test('should handle first project creation', async ({ page }) => {
    const newUser = {
      username: `firstproject_${Date.now()}`,
      email: `firstproject_${Date.now()}@example.com`,
      password: 'FirstProject123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Create first project
    await dashboardPage.clickCreateProject();
    
    // Should open project creation modal/form
    await expect(dashboardPage.projectModal).toBeVisible();
    
    // Fill project details
    const projectData = {
      name: 'My First Project',
      description: 'This is my first project with Claude',
      type: 'nodejs'
    };
    
    await dashboardPage.fillProjectForm(projectData);
    await dashboardPage.submitProject();
    
    // Should show success message and close modal
    await expect(dashboardPage.successMessage).toBeVisible();
    await expect(dashboardPage.projectModal).not.toBeVisible();
    
    // Project should appear in project list
    await expect(dashboardPage.projectsList).toBeVisible();
    await expect(dashboardPage.getProjectByName(projectData.name)).toBeVisible();
    
    // Empty state should be hidden
    await expect(dashboardPage.emptyProjectsState).not.toBeVisible();
  });

  test('should complete account setup preferences', async ({ page }) => {
    const newUser = {
      username: `preferences_${Date.now()}`,
      email: `preferences_${Date.now()}@example.com`,
      password: 'Preferences123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Navigate to settings/preferences
    await dashboardPage.clickUserMenu();
    await dashboardPage.clickSettings();
    
    // Should navigate to settings page
    await expect(page).toHaveURL(/\/settings/);
    
    // Complete profile information
    await page.fill('[data-testid="display-name"]', 'Test User');
    await page.selectOption('[data-testid="timezone"]', 'America/New_York');
    await page.selectOption('[data-testid="theme"]', 'dark');
    
    // Enable notifications
    await page.check('[data-testid="email-notifications"]');
    await page.check('[data-testid="desktop-notifications"]');
    
    // Save preferences
    await page.click('[data-testid="save-preferences"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Preferences saved');
    
    // Verify changes persist
    await page.reload();
    await expect(page.locator('[data-testid="display-name"]')).toHaveValue('Test User');
    await expect(page.locator('[data-testid="timezone"]')).toHaveValue('America/New_York');
    await expect(page.locator('[data-testid="theme"]')).toHaveValue('dark');
  });

  test('should handle onboarding tour completion', async ({ page }) => {
    const newUser = {
      username: `tour_${Date.now()}`,
      email: `tour_${Date.now()}@example.com`,
      password: 'Tour123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Start onboarding tour
    await dashboardPage.clickStartTour();
    
    // Go through tour steps
    const tourSteps = [
      'dashboard-overview',
      'chat-feature',
      'projects-feature',
      'settings-feature',
      'help-resources'
    ];
    
    for (let i = 0; i < tourSteps.length; i++) {
      const step = tourSteps[i];
      
      // Check current step is highlighted
      await expect(page.locator(`[data-tour-step="${step}"]`)).toBeVisible();
      
      if (i < tourSteps.length - 1) {
        // Click next
        await page.click('[data-testid="tour-next"]');
      } else {
        // Finish tour
        await page.click('[data-testid="tour-finish"]');
      }
    }
    
    // Tour should be completed
    await expect(page.locator('[data-testid="tour-overlay"]')).not.toBeVisible();
    
    // Should show completion message
    await expect(dashboardPage.tourCompletedMessage).toBeVisible();
    await expect(dashboardPage.tourCompletedMessage).toContainText('Tour completed');
    
    // User should not see tour again on refresh
    await page.reload();
    await expect(dashboardPage.onboardingTour).not.toBeVisible();
  });

  test('should provide helpful error recovery for new users', async ({ page }) => {
    const newUser = {
      username: `recovery_${Date.now()}`,
      email: `recovery_${Date.now()}@example.com`,
      password: 'Recovery123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Simulate network error during chat
    await dashboardPage.clickStartChat();
    
    // Mock network failure
    await page.route('**/api/chat', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Network error' })
      });
    });
    
    // Try to send message
    await chatPage.sendMessage('This should fail');
    
    // Should show helpful error message for new users
    await expect(chatPage.errorMessage).toBeVisible();
    await expect(chatPage.errorMessage).toContainText('connection issue');
    
    // Should show retry and help options
    await expect(chatPage.retryButton).toBeVisible();
    await expect(chatPage.helpButton).toBeVisible();
    
    // Clicking help should show guidance
    await chatPage.clickHelp();
    await expect(chatPage.helpDialog).toBeVisible();
    await expect(chatPage.helpDialog).toContainText('troubleshooting');
  });

  test('should track new user onboarding completion', async ({ page }) => {
    const newUser = {
      username: `tracking_${Date.now()}`,
      email: `tracking_${Date.now()}@example.com`,
      password: 'Tracking123!'
    };
    
    // Register and login
    await loginPage.clickRegisterLink();
    await loginPage.fillRegistrationForm(newUser);
    await loginPage.submitRegistration();
    
    // Check initial onboarding progress
    await expect(dashboardPage.onboardingProgress).toBeVisible();
    await expect(dashboardPage.getProgressPercent()).toContainText('20%');
    
    // Complete first chat
    await dashboardPage.clickStartChat();
    await chatPage.sendMessage('First message');
    await expect(chatPage.getLastResponse()).toBeVisible();
    
    // Return to dashboard and check progress
    await page.goto('/dashboard');
    await expect(dashboardPage.getProgressPercent()).toContainText('40%');
    
    // Create first project
    await dashboardPage.clickCreateProject();
    await dashboardPage.fillProjectForm({
      name: 'Test Project',
      type: 'nodejs'
    });
    await dashboardPage.submitProject();
    
    // Check progress updated
    await expect(dashboardPage.getProgressPercent()).toContainText('60%');
    
    // Complete settings
    await dashboardPage.clickUserMenu();
    await dashboardPage.clickSettings();
    await page.fill('[data-testid="display-name"]', 'Complete User');
    await page.click('[data-testid="save-preferences"]');
    
    // Return and check final progress
    await page.goto('/dashboard');
    await expect(dashboardPage.getProgressPercent()).toContainText('100%');
    await expect(dashboardPage.onboardingCompleteMessage).toBeVisible();
  });
});