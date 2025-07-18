# Server API Documentation

## Overview

The Claude Code UI server provides a RESTful API for web clients and WebSocket connections for real-time communication with machine clients. The server implements dual authentication: JWT for web UI users and API tokens for machine clients.

## Base URL

- Development: `http://localhost:3020`
- Production: `https://your-domain.com`

## Authentication

### JWT Authentication (Web UI)

Used for all web UI requests. JWT tokens are issued upon successful login and must be included in the Authorization header.

```http
Authorization: Bearer <jwt-token>
```

**Token Lifecycle:**
- Issued on successful login
- Default expiration: 24 hours
- Stored in HTTP-only secure cookie
- Automatically refreshed on activity

### API Token Authentication (Machine Clients)

Used for machine client WebSocket connections. API tokens are permanent until revoked.

```
ws://server-url/machine?token=<api-token>
```

**Token Management:**
- Created through web UI (Settings → API Tokens)
- SHA-256 hashed in database
- Can be revoked at any time
- Each token tied to a specific user

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/login`

Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "username": "string",
    "role": "admin|user"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials
- `429` - Too many attempts

#### POST `/api/auth/logout`

Invalidate current session.

**Request:**
No body required. JWT token in header.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### GET `/api/auth/verify`

Verify current JWT token validity.

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "username": "string",
    "role": "admin|user"
  }
}
```

### Machine Management Endpoints

#### GET `/api/machines`

Get list of connected machines.

**Response:**
```json
{
  "machines": [
    {
      "id": "uuid",
      "name": "Work Computer",
      "status": "online|offline",
      "lastSeen": "2024-01-01T00:00:00Z",
      "capabilities": ["claude-cli", "git", "file-access"],
      "ipAddress": "192.168.1.100"
    }
  ]
}
```

#### GET `/api/machines/:id`

Get specific machine details.

**Response:**
```json
{
  "id": "uuid",
  "name": "Work Computer",
  "status": "online",
  "lastSeen": "2024-01-01T00:00:00Z",
  "capabilities": ["claude-cli", "git", "file-access"],
  "ipAddress": "192.168.1.100",
  "systemInfo": {
    "platform": "darwin",
    "release": "23.1.0",
    "arch": "arm64"
  }
}
```

#### DELETE `/api/machines/:id`

Remove a machine from registry.

**Response:**
```json
{
  "message": "Machine removed successfully"
}
```

### API Token Management

#### GET `/api/auth/tokens`

Get all API tokens for current user.

**Response:**
```json
{
  "tokens": [
    {
      "id": 1,
      "name": "Work Computer",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-01T00:00:00Z",
      "expiresAt": null
    }
  ]
}
```

#### POST `/api/auth/tokens`

Create new API token.

**Request:**
```json
{
  "name": "Token name"
}
```

**Response:**
```json
{
  "token": "actual-token-value-shown-once",
  "id": 1,
  "name": "Token name",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

⚠️ **Important**: The token value is only shown once. Store it securely.

#### DELETE `/api/auth/tokens/:id`

Revoke an API token.

**Response:**
```json
{
  "message": "Token revoked successfully"
}
```

### Machine-Forwarded Endpoints

These endpoints are forwarded to the selected machine client. Requires `X-Machine-ID` header.

#### GET `/api/projects`

Get Claude projects from target machine.

**Headers:**
```http
X-Machine-ID: machine-uuid
```

**Response:**
```json
{
  "projects": [
    {
      "name": "my-project",
      "displayName": "My Project",
      "path": "/home/user/projects/my-project",
      "lastModified": "2024-01-01T00:00:00Z",
      "sessions": [...]
    }
  ]
}
```

#### GET `/api/projects/:project/sessions`

Get sessions for a specific project.

**Query Parameters:**
- `limit` - Number of sessions (default: 10)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "sessions": [
    {
      "id": "session-id",
      "created": "2024-01-01T00:00:00Z",
      "lastModified": "2024-01-01T00:00:00Z",
      "messageCount": 42,
      "summary": "Implementing user authentication"
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

#### GET `/api/projects/:project/sessions/:session/messages`

Get messages for a specific session.

**Response:**
```json
{
  "messages": [
    {
      "role": "user|assistant",
      "content": "message content",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### GET `/api/projects/:project/file`

Read file content from target machine.

**Query Parameters:**
- `filePath` - Absolute path to file

**Response:**
```json
{
  "content": "file content",
  "path": "/absolute/path/to/file"
}
```

#### PUT `/api/projects/:project/file`

Save file content to target machine.

**Request:**
```json
{
  "filePath": "/absolute/path/to/file",
  "content": "new file content"
}
```

**Response:**
```json
{
  "success": true,
  "path": "/absolute/path/to/file"
}
```

### Git Operations

All git endpoints require `X-Machine-ID` header and are forwarded to the target machine.

#### GET `/api/git/status`

Get git repository status.

**Query Parameters:**
- `projectPath` - Path to git repository

**Response:**
```json
{
  "branch": "main",
  "ahead": 0,
  "behind": 0,
  "staged": [...],
  "unstaged": [...],
  "untracked": [...]
}
```

#### POST `/api/git/stage`

Stage files for commit.

**Request:**
```json
{
  "projectPath": "/path/to/project",
  "files": ["file1.js", "file2.js"]
}
```

#### POST `/api/git/commit`

Create a git commit.

**Request:**
```json
{
  "projectPath": "/path/to/project",
  "message": "Commit message"
}
```

### Settings Endpoints

#### GET `/api/settings`

Get user settings.

**Response:**
```json
{
  "theme": "light|dark",
  "projectSortOrder": "name|date",
  "enabledTools": ["tool1", "tool2"]
}
```

#### PUT `/api/settings`

Update user settings.

**Request:**
```json
{
  "theme": "dark",
  "projectSortOrder": "date"
}
```

## WebSocket Protocol

### Machine Connection

Machines connect via WebSocket with API token authentication:

```javascript
const ws = new WebSocket('ws://server/machine?token=api-token');
```

### Message Types

#### Server → Client Messages

**API Request:**
```json
{
  "type": "request:api",
  "requestId": "uuid",
  "data": {
    "path": "/projects",
    "method": "GET",
    "headers": {},
    "query": {},
    "body": {}
  }
}
```

**Command Execution:**
```json
{
  "type": "command:execute",
  "requestId": "uuid",
  "command": "claude",
  "args": ["--help"],
  "options": {
    "cwd": "/path/to/project"
  }
}
```

#### Client → Server Messages

**Registration:**
```json
{
  "type": "machine:register",
  "name": "Work Computer",
  "capabilities": ["claude-cli", "git", "file-access"],
  "systemInfo": {
    "platform": "darwin",
    "release": "23.1.0"
  }
}
```

**API Response:**
```json
{
  "type": "api:response",
  "requestId": "uuid",
  "status": 200,
  "headers": {},
  "data": {}
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `AUTH_REQUIRED` - Missing authentication
- `AUTH_INVALID` - Invalid token
- `MACHINE_NOT_FOUND` - Target machine not connected
- `PERMISSION_DENIED` - Insufficient permissions
- `VALIDATION_ERROR` - Invalid request data
- `INTERNAL_ERROR` - Server error

## Rate Limiting

- Login attempts: 5 per minute
- API requests: 100 per minute per user
- WebSocket messages: 50 per second per connection

## CORS Configuration

Development:
- Origin: `http://localhost:3021`
- Credentials: Allowed

Production:
- Origin: Configured domain only
- Credentials: Allowed
- Preflight cache: 86400 seconds