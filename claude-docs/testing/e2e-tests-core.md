# Core E2E Tests

**Status: 🔄 Ready for Implementation**  
**Total Tests: ~25 test specifications**  
**Completion: 0/25 tests implemented**

## Test Implementation Checklist

### First Time User (`/tests/e2e/specs/first-time-user.spec.js`)
- [ ] Complete Onboarding Flow (1 test) - `first-time-user.spec.js:Onboarding-Flow`
- [ ] Registration Error Handling (1 test) - `first-time-user.spec.js:Registration-Errors`

### Developer Workflow (`/tests/e2e/specs/developer-workflow.spec.js`)
- [ ] Typical Development Session (1 test) - `developer-workflow.spec.js:Dev-Session`
- [ ] Development Error Handling (1 test) - `developer-workflow.spec.js:Dev-Errors`

### Project Management (`/tests/e2e/specs/project-management.spec.js`)
- [ ] CRUD Operations (1 test) - `project-management.spec.js:Project-CRUD`
- [ ] Collaboration Features (1 test) - `project-management.spec.js:Project-Collab`

### Chat Interface (`/tests/e2e/specs/chat-interface.spec.js`)
- [ ] Complete Chat Conversation (1 test) - `chat-interface.spec.js:Chat-Conversation`
- [ ] Chat Error Handling (1 test) - `chat-interface.spec.js:Chat-Errors`

### File Operations (`/tests/e2e/specs/file-operations.spec.js`)
- [ ] File Management Workflow (1 test) - `file-operations.spec.js:File-Management`
- [ ] File Upload/Download (1 test) - `file-operations.spec.js:File-Upload-Download`

**Progress: 0/10 E2E test scenarios completed**

This document contains detailed specifications for core end-to-end tests in the Claude Code UI Docker test environment.

## Overview

Core E2E tests verify critical user journeys and workflows:
- **First Time User Journey** - Complete onboarding flow
- **Developer Workflow** - Typical development session
- **Project Management** - Project CRUD operations
- **Chat Interface** - AI assistant interactions
- **File Operations** - File editing and management

---

## User Journey: First Time User (`/tests/e2e/specs/first-time-user.spec.js`)

### Complete Onboarding Flow

```javascript
describe('First Time User Journey', () => {
  test('complete onboarding flow', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('/');
    await expect(page.locator('[data-testid="hero-title"]')).toContainText('Claude Code UI');
    await expect(page.locator('[data-testid="get-started"]')).toBeVisible();
    
    // 2. Click "Get Started"
    await page.click('[data-testid="get-started"]');
    await expect(page).toHaveURL('/register');
    
    // 3. Register new account
    await page.fill('[data-testid="email"]', 'newuser@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');
    await page.fill('[data-testid="username"]', 'newuser');
    await page.click('[data-testid="register-button"]');
    
    // 4. Verify email (mocked in test mode)
    await page.waitForURL('/verify-email');
    await expect(page.locator('[data-testid="verification-message"]')).toContainText('Check your email');
    await page.click('[data-testid="verify-button"]'); // Mock verification
    
    // 5. Complete profile
    await page.waitForURL('/setup-profile');
    await page.fill('[data-testid="display-name"]', 'New Test User');
    await page.selectOption('[data-testid="timezone"]', 'America/New_York');
    await page.selectOption('[data-testid="theme"]', 'dark');
    await page.click('[data-testid="continue"]');
    
    // 6. Create first project
    await page.waitForURL('/create-project');
    await expect(page.locator('[data-testid="welcome-title"]')).toContainText('Create Your First Project');
    
    await page.click('[data-testid="create-project"]');
    await page.fill('[data-testid="project-name"]', 'My First Project');
    await page.fill('[data-testid="project-description"]', 'Learning Claude Code UI');
    await page.selectOption('[data-testid="project-type"]', 'nodejs');
    await page.click('[data-testid="create"]');
    
    // 7. Land in project workspace
    await page.waitForURL(/\/projects\/[a-z0-9-]+/);
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-name-header"]')).toContainText('My First Project');
    
    // 8. Verify workspace elements are present
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="terminal-tab"]')).toBeVisible();
    
    // 9. Welcome tutorial starts
    await expect(page.locator('[data-testid="tutorial-step-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="tutorial-text"]')).toContainText('Welcome to Claude Code UI');
  });

  test('handles registration errors gracefully', async ({ page }) => {
    await page.goto('/register');
    
    // 1. Try with invalid email
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Invalid email address');
    
    // 2. Try with weak password
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', '123');
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="password-error"]')).toContainText('Password must be at least 8 characters');
    
    // 3. Try with mismatched passwords
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'DifferentPass123!');
    await page.click('[data-testid="register-button"]');
    
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText('Passwords do not match');
  });
});
```

---

## Developer Workflow (`/tests/e2e/specs/developer-workflow.spec.js`)

### Typical Development Session

```javascript
describe('Developer Workflow', () => {
  test('typical development session', async ({ page }) => {
    // 1. Login
    await loginTestUser(page);
    await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Your Projects');
    
    // 2. Open existing project
    await page.click('[data-testid="project-express-app"]');
    await page.waitForURL(/\/projects\/express-app/);
    await expect(page.locator('[data-testid="project-loaded"]')).toBeVisible();
    
    // 3. Create new feature branch
    await page.click('[data-testid="branch-dropdown"]');
    await expect(page.locator('[data-testid="current-branch"]')).toContainText('main');
    
    await page.click('[data-testid="create-branch"]');
    await page.fill('[data-testid="branch-name"]', 'feature/user-auth');
    await page.click('[data-testid="create-branch-button"]');
    
    await expect(page.locator('[data-testid="current-branch"]')).toContainText('feature/user-auth');
    await expect(page.locator('[data-testid="branch-created-notification"]')).toBeVisible();
    
    // 4. Create new file
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-path"]', 'src/auth/login.js');
    await page.click('[data-testid="create-file-button"]');
    
    await expect(page.locator('[data-testid="file-tab-login.js"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
    
    // 5. Write code with AI assistance
    await page.click('[data-testid="chat-input"]');
    await page.type('[data-testid="chat-input"]', 'Help me create a login endpoint with JWT authentication');
    await page.press('Enter');
    
    await expect(page.locator('[data-testid="message-sending"]')).toBeVisible();
    
    // 6. Wait for AI response
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="assistant-message"]')).toContainText('login endpoint');
    
    // 7. Apply suggested code
    await expect(page.locator('[data-testid="code-suggestion"]')).toBeVisible();
    await page.click('[data-testid="apply-code-button"]');
    
    await expect(page.locator('[data-testid="editor"]')).toContainText('login');
    await expect(page.locator('[data-testid="code-applied-notification"]')).toBeVisible();
    
    // 8. Save file
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="file-saved-indicator"]')).toBeVisible();
    
    // 9. Run tests
    await page.click('[data-testid="terminal-tab"]');
    await expect(page.locator('[data-testid="terminal"]')).toBeVisible();
    
    await page.type('[data-testid="terminal-input"]', 'npm test');
    await page.press('Enter');
    
    // Wait for test execution
    await page.waitForSelector('[data-testid="test-results"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="test-status"]')).toContainText('PASS');
    
    // 10. Stage and commit
    await page.click('[data-testid="git-tab"]');
    await expect(page.locator('[data-testid="git-status"]')).toBeVisible();
    
    await expect(page.locator('[data-testid="unstaged-files"]')).toContainText('src/auth/login.js');
    await page.click('[data-testid="stage-all"]');
    
    await expect(page.locator('[data-testid="staged-files"]')).toContainText('src/auth/login.js');
    
    await page.fill('[data-testid="commit-message"]', 'feat: add login endpoint with JWT');
    await page.click('[data-testid="commit-button"]');
    
    await expect(page.locator('[data-testid="commit-success"]')).toBeVisible();
    
    // 11. Push to remote
    await page.click('[data-testid="push-button"]');
    await expect(page.locator('[data-testid="push-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="push-success"]')).toBeVisible();
    
    // 12. Verify commit appears in history
    await page.click('[data-testid="git-history"]');
    await expect(page.locator('[data-testid="commit-list"]')).toContainText('feat: add login endpoint with JWT');
  });

  test('handles development workflow errors', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-test-project"]');
    
    // 1. File creation error (invalid path)
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-path"]', '../../../invalid-path.js');
    await page.click('[data-testid="create-file-button"]');
    
    await expect(page.locator('[data-testid="file-error"]')).toContainText('Invalid file path');
    
    // 2. Save error (permissions)
    await page.click('[data-testid="file-readonly.js"]');
    await page.fill('[data-testid="editor"]', 'const modified = true;');
    await page.keyboard.press('Control+S');
    
    await expect(page.locator('[data-testid="save-error"]')).toContainText('Permission denied');
    
    // 3. Commit error (no changes)
    await page.click('[data-testid="git-tab"]');
    await page.fill('[data-testid="commit-message"]', 'Empty commit');
    await page.click('[data-testid="commit-button"]');
    
    await expect(page.locator('[data-testid="commit-error"]')).toContainText('No changes to commit');
  });
});
```

---

## Project Management (`/tests/e2e/specs/project-management.spec.js`)

### Project CRUD Operations

```javascript
describe('Project Management', () => {
  test('create, edit, and delete project', async ({ page }) => {
    await loginTestUser(page);
    
    // 1. Create new project
    await page.click('[data-testid="create-new-project"]');
    await page.waitForURL('/create-project');
    
    await page.fill('[data-testid="project-name"]', 'Test E2E Project');
    await page.fill('[data-testid="project-description"]', 'A project created during E2E tests');
    await page.selectOption('[data-testid="project-type"]', 'react');
    await page.check('[data-testid="initialize-git"]');
    await page.click('[data-testid="create-project-button"]');
    
    // Verify project created
    await page.waitForURL(/\/projects\/test-e2e-project/);
    await expect(page.locator('[data-testid="project-name-header"]')).toContainText('Test E2E Project');
    
    // 2. Verify project structure
    await expect(page.locator('[data-testid="file-package.json"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-src/App.js"]')).toBeVisible();
    await expect(page.locator('[data-testid="git-initialized"]')).toBeVisible();
    
    // 3. Edit project settings
    await page.click('[data-testid="project-settings"]');
    await page.waitForURL(/\/projects\/test-e2e-project\/settings/);
    
    await page.fill('[data-testid="project-name-input"]', 'Renamed E2E Project');
    await page.fill('[data-testid="project-description-input"]', 'Updated description');
    await page.click('[data-testid="save-settings"]');
    
    await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
    
    // 4. Return to project and verify changes
    await page.click('[data-testid="back-to-project"]');
    await expect(page.locator('[data-testid="project-name-header"]')).toContainText('Renamed E2E Project');
    
    // 5. Star/favorite project
    await page.click('[data-testid="star-project"]');
    await expect(page.locator('[data-testid="project-starred"]')).toBeVisible();
    
    // 6. Go to dashboard and verify starred project
    await page.click('[data-testid="dashboard-link"]');
    await expect(page.locator('[data-testid="starred-projects"]')).toContainText('Renamed E2E Project');
    
    // 7. Delete project
    await page.click('[data-testid="project-menu-renamed-e2e-project"]');
    await page.click('[data-testid="delete-project"]');
    
    // Confirm deletion
    await page.fill('[data-testid="confirm-delete-input"]', 'DELETE');
    await page.click('[data-testid="confirm-delete-button"]');
    
    await expect(page.locator('[data-testid="project-deleted"]')).toBeVisible();
    
    // 8. Verify project no longer appears in list
    await expect(page.locator('[data-testid="project-renamed-e2e-project"]')).not.toBeVisible();
  });

  test('project collaboration features', async ({ browser }) => {
    // Create two user contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // 1. User 1 creates shared project
    await loginTestUser(page1, 'user1@example.com', 'password1');
    
    await page1.click('[data-testid="create-new-project"]');
    await page1.fill('[data-testid="project-name"]', 'Shared Project');
    await page1.check('[data-testid="enable-collaboration"]');
    await page1.click('[data-testid="create-project-button"]');
    
    // Get sharing link
    await page1.click('[data-testid="share-project"]');
    const shareLink = await page1.textContent('[data-testid="share-link"]');
    
    // 2. User 2 joins project
    await loginTestUser(page2, 'user2@example.com', 'password2');
    await page2.goto(shareLink);
    
    await page2.click('[data-testid="join-project"]');
    await expect(page2.locator('[data-testid="project-joined"]')).toBeVisible();
    
    // 3. Both users can see each other online
    await expect(page1.locator('[data-testid="collaborator-user2"]')).toBeVisible();
    await expect(page2.locator('[data-testid="collaborator-user1"]')).toBeVisible();
    
    // 4. Real-time collaboration
    await page1.click('[data-testid="file-index.js"]');
    await page1.fill('[data-testid="editor"]', '// User 1 is editing');
    
    // User 2 should see the cursor/editing indicator
    await page2.click('[data-testid="file-index.js"]');
    await expect(page2.locator('[data-testid="user1-cursor"]')).toBeVisible();
    
    await context1.close();
    await context2.close();
  });
});
```

---

## Chat Interface (`/tests/e2e/specs/chat-interface.spec.js`)

### AI Assistant Interactions

```javascript
describe('Chat Interface', () => {
  test('complete chat conversation with code assistance', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs-app"]');
    
    // 1. Open chat panel
    await page.click('[data-testid="chat-tab"]');
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    
    // 2. Send initial message
    await page.fill('[data-testid="chat-input"]', 'Help me create a REST API endpoint for user registration');
    await page.press('Enter');
    
    // Verify message sent
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Help me create a REST API');
    await expect(page.locator('[data-testid="message-timestamp"]')).toBeVisible();
    
    // 3. Wait for AI response
    await expect(page.locator('[data-testid="ai-thinking"]')).toBeVisible();
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 15000 });
    
    // Verify AI response
    await expect(page.locator('[data-testid="assistant-message"]')).toContainText('registration');
    await expect(page.locator('[data-testid="code-block"]')).toBeVisible();
    
    // 4. Apply suggested code
    await page.click('[data-testid="apply-code-to-file"]');
    
    // Select target file
    await page.selectOption('[data-testid="target-file-select"]', 'src/routes/auth.js');
    await page.click('[data-testid="confirm-apply"]');
    
    await expect(page.locator('[data-testid="code-applied"]')).toBeVisible();
    
    // 5. Follow-up question
    await page.fill('[data-testid="chat-input"]', 'How do I add input validation?');
    await page.press('Enter');
    
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(4)', { timeout: 15000 });
    
    // 6. Request modification
    await page.fill('[data-testid="chat-input"]', 'Can you modify the code to use express-validator?');
    await page.press('Enter');
    
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(6)', { timeout: 15000 });
    await expect(page.locator('[data-testid="code-block"]:last-child')).toContainText('express-validator');
    
    // 7. Test the chat history
    const messages = await page.locator('[data-testid^="message-"]').count();
    expect(messages).toBe(6); // 3 user messages + 3 AI responses
    
    // 8. Clear chat history
    await page.click('[data-testid="chat-menu"]');
    await page.click('[data-testid="clear-chat"]');
    await page.click('[data-testid="confirm-clear"]');
    
    await expect(page.locator('[data-testid="chat-empty"]')).toBeVisible();
  });

  test('handles chat errors gracefully', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-test-app"]');
    
    // 1. Network error during message send
    await page.route('**/api/chat/messages', route => route.abort());
    
    await page.fill('[data-testid="chat-input"]', 'This message should fail');
    await page.press('Enter');
    
    await expect(page.locator('[data-testid="message-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // 2. Retry mechanism
    await page.unroute('**/api/chat/messages');
    await page.click('[data-testid="retry-button"]');
    
    await expect(page.locator('[data-testid="message-error"]')).not.toBeVisible();
    await page.waitForSelector('[data-testid="assistant-message"]');
    
    // 3. Handle large message input
    const longMessage = 'A'.repeat(10000);
    await page.fill('[data-testid="chat-input"]', longMessage);
    
    await expect(page.locator('[data-testid="message-too-long"]')).toBeVisible();
    await expect(page.locator('[data-testid="character-count"]')).toContainText('10000');
  });
});
```

---

## File Operations (`/tests/e2e/specs/file-operations.spec.js`)

### File Editing and Management

```javascript
describe('File Operations', () => {
  test('complete file management workflow', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-file-test"]');
    
    // 1. Create new file
    await page.click('[data-testid="new-file-button"]');
    await page.fill('[data-testid="file-name-input"]', 'utils/helper.js');
    await page.click('[data-testid="create-file-confirm"]');
    
    // Verify file created
    await expect(page.locator('[data-testid="file-utils/helper.js"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-tab-helper.js"]')).toBeVisible();
    
    // 2. Edit file content
    const codeContent = `
export function formatDate(date) {
  return date.toLocaleDateString();
}

export function validateEmail(email) {
  const regex = /^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$/;
  return regex.test(email);
}`;
    
    await page.fill('[data-testid="editor"]', codeContent);
    
    // 3. Save file
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="file-saved"]')).toBeVisible();
    
    // 4. Create directory
    await page.rightClick('[data-testid="file-explorer"]');
    await page.click('[data-testid="new-folder"]');
    await page.fill('[data-testid="folder-name-input"]', 'components');
    await page.press('Enter');
    
    await expect(page.locator('[data-testid="folder-components"]')).toBeVisible();
    
    // 5. Move file to directory
    await page.dragAndDrop(
      '[data-testid="file-utils/helper.js"]',
      '[data-testid="folder-components"]'
    );
    
    await expect(page.locator('[data-testid="file-components/helper.js"]')).toBeVisible();
    
    // 6. Rename file
    await page.rightClick('[data-testid="file-components/helper.js"]');
    await page.click('[data-testid="rename-file"]');
    await page.fill('[data-testid="rename-input"]', 'utilities.js');
    await page.press('Enter');
    
    await expect(page.locator('[data-testid="file-components/utilities.js"]')).toBeVisible();
    
    // 7. Duplicate file
    await page.rightClick('[data-testid="file-components/utilities.js"]');
    await page.click('[data-testid="duplicate-file"]');
    
    await expect(page.locator('[data-testid="file-components/utilities-copy.js"]')).toBeVisible();
    
    // 8. Delete file
    await page.rightClick('[data-testid="file-components/utilities-copy.js"]');
    await page.click('[data-testid="delete-file"]');
    await page.click('[data-testid="confirm-delete"]');
    
    await expect(page.locator('[data-testid="file-components/utilities-copy.js"]')).not.toBeVisible();
    
    // 9. File search
    await page.click('[data-testid="search-files"]');
    await page.fill('[data-testid="search-input"]', 'formatDate');
    
    await expect(page.locator('[data-testid="search-results"]')).toContainText('components/utilities.js');
    
    // 10. Multiple file selection
    await page.click('[data-testid="file-components/utilities.js"]', { modifiers: ['Control'] });
    await page.click('[data-testid="file-package.json"]', { modifiers: ['Control'] });
    
    await expect(page.locator('[data-testid="selected-files-count"]')).toContainText('2');
  });

  test('file upload and download', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-upload-test"]');
    
    // 1. Upload single file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-file"]')
    ]);
    
    await fileChooser.setFiles('./test-fixtures/sample.txt');
    await expect(page.locator('[data-testid="file-sample.txt"]')).toBeVisible();
    
    // 2. Upload multiple files
    const [multiFileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-multiple"]')
    ]);
    
    await multiFileChooser.setFiles([
      './test-fixtures/image.png',
      './test-fixtures/data.json'
    ]);
    
    await expect(page.locator('[data-testid="file-image.png"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-data.json"]')).toBeVisible();
    
    // 3. Download file
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-sample.txt"]')
    ]);
    
    expect(download.suggestedFilename()).toBe('sample.txt');
    await download.saveAs('./downloads/sample.txt');
    
    // 4. Bulk download (zip)
    const [zipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-all-files"]')
    ]);
    
    expect(zipDownload.suggestedFilename()).toContain('.zip');
  });
});
```

---

## Test Execution Notes

### Browser Configuration
- Test in Chromium, Firefox, and WebKit
- Mobile viewport testing for responsive design
- Different screen resolutions and pixel densities
- Accessibility testing with screen readers

### Test Data Requirements
- Pre-created test users with different roles
- Sample projects with various types and structures
- Test files for upload/download scenarios
- Mock AI responses for consistent testing

### Performance Expectations
- Page load time: <2s
- AI response time: <10s
- File operations: <1s for files <10MB
- UI interactions: <200ms response time

### Error Scenarios
- Network connectivity issues
- Server errors during operations
- File permission problems
- Concurrent user conflicts

**Total Core E2E Tests**: ~25 comprehensive test scenarios covering user journeys, developer workflows, and core functionality.