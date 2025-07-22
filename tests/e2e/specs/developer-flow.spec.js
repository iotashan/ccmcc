// tests/e2e/specs/developer-flow.spec.js
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page.js';
import { DashboardPage } from '../pages/dashboard.page.js';
import { ChatPage } from '../pages/chat.page.js';

test.describe('Developer Workflow Integration', () => {
  let loginPage;
  let dashboardPage;
  let chatPage;
  let testUser;

  test.beforeAll(async ({ browser }) => {
    // Create a test user for all developer flow tests
    testUser = {
      username: 'developer_user',
      email: 'developer@example.com',
      password: 'DevFlow123!'
    };
    
    // Register user if not exists
    const page = await browser.newPage();
    const login = new LoginPage(page);
    await page.goto('/');
    
    try {
      await login.clickRegisterLink();
      await login.fillRegistrationForm(testUser);
      await login.submitRegistration();
    } catch (error) {
      // User might already exist, try to login
      await page.goto('/');
      await login.fillLoginForm(testUser.username, testUser.password);
      await login.submitLogin();
    }
    
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    chatPage = new ChatPage(page);
    
    await page.goto('/');
    await loginPage.fillLoginForm(testUser.username, testUser.password);
    await loginPage.submitLogin();
    
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should create and manage a Node.js project', async ({ page }) => {
    // Create new Node.js project
    await dashboardPage.clickCreateProject();
    
    const projectData = {
      name: 'Express API Server',
      description: 'RESTful API server with Express.js',
      type: 'nodejs',
      template: 'express-api'
    };
    
    await dashboardPage.fillProjectForm(projectData);
    await dashboardPage.submitProject();
    
    // Verify project was created
    await expect(dashboardPage.getProjectByName(projectData.name)).toBeVisible();
    
    // Open project
    await dashboardPage.clickProject(projectData.name);
    
    // Should show project overview
    await expect(page).toHaveURL(/\/projects\/[^/]+/);
    await expect(page.locator('[data-testid="project-name"]')).toContainText(projectData.name);
    await expect(page.locator('[data-testid="project-type"]')).toContainText('Node.js');
    
    // Check project structure is created
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-item"][data-file="package.json"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-item"][data-file="server.js"]')).toBeVisible();
  });

  test('should start a coding session and receive code assistance', async ({ page }) => {
    // Start new chat session for coding
    await dashboardPage.clickStartChat();
    
    // Request help with a specific coding task
    const codingRequest = 'Help me create a REST API endpoint for user authentication with JWT tokens in Express.js';
    await chatPage.sendMessage(codingRequest);
    
    // Wait for Claude's response
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse().textContent();
    
    // Verify response contains relevant code and explanations
    expect(response).toContain('express');
    expect(response).toContain('JWT');
    expect(response).toMatch(/app\.(post|use)/); // Express route definition
    expect(response).toMatch(/jwt\.(sign|verify)/); // JWT methods
    
    // Check if code blocks are properly formatted
    await expect(chatPage.lastResponse.locator('pre code')).toBeVisible();
  });

  test('should handle file operations through Claude chat', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request to create a new file
    const fileRequest = 'Create a new file called utils.js with helper functions for string manipulation';
    await chatPage.sendMessage(fileRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // Check if response contains file creation tool usage
    const response = await chatPage.getLastResponse();
    await expect(response.locator('[data-tool="Write"]')).toBeVisible();
    
    // Verify file content is shown
    await expect(response.locator('pre code')).toContainText('utils.js');
    
    // Request to read the file back
    await chatPage.sendMessage('Can you show me the contents of utils.js?');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
    
    const readResponse = await chatPage.getLastResponse();
    await expect(readResponse.locator('[data-tool="Read"]')).toBeVisible();
  });

  test('should integrate with shell/terminal commands', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request to run shell commands
    const shellRequest = 'Initialize a new npm project and install express as a dependency';
    await chatPage.sendMessage(shellRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // Check for shell command execution
    const response = await chatPage.getLastResponse();
    
    // Should show shell commands being executed
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    // Verify npm commands are shown
    const bashContent = await response.locator('[data-tool="Bash"]').textContent();
    expect(bashContent).toMatch(/npm (init|install)/);
    
    // Request to check project status
    await chatPage.sendMessage('Check the current directory structure and installed packages');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
    
    const statusResponse = await chatPage.getLastResponse();
    await expect(statusResponse.locator('[data-tool="LS"]')).toBeVisible();
  });

  test('should provide debugging assistance', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Present a bug scenario
    const bugReport = `I'm getting this error in my Express server:
    
Error: Cannot set headers after they are sent to the client
    at new NodeError (node:internal/errors:387:5)
    at ServerResponse.setHeader (node:http:1290:11)

Here's my route handler:
\`\`\`javascript
app.get('/api/users', (req, res) => {
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Unauthorized' });
  }
  
  // More code here...
  res.json({ users: [] });
});
\`\`\`

Can you help me fix this?`;
    
    await chatPage.sendMessage(bugReport);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const debugResponse = await chatPage.getLastResponse().textContent();
    
    // Verify Claude identifies the issue
    expect(debugResponse).toContain('Cannot set headers after they are sent');
    expect(debugResponse).toContain('return');
    expect(debugResponse).toMatch(/res\.status.*return/);
    
    // Check for corrected code
    await expect(chatPage.lastResponse.locator('pre code')).toBeVisible();
  });

  test('should assist with code refactoring', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const refactorRequest = `Please help me refactor this code to be more maintainable:

\`\`\`javascript
function processUser(user) {
  if (user && user.name && user.email && user.name.length > 0 && user.email.includes('@') && user.age && user.age > 0 && user.age < 150) {
    const processedUser = {
      id: Math.random().toString(36).substr(2, 9),
      name: user.name.trim().toLowerCase(),
      email: user.email.trim().toLowerCase(),
      age: parseInt(user.age),
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    if (processedUser.age >= 18) {
      processedUser.isAdult = true;
    } else {
      processedUser.isAdult = false;
    }
    
    return processedUser;
  } else {
    throw new Error('Invalid user data');
  }
}
\`\`\``;
    
    await chatPage.sendMessage(refactorRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const refactorResponse = await chatPage.getLastResponse().textContent();
    
    // Check for refactoring improvements
    expect(refactorResponse).toContain('validateUser');
    expect(refactorResponse).toContain('separate');
    expect(refactorResponse).toMatch(/(function|const).*validate/i);
    
    // Should provide improved code
    await expect(chatPage.lastResponse.locator('pre code')).toBeVisible();
  });

  test('should handle git operations and version control', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    // Request git operations
    const gitRequest = 'Initialize a git repository, create a .gitignore file for Node.js, and make the initial commit';
    await chatPage.sendMessage(gitRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for git command execution
    await expect(response.locator('[data-tool="Bash"]')).toBeVisible();
    
    const bashContent = await response.locator('[data-tool="Bash"]').textContent();
    expect(bashContent).toMatch(/git (init|add|commit)/);
    
    // Request to create a feature branch
    await chatPage.sendMessage('Create a new feature branch called "user-authentication" and switch to it');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 10000 });
    
    const branchResponse = await chatPage.getLastResponse();
    const branchContent = await branchResponse.locator('[data-tool="Bash"]').textContent();
    expect(branchContent).toMatch(/git (checkout|branch).*user-authentication/);
  });

  test('should provide testing assistance', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const testRequest = `Help me write unit tests for this user service:

\`\`\`javascript
class UserService {
  constructor(database) {
    this.db = database;
  }
  
  async createUser(userData) {
    const user = {
      id: Math.random().toString(36).substr(2, 9),
      ...userData,
      createdAt: new Date()
    };
    
    await this.db.users.insert(user);
    return user;
  }
  
  async getUserById(id) {
    return await this.db.users.findById(id);
  }
}
\`\`\`

Please use Jest as the testing framework.`;
    
    await chatPage.sendMessage(testRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const testResponse = await chatPage.getLastResponse().textContent();
    
    // Check for Jest test patterns
    expect(testResponse).toContain('describe');
    expect(testResponse).toContain('it') || expect(testResponse).toContain('test');
    expect(testResponse).toContain('expect');
    expect(testResponse).toMatch(/jest\.mock|jest\.fn/);
    
    // Should include test file creation
    await expect(chatPage.lastResponse.locator('[data-tool="Write"]')).toBeVisible();
  });

  test('should handle package management and dependencies', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const packageRequest = 'I need to add authentication middleware to my Express app. Install the necessary packages and show me how to implement JWT authentication';
    await chatPage.sendMessage(packageRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for npm install commands
    const bashContent = await response.locator('[data-tool="Bash"]').textContent();
    expect(bashContent).toMatch(/npm install.*jwt/i);
    expect(bashContent).toMatch(/bcrypt|argon2/i); // Password hashing library
    
    // Should show implementation code
    const responseText = await response.textContent();
    expect(responseText).toContain('middleware');
    expect(responseText).toContain('jwt.sign');
    expect(responseText).toContain('jwt.verify');
  });

  test('should assist with API documentation', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const docRequest = `Help me create API documentation for these endpoints:

\`\`\`javascript
// User endpoints
app.get('/api/users', getAllUsers);
app.get('/api/users/:id', getUserById);
app.post('/api/users', createUser);
app.put('/api/users/:id', updateUser);
app.delete('/api/users/:id', deleteUser);
\`\`\`

Please create a README.md with proper API documentation.`;
    
    await chatPage.sendMessage(docRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for file creation
    await expect(response.locator('[data-tool="Write"]')).toBeVisible();
    
    const responseText = await response.textContent();
    
    // Verify documentation content
    expect(responseText).toContain('API Documentation');
    expect(responseText).toContain('GET /api/users');
    expect(responseText).toContain('POST /api/users');
    expect(responseText).toMatch(/200|201|400|404/); // HTTP status codes
    expect(responseText).toContain('Request') && expect(responseText).toContain('Response');
  });

  test('should handle performance optimization suggestions', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const perfRequest = `My Express API is responding slowly. Here's my current setup:

\`\`\`javascript
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  const enrichedUsers = [];
  
  for (let user of users) {
    const profile = await Profile.findOne({ userId: user.id });
    const posts = await Post.find({ authorId: user.id });
    
    enrichedUsers.push({
      ...user.toObject(),
      profile,
      postCount: posts.length
    });
  }
  
  res.json(enrichedUsers);
});
\`\`\`

How can I optimize this for better performance?`;
    
    await chatPage.sendMessage(perfRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const perfResponse = await chatPage.getLastResponse().textContent();
    
    // Check for performance optimization suggestions
    expect(perfResponse).toContain('N+1');
    expect(perfResponse).toMatch(/aggregate|join|populate/i);
    expect(perfResponse).toMatch(/Promise\.all|concurrent/i);
    expect(perfResponse).toContain('caching') || expect(perfResponse).toContain('pagination');
    
    // Should provide optimized code
    await expect(chatPage.lastResponse.locator('pre code')).toBeVisible();
  });

  test('should manage development environment setup', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const envRequest = 'Set up a development environment for my Node.js project with hot reload, environment variables, and debugging configuration';
    await chatPage.sendMessage(envRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const response = await chatPage.getLastResponse();
    
    // Check for package installations
    const bashContent = await response.locator('[data-tool="Bash"]').textContent();
    expect(bashContent).toMatch(/npm install.*nodemon|concurrently/i);
    expect(bashContent).toMatch(/dotenv/i);
    
    // Should create configuration files
    const responseText = await response.textContent();
    expect(responseText).toContain('.env');
    expect(responseText).toContain('package.json');
    expect(responseText).toMatch(/scripts.*dev/);
    
    // Check for file creation tools
    await expect(response.locator('[data-tool="Write"]')).toBeVisible();
  });

  test('should provide project architecture guidance', async ({ page }) => {
    await dashboardPage.clickStartChat();
    
    const archRequest = `I'm building a medium-sized Express.js application. What's a good project structure and architecture pattern I should follow? Include folder organization, separation of concerns, and best practices.`;
    
    await chatPage.sendMessage(archRequest);
    
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    const archResponse = await chatPage.getLastResponse().textContent();
    
    // Check for architecture concepts
    expect(archResponse).toMatch(/MVC|layered|clean architecture/i);
    expect(archResponse).toContain('controllers');
    expect(archResponse).toContain('models');
    expect(archResponse).toContain('routes');
    expect(archResponse).toMatch(/services?|middleware/);
    
    // Should show folder structure
    expect(archResponse).toMatch(/src\/|lib\/|app\//);
    expect(archResponse).toContain('├──') || expect(archResponse).toContain('│');
  });

  test('should complete end-to-end development workflow', async ({ page }) => {
    // This test combines multiple development tasks in sequence
    await dashboardPage.clickStartChat();
    
    // 1. Project setup
    await chatPage.sendMessage('Initialize a new Express.js REST API project with TypeScript');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // 2. Add authentication
    await chatPage.sendMessage('Add JWT-based authentication middleware');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // 3. Create database models
    await chatPage.sendMessage('Create a User model with Mongoose for MongoDB');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // 4. Add tests
    await chatPage.sendMessage('Write unit tests for the authentication middleware');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // 5. Set up deployment
    await chatPage.sendMessage('Create a Dockerfile for production deployment');
    await expect(chatPage.getLastResponse()).toBeVisible({ timeout: 15000 });
    
    // Verify the conversation history shows all development steps
    const messages = await chatPage.getAllMessages();
    expect(messages.length).toBeGreaterThanOrEqual(10); // 5 requests + 5+ responses
    
    // Check that session is saved with meaningful title
    await page.goto('/dashboard');
    await expect(dashboardPage.recentSessions).toBeVisible();
    
    const sessionTitle = await dashboardPage.getLatestSessionTitle();
    expect(sessionTitle).toMatch(/Express|TypeScript|API|Development/i);
  });
});