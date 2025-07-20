# Product Requirements Document: Claude Code Hooks Integration

## Executive Summary

This PRD outlines the implementation of a Claude Code hooks integration feature for the Claude Code UI (CCUI) project. The feature enables real-time session status tracking and notifications without polluting user project hooks, utilizing a temporary hook injection mechanism.

## Background & Problem Statement

### Current State
- Claude Code UI manages multiple remote machines running Claude CLI
- No visibility into active Claude sessions or their status
- Users must manually check if Claude is processing or waiting
- Alert-based notifications disrupt user experience

### Problem
- Users cannot see which projects have active Claude sessions
- No indication when Claude completes processing or needs input
- Current notification system uses intrusive browser alerts
- Risk of polluting user's actual project hooks with tracking code

## Goals & Non-Goals

### Goals
1. Provide real-time visibility of Claude session status
2. Show visual indicators for active sessions on projects/machines
3. Implement non-intrusive notification system
4. Maintain clean separation from user's project hooks
5. Enable future push notification capabilities

### Non-Goals
1. Modifying Claude CLI itself
2. Storing session history long-term
3. Analytics or metrics collection
4. Cross-user session visibility

## User Stories

### As a Developer
- I want to see which machines have active Claude projects
- I want to see which projects have active Claude sessions
- I want notifications when Claude completes tasks or needs input
- I want my project's hook configuration to remain untouched

### As a Team Lead
- I want to monitor Claude activity across my machines
- I want to ensure no interference with existing CI/CD hooks

## Functional Requirements

### 1. Hook Injection System

#### 1.1 Settings Management
- Create/backup `.claude/settings.local.json` before Claude execution
- Inject custom hooks configuration dynamically
- Restore original settings after Claude starts
- Handle missing files and permission errors gracefully

#### 1.2 Hook Configuration
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-session-start.js"
      }]
    }],
    "PreToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-tool-pending.js"
      }]
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-tool-complete.js"
      }]
    }],
    "SubagentStop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-subagent-done.js"
      }]
    }],
    "Notification": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-notification.js"
      }]
    }],
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/claude-session-end.js"
      }]
    }]
  }
}
```

### 2. Custom Hook Scripts

#### 2.1 Session Start Hook (`claude-session-start.js`)
- Parse stdin JSON from Claude
- Extract project path and session info
- Send HTTP POST to local server endpoint
- Include authentication token
- Exit with code 0 for normal flow

#### 2.2 Tool Pending Hook (`claude-tool-pending.js`)
- Triggered when Claude is about to use a tool
- Extract tool name and parameters
- Send status update indicating "waiting_tool_confirmation"
- Track which tools are pending approval

#### 2.3 Tool Complete Hook (`claude-tool-complete.js`)
- Triggered after tool execution completes
- Include tool execution result status
- Update session state to "active" or next appropriate state

#### 2.4 Subagent Done Hook (`claude-subagent-done.js`)
- Triggered when subagent completes its task
- Track parallel task completion
- Update session with subagent results

#### 2.5 Notification Hook (`claude-notification.js`)
- Capture system notifications and errors
- Handle special states like context compaction
- Send appropriate UI notifications

#### 2.6 Session End Hook (`claude-session-end.js`)
- Similar to start hook
- Include session duration and completion status
- Handle both successful and error completions

### 3. WebSocket Protocol Extension

#### 3.1 New Message Types
```javascript
// Client → Server
{
  "type": "claude:session:start",
  "machineId": "uuid",
  "projectPath": "/path/to/project",
  "sessionId": "session-uuid",
  "timestamp": "ISO-8601"
}

{
  "type": "claude:session:end",
  "machineId": "uuid",
  "projectPath": "/path/to/project",
  "sessionId": "session-uuid",
  "duration": 12345,
  "status": "completed|error|interrupted",
  "timestamp": "ISO-8601"
}

// Server → Web UI
{
  "type": "claude:session:update",
  "sessions": {
    "machine-uuid": {
      "project-path": {
        "sessionId": "session-uuid",
        "status": "active|waiting_user_input|waiting_tool_confirmation|streaming|error|completed",
        "waitingCount": 0,  // Number of sessions waiting on this machine
        "currentTool": "tool-name",  // When waiting_tool_confirmation
        "errorMessage": "error details",  // When status is error
        "startTime": "ISO-8601",
        "lastUpdate": "ISO-8601"
      }
    },
    "waitingSessions": {
      "machine-uuid": 3  // Total waiting sessions per machine
    }
  }
}
```

### 4. UI Components

#### 4.1 Toast Notification System
- Non-blocking notifications with auto-dismiss
- Support types: info, success, warning, error
- Stack multiple notifications
- Click to dismiss
- Configurable position and duration

#### 4.2 Status Indicators
- Pulsing dot for active sessions
- Color coding: blue (active), yellow (waiting), gray (inactive)
- Tooltip showing session details
- Integration points:
  - Project list items
  - Machine status cards
  - Project detail header

#### 4.3 Machine Picker Notification Badge
- Display count of waiting sessions on machine selector button
- Red badge with white number (e.g., "3") when sessions are waiting
- Hide badge when count is zero
- Update in real-time based on WebSocket messages
- Click on badge to open machine list with details

#### 4.4 Machine List Session Indicators
- Each machine card shows waiting session count badge
- Visual hierarchy: larger badge for machines with more waiting sessions
- Color coding: 
  - Red badge: sessions waiting for user input
  - Yellow badge: sessions in progress but not waiting
  - No badge: no active sessions
- Tooltip shows breakdown by project when hovering over badge

### 5. Server Endpoints

#### 5.1 Hook Communication Endpoint
```
POST /api/hooks/session
Authorization: Bearer <hook-token>
{
  "event": "start|end|tool_pending|tool_complete|subagent_done|notification",
  "machineId": "uuid",
  "projectPath": "/path",
  "sessionId": "uuid",
  "metadata": {
    "toolName": "tool-name",  // For tool events
    "toolParams": {},         // Tool parameters
    "notificationType": "info|warning|error",  // For notifications
    "message": "notification text",
    "subagentId": "subagent-uuid"  // For subagent events
  }
}
```

## Technical Architecture

### Component Diagram
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web UI        │────▶│    Server       │────▶│  Machine Client │
│                 │◀────│                 │◀────│                 │
│ - Toast System  │     │ - WebSocket Hub │     │ - Hook Injector │
│ - Status Icons  │     │ - Hook Endpoint │     │ - Claude Runner │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Claude CLI     │
                                                 │  with Hooks     │
                                                 └─────────────────┘
```

### Sequence Diagram
```
User        Web UI      Server      Machine     Claude
 │            │           │           │           │
 │─ Start ───▶│           │           │           │
 │  Session   │──────────▶│           │           │
 │            │           │──────────▶│           │
 │            │           │           │─ Inject ─▶│
 │            │           │           │  Hooks    │
 │            │           │           │           │
 │            │           │           │─ Start ──▶│
 │            │           │           │  Claude   │
 │            │           │◀─ Hook ───│◀─ Event ──│
 │            │◀─ Update ─│  Message  │           │
 │◀─ Show ────│           │           │           │
 │  Status    │           │           │           │
 │            │           │           │           │
 │            │           │◀─ Hook ───│◀─ Done ───│
 │            │◀─ Update ─│  Message  │           │
 │◀─ Notify ──│           │           │           │
 │            │           │           │─ Restore ▶│
 │            │           │           │  Settings │
```

## Security Considerations

### 1. Hook Authentication
- Generate unique tokens for hook-to-server communication
- Validate tokens in server endpoint
- Rotate tokens periodically

### 2. Input Validation
- Sanitize all hook inputs
- Validate JSON structure
- Prevent command injection

### 3. File System Security
- Use atomic file operations
- Validate file paths
- Handle permission errors gracefully

## Performance Requirements

### 1. Latency
- Hook execution: < 50ms overhead
- Status updates: < 100ms end-to-end
- UI updates: < 16ms (60fps)

### 2. Resource Usage
- Minimal CPU overhead during idle
- Hook scripts: < 10MB memory
- No persistent background processes

## Testing Strategy

### 1. Unit Tests
- Hook injection/restoration logic
- Settings file manipulation
- WebSocket message handling
- UI component behavior

### 2. Integration Tests
- End-to-end hook execution flow
- WebSocket communication
- Multi-machine scenarios
- Error recovery paths

### 3. User Acceptance Tests
- Visual indicators appear correctly
- Notifications are non-intrusive
- No interference with existing hooks
- Performance meets requirements

## Success Metrics

### 1. Technical Metrics
- 100% settings restoration success rate
- < 100ms notification latency
- Zero pollution of user hooks
- 99.9% uptime for hook system

### 2. User Metrics
- Reduced support tickets about session status
- Positive user feedback on notifications
- Increased Claude usage due to better visibility

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Build hook injection system
2. Create hook scripts
3. Implement server endpoint
4. Extend WebSocket protocol

### Phase 2: UI Components (Week 3)
1. Build toast notification system
2. Create status indicator component
3. Replace existing alert() calls
4. Integrate with existing UI

### Phase 3: Integration & Polish (Week 4)
1. Full system integration
2. Edge case handling
3. Performance optimization
4. Documentation

## Risk Mitigation

### 1. Technical Risks
- **Risk**: Hook injection fails
  - **Mitigation**: Fallback to polling-based updates
- **Risk**: Race conditions during file operations
  - **Mitigation**: Use file locking and atomic operations

### 2. User Experience Risks
- **Risk**: Notifications become annoying
  - **Mitigation**: User preferences and rate limiting
- **Risk**: Performance degradation
  - **Mitigation**: Feature flag for gradual rollout

## Future Enhancements

1. **Push Notifications**
   - Browser Notification API integration
   - Mobile app notifications

2. **External Integrations**
   - Slack/Discord webhooks
   - Email notifications
   - Custom webhook support

3. **Analytics & Insights**
   - Session duration tracking
   - Usage patterns analysis
   - Performance metrics dashboard

4. **Advanced Features**
   - Multi-machine session coordination
   - Session history and replay
   - Collaborative session indicators

## Appendix

### A. Hook Script Example
```javascript
#!/usr/bin/env node
const https = require('https');

// Parse stdin
let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(inputData);
  
  // Send to server
  const req = https.request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/hooks/session',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CCUI_HOOK_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  
  req.write(JSON.stringify({
    event: 'start',
    machineId: process.env.CCUI_MACHINE_ID,
    projectPath: data.cwd,
    sessionId: data.sessionId
  }));
  
  req.end();
  process.exit(0);
});
```

### B. Configuration Files
- `/src/utils/claudeHooks.js` - Hook injection logic
- `/hooks/` - Hook script directory
- `/shared/protocol.js` - WebSocket message types
- `/src/components/ui/Toast.jsx` - Notification component