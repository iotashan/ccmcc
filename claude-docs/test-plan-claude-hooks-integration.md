# Test Plan: Claude Code Hooks Integration Feature

## Overview

This test plan covers comprehensive testing of the Claude Code hooks integration feature that provides real-time session status tracking and UI notifications. Testing will progress from local server instances to multi-machine remote client scenarios.

## Test Environment Setup

### Prerequisites
- Claude Code UI server running (default port 3002)
- Claude CLI installed and accessible
- At least one test project with Claude sessions
- Browser with developer tools for debugging

### Test Data Setup
```bash
# Create test project directory
mkdir ~/test-claude-project
cd ~/test-claude-project
echo "# Test Project" > README.md

# Initialize Claude session
claude --model sonnet "Hello, can you help me test the hooks integration?"
```

## Phase 1: Local Server Testing

### 1.1 Hook Injection System Tests

#### Test Case 1.1.1: Basic Hook Injection
**Objective**: Verify hooks are properly injected into `.claude/settings.local.json`

**Steps**:
1. Navigate to test project directory
2. Ensure no existing `.claude/settings.local.json` file
3. Start a new Claude session through CCUI
4. Check that `.claude/settings.local.json` was created with hooks configuration

**Expected Results**:
- File created at `.claude/settings.local.json`
- Contains 6 hook configurations (start, end, tool_pending, tool_complete, subagent_stop, notification)
- Each hook points to correct script in CCUI installation
- Authentication token present in hook configuration

**Verification**:
```bash
cat ~/test-claude-project/.claude/settings.local.json | jq '.hooks'
```

#### Test Case 1.1.2: Settings Backup and Restore
**Objective**: Verify existing settings are preserved

**Pre-setup**:
```bash
mkdir -p ~/test-claude-project/.claude
echo '{"model": "sonnet", "custom_setting": "test_value"}' > ~/test-claude-project/.claude/settings.local.json
```

**Steps**:
1. Start Claude session through CCUI
2. Verify hooks are added while preserving existing settings
3. Let session complete
4. Verify original settings are restored

**Expected Results**:
- During session: hooks added, original settings preserved
- After session: original settings restored, hooks removed
- Custom settings remain intact throughout

#### Test Case 1.1.3: Error Handling and Rollback
**Objective**: Verify graceful handling of hook injection failures

**Steps**:
1. Create read-only `.claude` directory: `chmod 444 ~/test-claude-project/.claude`
2. Attempt to start Claude session through CCUI
3. Verify error handling and no corruption

**Expected Results**:
- Error logged but CCUI remains functional
- No partial hook injection
- User receives appropriate error feedback

**Cleanup**: `chmod 755 ~/test-claude-project/.claude`

### 1.2 Hook Script Execution Tests

#### Test Case 1.2.1: Session Start Hook
**Objective**: Verify session start is properly reported

**Steps**:
1. Open browser developer tools, monitor Network tab
2. Start new Claude session through CCUI
3. Look for POST request to `/api/hooks/session` with `event: "start"`

**Expected Results**:
- HTTP POST to `/api/hooks/session` within 2 seconds of session start
- Request contains: `event: "start"`, `machineId: "local"`, `sessionId`, `projectPath`
- Response: `200 OK` with `{"success": true}`

#### Test Case 1.2.2: Tool Execution Hooks
**Objective**: Verify tool hooks fire correctly

**Steps**:
1. Start Claude session
2. Send message: "Please create a file called test.txt with 'Hello World' inside"
3. Monitor network requests during tool execution

**Expected Results**:
- `tool_pending` event when Claude is about to use tools
- `tool_complete` event after tool execution finishes
- Events contain relevant metadata (tool name, execution status)

#### Test Case 1.2.3: Session End Hook
**Objective**: Verify session completion is reported

**Steps**:
1. Start Claude session
2. Send a simple message and wait for response
3. Close/abort the session
4. Monitor for session end event

**Expected Results**:
- `end` event sent within 2 seconds of session termination
- Contains session duration and completion status

### 1.3 WebSocket Protocol Tests

#### Test Case 1.3.1: Real-time Session Updates
**Objective**: Verify UI receives session status updates

**Steps**:
1. Open browser developer tools, monitor WebSocket frames
2. Start Claude session
3. Look for `claude_session_update` messages

**Expected Results**:
- WebSocket message type: `claude_session_update`
- Contains `waitingSessions` object with machine counts
- Updates received in real-time as session state changes

#### Test Case 1.3.2: Multi-Session Tracking
**Objective**: Verify multiple concurrent sessions are tracked

**Steps**:
1. Start first Claude session (keep it waiting for user input)
2. Open second project, start another session
3. Monitor waiting session counts

**Expected Results**:
- `waitingSessions.local` count increases to 2
- UI notification badges update accordingly
- Each session tracked independently

### 1.4 UI Component Tests

#### Test Case 1.4.1: Machine Selector Notification Badges
**Objective**: Verify notification badges appear and update correctly

**Steps**:
1. Start Claude session that waits for user input
2. Check machine selector button for notification badge
3. Start second waiting session
4. Verify badge count updates

**Expected Results**:
- Red badge appears on machine selector with count "1"
- Badge updates to "2" when second session starts
- Badge disappears when all sessions complete

#### Test Case 1.4.2: Project Status Indicators
**Objective**: Verify project-level status indicators

**Steps**:
1. Start Claude session in test project
2. Look for orange pulsing dot next to project name
3. Complete session and verify indicator disappears

**Expected Results**:
- Orange pulsing dot appears next to project name during active session
- Indicator visible in both mobile and desktop views
- Indicator disappears when session completes

#### Test Case 1.4.3: Machine Dropdown Individual Counts
**Objective**: Verify individual machine counts in dropdown

**Steps**:
1. Start waiting session on local machine
2. Open machine selector dropdown
3. Verify "Local Machine" shows yellow badge with count

**Expected Results**:
- Local Machine entry shows yellow badge "1"
- Badge updates as session count changes
- Badge disappears when no sessions waiting

## Phase 2: Remote Client Testing

### 2.1 Remote Client Setup

#### Test Case 2.1.1: Remote Client Connection
**Objective**: Verify remote client can connect and register

**Pre-setup**:
```bash
# On remote machine
git clone <ccui-repo>
cd claudecodeui-ccui-hooks/client
npm install
node src/index.js --server-host <server-ip> --client-name "test-remote"
```

**Steps**:
1. Start remote client
2. Check server logs for successful registration
3. Verify machine appears in UI dropdown

**Expected Results**:
- Remote client successfully registers with server
- Machine appears in UI machine selector
- Status shows "online"

### 2.2 Remote Hook Integration Tests

#### Test Case 2.2.1: Remote Claude Session Hooks
**Objective**: Verify hooks work on remote machines

**Steps**:
1. Select remote machine in UI
2. Start Claude session in remote project
3. Monitor for hook events from remote machine

**Expected Results**:
- Hook events received from remote machine ID
- Session tracked separately from local sessions
- UI updates show remote machine session count

#### Test Case 2.2.2: Cross-Machine Session Tracking
**Objective**: Verify sessions tracked independently per machine

**Steps**:
1. Start session on local machine (keep waiting)
2. Start session on remote machine (keep waiting)
3. Verify both machines show separate counts

**Expected Results**:
- Total badge shows "2" (combined count)
- Local machine shows "1" in dropdown
- Remote machine shows "1" in dropdown
- Sessions tracked independently

### 2.3 Multi-Machine Scenarios

#### Test Case 2.3.1: Machine Disconnect Handling
**Objective**: Verify graceful handling of machine disconnection

**Steps**:
1. Start sessions on both local and remote machines
2. Disconnect remote client (kill process)
3. Verify UI updates correctly

**Expected Results**:
- Remote machine marked as "offline"
- Remote session counts reset to 0
- Local sessions continue to be tracked
- Total count reflects only local sessions

#### Test Case 2.3.2: Machine Reconnection
**Objective**: Verify machine reconnection and session recovery

**Steps**:
1. Restart remote client after disconnect
2. Start new session on remote machine
3. Verify tracking resumes correctly

**Expected Results**:
- Remote machine shows "online" status
- New sessions tracked correctly
- Previous session state cleared (fresh start)

## Phase 3: Edge Cases and Error Handling

### 3.1 Network and Connectivity Tests

#### Test Case 3.1.1: Server Downtime During Session
**Objective**: Verify graceful handling of server connectivity loss

**Steps**:
1. Start Claude session with hooks active
2. Stop CCUI server
3. Continue Claude session
4. Restart server

**Expected Results**:
- Claude session continues normally (not affected by hook failures)
- Hooks fail gracefully without disrupting Claude
- Session tracking resumes when server returns

#### Test Case 3.1.2: Authentication Token Expiry
**Objective**: Verify handling of expired authentication tokens

**Steps**:
1. Start session with valid token
2. Manually expire/invalidate token on server
3. Trigger hook event

**Expected Results**:
- Hook receives 401 Unauthorized
- Error logged but Claude session continues
- No UI updates for failed authentication

### 3.2 Concurrent Session Tests

#### Test Case 3.2.1: Rapid Session Creation/Termination
**Objective**: Verify handling of rapid session changes

**Steps**:
1. Rapidly start and stop multiple Claude sessions
2. Monitor for race conditions or state inconsistencies
3. Verify final state is correct

**Expected Results**:
- All session state changes tracked correctly
- No orphaned sessions in tracking
- UI counts remain accurate

#### Test Case 3.2.2: Long-Running Sessions
**Objective**: Verify handling of extended sessions

**Steps**:
1. Start Claude session and let run for extended period (30+ minutes)
2. Perform various operations
3. Monitor for memory leaks or state degradation

**Expected Results**:
- Session continues to be tracked accurately
- No memory leaks in hook tracking
- UI remains responsive

## Phase 4: Performance and Reliability Tests

### 4.1 Performance Tests

#### Test Case 4.1.1: Hook Execution Performance
**Objective**: Verify hooks don't significantly impact Claude performance

**Steps**:
1. Time Claude session startup with and without hooks
2. Measure tool execution latency with hooks active
3. Compare performance metrics

**Expected Results**:
- Hook injection adds <100ms to session startup
- Tool execution latency increase <50ms
- No noticeable impact on Claude responsiveness

#### Test Case 4.1.2: Server Load with Multiple Machines
**Objective**: Verify server handles multiple remote clients efficiently

**Steps**:
1. Connect 5+ remote clients
2. Start multiple sessions across machines
3. Monitor server resource usage

**Expected Results**:
- Server CPU usage remains reasonable (<20% increase)
- Memory usage scales linearly with sessions
- WebSocket updates remain responsive

### 4.2 Reliability Tests

#### Test Case 4.2.1: Settings Corruption Protection
**Objective**: Verify robust protection against settings corruption

**Steps**:
1. Create malformed `.claude/settings.local.json`
2. Attempt hook injection
3. Verify graceful handling

**Expected Results**:
- Malformed settings detected
- Backup created before modification
- Rollback occurs on error

## Test Execution Checklist

### Local Testing Phase ✅ COMPLETED (11/11 tests passed)
- [x] Test Case 1.1.1: Basic Hook Injection ✅ PASSED
- [x] Test Case 1.1.2: Settings Backup and Restore ✅ PASSED
- [x] Test Case 1.1.3: Error Handling and Rollback ✅ PASSED
- [x] Test Case 1.2.1: Session Start Hook ✅ PASSED
- [x] Test Case 1.2.2: Tool Execution Hooks ✅ PASSED
- [x] Test Case 1.2.3: Session End Hook ✅ PASSED
- [x] Test Case 1.3.1: Real-time Session Updates ✅ PASSED
- [x] Test Case 1.3.2: Multi-Session Tracking ✅ PASSED
- [x] Test Case 1.4.1: Machine Selector Notification Badges ✅ PASSED
- [x] Test Case 1.4.2: Project Status Indicators ✅ PASSED
- [x] Test Case 1.4.3: Machine Dropdown Individual Counts ✅ PASSED

### Remote Testing Phase
- [ ] Test Case 2.1.1: Remote Client Connection
- [ ] Test Case 2.2.1: Remote Claude Session Hooks
- [ ] Test Case 2.2.2: Cross-Machine Session Tracking
- [ ] Test Case 2.3.1: Machine Disconnect Handling
- [ ] Test Case 2.3.2: Machine Reconnection

### Edge Cases Phase
- [ ] Test Case 3.1.1: Server Downtime During Session
- [ ] Test Case 3.1.2: Authentication Token Expiry
- [ ] Test Case 3.2.1: Rapid Session Creation/Termination
- [ ] Test Case 3.2.2: Long-Running Sessions

### Performance Phase
- [ ] Test Case 4.1.1: Hook Execution Performance
- [ ] Test Case 4.1.2: Server Load with Multiple Machines
- [ ] Test Case 4.2.1: Settings Corruption Protection

## Bug Reporting Template

```markdown
**Test Case**: [Test case ID and name]
**Environment**: [Local/Remote, OS, Claude version, Browser]
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**: 
**Actual Result**: 
**Screenshots/Logs**: 
**Severity**: [Critical/High/Medium/Low]
**Additional Notes**: 
```

## Success Criteria

The feature will be considered ready for production when:

1. **All Local Tests Pass**: 100% success rate on Phase 1 tests
2. **Remote Functionality Works**: Core remote client tests pass (Cases 2.1.1, 2.2.1, 2.2.2)
3. **Error Handling Robust**: All edge case tests pass without system crashes
4. **Performance Acceptable**: No more than 10% performance degradation
5. **UI Responsiveness**: All notification updates appear within 2 seconds
6. **Zero Data Loss**: No settings corruption or session data loss in any test scenario

## Test Execution Summary

### Phase 1: Local Server Testing - ✅ COMPLETED
**Execution Date**: July 19-20, 2025  
**Status**: All tests passed (11/11)  
**Environment**: macOS, Node.js v20.19.3, Claude Code UI local server

#### Key Findings:
- **Hook System**: All 6 hook scripts execute properly after converting to `.cjs` extensions for ES module compatibility
- **Settings Management**: Atomic backup/restore operations preserve user configurations correctly
- **Error Handling**: Graceful failure recovery with no partial injection or corruption
- **WebSocket Infrastructure**: Server properly configured and accepts connections on port 3021
- **UI Components**: Notification badge calculations and status indicators work correctly

#### Issues Resolved:
1. **ES Module Compatibility**: Converted hook scripts from `.js` to `.cjs` to resolve `require` vs `import` conflicts
2. **Server Port Discovery**: Updated tests to use correct server port (3020/3021) 
3. **Hook Path References**: Modified `claudeHooks.js` to reference `.cjs` extensions

#### Test Coverage:
- ✅ Hook injection and removal (atomic operations)
- ✅ Settings backup and restore (preserves original configurations)  
- ✅ Error handling and rollback (graceful failure recovery)
- ✅ All 6 hook script execution (start, end, tool pending/complete, subagent, notification)
- ✅ WebSocket protocol infrastructure
- ✅ Multi-session tracking with unique tokens
- ✅ UI component notification logic

**Ready for Phase 2**: Remote client testing can proceed. All local server functionality validated.

---

## Post-Testing Validation

After all tests pass:
1. Document any configuration requirements for deployment
2. Create troubleshooting guide for common issues found during testing
3. Update user documentation with new feature capabilities
4. Prepare rollback plan in case issues discovered in production