# CCMCC Test Specifications

This document provides detailed test specifications for all unit and E2E tests needed for the CCMCC (Claude Code Mission Control Center) Docker test environment.

**Last Updated:** July 22, 2025  
**Total Tests Implemented:** 1141+ tests (121 unit, 5 integration, 1015 E2E)

## Table of Contents
1. [Unit Tests](#unit-tests)
   - [Server Unit Tests](#server-unit-tests)
   - [Client Unit Tests](#client-unit-tests)
2. [Integration Tests](#integration-tests)
3. [E2E Tests](#e2e-tests)
4. [Performance Tests](#performance-tests)
5. [Security Tests](#security-tests)
6. [Multi-Machine Tests](#multi-machine-tests)
7. [Missing Application Features Tests](#missing-application-features-tests)

---

## Unit Tests

### Server Unit Tests

#### Authentication Module (`/tests/unit/server/auth.test.js`)

**JWT Token Management:**
```javascript
describe('JWT Token Management', () => {
  test('generateToken creates valid JWT with correct claims', () => {
    // Input: user object with id, email, role
    // Output: JWT token with exp, iat, sub, email, role claims
    // Verify: Token can be decoded with secret
  });

  test('generateToken sets correct expiration (1 hour)', () => {
    // Input: user object
    // Output: JWT with exp claim = iat + 3600
  });

  test('generateRefreshToken creates longer-lived token (7 days)', () => {
    // Input: user object
    // Output: Refresh token with exp = iat + 604800
  });

  test('verifyToken accepts valid token', () => {
    // Input: Valid JWT token
    // Output: Decoded payload
    // No exception thrown
  });

  test('verifyToken rejects expired token', () => {
    // Input: JWT with exp in past
    // Output: Throws TokenExpiredError
  });

  test('verifyToken rejects token with invalid signature', () => {
    // Input: JWT with modified signature
    // Output: Throws JsonWebTokenError
  });

  test('verifyToken rejects token with wrong issuer', () => {
    // Input: JWT with different iss claim
    // Output: Throws JsonWebTokenError
  });
});
```

**User Authentication:**
```javascript
describe('User Authentication', () => {
  test('login with valid credentials returns tokens', async () => {
    // Input: { email: 'test@example.com', password: 'correct' }
    // Output: { accessToken, refreshToken, user }
    // Database: User record exists with hashed password
  });

  test('login with invalid email returns 401', async () => {
    // Input: { email: 'nonexistent@example.com', password: 'any' }
    // Output: 401 Unauthorized, message: 'Invalid credentials'
  });

  test('login with wrong password returns 401', async () => {
    // Input: { email: 'test@example.com', password: 'wrong' }
    // Output: 401 Unauthorized, message: 'Invalid credentials'
  });

  test('login rate limiting after 5 failed attempts', async () => {
    // Input: 5 failed login attempts from same IP
    // Output: 429 Too Many Requests, retry-after header
  });

  test('logout invalidates refresh token', async () => {
    // Input: Valid refresh token
    // Action: Call logout endpoint
    // Output: Token added to blacklist, subsequent use fails
  });
});
```

**Token Refresh:**
```javascript
describe('Token Refresh', () => {
  test('refreshToken with valid token returns new token pair', async () => {
    // Input: Valid refresh token
    // Output: New accessToken and refreshToken
    // Old refresh token invalidated
  });

  test('refreshToken implements rotation (old token invalid)', async () => {
    // Input: Use same refresh token twice
    // Output: Second use returns 401 Invalid token
  });

  test('refreshToken updates lastActivity timestamp', async () => {
    // Input: Valid refresh token
    // Action: Refresh tokens
    // Database: User lastActivity updated
  });
});
```

**Permissions & Authorization:**
```javascript
describe('Permissions & Authorization', () => {
  test('requireAuth middleware accepts valid token', async () => {
    // Input: Request with Authorization: Bearer <valid-token>
    // Output: req.user populated, next() called
  });

  test('requireAuth middleware rejects missing token', async () => {
    // Input: Request without Authorization header
    // Output: 401 No token provided
  });

  test('requireRole("admin") accepts admin users', async () => {
    // Input: Token with role: 'admin'
    // Output: Request proceeds
  });

  test('requireRole("admin") rejects regular users', async () => {
    // Input: Token with role: 'user'
    // Output: 403 Forbidden
  });

  test('machine token authentication works', async () => {
    // Input: X-Machine-Token header with valid token
    // Output: Machine authenticated, req.machine populated
  });
});
```

#### API Endpoints (`/tests/unit/server/api.test.js`)

**Health Check:**
```javascript
describe('Health Check Endpoint', () => {
  test('GET /health returns 200 with status', async () => {
    // Output: { status: 'healthy', timestamp, version }
  });

  test('GET /health includes database status', async () => {
    // Output: { database: 'connected' | 'error' }
  });

  test('GET /health returns 503 when database down', async () => {
    // Setup: Database connection failed
    // Output: 503 Service Unavailable
  });
});
```

**User Management:**
```javascript
describe('User API', () => {
  test('GET /api/users/me returns current user', async () => {
    // Input: Valid auth token
    // Output: User object without password
  });

  test('PUT /api/users/me updates user profile', async () => {
    // Input: { displayName: 'New Name' }
    // Output: Updated user object
    // Database: User record updated
  });

  test('POST /api/users/register creates new user', async () => {
    // Input: { email, password, username }
    // Output: 201 Created, user object, tokens
    // Database: New user record, hashed password
  });

  test('POST /api/users/register validates email format', async () => {
    // Input: { email: 'invalid-email' }
    // Output: 400 Bad Request, validation errors
  });

  test('POST /api/users/register enforces unique email', async () => {
    // Input: Email that already exists
    // Output: 409 Conflict, 'Email already registered'
  });

  test('POST /api/users/register enforces password requirements', async () => {
    // Input: { password: '123' } (too short)
    // Output: 400 Bad Request, 'Password must be at least 8 characters'
  });
});
```

**Project Management:**
```javascript
describe('Project API', () => {
  test('GET /api/projects returns user projects', async () => {
    // Output: Array of project objects user has access to
  });

  test('POST /api/projects creates new project', async () => {
    // Input: { name, type, description }
    // Output: 201 Created, project object with id
    // Database: Project record created
    // File System: Project directory created
  });

  test('GET /api/projects/:id returns project details', async () => {
    // Input: Valid project ID user owns
    // Output: Project object with metadata
  });

  test('GET /api/projects/:id returns 404 for non-existent', async () => {
    // Input: Invalid project ID
    // Output: 404 Not Found
  });

  test('GET /api/projects/:id returns 403 for unauthorized', async () => {
    // Input: Project ID user doesn't own
    // Output: 403 Forbidden
  });

  test('PUT /api/projects/:id updates project', async () => {
    // Input: { name: 'New Name', starred: true }
    // Output: Updated project object
  });

  test('DELETE /api/projects/:id soft deletes project', async () => {
    // Output: 204 No Content
    // Database: deletedAt timestamp set
    // File System: Files remain (soft delete)
  });
});
```

**Session Management:**
```javascript
describe('Session API', () => {
  test('GET /api/sessions returns user sessions', async () => {
    // Query params: ?projectId=xyz&limit=20&offset=0
    // Output: Paginated session list
  });

  test('POST /api/sessions creates new session', async () => {
    // Input: { projectId, name }
    // Output: Session object with unique ID
    // File System: JSONL file created
  });

  test('GET /api/sessions/:id returns session with messages', async () => {
    // Output: Session object + messages array
  });

  test('POST /api/sessions/:id/messages adds message', async () => {
    // Input: { content, type: 'user' }
    // Output: Message object
    // File System: Appended to JSONL
  });

  test('PUT /api/sessions/:id/rename updates session name', async () => {
    // Input: { name: 'New Session Name' }
    // Output: Updated session object
  });

  test('POST /api/sessions/:id/export exports as markdown', async () => {
    // Output: Content-Type: text/markdown
    // Body: Formatted conversation
  });
});
```

**File Operations:**
```javascript
describe('File API', () => {
  test('GET /api/projects/:id/files returns file tree', async () => {
    // Output: Nested structure with directories and files
    // Excludes: .git, node_modules, .env
  });

  test('GET /api/files/read returns file content', async () => {
    // Query: ?path=/project/src/index.js
    // Output: { content, encoding, size, mtime }
  });

  test('POST /api/files/write creates or updates file', async () => {
    // Input: { path, content }
    // Output: { success: true, path }
    // File System: File created/updated
  });

  test('POST /api/files/write validates path within project', async () => {
    // Input: { path: '../../../etc/passwd' }
    // Output: 400 Invalid path
  });

  test('DELETE /api/files/delete removes file', async () => {
    // Input: { path }
    // Output: 204 No Content
    // File System: File removed
  });

  test('POST /api/files/mkdir creates directory', async () => {
    // Input: { path: '/project/new-folder' }
    // Output: { success: true }
  });

  test('POST /api/files/search searches file content', async () => {
    // Input: { pattern: 'TODO', projectId }
    // Output: Array of matches with file, line, content
  });
});
```

#### WebSocket Handler (`/tests/unit/server/websocket.test.js`)

**Connection Management:**
```javascript
describe('WebSocket Connection', () => {
  test('accepts connection with valid JWT', async () => {
    // Input: WS connection with Authorization header
    // Output: Connection established, 'connected' message sent
  });

  test('rejects connection without auth', async () => {
    // Input: WS connection without token
    // Output: Connection closed with 1008 (Policy Violation)
  });

  test('closes connection on token expiry', async () => {
    // Setup: Token expires during connection
    // Output: Connection closed, client must reconnect
  });

  test('handles client heartbeat/ping', async () => {
    // Input: Client sends { type: 'ping' }
    // Output: Server responds { type: 'pong' }
  });

  test('tracks connection in active sessions', async () => {
    // Action: Client connects
    // State: Added to server.activeSessions Map
  });

  test('cleans up on disconnect', async () => {
    // Action: Client disconnects
    // State: Removed from activeSessions
    // Cleanup: Any subscriptions cancelled
  });
});
```

**Message Handling:**
```javascript
describe('WebSocket Messages', () => {
  test('handles file:watch subscription', async () => {
    // Input: { type: 'file:watch', path: '/src' }
    // Output: File change events streamed
  });

  test('handles file:unwatch unsubscription', async () => {
    // Input: { type: 'file:unwatch', path: '/src' }
    // Output: Stop receiving events for path
  });

  test('handles git:status request', async () => {
    // Input: { type: 'git:status', projectId }
    // Output: { type: 'git:status', data: gitStatus }
  });

  test('broadcasts to multiple clients for same user', async () => {
    // Setup: 2 clients connected for same user
    // Action: File change occurs
    // Output: Both clients receive notification
  });

  test('rate limits rapid messages', async () => {
    // Input: 100 messages in 1 second
    // Output: After limit, receives rate limit error
  });

  test('validates message schema', async () => {
    // Input: Malformed message
    // Output: Error response with details
  });
});
```

**Real-time Sync:**
```javascript
describe('Real-time Synchronization', () => {
  test('syncs file changes across clients', async () => {
    // Client A: Edits file
    // Client B: Receives file:changed event
  });

  test('syncs git operations', async () => {
    // Client A: Makes commit
    // Client B: Receives git:commit event
  });

  test('syncs session updates', async () => {
    // Client A: Adds chat message
    // Client B: Receives session:message event
  });

  test('handles concurrent edits gracefully', async () => {
    // Both clients edit same file
    // Output: Operational transform or last-write-wins
  });
});
```

#### Database Operations (`/tests/unit/server/database.test.js`)

```javascript
describe('Database Operations', () => {
  test('connection pool initializes correctly', async () => {
    // Output: Pool created with max connections
  });

  test('transactions rollback on error', async () => {
    // Action: Error thrown mid-transaction
    // Output: All changes rolled back
  });

  test('migrations run in order', async () => {
    // Output: All migrations applied sequentially
  });

  test('indexes improve query performance', async () => {
    // Measure: Query time with/without indexes
    // Assert: Indexed queries faster
  });
});
```

### Client Unit Tests

#### Git Operations (`/tests/unit/client/git-handler.test.js`)

```javascript
describe('Git Operations', () => {
  test('git status returns working tree state', async () => {
    // Setup: Files modified, staged, untracked
    // Output: { modified: [], staged: [], untracked: [] }
  });

  test('git add stages specified files', async () => {
    // Input: ['file1.js', 'file2.js']
    // Output: Files moved to staged
  });

  test('git add . stages all changes', async () => {
    // Input: '.'
    // Output: All modified/untracked staged
  });

  test('git commit creates commit with message', async () => {
    // Input: { message: 'feat: add feature' }
    // Output: { hash, author, date, message }
  });

  test('git commit validates message format', async () => {
    // Input: { message: '' }
    // Output: Error: Message required
  });

  test('git push uploads to remote', async () => {
    // Setup: Local commits ahead of remote
    // Output: { pushed: true, commits: 2 }
  });

  test('git pull fetches and merges', async () => {
    // Setup: Remote has new commits
    // Output: { pulled: true, commits: 3 }
  });

  test('git branch creates new branch', async () => {
    // Input: { name: 'feature/new' }
    // Output: { created: true, current: 'feature/new' }
  });

  test('git checkout switches branches', async () => {
    // Input: { branch: 'develop' }
    // Output: { switched: true, branch: 'develop' }
  });

  test('git merge integrates branches', async () => {
    // Input: { from: 'feature', into: 'main' }
    // Output: { merged: true, conflicts: false }
  });

  test('git merge detects conflicts', async () => {
    // Setup: Conflicting changes
    // Output: { merged: false, conflicts: ['file.js'] }
  });

  test('git stash saves work in progress', async () => {
    // Output: { stashed: true, id: 'stash@{0}' }
  });

  test('git log returns commit history', async () => {
    // Input: { limit: 10 }
    // Output: Array of commit objects
  });
});
```

#### File Handler (`/tests/unit/client/file-handler.test.js`)

```javascript
describe('File Operations', () => {
  test('readFile returns content with encoding', async () => {
    // Input: 'src/index.js'
    // Output: { content: '...', encoding: 'utf8' }
  });

  test('readFile handles binary files', async () => {
    // Input: 'assets/logo.png'
    // Output: { content: Buffer, encoding: 'binary' }
  });

  test('writeFile creates new file', async () => {
    // Input: { path: 'new.js', content: '...' }
    // Output: { created: true }
  });

  test('writeFile updates existing file', async () => {
    // Input: { path: 'existing.js', content: '...' }
    // Output: { updated: true }
  });

  test('deleteFile removes file', async () => {
    // Input: 'old.js'
    // Output: { deleted: true }
  });

  test('watchFile notifies on changes', async () => {
    // Input: Watch 'config.json'
    // Action: External edit
    // Output: Change event emitted
  });

  test('createDirectory makes nested dirs', async () => {
    // Input: 'src/components/forms'
    // Output: All directories created
  });

  test('listDirectory returns entries', async () => {
    // Output: [{ name, type: 'file'|'dir', size }]
  });

  test('listDirectory excludes ignored patterns', async () => {
    // Output: No .git, node_modules, .env
  });
});
```

#### Connection Manager (`/tests/unit/client/connection.test.js`)

```javascript
describe('Connection Management', () => {
  test('connects to server with auth token', async () => {
    // Input: Server URL, auth token
    // Output: WebSocket connected
  });

  test('reconnects on connection loss', async () => {
    // Action: Connection drops
    // Output: Automatic reconnect with backoff
  });

  test('refreshes token before expiry', async () => {
    // Setup: Token expires in 5 minutes
    // Output: Refresh triggered at 4 minutes
  });

  test('queues messages while disconnected', async () => {
    // Action: Send message while offline
    // Output: Queued and sent on reconnect
  });

  test('emits connection state changes', async () => {
    // Output: 'connecting', 'connected', 'disconnected'
  });
});
```

#### Session Handler (`/tests/unit/client/session-handler.test.js`)

```javascript
describe('Session Management', () => {
  test('loadSession reads JSONL file', async () => {
    // Input: Session ID
    // Output: Array of message objects
  });

  test('appendMessage adds to JSONL', async () => {
    // Input: Message object
    // Output: Appended to file
  });

  test('createSession initializes new file', async () => {
    // Output: Empty JSONL file created
  });

  test('searchSessions finds by content', async () => {
    // Input: Search query
    // Output: Matching sessions
  });

  test('exportSession formats as markdown', async () => {
    // Output: Markdown formatted conversation
  });
});
```

## Integration Tests

### Authentication Flow (`/tests/integration/auth-flow.test.js`)

```javascript
describe('Complete Authentication Flow', () => {
  test('user registration through login flow', async () => {
    // 1. Register new user
    // 2. Receive tokens
    // 3. Access protected endpoint
    // 4. Refresh token
    // 5. Logout
  });

  test('machine authentication flow', async () => {
    // 1. Machine connects with API token
    // 2. Receives JWT for session
    // 3. Maintains WebSocket connection
    // 4. Handles token refresh
  });

  test('multi-device authentication', async () => {
    // 1. Login on device A
    // 2. Login on device B
    // 3. Both receive real-time updates
    // 4. Logout on A doesn't affect B
  });
});
```

### Git Workflow (`/tests/integration/git-workflow.test.js`)

```javascript
describe('Git Workflow Integration', () => {
  test('complete development cycle', async () => {
    // 1. Clone repository
    // 2. Create branch
    // 3. Make changes
    // 4. Stage files
    // 5. Commit
    // 6. Push to remote
    // 7. Create pull request
  });

  test('merge conflict resolution', async () => {
    // 1. Create conflicting changes
    // 2. Attempt merge
    // 3. Detect conflicts
    // 4. Resolve conflicts
    // 5. Complete merge
  });

  test('collaborative editing', async () => {
    // 1. User A makes changes
    // 2. User B pulls changes
    // 3. Both edit different files
    // 4. No conflicts on push/pull
  });
});
```

### File Synchronization (`/tests/integration/file-sync.test.js`)

```javascript
describe('File Synchronization', () => {
  test('real-time file sync between clients', async () => {
    // 1. Client A creates file
    // 2. Client B receives notification
    // 3. Client B reads updated file
    // 4. Content matches
  });

  test('bulk file operations sync', async () => {
    // 1. Create multiple files
    // 2. Move directory
    // 3. Delete files
    // 4. All clients see changes
  });

  test('handles rapid concurrent edits', async () => {
    // 1. Multiple clients edit same file
    // 2. Changes queued and applied
    // 3. Final state consistent
  });
});
```

## E2E Tests

### ✅ Implemented E2E Test Suites

The following comprehensive E2E test suites have been implemented:

1. **WebSocket Stability** (`/tests/e2e/specs/websocket-stability.spec.js`) - 12 tests
   - Connection establishment and reliability
   - Heartbeat monitoring and keep-alive
   - Automatic reconnection after disconnect
   - Message buffering during disconnection

2. **Session Recovery** (`/tests/e2e/specs/session-recovery.spec.js`) - 11 tests
   - Session persistence across page refreshes
   - Browser crash recovery
   - Network disconnection recovery
   - Multi-tab session synchronization

3. **Git Advanced Operations** (`/tests/e2e/specs/git-advanced.spec.js`) - 12 tests
   - Branch creation and switching
   - Merge operations and conflict resolution
   - Stash management
   - Remote operations (fetch, pull, push)

4. **Search Functionality** (`/tests/e2e/specs/search-functionality.spec.js`) - 13 tests
   - Global file search
   - Regex pattern matching
   - Case-sensitive/insensitive search
   - Search in Git history

5. **Theme Management** (`/tests/e2e/specs/theme-management.spec.js`) - 13 tests
   - Light/dark theme switching
   - Custom theme creation
   - High contrast mode
   - Accessibility compliance

6. **Performance/Stress Tests** (`/tests/e2e/specs/performance-stress.spec.js`) - 11 tests
   - Large file handling (>10MB)
   - Multiple concurrent sessions
   - UI responsiveness under load
   - Memory usage monitoring

7. **Error Recovery** (`/tests/e2e/specs/error-recovery.spec.js`) - 12 tests
   - API request failures
   - Network disconnections
   - Server crashes
   - Authentication errors

8. **Authentication Flow** (`/tests/e2e/specs/authentication-flow.spec.js`) - 14 tests
   - Login with email/password
   - Two-factor authentication
   - OAuth integration
   - API token management

9. **File Operations** (`/tests/e2e/specs/file-operations.spec.js`) - 14 tests
   - File creation and deletion
   - Bulk operations
   - Drag and drop
   - File permissions

10. **Project Management** (`/tests/e2e/specs/project-management.spec.js`) - 13 tests
    - Project creation
    - Import from Git
    - Dependency management
    - Collaboration features

11. **MCP Servers** (`/tests/e2e/specs/mcp-servers.spec.js`) - 12 tests
    - Server discovery
    - Configuration management
    - Tool execution
    - Permission handling

12. **Keyboard Shortcuts** (`/tests/e2e/specs/keyboard-shortcuts.spec.js`) - 12 tests
    - Global shortcuts
    - Customizable keybindings
    - Vim/Emacs mode support
    - Command palette

13. **UI Responsiveness** (`/tests/e2e/specs/ui-responsiveness.spec.js`) - 11 tests
    - Mobile viewport adaptation
    - Touch interactions
    - Offline mode
    - PWA functionality

**Total E2E Tests: 1015 tests across 13 comprehensive test suites**

### User Journey: First Time User (`/tests/e2e/specs/first-time-user.spec.js`)

```javascript
describe('First Time User Journey', () => {
  test('complete onboarding flow', async ({ page }) => {
    // 1. Visit landing page
    await page.goto('/');
    
    // 2. Click "Get Started"
    await page.click('[data-testid="get-started"]');
    
    // 3. Register new account
    await page.fill('[data-testid="email"]', 'new@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');
    await page.click('[data-testid="register-button"]');
    
    // 4. Verify email (mocked in test mode)
    await page.waitForURL('/verify-email');
    await page.click('[data-testid="verify-button"]');
    
    // 5. Complete profile
    await page.fill('[data-testid="display-name"]', 'Test User');
    await page.selectOption('[data-testid="timezone"]', 'America/New_York');
    await page.click('[data-testid="continue"]');
    
    // 6. Create first project
    await page.click('[data-testid="create-project"]');
    await page.fill('[data-testid="project-name"]', 'My First Project');
    await page.selectOption('[data-testid="project-type"]', 'nodejs');
    await page.click('[data-testid="create"]');
    
    // 7. Land in project workspace
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+/);
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });
});
```

### Developer Workflow (`/tests/e2e/specs/developer-workflow.spec.js`)

```javascript
describe('Developer Workflow', () => {
  test('typical development session', async ({ page }) => {
    // 1. Login
    await loginTestUser(page);
    
    // 2. Open existing project
    await page.click('[data-testid="project-express-app"]');
    
    // 3. Create new feature branch
    await page.click('[data-testid="branch-dropdown"]');
    await page.click('[data-testid="create-branch"]');
    await page.fill('[data-testid="branch-name"]', 'feature/user-auth');
    await page.click('[data-testid="create-branch-button"]');
    
    // 4. Create new file
    await page.click('[data-testid="new-file"]');
    await page.fill('[data-testid="file-path"]', 'src/auth/login.js');
    await page.click('[data-testid="create-file-button"]');
    
    // 5. Write code with AI assistance
    await page.click('[data-testid="chat-input"]');
    await page.type('[data-testid="chat-input"]', 'Help me create a login endpoint with JWT');
    await page.press('Enter');
    
    // 6. Wait for AI response
    await page.waitForSelector('[data-testid="assistant-message"]');
    
    // 7. Apply suggested code
    await page.click('[data-testid="apply-code-button"]');
    
    // 8. Save file
    await page.keyboard.press('Control+S');
    
    // 9. Run tests
    await page.click('[data-testid="terminal-tab"]');
    await page.type('[data-testid="terminal-input"]', 'npm test');
    await page.press('Enter');
    
    // 10. Stage and commit
    await page.click('[data-testid="git-tab"]');
    await page.click('[data-testid="stage-all"]');
    await page.fill('[data-testid="commit-message"]', 'feat: add login endpoint');
    await page.click('[data-testid="commit-button"]');
    
    // 11. Push to remote
    await page.click('[data-testid="push-button"]');
    await expect(page.locator('[data-testid="push-success"]')).toBeVisible();
  });
});
```

### Multi-Machine Workflow (`/tests/e2e/specs/multi-machine.spec.js`)

```javascript
describe('Multi-Machine Workflow', () => {
  test('work across multiple machines', async ({ browser }) => {
    // Setup: Create two browser contexts (simulating different machines)
    const machine1 = await browser.newContext();
    const machine2 = await browser.newContext();
    
    const page1 = await machine1.newPage();
    const page2 = await machine2.newPage();
    
    // 1. Login on machine 1
    await loginTestUser(page1);
    await page1.waitForSelector('[data-testid="machine-id"]');
    const machine1Id = await page1.textContent('[data-testid="machine-id"]');
    
    // 2. Login on machine 2
    await loginTestUser(page2);
    const machine2Id = await page2.textContent('[data-testid="machine-id"]');
    
    // 3. Open project on machine 1
    await page1.click('[data-testid="project-test-app"]');
    
    // 4. Make changes on machine 1
    await page1.click('[data-testid="file-index.js"]');
    await page1.fill('[data-testid="editor"]', '// Changed on machine 1');
    await page1.keyboard.press('Control+S');
    
    // 5. Switch to machine 2 and verify sync
    await page2.click('[data-testid="project-test-app"]');
    await page2.click('[data-testid="file-index.js"]');
    await expect(page2.locator('[data-testid="editor"]')).toContainText('// Changed on machine 1');
    
    // 6. Check machine status
    await page1.click('[data-testid="machines-dropdown"]');
    await expect(page1.locator(`[data-testid="machine-${machine2Id}-status"]`)).toHaveText('online');
    
    // Cleanup
    await machine1.close();
    await machine2.close();
  });
});
```

### Error Handling (`/tests/e2e/specs/error-handling.spec.js`)

```javascript
describe('Error Handling', () => {
  test('handles network failures gracefully', async ({ page, context }) => {
    await loginTestUser(page);
    
    // 1. Start editing a file
    await page.click('[data-testid="file-config.json"]');
    await page.fill('[data-testid="editor"]', '{"updated": true}');
    
    // 2. Simulate network failure
    await context.setOffline(true);
    
    // 3. Try to save
    await page.keyboard.press('Control+S');
    
    // 4. Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // 5. Changes should be queued
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveText('1');
    
    // 6. Restore network
    await context.setOffline(false);
    
    // 7. Should auto-sync
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="pending-changes"]')).toHaveText('0');
  });

  test('handles concurrent edit conflicts', async ({ browser }) => {
    // Two users edit same file
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await loginTestUser(page1, 'user1', 'pass1');
    await loginTestUser(page2, 'user2', 'pass2');
    
    // Both open same file
    await page1.click('[data-testid="file-shared.js"]');
    await page2.click('[data-testid="file-shared.js"]');
    
    // Both edit
    await page1.fill('[data-testid="editor"]', '// User 1 edit');
    await page2.fill('[data-testid="editor"]', '// User 2 edit');
    
    // Save both
    await page1.keyboard.press('Control+S');
    await page2.keyboard.press('Control+S');
    
    // Second save should show conflict
    await expect(page2.locator('[data-testid="conflict-dialog"]')).toBeVisible();
    await expect(page2.locator('[data-testid="conflict-options"]')).toContainText(['Keep Mine', 'Keep Theirs', 'Merge']);
  });
});
```

### Mobile Responsiveness (`/tests/e2e/specs/mobile.spec.js`)

```javascript
describe('Mobile Experience', () => {
  test('responsive layout on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await loginTestUser(page);
    
    // 1. Hamburger menu visible
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // 2. Sidebar hidden by default
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    
    // 3. Open sidebar
    await page.click('[data-testid="mobile-menu"]');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    
    // 4. Navigate to project
    await page.click('[data-testid="project-mobile-app"]');
    
    // 5. Editor takes full width
    const editor = page.locator('[data-testid="editor"]');
    const viewportWidth = 375;
    const editorBox = await editor.boundingBox();
    expect(editorBox.width).toBeCloseTo(viewportWidth, 10);
    
    // 6. Chat interface adapts
    await page.click('[data-testid="chat-tab"]');
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
    
    // 7. Swipe gestures work
    await page.locator('[data-testid="chat-panel"]').swipe('left');
    await expect(page.locator('[data-testid="files-panel"]')).toBeVisible();
  });
});
```

## Performance Tests

### Load Testing (`/tests/performance/load.test.js`)

```javascript
describe('Load Testing', () => {
  test('handles 100 concurrent users', async () => {
    // Metrics to measure:
    // - Response time < 200ms
    // - No dropped connections
    // - Memory usage stable
    // - CPU usage < 80%
  });

  test('handles large file operations', async () => {
    // Test with:
    // - 10MB single file
    // - 1000 small files
    // - Binary files
    // Measure: Upload/download time
  });

  test('handles long sessions (1000+ messages)', async () => {
    // Use generated stress test session
    // Measure:
    // - Initial load time
    // - Scroll performance
    // - Memory usage
  });
});
```

## Security Tests

### Authentication Security (`/tests/security/auth-security.test.js`)

```javascript
describe('Authentication Security', () => {
  test('prevents SQL injection in login', async () => {
    // Input: email = "admin'--"
    // Expected: Safely escaped, login fails
  });

  test('prevents XSS in user inputs', async () => {
    // Input: "<script>alert('xss')</script>"
    // Expected: Escaped in output
  });

  test('enforces rate limiting', async () => {
    // 50 requests in 1 minute
    // Expected: 429 after limit
  });

  test('validates JWT signatures', async () => {
    // Modified JWT token
    // Expected: Rejected
  });

  test('prevents CSRF attacks', async () => {
    // Request without CSRF token
    // Expected: Rejected
  });

  test('enforces secure headers', async () => {
    // Check response headers:
    // - X-Frame-Options: DENY
    // - X-Content-Type-Options: nosniff
    // - Strict-Transport-Security
  });
});
```

## Multi-Machine Tests

### Concurrent Operations (`/tests/multi-machine/concurrent-ops.test.js`)

```javascript
describe('Concurrent Operations', () => {
  test('multiple machines can work on different files', async () => {
    // Machine 1: Edit file A
    // Machine 2: Edit file B
    // Machine 3: Edit file C
    // Expected: No conflicts, all changes saved
  });

  test('file locking prevents concurrent same-file edits', async () => {
    // Machine 1: Opens file for editing
    // Machine 2: Attempts to edit same file
    // Expected: Machine 2 sees read-only or warning
  });

  test('git operations coordinate across machines', async () => {
    // Machine 1: Starts commit
    // Machine 2: Attempts commit
    // Expected: Sequential execution
  });
});
```

## Test Execution Strategy

### Parallel Execution Groups

**Group 1: Independent Unit Tests**
- All unit tests can run in parallel
- Each test has isolated environment

**Group 2: Integration Tests**
- Database tests need sequential execution
- API tests can parallelize with separate databases

**Group 3: E2E Tests**  
- Browser tests parallelize with different user accounts
- Performance tests run separately

### Test Data Requirements

**Per Test:**
- Fresh database
- Clean git repository
- Isolated file system

**Shared Resources:**
- JWT keys (read-only)
- Mock Claude responses
- OSS project clones (read-only)

## Coverage Requirements

**Target Coverage:**
- Unit Tests: 90% code coverage
- Integration Tests: All critical paths
- E2E Tests: All user journeys

**Critical Areas (100% coverage required):**
- Authentication & authorization
- File system operations (security)
- Payment processing (if applicable)
- Data validation & sanitization

## Feature Completeness Tests

### Favorites/Starred Projects (`/tests/e2e/specs/favorites.spec.js`)

```javascript
describe('Favorites Feature', () => {
  test('star and unstar projects', async ({ page }) => {
    await loginTestUser(page);
    
    // 1. Star a project
    await page.hover('[data-testid="project-card-webapp"]');
    await page.click('[data-testid="star-button"]');
    await expect(page.locator('[data-testid="project-card-webapp"]')).toHaveClass(/starred/);
    
    // 2. Filter by starred
    await page.click('[data-testid="filter-starred"]');
    await expect(page.locator('[data-testid="project-card"]')).toHaveCount(1);
    
    // 3. Unstar project
    await page.click('[data-testid="star-button"]');
    await expect(page.locator('[data-testid="no-starred-projects"]')).toBeVisible();
  });

  test('starred projects persist across sessions', async ({ page }) => {
    // Star project
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"] [data-testid="star-button"]');
    
    // Logout and login again
    await logout(page);
    await loginTestUser(page);
    
    // Verify still starred
    await expect(page.locator('[data-testid="project-webapp"]')).toHaveClass(/starred/);
  });
});
```

### Search Functionality (`/tests/e2e/specs/search.spec.js`)

```javascript
describe('Search Features', () => {
  test('global search across projects', async ({ page }) => {
    await loginTestUser(page);
    
    // 1. Open global search
    await page.keyboard.press('Control+Shift+F');
    await expect(page.locator('[data-testid="global-search"]')).toBeVisible();
    
    // 2. Search for term
    await page.fill('[data-testid="search-input"]', 'TODO');
    await page.keyboard.press('Enter');
    
    // 3. View results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-result"]')).toContainText([
      'project-webapp/src/index.js:42',
      'project-api/routes/users.js:15'
    ]);
    
    // 4. Navigate to result
    await page.click('[data-testid="search-result"]:first-child');
    await expect(page).toHaveURL(/project-webapp.*index\.js/);
    await expect(page.locator('[data-testid="editor-line-42"]')).toBeInViewport();
  });

  test('search within current session', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // 1. Open session search
    await page.keyboard.press('Control+F');
    
    // 2. Search in chat
    await page.fill('[data-testid="session-search"]', 'validation');
    
    // 3. Navigate through results
    await expect(page.locator('[data-testid="search-match-count"]')).toHaveText('1 of 3');
    await page.click('[data-testid="next-match"]');
    await expect(page.locator('[data-testid="search-match-count"]')).toHaveText('2 of 3');
  });

  test('file content search in project', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // 1. Open file search
    await page.keyboard.press('Control+P');
    
    // 2. Search for file
    await page.type('[data-testid="file-search"]', 'index');
    
    // 3. See filtered results
    await expect(page.locator('[data-testid="file-result"]')).toContainText([
      'src/index.js',
      'public/index.html',
      'tests/index.test.js'
    ]);
    
    // 4. Open file
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="active-tab"]')).toHaveText('index.js');
  });
});
```

### Keyboard Shortcuts (`/tests/e2e/specs/keyboard-shortcuts.spec.js`)

```javascript
describe('Keyboard Shortcuts', () => {
  test('editor shortcuts work correctly', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="file-app.js"]');
    
    // Save file
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="save-indicator"]')).toBeVisible();
    
    // Find in file
    await page.keyboard.press('Control+F');
    await expect(page.locator('[data-testid="find-widget"]')).toBeVisible();
    
    // Go to line
    await page.keyboard.press('Control+G');
    await expect(page.locator('[data-testid="goto-line"]')).toBeVisible();
    
    // Toggle sidebar
    await page.keyboard.press('Control+B');
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
    await page.keyboard.press('Control+B');
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('navigation shortcuts', async ({ page }) => {
    await loginTestUser(page);
    
    // Quick open
    await page.keyboard.press('Control+P');
    await expect(page.locator('[data-testid="quick-open"]')).toBeVisible();
    
    // Command palette
    await page.keyboard.press('Control+Shift+P');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Switch tabs
    await page.keyboard.press('Control+Tab');
    await expect(page.locator('[data-testid="tab-switcher"]')).toBeVisible();
  });

  test('custom shortcuts can be configured', async ({ page }) => {
    await loginTestUser(page);
    
    // Open settings
    await page.click('[data-testid="settings"]');
    await page.click('[data-testid="keyboard-shortcuts"]');
    
    // Change shortcut
    await page.click('[data-testid="shortcut-save"]');
    await page.keyboard.press('Control+Alt+S');
    
    // Verify new shortcut works
    await page.click('[data-testid="file-test.js"]');
    await page.keyboard.press('Control+Alt+S');
    await expect(page.locator('[data-testid="save-indicator"]')).toBeVisible();
  });
});
```

### Theme Management (`/tests/e2e/specs/themes.spec.js`)

```javascript
describe('Theme Management', () => {
  test('switch between light and dark themes', async ({ page }) => {
    await loginTestUser(page);
    
    // Default is dark
    await expect(page.locator('body')).toHaveClass(/theme-dark/);
    
    // Switch to light
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('body')).toHaveClass(/theme-light/);
    
    // Verify contrast and readability
    const bgColor = await page.locator('body').evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(255, 255, 255)');
  });

  test('theme preference persists', async ({ page }) => {
    await loginTestUser(page);
    
    // Set light theme
    await page.click('[data-testid="theme-toggle"]');
    
    // Reload page
    await page.reload();
    
    // Still light theme
    await expect(page.locator('body')).toHaveClass(/theme-light/);
  });

  test('custom theme colors', async ({ page }) => {
    await loginTestUser(page);
    
    // Open theme settings
    await page.click('[data-testid="settings"]');
    await page.click('[data-testid="themes"]');
    
    // Customize accent color
    await page.fill('[data-testid="accent-color"]', '#00ff00');
    await page.click('[data-testid="apply-theme"]');
    
    // Verify applied
    const accentElements = page.locator('.accent-color');
    await expect(accentElements.first()).toHaveCSS('color', 'rgb(0, 255, 0)');
  });
});
```

### Session Import/Export (`/tests/e2e/specs/session-portability.spec.js`)

```javascript
describe('Session Import/Export', () => {
  test('export session as markdown', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="session-webapp-dev"]');
    
    // Export session
    await page.click('[data-testid="session-menu"]');
    await page.click('[data-testid="export-markdown"]');
    
    // Verify download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/session-.*\.md/);
    
    // Verify content
    const content = await download.path().then(fs.readFileSync);
    expect(content).toContain('## Session: Web App Development');
    expect(content).toContain('**User**: Help me create');
    expect(content).toContain('**Assistant**: I\'ll help');
  });

  test('import session from file', async ({ page }) => {
    await loginTestUser(page);
    
    // Open import dialog
    await page.click('[data-testid="import-session"]');
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-fixtures/sample-session.jsonl');
    
    // Confirm import
    await page.click('[data-testid="import-button"]');
    
    // Verify imported
    await expect(page.locator('[data-testid="session-imported"]')).toBeVisible();
    await page.click('[data-testid="session-imported"]');
    await expect(page.locator('[data-testid="message"]')).toHaveCount(10);
  });
});
```

### Advanced Git Features (`/tests/e2e/specs/advanced-git.spec.js`)

```javascript
describe('Advanced Git Operations', () => {
  test('git stash workflow', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // Make changes
    await page.click('[data-testid="file-index.js"]');
    await page.fill('[data-testid="editor"]', '// Work in progress');
    
    // Stash changes
    await page.click('[data-testid="git-menu"]');
    await page.click('[data-testid="stash-changes"]');
    await page.fill('[data-testid="stash-message"]', 'WIP: new feature');
    await page.click('[data-testid="stash-button"]');
    
    // Verify working tree clean
    await expect(page.locator('[data-testid="git-status"]')).toHaveText('Working tree clean');
    
    // Apply stash
    await page.click('[data-testid="stash-list"]');
    await page.click('[data-testid="stash-0"]');
    await page.click('[data-testid="apply-stash"]');
    
    // Verify changes restored
    await expect(page.locator('[data-testid="editor"]')).toContainText('// Work in progress');
  });

  test('git tag creation and management', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // Create tag
    await page.click('[data-testid="git-menu"]');
    await page.click('[data-testid="create-tag"]');
    await page.fill('[data-testid="tag-name"]', 'v1.0.0');
    await page.fill('[data-testid="tag-message"]', 'First release');
    await page.click('[data-testid="create-tag-button"]');
    
    // Verify tag created
    await page.click('[data-testid="tags-list"]');
    await expect(page.locator('[data-testid="tag-v1.0.0"]')).toBeVisible();
    
    // Push tag
    await page.click('[data-testid="push-tags"]');
    await expect(page.locator('[data-testid="push-success"]')).toBeVisible();
  });

  test('cherry-pick commits', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // Switch to feature branch
    await page.click('[data-testid="branch-selector"]');
    await page.click('[data-testid="branch-feature"]');
    
    // Open commit history
    await page.click('[data-testid="git-log"]');
    
    // Cherry-pick from main
    await page.click('[data-testid="commit-abc123"]');
    await page.click('[data-testid="cherry-pick"]');
    
    // Confirm
    await page.click('[data-testid="confirm-cherry-pick"]');
    
    // Verify applied
    await expect(page.locator('[data-testid="success-message"]')).toHaveText('Cherry-pick successful');
  });
});
```

## Stress Testing

### Long Session Handling (`/tests/stress/long-sessions.test.js`)

```javascript
describe('Long Session Stress Tests', () => {
  test('handles 1000+ message session', async ({ page }) => {
    await loginTestUser(page);
    
    // Load stress test session
    await page.click('[data-testid="session-stress-test"]');
    
    // Measure initial load time
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="message-1000"]');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000); // Should load in <5s
    
    // Test scrolling performance
    await page.evaluate(() => {
      document.querySelector('[data-testid="messages-container"]').scrollTo(0, 999999);
    });
    
    // Verify smooth scrolling (no jank)
    const scrollFPS = await page.evaluate(() => {
      return new Promise(resolve => {
        let frames = 0;
        const startTime = performance.now();
        
        function countFrame() {
          frames++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve(frames);
          }
        }
        
        requestAnimationFrame(countFrame);
      });
    });
    
    expect(scrollFPS).toBeGreaterThan(30); // At least 30 FPS
  });

  test('memory usage remains stable', async ({ page }) => {
    await loginTestUser(page);
    
    // Get initial memory
    const initialMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
    
    // Load multiple large sessions
    for (let i = 0; i < 5; i++) {
      await page.click(`[data-testid="session-large-${i}"]`);
      await page.waitForSelector('[data-testid="messages-loaded"]');
    }
    
    // Check memory after loading
    const finalMemory = await page.evaluate(() => performance.memory.usedJSHeapSize);
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
  });
});
```

### Large File Operations (`/tests/stress/large-files.test.js`)

```javascript
describe('Large File Stress Tests', () => {
  test('handles 10MB file upload', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // Create 10MB file
    const largeContent = 'x'.repeat(10 * 1024 * 1024);
    const fileName = 'large-test.txt';
    
    // Upload file
    await page.click('[data-testid="upload-file"]');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from(largeContent)
    });
    
    // Measure upload time
    const uploadStart = Date.now();
    await page.waitForSelector('[data-testid="upload-complete"]');
    const uploadTime = Date.now() - uploadStart;
    
    expect(uploadTime).toBeLessThan(10000); // Less than 10s
    
    // Verify file can be opened
    await page.click(`[data-testid="file-${fileName}"]`);
    await expect(page.locator('[data-testid="editor"]')).toBeVisible();
  });

  test('handles directory with 1000 files', async ({ page }) => {
    await loginTestUser(page);
    
    // Create project with many files
    await page.click('[data-testid="create-project"]');
    await page.fill('[data-testid="project-name"]', 'many-files');
    await page.click('[data-testid="create-with-template"]');
    await page.selectOption('[data-testid="template"]', 'thousand-files');
    await page.click('[data-testid="create"]');
    
    // Open file explorer
    await page.click('[data-testid="file-tree"]');
    
    // Measure render time
    const renderStart = Date.now();
    await page.waitForSelector('[data-testid="file-count-1000"]');
    const renderTime = Date.now() - renderStart;
    
    expect(renderTime).toBeLessThan(2000); // Less than 2s
    
    // Test file search performance
    await page.keyboard.press('Control+P');
    await page.type('[data-testid="file-search"]', 'file-500');
    
    // Should find quickly
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible({ timeout: 500 });
  });
});
```

### Network Interruption (`/tests/stress/network-resilience.test.js`)

```javascript
describe('Network Resilience', () => {
  test('handles intermittent connection loss', async ({ page, context }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-webapp"]');
    
    // Start editing
    await page.click('[data-testid="file-app.js"]');
    await page.fill('[data-testid="editor"]', '// Edit 1');
    
    // Simulate network interruption
    await context.setOffline(true);
    await page.waitForTimeout(2000);
    await context.setOffline(false);
    
    // Continue editing
    await page.fill('[data-testid="editor"]', '// Edit 2');
    
    // Save should work
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // All edits preserved
    await page.reload();
    await expect(page.locator('[data-testid="editor"]')).toContainText('// Edit 2');
  });

  test('queues operations during offline', async ({ page, context }) => {
    await loginTestUser(page);
    
    // Go offline
    await context.setOffline(true);
    
    // Perform multiple operations
    await page.click('[data-testid="create-file"]');
    await page.fill('[data-testid="file-name"]', 'offline-file.js');
    await page.click('[data-testid="create"]');
    
    await page.fill('[data-testid="editor"]', 'console.log("offline")');
    await page.keyboard.press('Control+S');
    
    // Check queue indicator
    await expect(page.locator('[data-testid="queued-operations"]')).toHaveText('2');
    
    // Go online
    await context.setOffline(false);
    
    // Wait for sync
    await expect(page.locator('[data-testid="queued-operations"]')).toHaveText('0');
    
    // Verify operations completed
    await page.reload();
    await expect(page.locator('[data-testid="file-offline-file.js"]')).toBeVisible();
  });
});
```

## Notification System Tests (`/tests/e2e/specs/notifications.spec.js`)

```javascript
describe('Notification System', () => {
  test('shows notifications for important events', async ({ page }) => {
    await loginTestUser(page);
    
    // File saved notification
    await page.click('[data-testid="file-test.js"]');
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="notification"]')).toHaveText('File saved');
    
    // Auto-dismiss after 3 seconds
    await page.waitForTimeout(3500);
    await expect(page.locator('[data-testid="notification"]')).not.toBeVisible();
  });

  test('notification preferences', async ({ page }) => {
    await loginTestUser(page);
    
    // Open settings
    await page.click('[data-testid="settings"]');
    await page.click('[data-testid="notifications"]');
    
    // Disable file save notifications
    await page.uncheck('[data-testid="notify-file-save"]');
    await page.click('[data-testid="save-settings"]');
    
    // Test no notification
    await page.click('[data-testid="file-test.js"]');
    await page.keyboard.press('Control+S');
    await expect(page.locator('[data-testid="notification"]')).not.toBeVisible();
  });

  test('notification center shows history', async ({ page }) => {
    await loginTestUser(page);
    
    // Generate some notifications
    await page.click('[data-testid="file-new.js"]');
    await page.keyboard.press('Control+S');
    
    // Open notification center
    await page.click('[data-testid="notification-bell"]');
    await expect(page.locator('[data-testid="notification-center"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-item"]')).toContainText('File saved');
    
    // Clear all
    await page.click('[data-testid="clear-all-notifications"]');
    await expect(page.locator('[data-testid="no-notifications"]')).toBeVisible();
  });
});
```

## Command Palette Tests (`/tests/e2e/specs/command-palette.spec.js`)

```javascript
describe('Command Palette', () => {
  test('execute commands via palette', async ({ page }) => {
    await loginTestUser(page);
    
    // Open command palette
    await page.keyboard.press('Control+Shift+P');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Search for command
    await page.type('[data-testid="command-search"]', 'new file');
    await expect(page.locator('[data-testid="command-item"]').first()).toContainText('Create New File');
    
    // Execute command
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="new-file-dialog"]')).toBeVisible();
  });

  test('recent commands', async ({ page }) => {
    await loginTestUser(page);
    
    // Use a command
    await page.keyboard.press('Control+Shift+P');
    await page.type('[data-testid="command-search"]', 'git commit');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // Close commit dialog
    
    // Open palette again
    await page.keyboard.press('Control+Shift+P');
    
    // Recent command should be at top
    await expect(page.locator('[data-testid="recent-commands"] [data-testid="command-item"]').first())
      .toContainText('Git: Commit');
  });

  test('command shortcuts displayed', async ({ page }) => {
    await loginTestUser(page);
    
    await page.keyboard.press('Control+Shift+P');
    await page.type('[data-testid="command-search"]', 'save');
    
    // Should show keyboard shortcut
    await expect(page.locator('[data-testid="command-item"]').first())
      .toContainText('Ctrl+S');
  });
});
```

---

## Missing Application Features Tests

These tests are for features identified in the PRD that need to be implemented before testing.

### Favorites/Starred Projects (`/tests/unit/client/favorites.test.js`)

**Unit Tests:**
```javascript
describe('Favorites Manager', () => {
  test('addToFavorites adds project to favorites list', () => {
    // Input: project ID 'project-123'
    // Output: project appears in favorites array
    // Storage: Updated in localStorage
  });

  test('removeFromFavorites removes project from list', () => {
    // Input: favorited project ID 'project-123'
    // Output: project removed from favorites array
  });

  test('isFavorite returns true for favorited projects', () => {
    // Input: favorited project ID
    // Output: true
  });

  test('getFavorites returns array of favorited projects', () => {
    // Input: None
    // Output: Array of project objects with favorite metadata
  });

  test('favorites persist across browser sessions', () => {
    // Input: Add favorites, reload page
    // Output: Favorites still present
  });

  test('favorites sync across multiple windows', () => {
    // Input: Add favorite in one window
    // Output: Favorite appears in other windows
  });
});
```

**E2E Tests:**
```javascript
describe('Favorites E2E', () => {
  test('star and unstar project', async ({ page }) => {
    await loginTestUser(page);
    
    // Star a project
    await page.hover('[data-testid="project-nodejs"]');
    await page.click('[data-testid="star-project-nodejs"]');
    await expect(page.locator('[data-testid="star-project-nodejs"]'))
      .toHaveClass(/starred/);
    
    // Unstar project
    await page.click('[data-testid="star-project-nodejs"]');
    await expect(page.locator('[data-testid="star-project-nodejs"]'))
      .not.toHaveClass(/starred/);
  });

  test('filter projects by starred status', async ({ page }) => {
    await loginTestUser(page);
    
    // Star one project
    await page.hover('[data-testid="project-nodejs"]');
    await page.click('[data-testid="star-project-nodejs"]');
    
    // Filter by starred
    await page.click('[data-testid="filter-starred"]');
    
    // Only starred project should be visible
    await expect(page.locator('[data-testid="project-nodejs"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-python"]')).toBeHidden();
  });

  test('starred projects appear at top of list', async ({ page }) => {
    await loginTestUser(page);
    
    // Star the last project in list
    await page.hover('[data-testid="project-mixed"]');
    await page.click('[data-testid="star-project-mixed"]');
    
    // Starred project should be first
    await expect(page.locator('[data-testid="project-list"] [data-testid^="project-"]').first())
      .toHaveAttribute('data-testid', 'project-mixed');
  });
});
```

### Session Management (`/tests/unit/client/sessions.test.js`)

**Unit Tests:**
```javascript
describe('Session Manager', () => {
  test('resumeSession loads previous conversation state', async () => {
    // Input: session ID with existing messages
    // Output: Messages loaded, UI state restored
  });

  test('renameSession updates session name', async () => {
    // Input: session ID and new name
    // Output: Session name updated in storage and UI
  });

  test('searchSessions finds sessions by name and content', async () => {
    // Input: search term 'authentication'
    // Output: Sessions containing that term
  });

  test('exportSession generates markdown format', async () => {
    // Input: session ID
    // Output: Markdown string with conversation
  });

  test('importSession creates session from markdown', async () => {
    // Input: Markdown conversation data
    // Output: New session created with messages
  });

  test('deleteSession removes session and files', async () => {
    // Input: session ID
    // Output: Session removed from storage and filesystem
  });

  test('getSessionHistory returns sorted sessions', async () => {
    // Input: None
    // Output: Array of sessions sorted by last modified
  });
});
```

**E2E Tests:**
```javascript
describe('Session Management E2E', () => {
  test('resume previous session', async ({ page }) => {
    await loginTestUser(page);
    
    // Create new session
    await page.click('[data-testid="new-session"]');
    await page.fill('[data-testid="session-name"]', 'Test Session');
    await page.click('[data-testid="create-session"]');
    
    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Hello test');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="assistant-message"]');
    
    // Go back to dashboard
    await page.click('[data-testid="back-to-dashboard"]');
    
    // Resume session
    await page.click('[data-testid="session-Test Session"]');
    
    // Previous message should be visible
    await expect(page.locator('[data-testid="user-message"]'))
      .toContainText('Hello test');
  });

  test('rename session', async ({ page }) => {
    await loginTestUser(page);
    
    // Right-click on session
    await page.click('[data-testid="session-existing"] [data-testid="session-menu"]');
    await page.click('[data-testid="rename-session"]');
    
    // Enter new name
    await page.fill('[data-testid="session-name-input"]', 'Renamed Session');
    await page.keyboard.press('Enter');
    
    // Verify name changed
    await expect(page.locator('[data-testid="session-existing"]'))
      .toContainText('Renamed Session');
  });

  test('search sessions', async ({ page }) => {
    await loginTestUser(page);
    
    // Search for sessions
    await page.fill('[data-testid="session-search"]', 'auth');
    
    // Only matching sessions should be visible
    await expect(page.locator('[data-testid="session-auth-test"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-other"]')).toBeHidden();
  });

  test('export session as markdown', async ({ page }) => {
    await loginTestUser(page);
    
    // Open session menu
    await page.click('[data-testid="session-existing"] [data-testid="session-menu"]');
    await page.click('[data-testid="export-session"]');
    
    // Download should start
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-markdown"]');
    const download = await downloadPromise;
    
    // Verify filename
    expect(download.suggestedFilename()).toMatch(/session-.*\.md/);
  });
});
```

### Advanced Git Features (`/tests/unit/client/git-advanced.test.js`)

**Unit Tests:**
```javascript
describe('Advanced Git Operations', () => {
  test('createBranch creates new branch from current', async () => {
    // Input: branch name 'feature/test'
    // Output: New branch created and checked out
  });

  test('switchBranch changes to different branch', async () => {
    // Input: existing branch name 'develop'
    // Output: Working directory updated to branch state
  });

  test('mergeBranch combines branches', async () => {
    // Input: source branch 'feature/test'
    // Output: Changes merged into current branch
  });

  test('mergeBranch handles conflicts', async () => {
    // Input: branch with conflicting changes
    // Output: Conflict markers in files, merge state set
  });

  test('resolveConflict marks conflicts as resolved', async () => {
    // Input: file with resolved conflicts
    // Output: File staged, conflict state cleared
  });

  test('stashChanges saves working directory state', async () => {
    // Input: Modified files
    // Output: Changes saved to stash, working directory clean
  });

  test('applyStash restores stashed changes', async () => {
    // Input: Stash index
    // Output: Changes restored to working directory
  });

  test('createTag creates annotated tag', async () => {
    // Input: tag name 'v1.0.0' and message
    // Output: Tag created at current commit
  });

  test('cherryPick applies commit to current branch', async () => {
    // Input: commit SHA from different branch
    // Output: Commit changes applied to current branch
  });
});
```

**E2E Tests:**
```javascript
describe('Advanced Git E2E', () => {
  test('create and switch branches', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Create new branch
    await page.click('[data-testid="git-branch-menu"]');
    await page.click('[data-testid="create-branch"]');
    await page.fill('[data-testid="branch-name"]', 'feature/test');
    await page.click('[data-testid="create-branch-confirm"]');
    
    // Verify branch created and active
    await expect(page.locator('[data-testid="current-branch"]'))
      .toContainText('feature/test');
  });

  test('merge branches with conflicts', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-conflict"]');
    
    // Switch to conflict branch
    await page.click('[data-testid="git-branch-menu"]');
    await page.click('[data-testid="switch-branch-conflict"]');
    
    // Try to merge main
    await page.click('[data-testid="git-branch-menu"]');
    await page.click('[data-testid="merge-branch"]');
    await page.selectOption('[data-testid="merge-source"]', 'main');
    await page.click('[data-testid="merge-confirm"]');
    
    // Should show conflict resolution UI
    await expect(page.locator('[data-testid="conflict-files"]')).toBeVisible();
    
    // Resolve conflict
    await page.click('[data-testid="file-conflict.txt"]');
    await page.click('[data-testid="accept-current"]');
    await page.click('[data-testid="resolve-conflict"]');
    
    // Complete merge
    await page.click('[data-testid="complete-merge"]');
    await expect(page.locator('[data-testid="git-status"]'))
      .toContainText('clean');
  });

  test('stash and apply changes', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Make changes
    await page.click('[data-testid="file-index.js"]');
    await page.fill('[data-testid="editor"]', 'console.log("test");');
    
    // Stash changes
    await page.click('[data-testid="git-stash-menu"]');
    await page.click('[data-testid="stash-changes"]');
    await page.fill('[data-testid="stash-message"]', 'WIP: test changes');
    await page.click('[data-testid="stash-confirm"]');
    
    // Editor should be clean
    await expect(page.locator('[data-testid="editor"]'))
      .not.toContainText('console.log("test");');
    
    // Apply stash
    await page.click('[data-testid="git-stash-menu"]');
    await page.click('[data-testid="stash-list"]');
    await page.click('[data-testid="stash-0"] [data-testid="apply"]');
    
    // Changes should be restored
    await expect(page.locator('[data-testid="editor"]'))
      .toContainText('console.log("test");');
  });
});
```

### Search Functionality (`/tests/unit/client/search.test.js`)

**Unit Tests:**
```javascript
describe('Search Manager', () => {
  test('globalSearch finds matches across all projects', async () => {
    // Input: search term 'function'
    // Output: Results from all projects with matches
  });

  test('sessionSearch finds matches in conversation history', async () => {
    // Input: search term in session messages
    // Output: Matching messages with context
  });

  test('fileContentSearch finds matches in file contents', async () => {
    // Input: code snippet search
    // Output: Files and line numbers with matches
  });

  test('search with filters applies project/file type filters', async () => {
    // Input: search term with .js file filter
    // Output: Only JavaScript files in results
  });

  test('searchHistory tracks previous searches', async () => {
    // Input: Multiple search terms
    // Output: Previous searches available in history
  });

  test('fuzzySearch handles typos and partial matches', async () => {
    // Input: 'functoin' (typo)
    // Output: Matches for 'function'
  });
});
```

**E2E Tests:**
```javascript
describe('Search Functionality E2E', () => {
  test('global search across projects', async ({ page }) => {
    await loginTestUser(page);
    
    // Open global search
    await page.keyboard.press('Control+Shift+F');
    await page.fill('[data-testid="global-search"]', 'console.log');
    await page.keyboard.press('Enter');
    
    // Should show results from multiple projects
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="result-count"]'))
      .toContainText(/\d+ results/);
  });

  test('search within session', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="session-existing"]');
    
    // Open session search
    await page.keyboard.press('Control+F');
    await page.fill('[data-testid="session-search"]', 'authentication');
    
    // Should highlight matches in conversation
    await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
  });

  test('file content search with filters', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Search in files
    await page.keyboard.press('Control+Shift+F');
    await page.fill('[data-testid="file-search"]', 'exports');
    
    // Apply file type filter
    await page.click('[data-testid="search-filters"]');
    await page.check('[data-testid="filter-js"]');
    await page.click('[data-testid="apply-filters"]');
    
    // Results should only show .js files
    await expect(page.locator('[data-testid="search-results"] .result-file'))
      .toContainText('.js');
  });
});
```

### WebSocket & Real-time Features (`/tests/unit/client/websocket.test.js`)

**Unit Tests:**
```javascript
describe('WebSocket Manager', () => {
  test('connect establishes WebSocket connection', async () => {
    // Input: server URL and auth token
    // Output: WebSocket connection established
  });

  test('reconnect handles connection drops', async () => {
    // Input: WebSocket connection lost
    // Output: Automatic reconnection with exponential backoff
  });

  test('sendMessage queues messages during disconnect', async () => {
    // Input: Messages sent while disconnected
    // Output: Messages queued and sent on reconnect
  });

  test('heartbeat maintains connection', async () => {
    // Input: Idle connection
    // Output: Periodic ping/pong messages sent
  });

  test('messageSync synchronizes conversation state', async () => {
    // Input: New message from server
    // Output: UI updated with new message
  });

  test('connectionState tracks connection status', async () => {
    // Input: Connection state changes
    // Output: State events emitted (connecting, connected, disconnected)
  });
});
```

**E2E Tests:**
```javascript
describe('WebSocket Real-time E2E', () => {
  test('real-time message synchronization', async ({ page, context }) => {
    // Login in two windows
    const page2 = await context.newPage();
    await loginTestUser(page);
    await loginTestUser(page2);
    
    // Both join same session
    await page.click('[data-testid="session-shared"]');
    await page2.click('[data-testid="session-shared"]');
    
    // Send message from first window
    await page.fill('[data-testid="chat-input"]', 'Real-time test');
    await page.keyboard.press('Enter');
    
    // Should appear in second window
    await expect(page2.locator('[data-testid="user-message"]'))
      .toContainText('Real-time test');
  });

  test('connection status indicator', async ({ page }) => {
    await loginTestUser(page);
    
    // Should show connected status
    await expect(page.locator('[data-testid="connection-status"]'))
      .toHaveClass(/connected/);
    
    // Simulate disconnect (could mock network conditions)
    await page.evaluate(() => {
      window.wsManager.simulateDisconnect();
    });
    
    // Should show disconnected status
    await expect(page.locator('[data-testid="connection-status"]'))
      .toHaveClass(/disconnected/);
    
    // Should reconnect automatically
    await expect(page.locator('[data-testid="connection-status"]'))
      .toHaveClass(/connected/, { timeout: 10000 });
  });

  test('message queue during disconnect', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="session-existing"]');
    
    // Simulate disconnect
    await page.evaluate(() => {
      window.wsManager.simulateDisconnect();
    });
    
    // Send message while disconnected
    await page.fill('[data-testid="chat-input"]', 'Queued message');
    await page.keyboard.press('Enter');
    
    // Should show as pending
    await expect(page.locator('[data-testid="message-status"]'))
      .toContainText('Sending...');
    
    // Reconnect
    await page.evaluate(() => {
      window.wsManager.simulateReconnect();
    });
    
    // Message should be sent
    await expect(page.locator('[data-testid="message-status"]'))
      .toContainText('Sent');
  });
});
```

### Keyboard Shortcuts & Command Palette (`/tests/e2e/specs/keyboard-shortcuts.spec.js`)

**E2E Tests:**
```javascript
describe('Keyboard Shortcuts', () => {
  test('Ctrl+K opens command palette', async ({ page }) => {
    await loginTestUser(page);
    
    await page.keyboard.press('Control+K');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
  });

  test('Ctrl+N creates new session', async ({ page }) => {
    await loginTestUser(page);
    
    await page.keyboard.press('Control+N');
    await expect(page.locator('[data-testid="new-session-dialog"]')).toBeVisible();
  });

  test('Ctrl+Shift+F opens global search', async ({ page }) => {
    await loginTestUser(page);
    
    await page.keyboard.press('Control+Shift+F');
    await expect(page.locator('[data-testid="global-search"]')).toBeVisible();
  });

  test('Ctrl+1-9 switches between recent sessions', async ({ page }) => {
    await loginTestUser(page);
    
    // Ensure multiple sessions exist
    await page.click('[data-testid="session-1"]');
    await page.click('[data-testid="back-to-dashboard"]');
    
    // Switch with keyboard
    await page.keyboard.press('Control+1');
    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
  });

  test('Escape key closes modals and dialogs', async ({ page }) => {
    await loginTestUser(page);
    
    // Open command palette
    await page.keyboard.press('Control+K');
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="command-palette"]')).toBeHidden();
  });

  test('Tab navigation through focusable elements', async ({ page }) => {
    await loginTestUser(page);
    
    // Start from search input
    await page.focus('[data-testid="project-search"]');
    
    // Tab to next element
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="new-project-button"]')).toBeFocused();
    
    // Continue tabbing through interactive elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="project-nodejs"]')).toBeFocused();
  });
});
```

### Theme Management (`/tests/unit/client/theme.test.js`)

**Unit Tests:**
```javascript
describe('Theme Manager', () => {
  test('setTheme changes active theme', () => {
    // Input: theme name 'dark'
    // Output: Theme applied to document, CSS variables updated
  });

  test('getTheme returns current theme', () => {
    // Input: None
    // Output: Current theme name
  });

  test('theme persistence across sessions', () => {
    // Input: Set theme, reload page
    // Output: Theme restored from localStorage
  });

  test('detectSystemTheme returns OS preference', () => {
    // Input: Mock prefers-color-scheme media query
    // Output: 'light' or 'dark' based on system
  });

  test('autoTheme follows system changes', () => {
    // Input: System theme change event
    // Output: App theme updated automatically
  });

  test('customTheme applies user colors', () => {
    // Input: Custom theme object with colors
    // Output: CSS custom properties updated
  });
});
```

**E2E Tests:**
```javascript
describe('Theme Management E2E', () => {
  test('switch between light and dark themes', async ({ page }) => {
    await loginTestUser(page);
    
    // Default should be light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    
    // Switch to dark
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    
    // Switch back to light
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('theme persists across sessions', async ({ page, context }) => {
    await loginTestUser(page);
    
    // Switch to dark theme
    await page.click('[data-testid="theme-toggle"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    
    // Open new tab
    const newPage = await context.newPage();
    await newPage.goto('/');
    await loginTestUser(newPage);
    
    // Should still be dark theme
    await expect(newPage.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('auto theme follows system preference', async ({ page }) => {
    await loginTestUser(page);
    
    // Enable auto theme
    await page.click('[data-testid="settings"]');
    await page.click('[data-testid="theme-settings"]');
    await page.check('[data-testid="auto-theme"]');
    
    // Mock system dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // Should switch to dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    
    // Mock system light mode
    await page.emulateMedia({ colorScheme: 'light' });
    
    // Should switch to light
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
```

### Notification System (`/tests/unit/client/notifications.test.js`)

**Unit Tests:**
```javascript
describe('Notification Manager', () => {
  test('showNotification displays notification', () => {
    // Input: { type: 'success', message: 'Saved', timeout: 3000 }
    // Output: Notification appears in UI
  });

  test('dismissNotification removes notification', () => {
    // Input: notification ID
    // Output: Notification removed from queue and UI
  });

  test('autoTimeout removes notification after delay', async () => {
    // Input: notification with 1000ms timeout
    // Output: Notification auto-removed after 1 second
  });

  test('notification queue handles multiple notifications', () => {
    // Input: Multiple overlapping notifications
    // Output: Notifications stacked properly, oldest dismissed first
  });

  test('persistent notifications remain until dismissed', () => {
    // Input: notification with persistent: true
    // Output: Notification stays until manually dismissed
  });

  test('notification actions trigger callbacks', () => {
    // Input: notification with action buttons
    // Output: Callback functions executed when actions clicked
  });
});
```

**E2E Tests:**
```javascript
describe('Notifications E2E', () => {
  test('success notification after save', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Make changes and save
    await page.click('[data-testid="file-index.js"]');
    await page.fill('[data-testid="editor"]', 'console.log("test");');
    await page.keyboard.press('Control+S');
    
    // Should show success notification
    await expect(page.locator('[data-testid="notification-success"]'))
      .toContainText('File saved');
  });

  test('error notification on network failure', async ({ page }) => {
    await loginTestUser(page);
    
    // Simulate network error
    await page.route('**/api/**', route => route.abort());
    
    // Try action that requires network
    await page.click('[data-testid="sync-sessions"]');
    
    // Should show error notification
    await expect(page.locator('[data-testid="notification-error"]'))
      .toContainText('Network error');
  });

  test('notification with actions', async ({ page }) => {
    await loginTestUser(page);
    
    // Trigger notification with actions (e.g., update available)
    await page.evaluate(() => {
      window.notificationManager.show({
        type: 'info',
        message: 'Update available',
        actions: [
          { label: 'Update Now', action: 'update' },
          { label: 'Later', action: 'dismiss' }
        ]
      });
    });
    
    // Should show notification with action buttons
    await expect(page.locator('[data-testid="notification-action-update"]'))
      .toBeVisible();
    await expect(page.locator('[data-testid="notification-action-dismiss"]'))
      .toBeVisible();
    
    // Click action
    await page.click('[data-testid="notification-action-update"]');
    
    // Notification should be dismissed
    await expect(page.locator('[data-testid="notification"]'))
      .toBeHidden();
  });

  test('notification auto-dismiss timeout', async ({ page }) => {
    await loginTestUser(page);
    
    // Show notification with short timeout
    await page.evaluate(() => {
      window.notificationManager.show({
        type: 'info',
        message: 'Quick message',
        timeout: 1000
      });
    });
    
    // Should be visible initially
    await expect(page.locator('[data-testid="notification"]'))
      .toContainText('Quick message');
    
    // Should auto-dismiss after timeout
    await expect(page.locator('[data-testid="notification"]'))
      .toBeHidden({ timeout: 2000 });
  });
});
```

### Performance Features (`/tests/unit/client/performance.test.js`)

**Unit Tests:**
```javascript
describe('Performance Manager', () => {
  test('lazyLoadSessions loads sessions on demand', async () => {
    // Input: Request for session page 2
    // Output: Only sessions 21-40 loaded
  });

  test('virtualScrolling renders only visible items', () => {
    // Input: Session list with 1000 items, viewport showing 10
    // Output: Only 10-15 DOM elements created
  });

  test('streamingResponse handles large responses', async () => {
    // Input: Large assistant response (>10KB)
    // Output: Response rendered incrementally
  });

  test('fileChunking handles large file uploads', async () => {
    // Input: 50MB file
    // Output: File split into chunks, uploaded progressively
  });

  test('memoryCleanup clears unused session data', () => {
    // Input: Switch between sessions
    // Output: Previous session data garbage collected
  });

  test('cacheStrategy caches frequently accessed data', async () => {
    // Input: Repeated requests for same data
    // Output: Subsequent requests served from cache
  });
});
```

**E2E Tests:**
```javascript
describe('Performance Features E2E', () => {
  test('large session loads incrementally', async ({ page }) => {
    await loginTestUser(page);
    
    // Open session with 1000+ messages
    await page.click('[data-testid="session-stress-test"]');
    
    // Should load quickly with virtual scrolling
    await expect(page.locator('[data-testid="chat-container"]'))
      .toBeVisible({ timeout: 5000 });
    
    // Only first few messages should be in DOM initially
    const messageCount = await page.locator('[data-testid="message"]').count();
    expect(messageCount).toBeLessThan(50); // Virtual scrolling active
  });

  test('large file upload with progress', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Upload large file (simulated)
    const fileInput = page.locator('[data-testid="file-upload"]');
    await fileInput.setInputFiles({
      name: 'large-file.zip',
      mimeType: 'application/zip',
      buffer: Buffer.alloc(10 * 1024 * 1024) // 10MB
    });
    
    // Should show progress bar
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    
    // Progress should update
    await expect(page.locator('[data-testid="progress-percent"]'))
      .toContainText('100%', { timeout: 30000 });
  });

  test('streaming response renders incrementally', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="session-existing"]');
    
    // Send message that triggers long response
    await page.fill('[data-testid="chat-input"]', 'Generate a long explanation');
    await page.keyboard.press('Enter');
    
    // Should see typing indicator initially
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
    
    // Response should appear incrementally
    await expect(page.locator('[data-testid="assistant-message"]'))
      .toBeVisible();
    
    // Should show streaming animation
    await expect(page.locator('[data-testid="streaming-cursor"]')).toBeVisible();
  });
});
```

### Error Recovery (`/tests/unit/client/error-recovery.test.js`)

**Unit Tests:**
```javascript
describe('Error Recovery Manager', () => {
  test('autoReconnect recovers from network failures', async () => {
    // Input: Network connection lost
    // Output: Automatic reconnection attempts with backoff
  });

  test('sessionRecovery restores state after crash', async () => {
    // Input: App crash during session
    // Output: Session state restored on restart
  });

  test('partialMessageRecovery saves incomplete responses', async () => {
    // Input: Connection lost during streaming response
    // Output: Partial response saved and recoverable
  });

  test('offlineMode queues actions for later sync', async () => {
    // Input: Actions performed while offline
    // Output: Actions queued and executed when online
  });

  test('errorBoundary catches and displays errors gracefully', () => {
    // Input: Component error
    // Output: Error boundary shows fallback UI
  });

  test('retryMechanism retries failed operations', async () => {
    // Input: Failed API request
    // Output: Request retried with exponential backoff
  });
});
```

**E2E Tests:**
```javascript
describe('Error Recovery E2E', () => {
  test('network reconnection during session', async ({ page }) => {
    await loginTestUser(page);
    await page.click('[data-testid="session-existing"]');
    
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    // Try to send message
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.keyboard.press('Enter');
    
    // Should show connection error
    await expect(page.locator('[data-testid="connection-error"]'))
      .toContainText('Connection lost');
    
    // Restore network
    await page.unroute('**/api/**');
    
    // Should auto-reconnect
    await expect(page.locator('[data-testid="connection-restored"]'))
      .toBeVisible({ timeout: 10000 });
    
    // Queued message should be sent
    await expect(page.locator('[data-testid="user-message"]'))
      .toContainText('Test message');
  });

  test('session recovery after page refresh', async ({ page }) => {
    await loginTestUser(page);
    
    // Start new session
    await page.click('[data-testid="new-session"]');
    await page.fill('[data-testid="session-name"]', 'Recovery Test');
    await page.click('[data-testid="create-session"]');
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Before refresh');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="assistant-message"]');
    
    // Refresh page
    await page.reload();
    
    // Should prompt for session recovery
    await expect(page.locator('[data-testid="recovery-prompt"]'))
      .toContainText('Recover previous session?');
    
    // Accept recovery
    await page.click('[data-testid="recover-session"]');
    
    // Previous message should be restored
    await expect(page.locator('[data-testid="user-message"]'))
      .toContainText('Before refresh');
  });

  test('error boundary with component crash', async ({ page }) => {
    await loginTestUser(page);
    
    // Trigger component error (simulated)
    await page.evaluate(() => {
      window.triggerTestError = true;
    });
    
    // Navigate to trigger error
    await page.click('[data-testid="project-nodejs"]');
    
    // Should show error boundary
    await expect(page.locator('[data-testid="error-boundary"]'))
      .toContainText('Something went wrong');
    
    // Should have retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Reset error state
    await page.evaluate(() => {
      window.triggerTestError = false;
    });
    
    // Retry should work
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="project-view"]')).toBeVisible();
  });
});
```

## Notes for Implementation

1. **Test IDs**: All UI elements need `data-testid` attributes
2. **Async Operations**: Use proper waiting strategies, not arbitrary delays  
3. **Cleanup**: Each test must clean up its data
4. **Flakiness**: Retry flaky tests, but investigate root cause
5. **Performance**: Tests should complete in <10 minutes total
6. **Mocking**: Mock external services (Claude API, GitHub, etc.)
7. **Fixtures**: Reuse test data fixtures where possible
8. **Reporting**: Generate detailed reports with screenshots on failure
9. **Accessibility**: Include tests for keyboard navigation and screen readers
10. **Error States**: Test error boundaries and fallback UI
11. **Progressive Enhancement**: Test functionality with JavaScript disabled where applicable
12. **Browser Compatibility**: Run tests in Chrome, Firefox, Safari, and Edge