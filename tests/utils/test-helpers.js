// tests/utils/test-helpers.js
import { simpleGit } from 'simple-git';

export const testHelpers = {
  // Authentication helpers
  async loginTestUser(page, username = 'testuser', password = 'testpass123') {
    await page.goto('/login');
    await page.fill('[data-testid="username"]', username);
    await page.fill('[data-testid="password"]', password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  },

  async logout(page) {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    await page.waitForURL('/login');
  },

  // Git operation helpers
  async createTestCommit(projectPath, message, files = ['.']) {
    const git = simpleGit(projectPath);
    await git.add(files);
    await git.commit(message);
    return await git.log({ n: 1 });
  },

  async checkGitStatus(projectPath) {
    const git = simpleGit(projectPath);
    return await git.status();
  },

  // WebSocket helpers
  async waitForWebSocketMessage(page, type, timeout = 5000) {
    return page.waitForEvent('websocket.message', {
      predicate: msg => {
        try {
          const data = JSON.parse(msg.data);
          return data.type === type;
        } catch {
          return false;
        }
      },
      timeout
    });
  },

  async waitForWebSocketConnection(page, url) {
    return page.waitForEvent('websocket', {
      predicate: ws => ws.url().includes(url)
    });
  },

  // Project helpers
  async selectProject(page, projectName) {
    await page.click(`[data-testid="project-${projectName}"]`);
    await page.waitForSelector('[data-testid="project-view"]');
  },

  async createNewProject(page, projectName, projectType = 'nodejs') {
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name-input"]', projectName);
    await page.selectOption('[data-testid="project-type-select"]', projectType);
    await page.click('[data-testid="create-project-button"]');
    await page.waitForSelector(`[data-testid="project-${projectName}"]`);
  },

  // File operation helpers
  async createFile(page, fileName, content) {
    await page.click('[data-testid="new-file-button"]');
    await page.fill('[data-testid="file-name-input"]', fileName);
    await page.click('[data-testid="confirm-create-file"]');
    
    if (content) {
      await page.fill('[data-testid="editor-content"]', content);
      await page.keyboard.press('Control+S'); // Save file
    }
  },

  async editFile(page, fileName, newContent) {
    await page.click(`[data-testid="file-${fileName}"]`);
    await page.fill('[data-testid="editor-content"]', newContent);
    await page.keyboard.press('Control+S');
  },

  // Chat/Session helpers
  async sendChatMessage(page, message) {
    await page.fill('[data-testid="chat-input"]', message);
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="assistant-message"]:last-child');
  },

  async waitForAssistantResponse(page, timeout = 30000) {
    await page.waitForSelector('[data-testid="assistant-typing"]', { state: 'hidden', timeout });
    return await page.textContent('[data-testid="assistant-message"]:last-child');
  },

  // Screenshot helpers for both desktop and mobile
  async captureScreenshots(page, testName) {
    const timestamp = Date.now();
    
    // Desktop screenshot
    await page.screenshot({
      path: `test-results/screenshots/desktop-${testName}-${timestamp}.png`,
      fullPage: true
    });
    
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.screenshot({
      path: `test-results/screenshots/mobile-${testName}-${timestamp}.png`,
      fullPage: true
    });
    
    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  },

  // API helpers
  async makeAPIRequest(page, endpoint, method = 'GET', data = null) {
    const response = await page.request[method.toLowerCase()](`/api/${endpoint}`, {
      data: data ? JSON.stringify(data) : undefined,
      headers: data ? { 'Content-Type': 'application/json' } : undefined
    });
    
    return {
      status: response.status(),
      data: await response.json().catch(() => null)
    };
  },

  // Machine/Client helpers
  async connectMachine(page, machineName) {
    await page.click('[data-testid="machines-tab"]');
    await page.click(`[data-testid="connect-${machineName}"]`);
    await page.waitForSelector(`[data-testid="machine-${machineName}-status"][data-status="online"]`);
  },

  async switchMachine(page, fromMachine, toMachine) {
    await page.click('[data-testid="current-machine-dropdown"]');
    await page.click(`[data-testid="switch-to-${toMachine}"]`);
    await page.waitForSelector(`[data-testid="active-machine-${toMachine}"]`);
  },

  // Error handling helpers
  async expectError(page, errorMessage) {
    await page.waitForSelector('[data-testid="error-notification"]');
    const error = await page.textContent('[data-testid="error-notification"]');
    return error.includes(errorMessage);
  },

  async dismissError(page) {
    await page.click('[data-testid="dismiss-error"]');
    await page.waitForSelector('[data-testid="error-notification"]', { state: 'hidden' });
  },

  // Session management helpers
  async createNewSession(page, sessionName) {
    await page.click('[data-testid="new-session-button"]');
    await page.fill('[data-testid="session-name-input"]', sessionName);
    await page.click('[data-testid="create-session-button"]');
    await page.waitForSelector(`[data-testid="session-${sessionName}"]`);
  },

  async resumeSession(page, sessionId) {
    await page.click('[data-testid="sessions-tab"]');
    await page.click(`[data-testid="resume-session-${sessionId}"]`);
    await page.waitForSelector('[data-testid="chat-container"]');
  },

  // Utility functions
  async clearLocalStorage(page) {
    await page.evaluate(() => localStorage.clear());
  },

  async getLocalStorageItem(page, key) {
    return await page.evaluate(key => localStorage.getItem(key), key);
  },

  async setLocalStorageItem(page, key, value) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key, value });
  },

  // Wait helpers
  async waitForLoadingToComplete(page) {
    await page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden' });
  },

  async waitForToast(page, message) {
    await page.waitForSelector('[data-testid="toast-notification"]');
    const toast = await page.textContent('[data-testid="toast-notification"]');
    return toast.includes(message);
  },

  // Mock data generators
  generateMockUser(overrides = {}) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      username: 'testuser',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  },

  generateMockProject(overrides = {}) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: 'test-project',
      type: 'nodejs',
      path: '/test-data/projects/test-project',
      createdAt: new Date().toISOString(),
      ...overrides
    };
  },

  generateMockSession(overrides = {}) {
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Test Session',
      projectId: 'test-project-id',
      messages: [],
      createdAt: new Date().toISOString(),
      ...overrides
    };
  }
};

// Export individual helpers for convenience
export const {
  loginTestUser,
  logout,
  createTestCommit,
  waitForWebSocketMessage,
  selectProject,
  sendChatMessage,
  captureScreenshots,
  makeAPIRequest,
  expectError,
  waitForLoadingToComplete
} = testHelpers;