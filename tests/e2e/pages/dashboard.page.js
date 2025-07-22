// tests/e2e/pages/dashboard.page.js
export class DashboardPage {
  constructor(page) {
    this.page = page;
    
    // Main navigation
    this.projectsTab = page.locator('[data-testid="projects-tab"]');
    this.sessionsTab = page.locator('[data-testid="sessions-tab"]');
    this.machinesTab = page.locator('[data-testid="machines-tab"]');
    this.settingsTab = page.locator('[data-testid="settings-tab"]');
    
    // User menu
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.logoutButton = page.locator('[data-testid="logout"]');
    this.profileLink = page.locator('[data-testid="profile-link"]');
    
    // Projects section
    this.newProjectButton = page.locator('[data-testid="new-project-button"]');
    this.projectList = page.locator('[data-testid="project-list"]');
    this.projectSearchInput = page.locator('[data-testid="project-search"]');
    this.starredProjectsFilter = page.locator('[data-testid="starred-filter"]');
    
    // Sessions section
    this.activeSessions = page.locator('[data-testid="active-sessions"]');
    this.sessionHistory = page.locator('[data-testid="session-history"]');
    this.newSessionButton = page.locator('[data-testid="new-session-button"]');
    
    // Machines section
    this.machineList = page.locator('[data-testid="machine-list"]');
    this.addMachineButton = page.locator('[data-testid="add-machine-button"]');
    
    // Notifications
    this.notificationBell = page.locator('[data-testid="notification-bell"]');
    this.notificationCount = page.locator('[data-testid="notification-count"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async selectProject(projectName) {
    const projectItem = this.page.locator(`[data-testid="project-${projectName}"]`);
    await projectItem.click();
    await this.page.waitForURL(/\/project\/.+/);
  }

  async createNewProject(name, type = 'nodejs') {
    await this.newProjectButton.click();
    await this.page.fill('[data-testid="project-name-input"]', name);
    await this.page.selectOption('[data-testid="project-type-select"]', type);
    await this.page.click('[data-testid="create-project-button"]');
    await this.page.waitForSelector(`[data-testid="project-${name}"]`);
  }

  async searchProjects(query) {
    await this.projectSearchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  async toggleStarredFilter() {
    await this.starredProjectsFilter.click();
  }

  async starProject(projectName) {
    const starButton = this.page.locator(`[data-testid="star-${projectName}"]`);
    await starButton.click();
  }

  async getProjectCount() {
    const projects = await this.projectList.locator('.project-item').all();
    return projects.length;
  }

  async switchToTab(tabName) {
    const tabs = {
      'projects': this.projectsTab,
      'sessions': this.sessionsTab,
      'machines': this.machinesTab,
      'settings': this.settingsTab
    };
    
    await tabs[tabName].click();
    await this.page.waitForLoadState('networkidle');
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
    await this.page.waitForURL('/login');
  }

  async getActiveSessionCount() {
    await this.switchToTab('sessions');
    const sessions = await this.activeSessions.locator('.session-item').all();
    return sessions.length;
  }

  async resumeSession(sessionId) {
    await this.switchToTab('sessions');
    const resumeButton = this.page.locator(`[data-testid="resume-session-${sessionId}"]`);
    await resumeButton.click();
    await this.page.waitForURL(/\/session\/.+/);
  }

  async getMachineStatus(machineName) {
    await this.switchToTab('machines');
    const machineStatus = this.page.locator(`[data-testid="machine-${machineName}-status"]`);
    return await machineStatus.getAttribute('data-status');
  }

  async connectMachine(machineName) {
    await this.switchToTab('machines');
    const connectButton = this.page.locator(`[data-testid="connect-${machineName}"]`);
    await connectButton.click();
    await this.page.waitForSelector(`[data-testid="machine-${machineName}-status"][data-status="online"]`);
  }

  async getNotificationCount() {
    const count = await this.notificationCount.textContent();
    return parseInt(count) || 0;
  }

  async openNotifications() {
    await this.notificationBell.click();
    await this.page.waitForSelector('[data-testid="notification-panel"]');
  }

  async clearNotifications() {
    await this.openNotifications();
    await this.page.click('[data-testid="clear-all-notifications"]');
  }

  // Additional helper methods for test scenarios
  async clickCreateProject() {
    await this.newProjectButton.click();
  }

  async fillProjectForm(projectData) {
    await this.page.fill('[data-testid="project-name-input"]', projectData.name);
    if (projectData.description) {
      await this.page.fill('[data-testid="project-description-input"]', projectData.description);
    }
    if (projectData.type) {
      await this.page.selectOption('[data-testid="project-type-select"]', projectData.type);
    }
    if (projectData.template) {
      await this.page.selectOption('[data-testid="project-template-select"]', projectData.template);
    }
  }

  async submitProject() {
    await this.page.click('[data-testid="create-project-button"]');
    await this.page.waitForLoadState('networkidle');
  }

  getProjectByName(name) {
    return this.page.locator(`[data-testid="project-${name}"]`);
  }

  async clickProject(name) {
    await this.getProjectByName(name).click();
  }

  async clickStartChat() {
    await this.newSessionButton.click();
    await this.page.waitForURL(/\/session\/.+/);
  }

  get recentSessions() {
    return this.page.locator('[data-testid="recent-sessions"]');
  }

  async getLatestSessionTitle() {
    await this.switchToTab('sessions');
    const firstSession = this.sessionHistory.locator('.session-item').first();
    return await firstSession.locator('[data-testid="session-title"]').textContent();
  }
}