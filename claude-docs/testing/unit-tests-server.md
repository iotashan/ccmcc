# Server Unit Tests

**Status: 🔄 Ready for Implementation**  
**Total Tests: ~60 test specifications**  
**Completion: 0/60 tests implemented**

## Test Implementation Checklist

### Authentication Module (`/tests/unit/server/auth.test.js`)
- [ ] JWT Token Management (7 tests) - `auth.test.js:JWT-Token-Management`
- [ ] User Authentication (5 tests) - `auth.test.js:User-Authentication` 
- [ ] Token Refresh (3 tests) - `auth.test.js:Token-Refresh`
- [ ] Permissions & Authorization (5 tests) - `auth.test.js:Permissions-Authorization`

### API Endpoints (`/tests/unit/server/api.test.js`)
- [ ] Health Check (3 tests) - `api.test.js:Health-Check`
- [ ] User Management (6 tests) - `api.test.js:User-Management`
- [ ] Project Management (7 tests) - `api.test.js:Project-Management`
- [ ] Session Management (6 tests) - `api.test.js:Session-Management`
- [ ] File Operations (7 tests) - `api.test.js:File-Operations`

### WebSocket Handler (`/tests/unit/server/websocket.test.js`)
- [ ] Connection Management (6 tests) - `websocket.test.js:Connection-Management`
- [ ] Message Handling (6 tests) - `websocket.test.js:Message-Handling`
- [ ] Real-time Sync (4 tests) - `websocket.test.js:Real-time-Sync`

### Database Operations (`/tests/unit/server/database.test.js`)
- [ ] Database Operations (4 tests) - `database.test.js:Database-Operations`

**Progress: 0/13 test groups completed (0/60 individual tests)**

This document contains detailed specifications for all server-side unit tests in the Claude Code UI Docker test environment.

## Overview

Server unit tests focus on testing individual modules and functions in isolation:
- **Authentication Module** - JWT handling, user auth, permissions
- **API Endpoints** - All REST routes with comprehensive error handling
- **WebSocket Handler** - Connection management, message handling, real-time sync
- **Database Operations** - CRUD operations, transactions, migrations

---

## Authentication Module (`/tests/unit/server/auth.test.js`)

### JWT Token Management

- [ ] **Test Group**: JWT Token Management (7 tests)

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

### User Authentication

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

### Token Refresh

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

### Permissions & Authorization

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

---

## API Endpoints (`/tests/unit/server/api.test.js`)

### Health Check

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

### User Management

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

### Project Management

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

### Session Management

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

### File Operations

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

---

## WebSocket Handler (`/tests/unit/server/websocket.test.js`)

### Connection Management

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

### Message Handling

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

### Real-time Sync

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

---

## Database Operations (`/tests/unit/server/database.test.js`)

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

---

## Test Execution Notes

### Mocking Requirements
- Mock Claude API responses using `/test-data/mock-responses.json`
- Mock database with SQLite in-memory for isolation
- Mock file system operations for path validation tests
- Mock JWT signing for token expiry tests

### Test Data Setup
- Create test users with known credentials
- Set up test projects with realistic structures
- Prepare session data with various message types
- Generate JWT keys for signing/verification tests

### Performance Assertions  
- API responses should complete in <200ms
- Database queries should execute in <50ms
- WebSocket message handling in <10ms
- File operations should handle 10MB files

### Security Testing
- All endpoints must validate authentication
- Path traversal attacks should be blocked
- SQL injection attempts should fail
- Rate limiting should trigger at defined thresholds

**Total Server Unit Tests**: ~60 test specifications covering authentication, API endpoints, WebSocket handling, and database operations.