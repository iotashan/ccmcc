# WebSocket Protocol Documentation

## Overview

Claude Code UI uses WebSocket for real-time bidirectional communication between the server and clients (both web UI and machine clients). This document details the complete message protocol.

## Connection Establishment

### Web UI Connection

```
wss://server.example.com/ws
Headers:
  Cookie: jwt=<token>
```

### Machine Client Connection

```
wss://server.example.com/machine?token=<api-token>
```

## Message Format

All messages are JSON-encoded with a required `type` field:

```typescript
interface BaseMessage {
  type: string;
  timestamp?: string;
  [key: string]: any;
}
```

## Connection Lifecycle

```
Client                          Server
  │                               │
  ├─── Connect + Auth ──────────►│
  │                               │
  │◄──── Connection Ack ─────────┤
  │                               │
  ├─── Register (machines) ──────►│
  │                               │
  │◄──── Registration Ack ────────┤
  │                               │
  ├─── Heartbeat ────────────────►│
  │◄──── Heartbeat Ack ──────────┤
  │                               │
  │◄──── Messages ───────────────►│
  │                               │
  ├─── Disconnect ───────────────►│
  │                               │
```

## Message Types

### 1. Authentication & Registration

#### Machine Registration (Client → Server)

```json
{
  "type": "machine:register",
  "name": "Work Computer",
  "capabilities": ["claude-cli", "git", "file-access", "shell"],
  "systemInfo": {
    "platform": "darwin",
    "release": "23.1.0",
    "arch": "arm64",
    "hostname": "work-mac.local"
  }
}
```

#### Registration Acknowledgment (Server → Client)

```json
{
  "type": "register:ack",
  "machine": {
    "id": "uuid-v4",
    "name": "Work Computer",
    "auth_token": "machine-specific-token"
  }
}
```

### 2. Heartbeat Protocol

#### Heartbeat (Client → Server)

```json
{
  "type": "heartbeat",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Heartbeat Acknowledgment (Server → Client)

```json
{
  "type": "heartbeat:ack",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "serverTime": "2024-01-01T00:00:00.000Z"
}
```

### 3. API Request Forwarding

#### API Request (Server → Machine)

```json
{
  "type": "request:api",
  "requestId": "req-uuid-v4",
  "data": {
    "path": "/projects",
    "method": "GET",
    "headers": {
      "accept": "application/json"
    },
    "query": {
      "limit": "10",
      "offset": "0"
    },
    "body": null
  }
}
```

#### API Response (Machine → Server)

```json
{
  "type": "api:response",
  "requestId": "req-uuid-v4",
  "machine_id": "machine-uuid",
  "status": 200,
  "headers": {
    "content-type": "application/json"
  },
  "data": {
    "projects": [...]
  }
}
```

#### API Error Response (Machine → Server)

```json
{
  "type": "api:response",
  "requestId": "req-uuid-v4",
  "machine_id": "machine-uuid",
  "status": 500,
  "error": "Internal server error",
  "details": {
    "code": "FILE_READ_ERROR",
    "message": "Permission denied"
  }
}
```

### 4. Claude CLI Execution

#### Execute Claude Command (Server → Machine)

```json
{
  "type": "command:claude",
  "request_id": "cmd-uuid-v4",
  "command": "explain this code",
  "options": {
    "projectPath": "/home/user/project",
    "sessionId": "session-123"
  }
}
```

#### Claude Output Stream (Machine → Server)

```json
{
  "type": "claude:response",
  "request_id": "cmd-uuid-v4",
  "data": "Claude is analyzing the code...\n",
  "stream": "stdout"
}
```

#### Claude Error Stream (Machine → Server)

```json
{
  "type": "claude:response",
  "request_id": "cmd-uuid-v4",
  "data": "Error: Claude CLI not found\n",
  "stream": "stderr"
}
```

#### Claude Completion (Machine → Server)

```json
{
  "type": "claude:complete",
  "request_id": "cmd-uuid-v4",
  "code": 0,
  "signal": null
}
```

#### Claude Error (Machine → Server)

```json
{
  "type": "claude:error",
  "request_id": "cmd-uuid-v4",
  "error": "Failed to spawn claude process"
}
```

### 5. Project Operations

#### Get Projects Request (Internal)

```json
{
  "type": "projects:get",
  "request_id": "proj-uuid-v4"
}
```

#### Projects List Response (Internal)

```json
{
  "type": "projects:list",
  "request_id": "proj-uuid-v4",
  "projects": [
    {
      "name": "my-project",
      "displayName": "My Project",
      "path": "/home/user/projects/my-project",
      "lastModified": "2024-01-01T00:00:00.000Z",
      "created": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

### 6. Web UI Specific Messages

#### Chat Message (Web UI → Server)

```json
{
  "type": "chat:message",
  "sessionId": "session-123",
  "projectId": "project-456",
  "machineId": "machine-789",
  "message": {
    "role": "user",
    "content": "How do I implement authentication?"
  }
}
```

#### Chat Response (Server → Web UI)

```json
{
  "type": "chat:response",
  "sessionId": "session-123",
  "message": {
    "role": "assistant",
    "content": "To implement authentication...",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Machine Status Update (Server → Web UI)

```json
{
  "type": "machine:status",
  "machines": [
    {
      "id": "machine-123",
      "name": "Work Computer",
      "status": "online",
      "lastSeen": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 7. Error Messages

#### General Error

```json
{
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "Message type not recognized",
  "details": {
    "receivedType": "unknown:type"
  }
}
```

#### Authentication Error

```json
{
  "type": "auth:error",
  "code": "AUTH_FAILED",
  "message": "Invalid API token"
}
```

#### Connection Error

```json
{
  "type": "connection:error",
  "code": "RATE_LIMIT",
  "message": "Too many requests",
  "retryAfter": 60
}
```

## Protocol Constants

### Message Types (ClientMessageTypes)

```javascript
export const ClientMessageTypes = {
  // Registration
  REGISTER: 'machine:register',
  
  // Heartbeat
  HEARTBEAT: 'heartbeat',
  
  // API
  API_RESPONSE: 'api:response',
  
  // Claude
  CLAUDE_RESPONSE: 'claude:response',
  CLAUDE_COMPLETE: 'claude:complete',
  CLAUDE_ERROR: 'claude:error',
  
  // Projects
  PROJECT_LIST: 'projects:list'
};
```

### Message Types (ServerMessageTypes)

```javascript
export const ServerMessageTypes = {
  // Registration
  REGISTER_ACK: 'register:ack',
  
  // Heartbeat
  HEARTBEAT_ACK: 'heartbeat:ack',
  
  // API
  API_REQUEST: 'request:api',
  
  // Claude
  CLAUDE_EXECUTE: 'command:claude',
  
  // Projects
  PROJECT_GET: 'projects:get',
  
  // Status
  MACHINE_STATUS: 'machine:status'
};
```

## Flow Examples

### 1. Complete API Request Flow

```
Web UI          Server         Machine Client
  │               │                 │
  ├─ GET /api ───►│                 │
  │  projects     │                 │
  │  X-Machine-ID │                 │
  │               ├─ request:api ──►│
  │               │                 │
  │               │◄─ api:response ─┤
  │◄─ 200 OK ─────┤                 │
  │  {projects}   │                 │
  │               │                 │
```

### 2. Claude Command Execution Flow

```
Web UI          Server         Machine Client
  │               │                 │
  ├─ POST chat ──►│                 │
  │               │                 │
  │               ├─ command:claude►│
  │               │                 │
  │               │◄─ claude:resp ──┤ (streaming)
  │◄─ chat:resp ──┤                 │
  │               │◄─ claude:resp ──┤ (streaming)
  │◄─ chat:resp ──┤                 │
  │               │                 │
  │               │◄─ claude:done ──┤
  │◄─ chat:done ──┤                 │
  │               │                 │
```

## Best Practices

### 1. Message Validation

Always validate incoming messages:

```javascript
// Required fields
if (!message.type) {
  throw new Error('Message type required');
}

// Type-specific validation
switch (message.type) {
  case 'api:response':
    if (!message.requestId) {
      throw new Error('Request ID required');
    }
    break;
}
```

### 2. Request Tracking

Use unique request IDs for correlation:

```javascript
const requestId = crypto.randomUUID();
pendingRequests.set(requestId, {
  timestamp: Date.now(),
  callback: responseCallback
});
```

### 3. Timeout Handling

Implement timeouts for all requests:

```javascript
const TIMEOUT = 30000; // 30 seconds

setTimeout(() => {
  if (pendingRequests.has(requestId)) {
    pendingRequests.delete(requestId);
    callback(new Error('Request timeout'));
  }
}, TIMEOUT);
```

### 4. Error Recovery

Implement exponential backoff for reconnection:

```javascript
let reconnectDelay = 1000;
const maxDelay = 60000;

function reconnect() {
  setTimeout(() => {
    connect().catch(() => {
      reconnectDelay = Math.min(
        reconnectDelay * 2 + Math.random() * 1000,
        maxDelay
      );
      reconnect();
    });
  }, reconnectDelay);
}
```

### 5. Shell Operations (NEW: July 19, 2025)

#### Shell Connection (Web UI → Server)

```
ws://server:3020/shell?token=<jwt-token>&machineId=<machine-id>
```

The shell WebSocket connection requires:
- JWT token for authentication
- Optional machineId for routing to remote machines

#### Shell Initialization (Server → Machine)

```json
{
  "type": "shell:init",
  "request_id": "shell-session-uuid",
  "data": {
    "cols": 80,
    "rows": 24,
    "cwd": "/path/to/project"
  }
}
```

#### Shell Input (Server → Machine)

```json
{
  "type": "shell:input",
  "request_id": "shell-session-uuid",
  "data": "ls -la\n"
}
```

#### Shell Output (Machine → Server → Web UI)

```json
{
  "type": "shell:output",
  "request_id": "shell-session-uuid",
  "data": "total 48\ndrwxr-xr-x  6 user  staff   192 Jul 19 10:00 .\n"
}
```

#### Shell Resize (Server → Machine)

```json
{
  "type": "shell:resize",
  "request_id": "shell-session-uuid",
  "data": {
    "cols": 120,
    "rows": 40
  }
}
```

#### Shell Exit (Server → Machine)

```json
{
  "type": "shell:exit",
  "request_id": "shell-session-uuid"
}
```

**Important Fix (July 19, 2025):**
The server now maintains a consistent `shellSessionId` across all shell operations. Previously, each operation generated a new `request_id`, causing "No active shell session" errors.

## Security Considerations

### 1. Authentication

- Tokens sent only during connection establishment
- No tokens in message payloads
- Connection closed on auth failure

### 2. Message Size Limits

- Maximum message size: 10MB
- Large payloads should be chunked
- File transfers use separate mechanism

### 3. Rate Limiting

- Per-connection message rate limits
- Backpressure handling
- Automatic throttling

## Debugging

### Enable Debug Logging

Server:
```javascript
DEBUG=websocket:* npm run server
```

Client:
```javascript
{
  "logLevel": "debug"
}
```

### Common Issues

1. **Message Not Received**
   - Check message type is correct
   - Verify connection is established
   - Check for rate limiting

2. **Request Timeout**
   - Verify target machine is online
   - Check request routing
   - Examine server logs

3. **Authentication Failure**
   - Verify token is valid
   - Check token hasn't been revoked
   - Ensure proper header format

4. **Shell Session Issues (Fixed: July 19, 2025)**
   - Previous: Each shell operation generated new request_id
   - Fixed: Server maintains consistent shellSessionId
   - Verify machineId included in WebSocket URL for remote shells