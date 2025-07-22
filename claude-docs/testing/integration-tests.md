# Integration Tests

**Status: 🔄 Ready for Implementation**  
**Total Tests: ~15 test scenarios**  
**Completion: 0/15 tests implemented**

## Test Implementation Checklist

### Authentication Flow (`/tests/integration/auth-flow.test.js`)
- [ ] Complete Authentication Flow (1 scenario) - `auth-flow.test.js:Complete-Auth-Flow`
- [ ] Machine Authentication Flow (1 scenario) - `auth-flow.test.js:Machine-Auth-Flow`
- [ ] Multi-device Authentication (1 scenario) - `auth-flow.test.js:Multi-device-Auth`

### Git Workflow (`/tests/integration/git-workflow.test.js`)
- [ ] Complete Development Cycle (1 scenario) - `git-workflow.test.js:Development-Cycle`
- [ ] Merge Conflict Resolution (1 scenario) - `git-workflow.test.js:Merge-Conflicts`
- [ ] Collaborative Editing (1 scenario) - `git-workflow.test.js:Collaborative-Editing`

### File Synchronization (`/tests/integration/file-sync.test.js`)
- [ ] Real-time File Sync (1 scenario) - `file-sync.test.js:Real-time-Sync`
- [ ] Bulk File Operations Sync (1 scenario) - `file-sync.test.js:Bulk-Operations`
- [ ] Rapid Concurrent Edits (1 scenario) - `file-sync.test.js:Concurrent-Edits`

**Progress: 0/9 test scenarios completed**

This document contains detailed specifications for integration tests in the Claude Code UI Docker test environment.

## Overview

Integration tests verify that multiple components work together correctly:
- **Authentication Flow** - Complete user registration through login
- **Git Workflow** - End-to-end git operations 
- **File Synchronization** - Real-time file sync between clients
- **API Integration** - Client-server communication

---

## Authentication Flow (`/tests/integration/auth-flow.test.js`)

### Complete Authentication Flow

```javascript
describe('Complete Authentication Flow', () => {
  test('user registration through login flow', async () => {
    // 1. Register new user
    const registerResponse = await api.post('/api/users/register', {
      email: 'test@example.com',
      password: 'SecurePass123!',
      username: 'testuser'
    });
    expect(registerResponse.status).toBe(201);
    expect(registerResponse.data).toHaveProperty('accessToken');
    expect(registerResponse.data).toHaveProperty('refreshToken');
    
    // 2. Receive tokens and verify format
    const { accessToken, refreshToken } = registerResponse.data;
    expect(typeof accessToken).toBe('string');
    expect(accessToken.split('.')).toHaveLength(3); // JWT format
    
    // 3. Access protected endpoint
    const profileResponse = await api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.data.email).toBe('test@example.com');
    
    // 4. Refresh token
    const refreshResponse = await api.post('/api/auth/refresh', {
      refreshToken
    });
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.data).toHaveProperty('accessToken');
    
    // 5. Logout
    const logoutResponse = await api.post('/api/auth/logout', {
      refreshToken: refreshResponse.data.refreshToken
    });
    expect(logoutResponse.status).toBe(200);
    
    // 6. Verify token is blacklisted
    const invalidRefreshResponse = await api.post('/api/auth/refresh', {
      refreshToken: refreshResponse.data.refreshToken
    });
    expect(invalidRefreshResponse.status).toBe(401);
  });

  test('machine authentication flow', async () => {
    // 1. Machine connects with API token
    const machineToken = process.env.MACHINE_API_TOKEN;
    const authResponse = await api.post('/api/machines/auth', {
      token: machineToken,
      machineId: 'test-machine-001'
    });
    expect(authResponse.status).toBe(200);
    
    // 2. Receives JWT for session
    const { sessionToken } = authResponse.data;
    expect(sessionToken).toBeDefined();
    
    // 3. Maintains WebSocket connection
    const ws = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // 4. Handles token refresh
    ws.send(JSON.stringify({ type: 'refresh_token' }));
    
    const refreshMessage = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'token_refreshed') {
          resolve(message);
        }
      });
    });
    
    expect(refreshMessage.data.newToken).toBeDefined();
    ws.close();
  });

  test('multi-device authentication', async () => {
    // 1. Login on device A
    const deviceA = await api.post('/api/auth/login', {
      email: 'multidevice@example.com',
      password: 'password123'
    });
    
    // 2. Login on device B
    const deviceB = await api.post('/api/auth/login', {
      email: 'multidevice@example.com', 
      password: 'password123'
    });
    
    // Both should succeed
    expect(deviceA.status).toBe(200);
    expect(deviceB.status).toBe(200);
    
    // 3. Both receive real-time updates
    const wsA = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${deviceA.data.accessToken}` }
    });
    const wsB = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${deviceB.data.accessToken}` }
    });
    
    await Promise.all([
      new Promise((resolve) => wsA.on('open', resolve)),
      new Promise((resolve) => wsB.on('open', resolve))
    ]);
    
    // Send message from A, verify B receives it
    wsA.send(JSON.stringify({ type: 'test_broadcast', data: 'hello' }));
    
    const receivedMessage = await new Promise((resolve) => {
      wsB.on('message', (data) => {
        resolve(JSON.parse(data));
      });
    });
    
    expect(receivedMessage.type).toBe('test_broadcast');
    expect(receivedMessage.data).toBe('hello');
    
    // 4. Logout on A doesn't affect B
    await api.post('/api/auth/logout', {
      refreshToken: deviceA.data.refreshToken
    });
    
    // Device B should still work
    const profileB = await api.get('/api/users/me', {
      headers: { Authorization: `Bearer ${deviceB.data.accessToken}` }
    });
    expect(profileB.status).toBe(200);
    
    wsA.close();
    wsB.close();
  });
});
```

---

## Git Workflow (`/tests/integration/git-workflow.test.js`)

### Complete Development Cycle

```javascript
describe('Git Workflow Integration', () => {
  test('complete development cycle', async () => {
    const projectId = 'test-project-git-workflow';
    
    // 1. Initialize repository
    const initResponse = await api.post('/api/git/init', {
      projectId,
      remoteUrl: 'https://github.com/test/repo.git'
    });
    expect(initResponse.status).toBe(200);
    
    // 2. Create branch
    const branchResponse = await api.post('/api/git/branch', {
      projectId,
      name: 'feature/integration-test',
      checkout: true
    });
    expect(branchResponse.status).toBe(200);
    
    // 3. Make changes (create file)
    const fileResponse = await api.post('/api/files/write', {
      projectId,
      path: 'src/integration-test.js',
      content: 'console.log("Integration test file");'
    });
    expect(fileResponse.status).toBe(200);
    
    // 4. Stage files
    const stageResponse = await api.post('/api/git/add', {
      projectId,
      files: ['src/integration-test.js']
    });
    expect(stageResponse.status).toBe(200);
    
    // 5. Commit
    const commitResponse = await api.post('/api/git/commit', {
      projectId,
      message: 'feat: add integration test file'
    });
    expect(commitResponse.status).toBe(200);
    expect(commitResponse.data).toHaveProperty('hash');
    
    // 6. Push to remote (mocked)
    const pushResponse = await api.post('/api/git/push', {
      projectId,
      remote: 'origin',
      branch: 'feature/integration-test'
    });
    expect(pushResponse.status).toBe(200);
    
    // 7. Verify commit in history
    const logResponse = await api.get(`/api/git/log?projectId=${projectId}&limit=1`);
    expect(logResponse.status).toBe(200);
    expect(logResponse.data[0].message).toBe('feat: add integration test file');
  });

  test('merge conflict resolution', async () => {
    const projectId = 'test-project-conflicts';
    
    // Setup: Create two branches with conflicting changes
    
    // 1. Create branch A
    await api.post('/api/git/branch', {
      projectId,
      name: 'branch-a',
      checkout: true
    });
    
    // 2. Modify file in branch A
    await api.post('/api/files/write', {
      projectId,
      path: 'conflicted.txt',
      content: 'Content from branch A'
    });
    
    await api.post('/api/git/add', { projectId, files: ['.'] });
    await api.post('/api/git/commit', {
      projectId,
      message: 'Change in branch A'
    });
    
    // 3. Switch to main and create conflicting change
    await api.post('/api/git/checkout', {
      projectId,
      branch: 'main'
    });
    
    await api.post('/api/files/write', {
      projectId,
      path: 'conflicted.txt',
      content: 'Content from main'
    });
    
    await api.post('/api/git/add', { projectId, files: ['.'] });
    await api.post('/api/git/commit', {
      projectId,
      message: 'Change in main'
    });
    
    // 4. Attempt merge
    const mergeResponse = await api.post('/api/git/merge', {
      projectId,
      branch: 'branch-a'
    });
    
    // 5. Detect conflicts
    expect(mergeResponse.status).toBe(409); // Conflict status
    expect(mergeResponse.data.conflicts).toContain('conflicted.txt');
    
    // 6. Resolve conflicts
    await api.post('/api/files/write', {
      projectId,
      path: 'conflicted.txt',
      content: 'Content from branch A\nContent from main'
    });
    
    // 7. Complete merge
    await api.post('/api/git/add', { projectId, files: ['conflicted.txt'] });
    const completeMergeResponse = await api.post('/api/git/commit', {
      projectId,
      message: 'Resolve merge conflict'
    });
    
    expect(completeMergeResponse.status).toBe(200);
  });

  test('collaborative editing', async () => {
    const projectId = 'test-project-collab';
    
    // 1. User A makes changes
    const userAToken = await getTestUserToken('userA');
    const userBToken = await getTestUserToken('userB');
    
    await api.post('/api/files/write', {
      projectId,
      path: 'user-a-file.js',
      content: 'console.log("From User A");'
    }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    await api.post('/api/git/add', { projectId, files: ['.'] }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    await api.post('/api/git/commit', {
      projectId,
      message: 'User A: Add user-a-file'
    }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    await api.post('/api/git/push', { projectId }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    // 2. User B pulls changes
    const pullResponse = await api.post('/api/git/pull', { projectId }, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(pullResponse.status).toBe(200);
    
    // 3. Both edit different files
    await api.post('/api/files/write', {
      projectId,
      path: 'user-b-file.js',
      content: 'console.log("From User B");'
    }, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    
    // User A edits different file
    await api.post('/api/files/write', {
      projectId,
      path: 'shared-config.json',
      content: '{"updated_by": "user-a"}'
    }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    // 4. No conflicts on push/pull
    // User B commits and pushes first
    await api.post('/api/git/add', { projectId, files: ['.'] }, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    
    await api.post('/api/git/commit', {
      projectId,
      message: 'User B: Add user-b-file'
    }, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    
    const pushBResponse = await api.post('/api/git/push', { projectId }, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    expect(pushBResponse.status).toBe(200);
    
    // User A pulls and pushes
    await api.post('/api/git/pull', { projectId }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    await api.post('/api/git/add', { projectId, files: ['.'] }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    await api.post('/api/git/commit', {
      projectId,
      message: 'User A: Update config'
    }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    
    const pushAResponse = await api.post('/api/git/push', { projectId }, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    expect(pushAResponse.status).toBe(200);
  });
});
```

---

## File Synchronization (`/tests/integration/file-sync.test.js`)

### Real-time File Synchronization

```javascript
describe('File Synchronization', () => {
  test('real-time file sync between clients', async () => {
    const projectId = 'test-project-sync';
    
    // Setup two WebSocket connections
    const client1Token = await getTestUserToken('client1');
    const client2Token = await getTestUserToken('client2');
    
    const ws1 = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${client1Token}` }
    });
    
    const ws2 = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${client2Token}` }
    });
    
    await Promise.all([
      new Promise((resolve) => ws1.on('open', resolve)),
      new Promise((resolve) => ws2.on('open', resolve))
    ]);
    
    // Both clients watch the project
    ws1.send(JSON.stringify({
      type: 'file:watch',
      projectId: projectId
    }));
    
    ws2.send(JSON.stringify({
      type: 'file:watch', 
      projectId: projectId
    }));
    
    // 1. Client A creates file
    const createResponse = await api.post('/api/files/write', {
      projectId,
      path: 'sync-test.js',
      content: 'console.log("Initial content");'
    }, {
      headers: { Authorization: `Bearer ${client1Token}` }
    });
    
    expect(createResponse.status).toBe(200);
    
    // 2. Client B receives notification
    const notificationReceived = await new Promise((resolve) => {
      ws2.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'file:created' && message.path === 'sync-test.js') {
          resolve(message);
        }
      });
    });
    
    expect(notificationReceived.projectId).toBe(projectId);
    expect(notificationReceived.path).toBe('sync-test.js');
    
    // 3. Client B reads updated file
    const readResponse = await api.get('/api/files/read', {
      params: { projectId, path: 'sync-test.js' },
      headers: { Authorization: `Bearer ${client2Token}` }
    });
    
    expect(readResponse.status).toBe(200);
    
    // 4. Content matches
    expect(readResponse.data.content).toBe('console.log("Initial content");');
    
    ws1.close();
    ws2.close();
  });

  test('bulk file operations sync', async () => {
    const projectId = 'test-project-bulk-sync';
    const clientAToken = await getTestUserToken('clientA');
    const clientBToken = await getTestUserToken('clientB');
    
    const wsA = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${clientAToken}` }
    });
    
    const wsB = new WebSocket('ws://localhost:3001', {
      headers: { Authorization: `Bearer ${clientBToken}` }
    });
    
    await Promise.all([
      new Promise((resolve) => wsA.on('open', resolve)),
      new Promise((resolve) => wsB.on('open', resolve))
    ]);
    
    // Watch for file changes
    wsB.send(JSON.stringify({ type: 'file:watch', projectId }));
    
    const receivedEvents = [];
    wsB.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type.startsWith('file:')) {
        receivedEvents.push(message);
      }
    });
    
    // 1. Create multiple files
    const files = ['file1.js', 'file2.js', 'file3.js'];
    const createPromises = files.map(filename => 
      api.post('/api/files/write', {
        projectId,
        path: filename,
        content: `console.log("${filename}");`
      }, {
        headers: { Authorization: `Bearer ${clientAToken}` }
      })
    );
    
    await Promise.all(createPromises);
    
    // 2. Move directory
    await api.post('/api/files/mkdir', {
      projectId,
      path: 'moved-files'
    }, {
      headers: { Authorization: `Bearer ${clientAToken}` }
    });
    
    const movePromises = files.map(filename =>
      api.post('/api/files/move', {
        projectId,
        from: filename,
        to: `moved-files/${filename}`
      }, {
        headers: { Authorization: `Bearer ${clientAToken}` }
      })
    );
    
    await Promise.all(movePromises);
    
    // 3. Delete files
    const deletePromises = files.map(filename =>
      api.delete('/api/files/delete', {
        params: { projectId, path: `moved-files/${filename}` },
        headers: { Authorization: `Bearer ${clientAToken}` }
      })
    );
    
    await Promise.all(deletePromises);
    
    // Wait for all events to be received
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. All clients see changes
    expect(receivedEvents.length).toBeGreaterThanOrEqual(files.length * 3); // create, move, delete
    
    const createEvents = receivedEvents.filter(e => e.type === 'file:created');
    const moveEvents = receivedEvents.filter(e => e.type === 'file:moved');
    const deleteEvents = receivedEvents.filter(e => e.type === 'file:deleted');
    
    expect(createEvents.length).toBe(files.length);
    expect(moveEvents.length).toBe(files.length);
    expect(deleteEvents.length).toBe(files.length);
    
    wsA.close();
    wsB.close();
  });

  test('handles rapid concurrent edits', async () => {
    const projectId = 'test-project-concurrent';
    const tokens = await Promise.all([
      getTestUserToken('editor1'),
      getTestUserToken('editor2'),
      getTestUserToken('editor3')
    ]);
    
    // Create shared file first
    await api.post('/api/files/write', {
      projectId,
      path: 'shared-document.txt',
      content: 'Initial content'
    }, {
      headers: { Authorization: `Bearer ${tokens[0]}` }
    });
    
    // 1. Multiple clients edit same file rapidly
    const editPromises = tokens.map((token, index) => 
      Promise.all(Array.from({ length: 10 }, (_, editIndex) =>
        api.post('/api/files/write', {
          projectId,
          path: 'shared-document.txt',
          content: `Edit ${editIndex + 1} by editor ${index + 1}\n`
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ))
    );
    
    // 2. Changes queued and applied
    const results = await Promise.allSettled(editPromises.flat());
    const successfulEdits = results.filter(r => r.status === 'fulfilled').length;
    
    // At least some edits should succeed
    expect(successfulEdits).toBeGreaterThan(0);
    
    // 3. Final state is consistent
    const finalContent = await api.get('/api/files/read', {
      params: { projectId, path: 'shared-document.txt' },
      headers: { Authorization: `Bearer ${tokens[0]}` }
    });
    
    expect(finalContent.status).toBe(200);
    expect(finalContent.data.content).toBeDefined();
    
    // Content should be from one of the editors (last write wins)
    expect(finalContent.data.content).toMatch(/Edit \d+ by editor \d+/);
  });
});
```

---

## Test Execution Notes

### Setup Requirements
- Test database with realistic data
- Mock Claude API responses
- WebSocket server for real-time tests
- Git repository fixtures
- Multi-user test scenarios

### Performance Expectations
- Authentication flow: <2s end-to-end
- File sync notifications: <100ms
- Git operations: <1s for typical repos
- Concurrent editing: Graceful degradation

### Error Conditions
- Network failures during operations
- Database transaction rollbacks
- WebSocket connection drops
- Token expiry during long operations

**Total Integration Tests**: ~15 comprehensive test scenarios covering authentication, git workflows, and real-time synchronization.