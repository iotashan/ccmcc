# Client API Documentation

## Overview

The Claude Code UI client is a Node.js application that runs on machines with Claude CLI installed. It connects to the central server via WebSocket and executes commands locally, acting as a bridge between the web UI and the Claude CLI.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Client Application              │
├─────────────────────────────────────────────────┤
│  Connection Layer (WebSocket)                    │
├─────────────────────────────────────────────────┤
│  Handler Layer                                   │
│  ├─ API Handler (HTTP-like requests)           │
│  ├─ Projects Handler (Claude projects)          │
│  └─ Claude Handler (CLI execution)             │
├─────────────────────────────────────────────────┤
│  Local Resources                                 │
│  ├─ File System (~/.claude/projects)           │
│  ├─ Claude CLI                                  │
│  └─ Git Repositories                           │
└─────────────────────────────────────────────────┘
```

## Configuration

### Configuration File Structure

`config.json`:
```json
{
  "serverAddress": "https://server.example.com:3020",
  "authToken": "your-api-token-here",
  "clientName": "Work Computer",
  "capabilities": ["claude-cli", "git", "file-access", "shell"],
  "reconnectInterval": 5000,
  "heartbeatInterval": 30000,
  "logLevel": "info"
}
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `serverAddress` | string | Yes | Server URL (http/https) |
| `authToken` | string | Yes | API token for authentication |
| `clientName` | string | Yes | Display name for this client |
| `capabilities` | array | Yes | List of supported capabilities |
| `reconnectInterval` | number | No | MS between reconnection attempts (default: 5000) |
| `heartbeatInterval` | number | No | MS between heartbeat messages (default: 30000) |
| `logLevel` | string | No | Log level: error, warn, info, debug (default: info) |

### Capabilities

- `claude-cli` - Can execute Claude CLI commands
- `git` - Can perform git operations
- `file-access` - Can read/write files
- `shell` - Can execute shell commands

## Connection Management

### WebSocket Connection

The client maintains a persistent WebSocket connection to the server:

```javascript
// Connection flow
1. Read configuration
2. Convert HTTP URL to WebSocket URL
3. Append API token as query parameter
4. Establish WebSocket connection
5. Send registration message
6. Begin heartbeat cycle
```

### Connection States

```
┌─────────┐     connect()      ┌─────────────┐
│  INIT   │ ─────────────────► │ CONNECTING  │
└─────────┘                    └─────────────┘
                                      │
                                      │ success
                                      ▼
┌─────────┐     disconnect     ┌─────────────┐
│  CLOSED │ ◄────────────────  │  CONNECTED  │
└─────────┘                    └─────────────┘
     │                                │
     │                                │ error
     │                         ┌──────▼──────┐
     └────── reconnect ────────│    ERROR    │
                               └─────────────┘
```

### Automatic Reconnection

- Exponential backoff with jitter
- Maximum reconnection attempts: unlimited
- Reconnection interval: 5-60 seconds
- Preserves registration state

## Message Handlers

### API Handler (`apiHandler.js`)

Processes HTTP-like API requests forwarded from the server.

**Supported Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects` | GET | List all Claude projects |
| `/projects/:name/sessions` | GET | List sessions for a project |
| `/projects/:name/sessions/:id/messages` | GET | Get session messages |
| `/projects/:name/file` | GET | Read file content |
| `/projects/:name/file` | PUT | Save file content |

**Request Processing:**

```javascript
// Incoming message structure
{
  type: 'request:api',
  requestId: 'uuid',
  data: {
    path: '/projects',
    method: 'GET',
    headers: {},
    query: {},
    body: {}
  }
}

// Response structure
{
  type: 'api:response',
  requestId: 'uuid',
  status: 200,
  headers: { 'content-type': 'application/json' },
  data: { ... }
}
```

### Projects Handler (`projects.js`)

Manages Claude project operations by reading from `~/.claude/projects/`.

**Key Functions:**

1. **Project Discovery**
   - Scans `~/.claude/projects/` directory
   - Reads project metadata from `.claude/project.json`
   - Returns project list with names and paths

2. **Session Management**
   - Lists sessions in `.claude/sessions/` directory
   - Reads session metadata files
   - Supports pagination

3. **File Operations**
   - Validates file paths for security
   - Reads/writes files with proper error handling
   - Supports UTF-8 encoding

### Claude Handler (`claude.js`)

Executes Claude CLI commands and streams output.

**Command Execution:**

```javascript
// Incoming message
{
  type: 'command:claude',
  request_id: 'uuid',
  command: 'tell me about this file',
  options: {
    projectPath: '/path/to/project',
    sessionId: 'session-id'
  }
}

// Response streaming
{
  type: 'claude:response',
  request_id: 'uuid',
  data: 'Claude output...',
  stream: 'stdout|stderr'
}

// Completion
{
  type: 'claude:complete',
  request_id: 'uuid',
  code: 0,
  signal: null
}
```

**Process Management:**
- Spawns Claude CLI as child process
- Streams stdout/stderr in real-time
- Handles process termination
- Supports session resumption with `--resume`

## Security Considerations

### Path Validation

All file operations validate paths to prevent directory traversal:

```javascript
// Path must be absolute
if (!path.isAbsolute(filePath)) {
  return { error: 'Invalid file path' };
}

// Additional checks for project boundaries
if (!filePath.startsWith(projectPath)) {
  return { error: 'Access denied' };
}
```

### Authentication

- API token sent only during initial connection
- Token never logged or exposed
- Connection closed on authentication failure
- No token refresh mechanism (intentionally permanent)

### Process Isolation

- Claude CLI runs with client user permissions
- No shell command execution without explicit capability
- Working directory restricted to project paths
- Environment variables inherited safely

## Error Handling

### Error Types

1. **Connection Errors**
   - Network failures
   - Authentication failures
   - Server unreachable

2. **Execution Errors**
   - Claude CLI not found
   - Command execution failure
   - File system errors

3. **Protocol Errors**
   - Invalid message format
   - Unknown message type
   - Missing required fields

### Error Responses

Standard error format:
```json
{
  "type": "error",
  "requestId": "uuid",
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found: /path/to/file",
    "details": {}
  }
}
```

## Logging

### Log Levels

- `error` - Critical errors requiring attention
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Detailed debugging information

### Log Format

```
[2024-01-01T00:00:00.000Z] [INFO] Message content
[2024-01-01T00:00:00.000Z] [ERROR] Error: detailed error message
  at stack trace...
```

## Performance Considerations

### Message Batching

The client does not batch messages but processes them sequentially to maintain order.

### File Operations

- Large files read in chunks
- Streaming for Claude CLI output
- No file caching (always fresh reads)

### Memory Management

- Active process tracking with cleanup
- WebSocket message size limits
- Automatic garbage collection

## Deployment

### System Requirements

- Node.js v20 or higher
- Claude CLI installed and in PATH
- Network access to server
- Sufficient disk space for logs

### Running as a Service

#### Linux (systemd)

```ini
[Unit]
Description=Claude Code UI Client
After=network.target

[Service]
Type=simple
User=username
WorkingDirectory=/path/to/client
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Process Monitoring

Recommended monitoring:
- Process uptime
- WebSocket connection status
- Memory usage
- CPU usage
- Disk space (for logs)

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | production |
| `LOG_LEVEL` | Override config log level | (from config) |
| `CONFIG_PATH` | Path to config file | ./config.json |

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify server URL is correct
   - Check API token is valid
   - Ensure network connectivity
   - Check firewall rules

2. **Claude CLI Not Found**
   - Verify Claude is installed
   - Check PATH environment variable
   - Run `which claude` to verify

3. **File Access Errors**
   - Check file permissions
   - Verify paths are correct
   - Ensure sufficient disk space

### Debug Mode

Enable debug logging:
```json
{
  "logLevel": "debug"
}
```

Debug output includes:
- All WebSocket messages
- File operation details
- Process spawn information
- Connection state changes