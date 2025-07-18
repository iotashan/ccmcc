# Claude Code UI Architecture

## Overview

Claude Code UI implements a distributed 3-tier architecture that enables secure remote control of Claude CLI instances across multiple machines. The system consists of three main components that communicate through well-defined protocols.

## Architecture Diagram

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│   Web UI            │         │   Server            │         │   Client            │
│   (Browser)         │◄───────►│ (Central Hub)       │◄───────►│  (Remote Machine)   │
│                     │  HTTPS  │                     │   WS    │                     │
├─────────────────────┤         ├─────────────────────┤         ├─────────────────────┤
│ • React SPA         │         │ • Express Server    │         │ • Node.js Client    │
│ • JWT Auth          │         │ • WebSocket Hub     │         │ • API Token Auth    │
│ • Machine Selector  │         │ • Auth Manager      │         │ • Claude CLI        │
│ • Project Browser   │         │ • Request Router    │         │ • File System       │
│ • Chat Interface    │         │ • Machine Registry  │         │ • Git Operations    │
└─────────────────────┘         └─────────────────────┘         └─────────────────────┘
```

## Component Details

### 1. Web UI (Frontend)

The Web UI is a React-based single-page application that provides the user interface for Claude Code UI.

**Key Features:**
- **Authentication**: Uses JWT tokens for secure user sessions
- **Machine Selection**: Allows users to choose which connected client to control
- **Project Management**: Browse and manage Claude Code projects across machines
- **Chat Interface**: Interactive chat with Claude for coding assistance
- **File Explorer**: View and edit files on remote machines
- **Git Integration**: Manage git repositories on remote machines

**Technology Stack:**
- React 18 with hooks
- Vite for build tooling
- Tailwind CSS for styling
- CodeMirror for code editing
- WebSocket for real-time communication

### 2. Server (Central Hub)

The server acts as the central coordinator, managing connections between web clients and machine clients.

**Core Responsibilities:**
- **Authentication Management**: 
  - JWT authentication for web UI users
  - API token authentication for machine clients
  - Dual auth system prevents unauthorized access
- **Connection Management**:
  - Maintains WebSocket connections with all clients
  - Tracks machine status and availability
  - Handles reconnection logic
- **Request Routing**:
  - Routes API requests from web UI to appropriate machine clients
  - Uses `X-Machine-ID` header to identify target machine
  - Forwards responses back to web UI
- **Data Persistence**:
  - SQLite database for users, tokens, and machine registry
  - Session management and audit logging

**API Endpoints:**
- `/api/auth/*` - Authentication endpoints
- `/api/machines/*` - Machine management
- `/api/projects/*` - Project operations (forwarded to clients)
- `/api/sessions/*` - Session management (forwarded to clients)
- `/api/git/*` - Git operations (forwarded to clients)

### 3. Client (Machine Agent)

The client runs on machines with Claude CLI installed and acts as the execution agent.

**Core Functions:**
- **Server Connection**: Maintains persistent WebSocket connection to server
- **Authentication**: Uses API token for secure machine identification
- **Command Execution**:
  - Executes Claude CLI commands
  - Handles file system operations
  - Performs git operations
- **API Handling**:
  - Processes forwarded API requests from server
  - Returns results through WebSocket connection

**Handlers:**
- `apiHandler.js` - Processes general API requests
- `projects.js` - Manages Claude project operations
- `claude.js` - Executes Claude CLI commands

## Communication Flow

### 1. Web UI to Server Communication

```
Web UI → HTTP/WebSocket → Server
```

- **Protocol**: HTTPS for API calls, WSS for real-time updates
- **Authentication**: JWT token in Authorization header
- **Format**: JSON request/response

Example request:
```javascript
// Web UI sends request with machine ID header
fetch('/api/projects', {
  headers: {
    'Authorization': 'Bearer <jwt-token>',
    'X-Machine-ID': 'machine-uuid'
  }
})
```

### 2. Server to Client Communication

```
Server → WebSocket → Client
```

- **Protocol**: WebSocket for bidirectional communication
- **Authentication**: API token validated on connection
- **Message Format**: JSON with type-based routing

Example message flow:
```javascript
// Server forwards request to client
{
  type: 'request:api',
  requestId: 'uuid',
  data: {
    path: '/projects',
    method: 'GET',
    headers: {...},
    query: {...}
  }
}

// Client responds
{
  type: 'api:response',
  requestId: 'uuid',
  status: 200,
  data: {...}
}
```

### 3. Complete Request Flow

1. **User Action**: User clicks "View Projects" in Web UI
2. **Web UI Request**: Sends GET /api/projects with X-Machine-ID header
3. **Server Processing**:
   - Validates JWT token
   - Identifies target machine from header
   - Creates request message with unique ID
4. **Server Forward**: Sends WebSocket message to target client
5. **Client Processing**:
   - Receives WebSocket message
   - Executes local operation (read projects from ~/.claude/projects)
   - Sends response via WebSocket
6. **Server Response**: Forwards client response to Web UI
7. **UI Update**: Web UI displays projects to user

## Security Model

### Authentication Layers

1. **Web UI Authentication**:
   - Username/password login
   - JWT tokens with expiration
   - Secure HTTP-only cookies
   - CORS protection

2. **Client Authentication**:
   - API tokens generated by server
   - SHA-256 hashed storage
   - Token validation on each connection
   - Machine-specific permissions

### Security Best Practices

- **No Direct Client Access**: Web UI never connects directly to clients
- **Token Isolation**: JWT tokens and API tokens are completely separate
- **Request Validation**: All requests validated at server before forwarding
- **Encrypted Communication**: HTTPS/WSS for all connections
- **Permission Scoping**: Clients declare capabilities during registration

## Deployment Architecture

### Development Setup

```
┌──────────────┐
│   Browser    │
│ localhost:   │
│    3021      │
└──────┬───────┘
       │
┌──────▼───────┐     ┌─────────────┐
│   Server     │◄────┤   Client    │
│ localhost:   │     │  (local)    │
│    3020      │     └─────────────┘
└──────────────┘
```

### Production Setup

```
┌──────────────┐
│   Browser    │
│  (anywhere)  │
└──────┬───────┘
       │ HTTPS
┌──────▼───────┐     ┌─────────────┐
│   Server     │◄────┤  Client 1   │
│  (Cloud)     │ WSS │  (Office)   │
│              │     └─────────────┘
│              │     ┌─────────────┐
│              │◄────┤  Client 2   │
│              │     │   (Home)    │
└──────────────┘     └─────────────┘
```

## Scalability Considerations

### Current Limitations

- Single server instance (no clustering)
- In-memory machine registry (lost on restart)
- SQLite database (single writer limitation)

### Future Enhancements

1. **Horizontal Scaling**:
   - Redis for session/machine state
   - Load balancer for multiple server instances
   - Sticky sessions for WebSocket connections

2. **High Availability**:
   - Database replication
   - Client auto-reconnection
   - Graceful failover

3. **Performance Optimization**:
   - Request batching
   - Response caching
   - Connection pooling

## Message Protocol

See [websocket-protocol.md](./websocket-protocol.md) for detailed message format documentation.

## API Reference

See [api-reference.md](./api-reference.md) for complete API documentation.