# Manual Test Execution Plan: Encryption Testing with Playwright MCP

## Pre-Test Setup

### 1. Start Main Server (Terminal 1)
```bash
cd /Users/shan/dev/iotashan/claudecodeui
npm run dev
# Runs on http://localhost:3000
```

### 2. Start Client Instance (Terminal 2)
```bash
cd /Users/shan/dev/iotashan/claudecodeui
PORT=3001 npm run dev
# Runs on http://localhost:3001
```

**Note**: We're running both server and client on the same machine using different ports. This is not ideal for production testing but sufficient for initial encryption validation. The client instance will connect to the server instance via localhost.

## Manual Test Steps with Playwright MCP

### Test 1: User Registration & Encryption Key Generation

**Steps:**
1. Navigate to http://localhost:3000
2. Click "Register" link if not logged in
3. Fill in registration form:
   - Username: `testuser_encrypt_001`
   - Password: `TestPass123!`
4. Submit registration
5. Open browser console and check for any errors
6. Take screenshot of successful registration

**Verification:**
- Check server logs for encryption key generation message
- Note: We'll verify database entry in post-test verification

**Expected Console Output:**
```
✅ Database initialized
User registered successfully: testuser_encrypt_001
Generated encryption key for user: [base64 key]
```

### Test 2: Login and Verify Config Endpoint

**Steps:**
1. Login with the newly created user
2. Open DevTools Network tab
3. Look for `/api/config` call
4. Click on the request and examine response
5. Take screenshot of the response showing encryptionKey field

**Expected Response:**
```json
{
  "serverPort": 3000,
  "wsUrl": "ws://localhost:3000",
  "serverIP": "192.168.x.x",
  "serverProtocol": "http",
  "encryptionKey": "base64-encoded-key-here"
}
```

### Test 3: Create API Token and Verify Key Distribution

**Steps:**
1. Click Settings icon in UI
2. Click on "Server" tab
3. Click "Create API Token" button
4. Enter token name: `test-client-token`
5. Click "Create" button
6. Take screenshot of the token display modal
7. Verify 4 lines are present:
   - CLAUDE_CODE_UI_SERVER_URL
   - CLAUDE_CODE_UI_API_TOKEN
   - CLAUDE_CODE_UI_CLIENT_NAME
   - CLAUDE_CODE_UI_ENCRYPTION_KEY
8. Click copy button and verify all 4 lines are copied

**Expected Display:**
```
CLAUDE_CODE_UI_SERVER_URL=http://localhost:3000
CLAUDE_CODE_UI_API_TOKEN=cui_token_xxxxx
CLAUDE_CODE_UI_CLIENT_NAME=test-client-token
CLAUDE_CODE_UI_ENCRYPTION_KEY=base64-key-here
```

### Test 4: Monitor Encrypted API Calls

**Steps:**
1. With DevTools Network tab open
2. Navigate to different sections:
   - Click on a project
   - Open Settings
   - Navigate between tabs
3. For each API call, check:
   - Request headers for `X-Encryption-Support: true`
   - Response headers for `X-Encrypted: true`
   - Request/Response body format
4. Take screenshots of:
   - An encrypted request
   - An encrypted response

**Expected Request Body:**
```json
{
  "encrypted": "long-base64-string-here"
}
```

**Expected Headers:**
- Request: `X-Encryption-Support: true`, `X-Encrypted: true` (for POST/PUT)
- Response: `X-Encrypted: true`

### Test 5: Settings API Encryption Test

**Steps:**
1. Open Settings modal
2. Switch to "Appearance" tab
3. Change theme (if available) or any setting
4. Click "Save" button
5. Monitor Network tab for `/api/settings` POST request
6. Examine request and response encryption
7. Take screenshot of encrypted settings save

### Test 6: Test Non-Encrypted Fallback

**Steps:**
1. Open browser console
2. Disable encryption support temporarily:
   ```javascript
   // Override to simulate no encryption support
   window.crypto.subtle = null;
   ```
3. Refresh the page
4. Login again
5. Make some API calls (navigate, open settings)
6. Verify in Network tab that:
   - No `X-Encryption-Support` header
   - Regular JSON bodies (not encrypted)
   - Everything still works
7. Take screenshot showing unencrypted communication

### Test 7: Configure Client Instance

**Steps:**
1. Open new browser tab/window
2. Navigate to http://localhost:3001 (client instance)
3. Create a `.env` file with the token info from Test 3
4. Restart the client instance with the .env configured
5. Verify client starts with "Running as client" message in console

### Test 8: Test Client-Server WebSocket Encryption

**Steps:**
1. In the client terminal, look for connection logs
2. In browser DevTools for main server (port 3000):
   - Go to Network tab → WS filter
   - Find the `/machine` WebSocket connection
3. Click on the WebSocket connection
4. Go to Messages tab
5. Examine the message frames for encryption
6. Take screenshot of encrypted WebSocket messages

**Expected WebSocket Messages:**
```json
{
  "encrypted": "base64-data",
  "isEncrypted": true
}
```

### Test 9: Cross-Machine Settings Test

**Steps:**
1. In main server UI (port 3000)
2. Look for machine selector dropdown
3. Select the connected client machine
4. Open Settings modal
5. Verify "Tools [ClientName]" tab appears
6. Click "Copy MCP Settings from Server" button
7. Confirm the operation
8. Monitor Network tab for encrypted `/api/settings/sync-from-server` call
9. Take screenshot of:
   - Settings modal with client context
   - Encrypted sync API call

### Test 10: Test Client-Server Functionality with Dummy Project

**Steps:**
1. In main server UI (port 3000), ensure client machine is selected
2. Navigate to Projects section
3. Look for "/Users/shan/Desktop/claudetest" project (should be visible if auto-detected)
4. If not visible, manually add the project:
   - Click "Add Project" or similar button
   - Enter path: `/Users/shan/Desktop/claudetest`
5. Click on the claudetest project
6. Start a new Claude session on the client machine
7. Execute a simple command like: "list the files in this directory"
8. Monitor both server and client logs for:
   - Command routing from server to client
   - Encrypted WebSocket communication
   - Command execution on client
   - Response routing back to server
9. Take screenshots of:
   - Project selection with client machine
   - Command execution in progress
   - Successful response from client
10. Try a more complex command: "create a simple README.md file explaining this is a test project"
11. Verify the file is created in `/Users/shan/Desktop/claudetest/`

**Expected Flow:**
```
Web UI (port 3000) → Encrypted Command → Server → 
Encrypted WebSocket → Client (port 3001) → 
Claude Execution → Encrypted Response → Server → 
Encrypted Response → Web UI
```

### Test 11: Test Settings Sync Functionality

**Steps:**
1. With client machine selected, open Settings → Tools [ClientName]
2. Make note of current MCP settings (should be empty initially)
3. Switch to server context (select local/server)
4. Go to Settings → Tools and configure some test MCP settings:
   - Add a dummy tool or connector
   - Save the settings
5. Switch back to client context
6. Click "Copy MCP Settings from Server"
7. Confirm the sync operation
8. Verify the MCP settings now appear in client settings
9. Monitor Network tab for encrypted `/api/settings/sync-from-server` call
10. Check that the client can now use the synced tools

### Test 12: Verify Encryption in Logs

**Steps:**
1. Check server console (Terminal 1) for encryption logs
2. Check client console (Terminal 2) for encryption logs
3. Look for patterns like:
   - "Encrypted message received"
   - "Decrypted request"
   - "Response encrypted"
   - "Machine message received: [type]" (should show decrypted message types)
4. Copy relevant log entries

## Post-Test Verification

### Database Checks
```bash
# In a new terminal
cd /Users/shan/dev/iotashan/claudecodeui
sqlite3 server/database/auth.db

# Run these queries:
.tables
SELECT id, username, LENGTH(encryption_key) as key_length FROM users WHERE username = 'testuser_encrypt_001';
SELECT COUNT(*) FROM users WHERE encryption_key IS NOT NULL;
```

### Browser Console Checks
```javascript
// Check encryption support
console.log('Crypto available:', !!window.crypto?.subtle);

// Check if responses are being decrypted
fetch('/api/config', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
    'X-Encryption-Support': 'true'
  }
}).then(r => r.json()).then(console.log);
```

## Screenshots to Capture

1. [ ] Successful user registration
2. [ ] `/api/config` response with encryptionKey
3. [ ] API token display with 4 lines including encryption key
4. [ ] Encrypted API request in DevTools
5. [ ] Encrypted API response in DevTools
6. [ ] Unencrypted fallback communication
7. [ ] Client WebSocket connection with encryption
8. [ ] Settings modal in client context
9. [ ] Encrypted settings sync operation
10. [ ] Project selection with client machine selected
11. [ ] Claude command execution on client machine
12. [ ] Successful command response from client
13. [ ] Created README.md file in /Users/shan/Desktop/claudetest/
14. [ ] MCP settings before sync (empty client settings)
15. [ ] MCP settings after sync (populated client settings)

## Expected Issues to Document

- Any encryption/decryption errors
- Performance observations
- UI glitches or missing elements
- WebSocket connection issues
- Fallback mechanism problems

## Test Result Template

```markdown
### Test X: [Test Name]
**Status**: ✅ Pass / ❌ Fail / ⚠️ Partial
**Screenshot**: [filename]
**Observations**: 
- 
**Issues Found**:
- 
```

## Next Steps

After completing manual tests:
1. Document all findings
2. Create Playwright automated tests based on these steps
3. File any bugs discovered
4. Update implementation if needed