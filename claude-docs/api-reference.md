# API Reference

## Overview

This document provides a complete reference for all APIs in Claude Code UI, including REST endpoints, WebSocket messages, and client handlers.

## Table of Contents

1. [REST API](#rest-api)
2. [WebSocket API](#websocket-api)
3. [Client API](#client-api)
4. [Data Types](#data-types)
5. [Error Codes](#error-codes)

## REST API

### Base URL

```
Development: http://localhost:3020/api
Production: https://your-domain.com/api
```

### Authentication

All API endpoints require authentication unless specified otherwise.

- **Web UI**: JWT token in Authorization header or cookie
- **Machines**: API token for WebSocket connections only

### Machine Routing (Updated: July 19, 2025)

API requests can be routed to specific machines using the `X-Machine-ID` header:

- **Local execution**: Omit header or use `X-Machine-ID: local`
- **Remote execution**: Use `X-Machine-ID: <machine-uuid>`

**Important**: All protected API routes (git, mcp, projects, etc.) support machine routing. The server middleware automatically forwards requests to the appropriate machine when the header is present.

### Endpoints

#### Authentication

##### POST /auth/login

Authenticate user and receive JWT token.

**Request:**
```typescript
{
  username: string;
  password: string;
}
```

**Response:**
```typescript
{
  token: string;
  user: {
    id: number;
    username: string;
    role: "admin" | "user";
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials
- `429` - Too many attempts

**Example:**
```bash
curl -X POST http://localhost:3020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

##### POST /auth/logout

Invalidate current session.

**Response:**
```typescript
{
  message: string;
}
```

**Example:**
```bash
curl -X POST http://localhost:3020/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

##### GET /auth/verify

Verify token validity.

**Response:**
```typescript
{
  valid: boolean;
  user?: {
    id: number;
    username: string;
    role: string;
  }
}
```

#### API Tokens

##### GET /auth/tokens

List user's API tokens.

**Response:**
```typescript
{
  tokens: Array<{
    id: number;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
  }>
}
```

##### POST /auth/tokens

Create new API token.

**Request:**
```typescript
{
  name: string;
}
```

**Response:**
```typescript
{
  token: string; // Only shown once!
  id: number;
  name: string;
  createdAt: string;
}
```

##### DELETE /auth/tokens/:id

Revoke API token.

**Parameters:**
- `id` - Token ID

**Response:**
```typescript
{
  message: string;
}
```

#### Machines

##### GET /machines

List connected machines.

**Response:**
```typescript
{
  machines: Array<{
    id: string;
    name: string;
    status: "online" | "offline";
    lastSeen: string;
    capabilities: string[];
    ipAddress: string;
  }>
}
```

##### GET /machines/:id

Get machine details.

**Parameters:**
- `id` - Machine ID

**Response:**
```typescript
{
  id: string;
  name: string;
  status: string;
  lastSeen: string;
  capabilities: string[];
  ipAddress: string;
  systemInfo: {
    platform: string;
    release: string;
    arch: string;
  }
}
```

##### DELETE /machines/:id

Remove machine from registry.

**Parameters:**
- `id` - Machine ID

**Response:**
```typescript
{
  message: string;
}
```

#### Projects (Machine-Forwarded)

All project endpoints require `X-Machine-ID` header.

##### GET /projects

List Claude projects on machine.

**Headers:**
```
X-Machine-ID: <machine-uuid>
```

**Response:**
```typescript
{
  projects: Array<{
    name: string;
    displayName: string;
    path: string;
    lastModified: string;
    created: string;
    sessions?: Array<Session>;
  }>
}
```

##### GET /projects/:name/sessions

Get project sessions.

**Parameters:**
- `name` - Project name

**Query:**
- `limit` - Max results (default: 10)
- `offset` - Pagination offset (default: 0)

**Response:**
```typescript
{
  sessions: Array<{
    id: string;
    created: string;
    lastModified: string;
    messageCount: number;
    summary: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

##### GET /projects/:name/sessions/:id/messages

Get session messages.

**Parameters:**
- `name` - Project name
- `id` - Session ID

**Response:**
```typescript
{
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>
}
```

##### GET /projects/:name/file

Read file content.

**Parameters:**
- `name` - Project name

**Query:**
- `filePath` - Absolute file path

**Response:**
```typescript
{
  content: string;
  path: string;
}
```

##### PUT /projects/:name/file

Save file content.

**Parameters:**
- `name` - Project name

**Request:**
```typescript
{
  filePath: string;
  content: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  path: string;
}
```

#### Git Operations

All git endpoints require `X-Machine-ID` header.

##### GET /git/status

Get repository status.

**Query:**
- `projectPath` - Repository path

**Response:**
```typescript
{
  branch: string;
  ahead: number;
  behind: number;
  staged: Array<{
    path: string;
    status: string;
  }>;
  unstaged: Array<{
    path: string;
    status: string;
  }>;
  untracked: string[];
}
```

##### POST /git/stage

Stage files for commit.

**Request:**
```typescript
{
  projectPath: string;
  files: string[];
}
```

**Response:**
```typescript
{
  success: boolean;
  staged: string[];
}
```

##### POST /git/unstage

Unstage files.

**Request:**
```typescript
{
  projectPath: string;
  files: string[];
}
```

##### POST /git/commit

Create commit.

**Request:**
```typescript
{
  projectPath: string;
  message: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  commit: string;
}
```

##### GET /git/branches

List branches.

**Query:**
- `projectPath` - Repository path

**Response:**
```typescript
{
  branches: string[];
  current: string;
}
```

##### POST /git/checkout

Switch branches.

**Request:**
```typescript
{
  projectPath: string;
  branch: string;
}
```

#### MCP Operations (Model Context Protocol)

All MCP endpoints require `X-Machine-ID` header for machine-specific operations.

##### GET /mcp/cli/list

List installed MCP servers using Claude CLI.

**Headers:**
```
X-Machine-ID: <machine-uuid> (optional, defaults to local)
```

**Response:**
```typescript
{
  success: boolean;
  output: string;
  servers: Array<{
    name: string;
    type: "stdio" | "http" | "sse";
    status: "active";
  }>;
}
```

##### POST /mcp/cli/add

Add an MCP server.

**Headers:**
```
X-Machine-ID: <machine-uuid> (optional, defaults to local)
```

**Request:**
```typescript
{
  name: string;
  type?: "stdio" | "http" | "sse"; // default: "stdio"
  command?: string; // for stdio
  args?: string[]; // for stdio
  url?: string; // for http/sse
  headers?: Record<string, string>; // for http/sse
  env?: Record<string, string>; // for stdio
}
```

**Response:**
```typescript
{
  success: boolean;
  output: string;
  message: string;
}
```

##### DELETE /mcp/cli/remove/:name

Remove an MCP server.

**Parameters:**
- `name` - MCP server name

**Headers:**
```
X-Machine-ID: <machine-uuid> (optional, defaults to local)
```

**Response:**
```typescript
{
  success: boolean;
  output: string;
  message: string;
}
```

##### GET /mcp/cli/get/:name

Get MCP server details.

**Parameters:**
- `name` - MCP server name

**Headers:**
```
X-Machine-ID: <machine-uuid> (optional, defaults to local)
```

**Response:**
```typescript
{
  success: boolean;
  output: string;
  server: {
    name?: string;
    type?: string;
    command?: string;
    url?: string;
    raw_output: string;
  };
}
```

#### Settings

##### GET /settings

Get user settings.

**Response:**
```typescript
{
  theme: "light" | "dark";
  projectSortOrder: "name" | "date";
  enabledTools: string[];
  [key: string]: any;
}
```

##### PUT /settings

Update settings.

**Request:**
```typescript
{
  [key: string]: any;
}
```

## WebSocket API

### Connection Endpoints

#### Web UI WebSocket

```
ws://localhost:3020/ws
wss://your-domain.com/ws
```

Authentication via JWT cookie or token query parameter.

#### Machine WebSocket

```
ws://localhost:3020/machine?token=<api-token>
wss://your-domain.com/machine?token=<api-token>
```

#### Shell WebSocket (Updated: July 19, 2025)

```
ws://localhost:3020/shell?token=<jwt-token>&machineId=<machine-uuid>
wss://your-domain.com/shell?token=<jwt-token>&machineId=<machine-uuid>
```

Query parameters:
- `token` - JWT authentication token (required)
- `machineId` - Target machine UUID (optional, defaults to local)

**Important Fix**: The server now maintains a consistent `shellSessionId` across all shell operations. Previously, each operation generated a new request_id causing session errors.

### Message Format

All messages use JSON with required `type` field:

```typescript
interface Message {
  type: string;
  [key: string]: any;
}
```

### Server → Client Messages

#### request:api

Forward API request to machine.

```typescript
{
  type: "request:api";
  requestId: string;
  data: {
    path: string;
    method: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    body: any;
  }
}
```

#### command:claude

Execute Claude CLI command.

```typescript
{
  type: "command:claude";
  request_id: string;
  command: string;
  options: {
    projectPath?: string;
    sessionId?: string;
  }
}
```

#### register:ack

Acknowledge machine registration.

```typescript
{
  type: "register:ack";
  machine: {
    id: string;
    name: string;
    auth_token: string;
  }
}
```

#### heartbeat:ack

Acknowledge heartbeat.

```typescript
{
  type: "heartbeat:ack";
  timestamp: string;
  serverTime: string;
}
```

### Client → Server Messages

#### machine:register

Register machine with server.

```typescript
{
  type: "machine:register";
  name: string;
  capabilities: string[];
  systemInfo: {
    platform: string;
    release: string;
    arch: string;
    hostname: string;
  }
}
```

#### api:response

Response to API request.

```typescript
{
  type: "api:response";
  requestId: string;
  machine_id: string;
  status: number;
  headers: Record<string, string>;
  data: any;
  error?: string;
}
```

#### claude:response

Stream Claude output.

```typescript
{
  type: "claude:response";
  request_id: string;
  data: string;
  stream: "stdout" | "stderr";
}
```

#### claude:complete

Claude command completed.

```typescript
{
  type: "claude:complete";
  request_id: string;
  code: number;
  signal: string | null;
}
```

#### heartbeat

Keep connection alive.

```typescript
{
  type: "heartbeat";
  timestamp: string;
}
```

## Client API

### Configuration

#### Config File Structure

```typescript
interface ClientConfig {
  serverAddress: string;
  authToken: string;
  clientName: string;
  capabilities: string[];
  reconnectInterval?: number;
  heartbeatInterval?: number;
  logLevel?: "error" | "warn" | "info" | "debug";
}
```

### Handlers

#### API Handler

Processes HTTP-like requests from server.

**Endpoints:**

| Path | Method | Handler |
|------|--------|---------|
| `/projects` | GET | `getProjects()` |
| `/projects/:name/sessions` | GET | `getSessions(name, limit, offset)` |
| `/projects/:name/sessions/:id/messages` | GET | `getSessionMessages(name, id)` |
| `/projects/:name/file` | GET | `readFile(filePath)` |
| `/projects/:name/file` | PUT | `saveFile(filePath, content)` |

#### Projects Handler

Manages Claude project operations.

```typescript
class ProjectsHandler {
  getProjects(): Promise<Project[]>
  getSessions(projectName: string, limit: number, offset: number): Promise<SessionList>
  getSessionMessages(projectName: string, sessionId: string): Promise<Message[]>
}
```

#### Claude Handler

Executes Claude CLI commands.

```typescript
class ClaudeHandler {
  handle(message: ClaudeCommand): void
  abort(sessionId: string): void
}
```

## Data Types

### Common Types

```typescript
// User
interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  createdAt: string;
  lastLogin: string;
}

// Project
interface Project {
  name: string;
  displayName: string;
  path: string;
  lastModified: string;
  created: string;
  sessions?: Session[];
}

// Session
interface Session {
  id: string;
  created: string;
  lastModified: string;
  messageCount: number;
  summary: string;
}

// Message
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// Machine
interface Machine {
  id: string;
  name: string;
  status: "online" | "offline";
  lastSeen: string;
  capabilities: string[];
  ipAddress: string;
  systemInfo?: SystemInfo;
}

// System Info
interface SystemInfo {
  platform: string;
  release: string;
  arch: string;
  hostname?: string;
}

// API Token
interface ApiToken {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

// Git Status
interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
}

// File Status
interface FileStatus {
  path: string;
  status: "M" | "A" | "D" | "R" | "C" | "U";
}
```

## Error Codes

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Auth required |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource missing |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Error | Server error |
| 503 | Service Unavailable | Machine offline |

### Application Error Codes

```typescript
enum ErrorCode {
  // Authentication
  AUTH_REQUIRED = "AUTH_REQUIRED",
  AUTH_INVALID = "AUTH_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
  
  // Machines
  MACHINE_NOT_FOUND = "MACHINE_NOT_FOUND",
  MACHINE_OFFLINE = "MACHINE_OFFLINE",
  
  // Operations
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED",
  INVALID_PATH = "INVALID_PATH",
  
  // Git
  GIT_NOT_REPO = "GIT_NOT_REPO",
  GIT_CONFLICT = "GIT_CONFLICT",
  
  // General
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;
  code?: ErrorCode;
  details?: any;
}
```

## Rate Limits

### Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 | 15 min |
| API calls | 100 | 1 min |
| Token creation | 10 | 1 hour |
| WebSocket messages | 50 | 1 sec |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

## Pagination

### Query Parameters

- `limit` - Items per page (max: 100)
- `offset` - Starting position

### Response Format

```typescript
{
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

## Versioning

API version included in response headers:

```
X-API-Version: 1.0.0
```

Future versions may use URL versioning:

```
/api/v2/...
```

## SDK Examples

### JavaScript/TypeScript

```typescript
class ClaudeUIClient {
  constructor(private baseUrl: string, private token: string) {}

  async getProjects(machineId: string): Promise<Project[]> {
    const response = await fetch(`${this.baseUrl}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'X-Machine-ID': machineId
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.projects;
  }
}
```

### Python

```python
import requests

class ClaudeUIClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}'
        })
    
    def get_projects(self, machine_id):
        response = self.session.get(
            f'{self.base_url}/api/projects',
            headers={'X-Machine-ID': machine_id}
        )
        response.raise_for_status()
        return response.json()['projects']
```

### cURL

```bash
# Get projects
curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Machine-ID: $MACHINE_ID" \
     https://api.claude-ui.com/api/projects

# Create API token
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name": "My Client"}' \
     https://api.claude-ui.com/api/auth/tokens
```