# Product Requirements Document: Multi-Machine Management for Claude Code UI

## Document Information
- **Feature Name**: Multi-Machine Management
- **Version**: 1.0
- **Date**: 2025-06-25
- **Status**: Draft
- **Author**: Claude Code UI Team

## Executive Summary
This PRD outlines the implementation of a multi-machine management system for Claude Code UI, enabling users to manage multiple computers from a single interface. The feature introduces a client-server architecture where lightweight agents run on remote machines and connect to a central UI server.

## Problem Statement
Currently, Claude Code UI operates as a single-machine application, limiting users who work across multiple development environments. Users need to:
- Access Claude Code projects across different machines (laptop, desktop, servers)
- Switch between machines seamlessly without losing context
- Monitor the status of multiple development environments
- Maintain security while accessing remote machines

## Goals and Objectives
1. **Enable multi-machine connectivity** - Allow multiple machines to connect to a single Claude Code UI instance
2. **Provide seamless switching** - Users can switch between machines with minimal friction
3. **Maintain feature parity** - All existing features work across all connected machines
4. **Ensure security** - Implement proper authentication and encryption
5. **Support offline scenarios** - Handle disconnections gracefully

## User Stories
1. **As a developer**, I want to connect my laptop and desktop to the same Claude Code UI so I can work from either machine
2. **As a team lead**, I want to monitor Claude Code sessions across multiple development servers
3. **As a user**, I want to see which machines are online/offline at a glance
4. **As a security-conscious user**, I want secure connections between my machines and the UI server
5. **As an administrator**, I want to remove old machines that are no longer in use

## Functional Requirements

### 1. Machine Management

#### 1.1 Machine Registration
- Client agents can register with the server using configurable environment variables
- Each machine receives a unique identifier and authentication token
- Machine names can be customized via `CLAUDE_CODE_UI_CLIENT_NAME` env var
- Default machine name falls back to hostname or IP address

#### 1.2 Machine Discovery & Status
- UI displays all registered machines in a dropdown selector
- Real-time status indicators show online/offline state
- Last seen timestamp for offline machines
- Machines persist in the database even when offline

#### 1.3 Machine Selection & Switching
- Machine selector dropdown positioned above project selector
- Switching machines updates all dependent UI components
- Selected machine persists across sessions
- Clear visual indication of currently selected machine

#### 1.4 Machine Removal
- Users can remove offline machines from the list
- Confirmation dialog prevents accidental removal
- Soft delete allows restoration if needed
- Cannot remove currently online machines

### 2. Client Agent

#### 2.1 Core Functionality
- Lightweight Node.js application
- Connects to server via WebSocket
- Monitors local Claude CLI projects
- Executes commands on behalf of the server
- Handles file system operations
- Proxies git commands

#### 2.2 Configuration
- `CLAUDE_CODE_UI_SERVER_ADDRESS` - Server connection URL
- `CLAUDE_CODE_UI_CLIENT_NAME` - Custom machine name
- Auto-discovery of server if not specified
- Configuration via environment variables or command-line flags

#### 2.3 Connection Management
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Heartbeat mechanism for connection health
- Graceful shutdown handling

### 3. Server Enhancements

#### 3.1 Machine Registry
- MachineManager class handles all machine connections
- SQLite database stores machine information
- WebSocket connection mapping per machine
- Message routing based on machine ID

#### 3.2 Protocol Extensions
- Machine-aware message format with machine_id header
- Protocol version negotiation
- Backward compatibility with single-machine setup
- Machine status broadcasts to all UI clients

### 4. UI Components

#### 4.1 Machine Selector Component
```
┌─────────────────────────────┐
│ ▼ Machine: dev-laptop    ●  │
├─────────────────────────────┤
│ ● dev-laptop          [✓]  │
│ ● prod-server              │
│ ○ home-desktop        [×]  │
│ ○ old-machine         [×]  │
├─────────────────────────────┤
│ + Add New Machine          │
└─────────────────────────────┘
```

#### 4.2 Machine Status Bar
- Current machine name and status
- Connection quality indicator
- Last sync timestamp
- Quick reconnect action

### 5. Security Requirements

#### 5.1 Authentication
- Machine-specific authentication tokens
- Token storage in secure database
- Option for shared secret authentication
- Token rotation mechanism

#### 5.2 Encryption
- TLS/SSL for all client-server communication
- Certificate pinning option
- Encrypted storage for sensitive data

#### 5.3 Authorization
- Machine-level access control
- Read-only mode option
- Command execution restrictions

## Non-Functional Requirements

### 1. Performance
- Machine switching latency < 500ms
- Support for 10+ simultaneous machine connections
- Message routing overhead < 10ms
- Efficient file transfer for large files

### 2. Reliability
- 99.9% uptime for server component
- Automatic recovery from network failures
- No data loss during disconnections
- Graceful degradation to single-machine mode

### 3. Scalability
- Architecture supports 100+ machines (future)
- Database design allows for growth
- Connection pooling for efficiency
- Monitoring and metrics collection

### 4. Usability
- Intuitive machine selector UI
- Clear status indicators
- Helpful error messages
- Simple client installation process

## Technical Architecture

### System Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   UI Browser    │     │  Central Server │     │ Client Machine 1│
│                 │◄───►│                 │◄───►│ - Claude CLI    │
│ [Machine ▼]    │ WS  │ MachineManager  │ WS  │ - Client Agent  │
│ [Project ▼]    │     │ MessageRouter   │     │ - Local FS      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                  │                        
                                  │ WS            ┌─────────────────┐
                                  └──────────────►│ Client Machine 2│
                                                  │ - Claude CLI    │
                                                  │ - Client Agent  │
                                                  │ - Local FS      │
                                                  └─────────────────┘
```

### Database Schema
```sql
CREATE TABLE machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP,
  first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  capabilities TEXT, -- JSON array
  metadata TEXT, -- JSON object
  is_removed BOOLEAN DEFAULT 0,
  removed_at TIMESTAMP,
  auth_token TEXT,
  UNIQUE(name)
);
```

### Message Protocol
```json
// Machine Registration
{
  "type": "machine_register",
  "machine_id": "uuid",
  "client_name": "dev-laptop",
  "capabilities": ["claude-cli", "git", "file-access"],
  "version": "1.0"
}

// Standard Message with Machine ID
{
  "type": "command",
  "machine_id": "uuid",
  "data": { ... }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- WebSocket protocol extensions
- Machine registry implementation
- Basic client agent
- Database schema

### Phase 2: Client Development (Week 3-4)
- Full client agent implementation
- Connection management
- Command execution
- File system operations

### Phase 3: UI Integration (Week 5-6)
- Machine selector component
- Status indicators
- State management updates
- API modifications

### Phase 4: Security & Polish (Week 7-8)
- Authentication implementation
- Encryption setup
- Error handling
- Performance optimization

### Phase 5: Testing & Documentation (Week 9-10)
- Comprehensive test suite
- Deployment packages
- User documentation
- Migration guide

## Success Metrics
1. **Adoption Rate** - 50% of users enable multi-machine features within 3 months
2. **Reliability** - < 0.1% connection failure rate
3. **Performance** - 95% of machine switches complete in < 500ms
4. **User Satisfaction** - > 4.5/5 rating for the feature
5. **Security** - Zero security incidents in first 6 months

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex deployment | High | Provide one-click installers and clear documentation |
| Security vulnerabilities | High | Security audit, penetration testing, encryption |
| Performance degradation | Medium | Load testing, connection pooling, caching |
| Network reliability | Medium | Robust reconnection logic, offline queue |
| User confusion | Low | Clear UI, helpful onboarding, video tutorials |

## Future Considerations
1. **Mobile app support** - Native mobile apps as clients
2. **Cloud sync** - Backup machine configurations to cloud
3. **Team sharing** - Share machines within teams
4. **Advanced routing** - Load balancing across machines
5. **Plugin system** - Third-party client extensions

## Appendices

### A. API Changes
- All existing APIs will accept optional `machine_id` parameter
- New `/api/machines` endpoints for machine management
- WebSocket protocol version bumped to 2.0

### B. Migration Plan
1. Deploy backward-compatible server update
2. Gradual rollout with feature flag
3. Provide migration tools for existing users
4. Maintain legacy support for 6 months

### C. Security Considerations
- Follow OWASP guidelines for web security
- Implement rate limiting and DDoS protection
- Regular security audits and updates
- Compliance with data protection regulations

---

## Sign-off
- [ ] Product Manager
- [ ] Engineering Lead
- [ ] Security Team
- [ ] UX Designer
- [ ] QA Lead