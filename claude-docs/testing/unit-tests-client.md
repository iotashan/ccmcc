# Client Unit Tests

**Status: 🔄 Ready for Implementation**  
**Total Tests: ~40 test specifications**  
**Completion: 0/40 tests implemented**

## Test Implementation Checklist

### Git Operations (`/tests/unit/client/git-handler.test.js`)
- [ ] Basic Git Operations (12 tests) - `git-handler.test.js:Basic-Git-Operations`
- [ ] Git Error Handling (4 tests) - `git-handler.test.js:Git-Error-Handling`

### File Handler (`/tests/unit/client/file-handler.test.js`)
- [ ] File Operations (9 tests) - `file-handler.test.js:File-Operations`
- [ ] File Security & Validation (4 tests) - `file-handler.test.js:File-Security`
- [ ] File Watching (4 tests) - `file-handler.test.js:File-Watching`

### Connection Manager (`/tests/unit/client/connection.test.js`)
- [ ] Connection Management (5 tests) - `connection.test.js:Connection-Management`
- [ ] Reconnection Logic (4 tests) - `connection.test.js:Reconnection-Logic`
- [ ] Message Queue (4 tests) - `connection.test.js:Message-Queue`

### Session Handler (`/tests/unit/client/session-handler.test.js`)
- [ ] Session Management (5 tests) - `session-handler.test.js:Session-Management`
- [ ] Session Persistence (4 tests) - `session-handler.test.js:Session-Persistence`
- [ ] Session Search (4 tests) - `session-handler.test.js:Session-Search`

### Client State Management (`/tests/unit/client/state-manager.test.js`)
- [ ] Application State (4 tests) - `state-manager.test.js:Application-State`
- [ ] State Persistence (4 tests) - `state-manager.test.js:State-Persistence`

### Client Error Handling (`/tests/unit/client/error-handler.test.js`)
- [ ] Error Capture and Reporting (4 tests) - `error-handler.test.js:Error-Handling`

**Progress: 0/14 test groups completed (0/40 individual tests)**

This document contains detailed specifications for all client-side unit tests in the Claude Code UI Docker test environment.

## Overview

Client unit tests focus on testing individual modules and functions that run in the browser/client environment:
- **Git Operations** - Git command handling, status, commits, branches
- **File Handler** - File system operations, watching, CRUD
- **Connection Manager** - WebSocket connections, reconnection, state management
- **Session Handler** - Session loading, saving, search, export

---

## Git Operations (`/tests/unit/client/git-handler.test.js`)

### Basic Git Operations

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

### Git Error Handling

```javascript
describe('Git Error Handling', () => {
  test('handles repository not found', async () => {
    // Setup: Non-git directory
    // Output: Error: Not a git repository
  });

  test('handles network errors during push', async () => {
    // Setup: Network disconnected
    // Output: Error: Could not connect to remote
  });

  test('handles merge conflicts gracefully', async () => {
    // Setup: Conflicting files
    // Output: Conflict details, suggested resolution
  });

  test('handles uncommitted changes on checkout', async () => {
    // Setup: Modified files, attempt checkout
    // Output: Error: Uncommitted changes would be overwritten
  });
});
```

---

## File Handler (`/tests/unit/client/file-handler.test.js`)

### File Operations

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

### File Security & Validation

```javascript
describe('File Security', () => {
  test('blocks path traversal attempts', async () => {
    // Input: '../../../etc/passwd'
    // Output: Error: Invalid path
  });

  test('validates file size limits', async () => {
    // Input: 100MB file
    // Output: Error: File too large
  });

  test('checks file permissions', async () => {
    // Input: Read-only file for write
    // Output: Error: Permission denied
  });

  test('sanitizes file names', async () => {
    // Input: 'file<script>alert()</script>.js'
    // Output: 'file_alert_.js'
  });
});
```

### File Watching

```javascript
describe('File Watching', () => {
  test('starts file watcher for directory', async () => {
    // Input: Watch '/src'
    // Output: Watcher started, events registered
  });

  test('stops file watcher correctly', async () => {
    // Input: Stop watching '/src'
    // Output: Watcher stopped, cleanup completed
  });

  test('throttles rapid file change events', async () => {
    // Input: 100 file changes in 1 second
    // Output: Events throttled to max 10/second
  });

  test('handles watcher errors gracefully', async () => {
    // Setup: Watch non-existent directory
    // Output: Error logged, watcher not started
  });
});
```

---

## Connection Manager (`/tests/unit/client/connection.test.js`)

### Connection Management

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

### Reconnection Logic

```javascript
describe('Reconnection Logic', () => {
  test('implements exponential backoff', async () => {
    // Setup: Multiple connection failures
    // Output: Delay increases: 1s, 2s, 4s, 8s, 16s
  });

  test('limits maximum reconnect attempts', async () => {
    // Setup: Server permanently down
    // Output: Stops after 10 attempts, emits 'failed'
  });

  test('resets backoff on successful connect', async () => {
    // Setup: Failed connections then success
    // Output: Next failure starts at 1s delay
  });

  test('handles server-initiated disconnects', async () => {
    // Input: Server sends close frame
    // Output: Reconnect attempt with fresh token
  });
});
```

### Message Queue

```javascript
describe('Message Queue', () => {
  test('queues messages during disconnect', async () => {
    // Input: Send messages while offline
    // Output: Messages stored in queue
  });

  test('sends queued messages on reconnect', async () => {
    // Action: Connection restored
    // Output: All queued messages sent in order
  });

  test('handles queue overflow gracefully', async () => {
    // Input: 1000+ messages while offline
    // Output: Oldest messages dropped, limit maintained
  });

  test('persists important messages across sessions', async () => {
    // Input: Critical messages while offline
    // Output: Messages saved to localStorage
  });
});
```

---

## Session Handler (`/tests/unit/client/session-handler.test.js`)

### Session Management

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

### Session Persistence

```javascript
describe('Session Persistence', () => {
  test('saves session state to localStorage', async () => {
    // Input: Session with messages
    // Output: State persisted across reloads
  });

  test('restores session state on load', async () => {
    // Setup: Saved session state
    // Output: Session UI restored exactly
  });

  test('handles corrupted session data', async () => {
    // Setup: Invalid JSONL in storage
    // Output: Error logged, fresh session started
  });

  test('migrates old session format', async () => {
    // Setup: Session in old format
    // Output: Converted to new format
  });
});
```

### Session Search

```javascript
describe('Session Search', () => {
  test('searches messages by content', async () => {
    // Input: 'authentication error'
    // Output: Messages containing phrase
  });

  test('searches by message type', async () => {
    // Input: type: 'user'
    // Output: Only user messages
  });

  test('searches with regex patterns', async () => {
    // Input: /error.*code:\s*\d+/
    // Output: Messages matching pattern
  });

  test('ranks search results by relevance', async () => {
    // Input: Search term
    // Output: Results sorted by match score
  });
});
```

---

## Client State Management (`/tests/unit/client/state-manager.test.js`)

### Application State

```javascript
describe('State Management', () => {
  test('initializes default state', () => {
    // Output: Default state object with all properties
  });

  test('updates state immutably', () => {
    // Input: State update
    // Output: New state object, original unchanged
  });

  test('emits state change events', () => {
    // Input: State change
    // Output: 'stateChanged' event with new state
  });

  test('validates state updates', () => {
    // Input: Invalid state shape
    // Output: Error thrown, state unchanged
  });
});
```

### State Persistence

```javascript
describe('State Persistence', () => {
  test('saves state to localStorage', () => {
    // Input: State update
    // Output: localStorage updated
  });

  test('restores state on app start', () => {
    // Setup: Saved state in localStorage
    // Output: State restored
  });

  test('handles storage quota exceeded', () => {
    // Setup: localStorage full
    // Output: Old data cleared, new state saved
  });

  test('merges default and saved state', () => {
    // Setup: Partial saved state
    // Output: Complete state with defaults
  });
});
```

---

## Client Error Handling (`/tests/unit/client/error-handler.test.js`)

### Error Capture and Reporting

```javascript
describe('Error Handling', () => {
  test('catches unhandled promise rejections', async () => {
    // Input: Promise rejection
    // Output: Error captured and logged
  });

  test('catches global JavaScript errors', () => {
    // Input: Uncaught exception
    // Output: Error captured, UI shows fallback
  });

  test('reports errors to monitoring service', async () => {
    // Input: Application error
    // Output: Error sent to monitoring endpoint
  });

  test('filters out known harmless errors', () => {
    // Input: Browser extension error
    // Output: Error ignored, not reported
  });
});
```

---

## Test Execution Notes

### Mocking Requirements
- Mock file system operations using virtual FS
- Mock WebSocket connections for connection tests  
- Mock git commands using test fixtures
- Mock localStorage for state persistence tests

### Test Data Setup
- Create sample project directories with git history
- Generate JSONL session files with various message types
- Set up file watching scenarios with controlled changes
- Prepare network failure simulations

### Performance Assertions
- File operations should complete in <100ms
- Git operations should complete in <500ms
- WebSocket connection established in <1s
- Session loading should handle 1000+ messages

### Browser Compatibility
- Test in Chrome, Firefox, Safari, Edge
- Verify WebSocket implementations work consistently
- Check localStorage behavior across browsers
- Test file upload/download across browsers

**Total Client Unit Tests**: ~40 test specifications covering git operations, file handling, connections, and session management.