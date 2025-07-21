# Duplicated Code Patterns Analysis

## Overview
This analysis identifies duplicated code patterns across the client and server implementations for shell, files, chat, and MCP modules in the Claude Code UI project.

## 1. Shell Operations

### Duplicated Patterns:
- **Shell initialization logic** - Both client (`client/src/handlers/shell.js`) and server (`server/index.js`) implement similar shell spawning logic
- **PTY configuration** - Identical PTY spawn configurations in both locations
- **Session management** - Similar session ID generation and tracking patterns
- **Error handling** - Duplicate error message formatting and WebSocket error responses

### Specific Duplications:

#### Shell Spawning Configuration
Both client and server use identical PTY configuration:
```javascript
// Client (shell.js:77-90)
const shellProcess = pty.spawn('bash', ['-c', shellCommand], {
  name: 'xterm-256color',
  cols: cols || 80,
  rows: rows || 24,
  cwd: process.env.HOME || '/',
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
    BROWSER: 'echo "OPEN_URL:"'
  }
});

// Server (index.js:923-936)
shellProcess = pty.spawn('bash', ['-c', shellCommand], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.env.HOME || '/',
  env: {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    FORCE_COLOR: '3',
    BROWSER: 'echo "OPEN_URL:"'
  }
});
```

#### Welcome Message Generation
Both locations have identical welcome message logic:
```javascript
const welcomeMsg = hasSession ? 
  `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
  `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`;
```

#### Shell Command Building
Duplicate command construction logic:
```javascript
let claudeCommand = 'claude';
if (hasSession && sessionId) {
  claudeCommand = `claude --resume ${sessionId} || claude`;
}
const shellCommand = `cd "${projectPath}" && ${claudeCommand}`;
```

## 2. File Operations

### Duplicated Patterns:
- **File reading logic** - Both client (`client/src/handlers/apiHandler.js`) and server (`server/index.js`) implement file reading with identical error handling
- **File writing logic** - Similar file write operations with permission checks
- **File tree traversal** - Near-identical `getFileTree` implementations

### Specific Duplications:

#### File Read Operations
Both implement identical file reading with error handling:
```javascript
// Client (apiHandler.js:56-69)
try {
  const content = await fs.readFile(filePath, 'utf8');
  responseData = { content, path: filePath };
} catch (error) {
  if (error.code === 'ENOENT') {
    status = 404;
    responseData = { error: 'File not found' };
  } else if (error.code === 'EACCES') {
    status = 403;
    responseData = { error: 'Permission denied' };
  } else {
    throw error;
  }
}

// Server (index.js) - Similar pattern for file operations
```

#### getFileTree Implementation
Both client and server have nearly identical file tree traversal:
```javascript
// Client (apiHandler.js:280-321)
async getFileTree(dir, maxDepth = 3, currentDepth = 0, includeHidden = false) {
  const tree = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;
      // ... identical logic
    }
  } catch (error) {
    this.logger.error(`Error reading directory ${dir}:`, error);
    throw error;
  }
  return tree;
}

// Server (index.js:1895-1966) - Similar implementation with additional metadata
```

## 3. Error Handling Patterns

### Duplicated Patterns:
- **WebSocket error responses** - Identical error message formatting
- **Rate limiting checks** - Similar rate limit exceeded message handling
- **Invalid message handling** - Duplicate abuse detection logic

### Specific Duplications:
```javascript
// Common error response pattern
ws.send(JSON.stringify({
  type: 'error',
  error: 'Invalid message format'
}));

// Common rate limit response
ws.send(JSON.stringify({
  type: 'rate_limit_exceeded',
  category: rateLimitCheck.category,
  resetTime: rateLimitCheck.resetTime,
  message: 'Too many requests. Please slow down.'
}));
```

## 4. Message Routing Patterns

### Duplicated Patterns:
- **Request ID generation** - Both use `crypto.randomUUID()` for request IDs
- **Machine routing logic** - Similar patterns for routing messages to remote machines
- **Response handling** - Identical WebSocket message response structures

## 5. MCP Operations

### Unique Implementation:
- MCP operations are only implemented on the server side (`server/routes/mcp.js`)
- No client-side MCP handler found
- Uses Claude CLI directly via `spawn` commands

## Recommendations for Reducing Duplication

### 1. Create Shared Utility Modules
```javascript
// shared/utils/shell.js
export const shellConfig = {
  ptyOptions: {
    name: 'xterm-256color',
    env: {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '3',
      BROWSER: 'echo "OPEN_URL:"'
    }
  },
  defaultDimensions: { cols: 80, rows: 24 },
  welcomeMessages: {
    resume: (sessionId, projectPath) => 
      `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n`,
    new: (projectPath) => 
      `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`
  }
};
```

### 2. Shared Error Handling
```javascript
// shared/utils/errors.js
export const fileErrorHandler = (error, status = {}) => {
  if (error.code === 'ENOENT') {
    return { status: 404, data: { error: 'File not found' } };
  } else if (error.code === 'EACCES') {
    return { status: 403, data: { error: 'Permission denied' } };
  }
  throw error;
};

export const wsErrorResponse = (type, message) => ({
  type: type || 'error',
  error: message
});
```

### 3. Common File Operations
```javascript
// shared/utils/fileOps.js
export async function getFileTree(dir, maxDepth = 3, currentDepth = 0, includeHidden = false) {
  // Single implementation used by both client and server
}
```

### 4. Protocol Constants
```javascript
// shared/protocol/messages.js
export const ErrorMessages = {
  INVALID_FORMAT: 'Invalid message format',
  RATE_LIMIT: 'Too many requests. Please slow down.',
  MACHINE_OFFLINE: 'Machine is offline or unavailable',
  PERMISSION_DENIED: 'Permission denied'
};
```

## Impact Analysis

### Benefits of Deduplication:
1. **Maintainability**: Single source of truth for business logic
2. **Consistency**: Ensures uniform behavior across client/server
3. **Testing**: Shared utilities can be tested once
4. **Bundle Size**: Potential reduction in client bundle size

### Risks:
1. **Coupling**: Shared code creates dependencies between client/server
2. **Complexity**: Need to ensure shared code works in both Node.js environments
3. **Deployment**: Changes to shared code affect both components

## Priority Areas for Refactoring

1. **High Priority**: Shell configuration and error handling (most duplication)
2. **Medium Priority**: File operations and tree traversal
3. **Low Priority**: Message formatting and routing patterns (minimal duplication)