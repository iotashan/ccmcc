// tests/e2e/pages/login.page.js
export class LoginPage {
  constructor(page) {
    this.page = page;
    
    // Locators
    this.usernameInput = page.locator('[data-testid="username"]');
    this.passwordInput = page.locator('[data-testid="password"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password"]');
    this.signUpLink = page.locator('[data-testid="sign-up-link"]');
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username, password, rememberMe = false) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    
    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }
    
    await this.loginButton.click();
  }

  async waitForError() {
    await this.errorMessage.waitFor({ state: 'visible' });
    return await this.errorMessage.textContent();
  }

  async isLoading() {
    return await this.loadingSpinner.isVisible();
  }

  async waitForLoginComplete() {
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
  }

  async getValidationError(field) {
    const errorLocator = this.page.locator(`[data-testid="${field}-error"]`);
    return await errorLocator.textContent();
  }

  async isLoginButtonEnabled() {
    return await this.loginButton.isEnabled();
  }

  async clearForm() {
    await this.usernameInput.clear();
    await this.passwordInput.clear();
  }
}