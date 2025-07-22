# PRD: roiAI CLI Local Sync Integration with CCMCC

## Executive Summary

This PRD outlines the integration of roiAI CLI's cloud sync functionality with Claude Code Mission Control Center (CCMCC) to enable local-first data synchronization. Instead of pushing AI usage data to roiAI's cloud service, the integration will redirect data to CCMCC's existing client-server architecture, maintaining complete data privacy and control.

## Problem Statement

### Current Situation
- roiAI CLI collects Claude Code usage data and syncs it to their cloud service
- Users want to use roiAI's analytics features but keep data local
- CCMCC already provides a robust local client-server architecture
- Forking and maintaining roiAI CLI would create technical debt

### Requirements
1. Use roiAI CLI without modifications (no forking)
2. Redirect cloud sync to CCMCC's local infrastructure
3. Maintain compatibility with roiAI's data format and protocols
4. Preserve all roiAI CLI functionality
5. Enable seamless authentication bridging
6. Display roiAI CLI analytics output in CCMCC web UI

## Solution Architecture

### High-Level Design

```
┌─────────────┐     HTTP API      ┌──────────────┐     WebSocket    ┌──────────────┐
│ roiAI CLI   │ ───────────────> │ CCMCC Server │ ───────────────> │ CCMCC Client │
│             │                   │ (API Bridge) │                  │  (Machines)  │
└─────────────┘                   └──────────────┘                  └──────────────┘
     |                                    |
     v                                    v
[config/local.json]              [/api/v1/cli/*]
 baseUrl override                 roiAI-compatible
                                     endpoints
```

### Integration Approach

**Configuration-Based Redirection**: Leverage roiAI CLI's existing configuration system to redirect API calls without code modifications.

## Technical Specification

### 1. roiAI CLI Configuration

Create `~/.roiai/config/local.json`:
```json
{
  "api": {
    "baseUrl": "http://localhost:3020"
  }
}
```

This overrides the default `https://api.roiai.fyi` endpoint.

### 2. CCMCC Server API Endpoints

Implement roiAI-compatible endpoints in CCMCC server:

#### POST `/api/v1/cli/login`
- **Purpose**: Authenticate roiAI CLI users
- **Request**: `{ email: string, password: string }`
- **Response**: `{ success: true, data: { apiKey: string, user: {...} } }`
- **Implementation**: 
  - Map to CCMCC user accounts
  - Generate JWT-compatible API token
  - Store roiAI-to-CCMCC user mapping

#### GET `/api/v1/cli/health`
- **Purpose**: Verify authentication and machine status
- **Response**: `{ authenticated: boolean, user: {...}, machine: {...} }`
- **Implementation**:
  - Validate API token
  - Return mapped user and machine info

#### POST `/api/v1/cli/upsync`
- **Purpose**: Receive batched usage data
- **Request**: 
  ```typescript
  {
    messages: MessageEntity[],
    entities: {
      machines: { [id: string]: MachineEntity },
      projects: { [id: string]: ProjectEntity },
      sessions: { [id: string]: SessionEntity }
    }
  }
  ```
- **Response**: 
  ```typescript
  {
    results: {
      persisted: { count: number, messageIds: string[] },
      deduplicated: { count: number, messageIds: string[] },
      failed: { count: number, details: FailureDetail[] }
    }
  }
  ```
- **Implementation**:
  - Parse batch data
  - Translate to WebSocket messages
  - Forward to appropriate CCMCC clients
  - Track sync status for response

### 3. Data Translation Layer

#### Entity Mapping
- **Machine IDs**: Map roiAI machine IDs to CCMCC client IDs
- **User IDs**: Bridge roiAI user IDs to CCMCC user accounts
- **Project/Session IDs**: Maintain mapping table for consistency

#### Message Format Translation
```typescript
// roiAI Format (Batch)
interface MessageEntity {
  id: string;
  sessionId: string;
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  messageCost: number;
  // ... other fields
}

// CCMCC Format (WebSocket)
interface CCMCCMessage {
  type: 'claude-usage';
  machineId: string;
  data: {
    timestamp: string;
    model: string;
    tokens: { input: number, output: number };
    cost: number;
  }
}
```

### 4. Authentication Bridge

1. **Login Flow**:
   - roiAI CLI sends email/password to `/api/v1/cli/login`
   - CCMCC server validates or creates user account
   - Generate API token compatible with Bearer auth
   - Return roiAI-expected response format

2. **Token Management**:
   - Store tokens in CCMCC database with roiAI metadata
   - Support token revocation via logout endpoint
   - Implement token expiration if needed

### 5. Response Compatibility

Ensure all responses match roiAI's expected format:
- Wrap all responses in `{ success: boolean, data?: any, error?: any }`
- Use exact field names and types from roiAI's OpenAPI spec
- Handle error codes and validation errors appropriately

### 6. Web UI Integration

#### Navigation Bar Updates

**CCMCC Icon**: Replace the current icon with a space shuttle icon (side view). This aligns perfectly with the "Mission Control Center" theme and provides a distinctive, professional appearance.

#### Stats Display Modal

Add a stats icon button to the CCMCC web UI navigation bar to display roiAI CLI analytics output.

**UI Location**: Top-right of the left navigation panel, parallel to the "add project" button

**Implementation Details**:

1. **Stats Icon Button**:
   - Position: Right side of "CCMCC" / "Mission Control Center" header
   - Icon: Chart/Analytics icon (e.g., bar chart or line graph)
   - Tooltip: "View Usage Analytics"
   - Style: Consistent with existing UI buttons

2. **Analytics Modal**:
   - **Title**: "Claude Code Usage Analytics"
   - **Content**: Terminal-style display showing roiAI CLI output
   - **Features**:
     - Non-interactive, read-only display
     - Scrollable for long output
     - Dark terminal theme with syntax highlighting
     - Copy-to-clipboard button
     - Refresh button to re-run sync

3. **Terminal Display Component**:
   ```typescript
   interface TerminalDisplayProps {
     output: string;
     isLoading: boolean;
     lastUpdated: Date;
   }
   ```

4. **Data Flow**:
   - Click stats icon → Server executes `roiai cc sync` command
   - Capture CLI output with ANSI color codes
   - Convert ANSI to HTML/CSS for display
   - Cache output for quick re-display

5. **API Endpoint**:
   ```
   GET /api/analytics/usage
   Response: {
     output: string,      // CLI output with ANSI codes
     timestamp: string,   // When sync was run
     cached: boolean      // If this is cached data
   }
   ```

6. **Visual Design**:
   ```
   ┌─────────────────────────────────────────┐
   │ Claude Code Usage Analytics        [X] │
   ├─────────────────────────────────────────┤
   │ ┌─────────────────────────────────────┐ │
   │ │ $ roiai cc sync                     │ │
   │ │                                     │ │
   │ │ 🔄 Incremental Changes:             │ │
   │ │    + New projects: project-abc      │ │
   │ │    + New sessions: 3 session(s)     │ │
   │ │    + New messages: 127              │ │
   │ │                                     │ │
   │ │ 📊 Sync Results                     │ │
   │ │    Projects processed: 5            │ │
   │ │    Sessions processed: 42           │ │
   │ │    Messages processed: 1,234        │ │
   │ │                                     │ │
   │ │ 💵 Total Cost: $12.45               │ │
   │ └─────────────────────────────────────┘ │
   │                                         │
   │ Last updated: 2 minutes ago    [Refresh]│
   └─────────────────────────────────────────┘
   ```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create roiAI-compatible route group in CCMCC server
- [ ] Implement basic health check endpoint
- [ ] Set up request/response logging for debugging
- [ ] Test configuration override with roiAI CLI

### Phase 2: Authentication (Week 2)
- [ ] Implement login endpoint with user mapping
- [ ] Create API token generation and validation
- [ ] Add logout endpoint for token revocation
- [ ] Test full authentication flow

### Phase 3: Data Sync (Week 3)
- [ ] Implement upsync endpoint with batch parsing
- [ ] Create WebSocket message translation layer
- [ ] Add entity ID mapping and storage
- [ ] Implement response tracking and formatting

### Phase 4: Web UI Integration (Week 4)
- [ ] Add stats icon button to navigation bar
- [ ] Create terminal display modal component
- [ ] Implement ANSI-to-HTML converter
- [ ] Add analytics API endpoint
- [ ] Cache management for analytics output

### Phase 5: Testing & Polish (Week 5)
- [ ] End-to-end testing with real Claude Code data
- [ ] Performance optimization for large batches
- [ ] Error handling and edge cases
- [ ] Documentation and user guide
- [ ] UI/UX testing for analytics modal

## Success Metrics

1. **Functional Success**:
   - roiAI CLI sync completes without errors
   - All usage data appears in CCMCC dashboard
   - Authentication works seamlessly

2. **Performance Metrics**:
   - Batch processing < 5 seconds for 1000 messages
   - No data loss during translation
   - Minimal memory overhead

3. **User Experience**:
   - Single configuration change to enable
   - No behavioral changes in roiAI CLI
   - Clear error messages if issues occur

## Risks and Mitigations

### Risk 1: API Compatibility
- **Risk**: roiAI updates their API format
- **Mitigation**: Version detection and compatibility layer

### Risk 2: Authentication Complexity
- **Risk**: Token format mismatch causes auth failures
- **Mitigation**: Comprehensive token validation testing

### Risk 3: Performance with Large Datasets
- **Risk**: Batch processing overwhelms server
- **Mitigation**: Implement streaming and pagination

### Risk 4: Data Format Evolution
- **Risk**: New fields or entities in roiAI format
- **Mitigation**: Flexible schema handling with defaults

## Configuration Instructions for Users

1. Install roiAI CLI normally:
   ```bash
   npm install -g roiai
   ```

2. Create local configuration:
   ```bash
   mkdir -p ~/.roiai/config
   echo '{"api":{"baseUrl":"http://localhost:3020"}}' > ~/.roiai/config/local.json
   ```

3. Login using CCMCC credentials:
   ```bash
   roiai cc login
   # Use your CCMCC email and password
   ```

4. Use roiAI CLI normally:
   ```bash
   roiai cc sync
   roiai cc push
   ```

## Future Enhancements

1. **Bi-directional Sync**: Pull data from CCMCC back to roiAI format
2. **Multi-Machine Support**: Sync across multiple CCMCC clients
3. **Filtering Options**: Selective sync based on projects or time ranges
4. **Offline Queue**: Store sync requests when server unavailable

## Conclusion

This integration provides a clean, maintainable solution for using roiAI CLI with local data storage through CCMCC. By leveraging configuration overrides and API compatibility layers, we avoid forking while maintaining full functionality and data privacy.