# Test Plan: End-to-End Encrypted Communication

## Overview
This test plan verifies that the encryption implementation works correctly for both HTTP API calls and WebSocket communications between the server and clients.

## Test Environment Setup

### 1. Server Setup (Main Instance)
```bash
# Terminal 1 - Start the main server
cd /Users/shan/dev/iotashan/claudecodeui
npm run dev
# Server will run on http://localhost:3000
```

### 2. Client Setup (Remote Machine Simulation)
```bash
# Terminal 2 - Start a client instance on different port
cd /Users/shan/dev/iotashan/claudecodeui
PORT=3001 npm run dev
# Client will run on http://localhost:3001
```

### 3. Test Tools
- Playwright for automated browser testing
- Browser DevTools for network inspection
- Console logging for encryption verification

## Test Scenarios

### Scenario 1: User Registration & Encryption Key Generation
**Objective**: Verify encryption keys are generated during registration

1. Navigate to http://localhost:3000
2. Register a new user
3. Verify in database that encryption_key is populated
4. Check server logs for encryption key generation

**Expected Results**:
- User created with non-null encryption_key
- 256-bit base64 encoded key (44 characters)

### Scenario 2: API Token Creation & Key Distribution
**Objective**: Verify encryption key is included in API token display

1. Login to server UI (http://localhost:3000)
2. Navigate to Settings → Server tab
3. Create new API token
4. Verify display includes 4 lines:
   - CLAUDE_CODE_UI_SERVER_URL
   - CLAUDE_CODE_UI_API_TOKEN
   - CLAUDE_CODE_UI_CLIENT_NAME
   - CLAUDE_CODE_UI_ENCRYPTION_KEY

**Expected Results**:
- Encryption key displayed in base64 format
- Copy button copies all 4 lines

### Scenario 3: Encrypted HTTP Communication
**Objective**: Verify API calls are encrypted

1. Login to server UI
2. Open browser DevTools → Network tab
3. Navigate to different projects/settings
4. Monitor API calls for encryption headers

**Expected Results**:
- Request headers include: `X-Encryption-Support: true`
- Encrypted requests include: `X-Encrypted: true`
- Response headers include: `X-Encrypted: true`
- Request/response bodies show `{ encrypted: "base64data..." }`

### Scenario 4: Client Connection with Encryption
**Objective**: Verify client-server WebSocket encryption

1. Configure client instance with API token and encryption key
2. Start client instance connecting to main server
3. Monitor WebSocket frames in DevTools
4. Check server logs for encrypted message handling

**Expected Results**:
- WebSocket messages show `{ encrypted: "...", isEncrypted: true }`
- Server logs show "Machine message received" with decrypted type
- No plaintext sensitive data in WebSocket frames

### Scenario 5: Settings Synchronization with Encryption
**Objective**: Verify settings sync uses encrypted communication

1. Select remote client in machine dropdown
2. Open Settings → Tools [ClientName]
3. Click "Copy MCP Settings from Server"
4. Monitor network traffic during sync

**Expected Results**:
- Settings API calls are encrypted
- Sync completes successfully
- Settings copied correctly to client

### Scenario 6: Fallback for Non-Encrypted Clients
**Objective**: Verify backward compatibility

1. Modify client to not send encryption headers
2. Attempt connection to server
3. Verify communication still works

**Expected Results**:
- Unencrypted communication allowed
- No errors in server logs
- Functionality remains intact

### Scenario 7: Encryption Key Rotation
**Objective**: Verify existing user key generation

1. Manually clear encryption_key for a user in database
2. Login with that user
3. Make API calls
4. Check database for new key

**Expected Results**:
- New encryption key auto-generated
- API calls work with new key
- Key persists in database

### Scenario 8: Cross-Machine Communication
**Objective**: Verify machine routing with encryption

1. Connect client to server
2. From server UI, execute commands on client
3. Monitor encrypted traffic flow

**Expected Results**:
- Commands encrypted at server UI
- Decrypted at server
- Re-encrypted for client WebSocket
- Decrypted and executed at client
- Responses follow reverse path

## Verification Methods

### 1. Network Traffic Analysis
- Use Chrome DevTools Network tab
- Filter by XHR/Fetch for API calls
- Filter by WS for WebSocket frames
- Verify encrypted payloads

### 2. Server Logs
```bash
# Look for encryption-related logs
grep -E "(Encryption|Decrypt|Encrypted)" server.log
```

### 3. Database Verification
```sql
-- Check encryption keys
SELECT id, username, 
       CASE WHEN encryption_key IS NOT NULL THEN 'Has Key' ELSE 'No Key' END as key_status,
       LENGTH(encryption_key) as key_length
FROM users;
```

### 4. Browser Console
```javascript
// Check if encryption is supported
localStorage.getItem('auth-token') && console.log('Encryption supported:', window.crypto && window.crypto.subtle);

// Monitor encrypted API calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Fetch:', args[0], args[1]?.body);
  return originalFetch.apply(this, args).then(response => {
    console.log('Response encrypted:', response.headers.get('X-Encrypted'));
    return response;
  });
};
```

## Test Data Requirements

### User Accounts
- Test User 1: For main server login
- Test User 2: For client testing
- Test User 3: For key rotation testing

### API Tokens
- Token 1: Full permissions for client connection
- Token 2: Limited permissions for security testing

### Test Settings
- Sample MCP configuration files
- Test tool configurations
- Various file types for encryption testing

## Success Criteria

1. **Encryption Coverage**
   - [ ] All authenticated API calls use encryption when supported
   - [ ] WebSocket messages are encrypted
   - [ ] No sensitive data in plaintext

2. **Performance**
   - [ ] Encryption adds <50ms latency to API calls
   - [ ] WebSocket encryption doesn't cause noticeable lag
   - [ ] Large file operations remain performant

3. **Compatibility**
   - [ ] Encrypted clients work with encrypted server
   - [ ] Non-encrypted clients work with server (fallback)
   - [ ] Mixed environment operates correctly

4. **Security**
   - [ ] Encryption keys are never exposed in logs
   - [ ] Keys are properly derived with salt
   - [ ] Authentication tags verify message integrity

5. **User Experience**
   - [ ] No visible difference for end users
   - [ ] Error messages are helpful when encryption fails
   - [ ] Settings sync works transparently

## Automated Test Script Structure

```javascript
// Playwright test structure
describe('Encryption E2E Tests', () => {
  test('User registration generates encryption key', async ({ page }) => {
    // Implementation
  });

  test('API token includes encryption key', async ({ page }) => {
    // Implementation
  });

  test('API calls are encrypted', async ({ page }) => {
    // Implementation with network interception
  });

  test('WebSocket messages are encrypted', async ({ page }) => {
    // Implementation with WebSocket monitoring
  });

  test('Settings sync uses encryption', async ({ page }) => {
    // Implementation
  });
});
```

## Known Issues & Limitations

1. **Self-signed certificates**: HTTPS not required due to app-level encryption
2. **Key distribution**: Manual process via API token UI
3. **Key rotation**: No automatic rotation implemented
4. **Browser support**: Requires modern browser with Web Crypto API

## Risk Mitigation

1. **Encryption failures**: Graceful fallback to unencrypted
2. **Performance impact**: Minimal due to efficient algorithms
3. **Key loss**: Keys stored in database with backups
4. **Compatibility**: Backward compatible design

## Conclusion

This test plan ensures comprehensive validation of the encryption implementation, covering both positive and negative test cases, performance considerations, and security verification. The tests can be executed manually or automated using Playwright.