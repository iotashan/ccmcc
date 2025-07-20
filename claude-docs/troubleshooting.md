# Troubleshooting Guide

This guide covers common issues and their solutions for Claude Code UI, particularly focusing on multi-machine setup and recent bug fixes.

## Table of Contents
- [Multi-Machine Issues](#multi-machine-issues)
- [Shell Operations](#shell-operations)
- [Git Operations](#git-operations)
- [MCP Operations](#mcp-operations)
- [WebSocket Connection Issues](#websocket-connection-issues)
- [Authentication Issues](#authentication-issues)

## Multi-Machine Issues

### Problem: Remote machines not appearing in dropdown
**Symptoms:**
- Client shows "Successfully registered with server"
- Server logs show machine registration
- Machine doesn't appear in Web UI dropdown

**Solution:**
1. Check if the machine is actually connected:
   ```bash
   # On server, check logs
   tail -f logs/dev-server.log | grep machine
   ```

2. Verify WebSocket connection:
   - Look for "machine_heartbeat" messages in server logs
   - Check for connection errors

3. Force UI refresh:
   - The UI polls every 30 seconds
   - Try switching tabs and returning
   - Check browser console for errors

### Problem: Machine disconnects frequently
**Symptoms:**
- Machine appears and disappears from list
- "Target machine is not available" errors

**Solution:**
1. Check network stability between client and server
2. Verify API token is correct
3. Look for rate limiting or firewall issues
4. Check client logs for reconnection attempts

## Shell Operations

### Problem: "No active shell session" errors (FIXED: July 19, 2025)
**Previous Issue:**
- Each keystroke generated "No active shell session" error
- Shell commands didn't execute on remote machines
- Server generated new request_id for each operation

**Root Cause:**
The server was creating a new `request_id` for each shell operation (init, input, resize, exit), but the client used `request_id` to track sessions.

**Fix Applied:**
```javascript
// server/index.js - Added persistent shellSessionId
let shellSessionId = null;

// Generate once on init, reuse for all operations
if (messageType === 'init') {
  shellSessionId = request_id;
}
```

**Verification:**
- Shell operations now work correctly on remote machines
- Session persists across multiple commands
- No more "No active shell session" errors

### Problem: Shell not connecting to remote machine
**Symptoms:**
- Shell shows local machine path when remote selected
- Commands execute on server instead of client

**Solution:**
1. Verify Shell component receives selectedMachine prop:
   ```javascript
   // Should be in MainContent.jsx
   <Shell selectedMachine={selectedMachine} />
   ```

2. Check WebSocket URL includes machineId:
   ```javascript
   // Shell.jsx WebSocket connection
   wsUrl += `&machineId=${encodeURIComponent(selectedMachine)}`;
   ```

3. Verify client has shell handler registered

## Git Operations

### Problem: Git operations show wrong repository (FIXED: July 19, 2025)
**Previous Issue:**
- Git status showed "Project path not found" on remote machines
- Git operations accessed server paths instead of client paths
- Remote repository information not displayed

**Root Cause:**
Git routes were defined before the machine routing middleware in Express, causing requests to be handled locally instead of forwarded.

**Fix Applied:**
```javascript
// server/index.js - Moved routes after middleware
// Apply machine routing middleware first
app.use('/api', authenticateToken, machineRoutingMiddleware(machineManager));

// Protected API Routes come AFTER middleware
app.use('/api/git', authenticateToken, gitRoutes);
app.use('/api/mcp', authenticateToken, mcpRoutes);
```

**Verification:**
- Git operations now correctly show remote repository status
- Commands execute on the selected machine
- Proper error messages for non-git directories

### Problem: Git panel not updating when switching machines
**Symptoms:**
- Git status stays cached when switching machines
- Old repository info displayed

**Solution:**
1. Verify GitPanel receives selectedMachine prop
2. Check useEffect dependency includes selectedMachine
3. Force refresh by switching tabs

## MCP Operations

### Problem: MCP configs not machine-specific (FIXED: July 19, 2025)
**Previous Issue:**
- MCP server configurations were shared across all machines
- Adding/removing MCP servers affected all machines
- Settings showed same MCP list regardless of selected machine

**Root Cause:**
ToolsSettings component used direct `fetch()` calls instead of the `api` utility, missing X-Machine-ID header.

**Fix Applied:**
```javascript
// src/components/ToolsSettings.jsx - Updated all calls
// Before:
const response = await fetch('/api/mcp/cli/list', {...});

// After:
const response = await api.get('/api/mcp/cli/list');
```

**Verification:**
- MCP configurations are now isolated per machine
- Each machine maintains its own MCP server list
- Changes on one machine don't affect others

### Problem: MCP server commands fail
**Symptoms:**
- "Failed to run Claude CLI" errors
- MCP servers don't add/remove properly

**Solution:**
1. Verify Claude CLI is installed on the target machine
2. Check PATH includes claude command
3. Verify user has permissions to run claude
4. Check client logs for detailed error messages

## WebSocket Connection Issues

### Problem: WebSocket keeps reconnecting
**Symptoms:**
- Frequent disconnect/reconnect messages
- Unstable real-time features
- Machine list flickers

**Solution:**
1. Check for proxy/firewall interference
2. Verify WebSocket upgrade headers allowed
3. Look for rate limiting on port 3020
4. Check client system resources

### Problem: "Invalid token" WebSocket errors
**Symptoms:**
- WebSocket connection rejected
- Authentication failures in logs

**Solution:**
1. Clear browser localStorage
2. Log out and log back in
3. Verify JWT token not expired
4. Check server JWT_SECRET matches

## Authentication Issues

### Problem: API token not working for client
**Symptoms:**
- Client can't register with server
- "Invalid API token" errors

**Solution:**
1. Regenerate API token in Web UI settings
2. Copy exact token (no extra spaces)
3. Update client config.json
4. Restart client after config change

### Problem: Session expires during use
**Symptoms:**
- Suddenly logged out
- API calls return 401 errors

**Solution:**
1. Check JWT expiration settings
2. Implement token refresh logic
3. Verify system clocks synchronized

## Common Debugging Steps

### 1. Check All Logs
```bash
# Server logs
tail -f logs/dev-server.log

# Client logs (on client machine)
tail -f logs/client.log

# Check specific patterns
grep -i error logs/*.log
grep -i "machine" logs/dev-server.log
```

### 2. Verify Connectivity
```bash
# From client machine
curl -H "X-API-Token: YOUR_TOKEN" http://server:3020/health

# Check WebSocket
wscat -H "X-API-Token: YOUR_TOKEN" -c ws://server:3020
```

### 3. Browser Console
- Open DevTools (F12)
- Check Console for errors
- Monitor Network tab for failed requests
- Verify WebSocket messages in WS tab

### 4. Component Props
For React components not receiving machine info:
1. Check props passed from parent
2. Verify selectedMachine in component
3. Look for prop drilling issues
4. Check Context/Redux state

## Prevention Tips

1. **Always use provided scripts** for starting/stopping services
2. **Monitor logs** during development
3. **Test machine switching** after any routing changes
4. **Verify middleware order** when adding new routes
5. **Use api utility** for all API calls in frontend
6. **Include machineId** in WebSocket connections

## Getting Help

If issues persist:
1. Collect relevant logs from both server and client
2. Note exact error messages and timing
3. Document reproduction steps
4. Check GitHub issues for similar problems
5. Include system information (OS, Node version, etc.)