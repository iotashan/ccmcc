# Multi-Machine Testing Guide

## Prerequisites

1. Claude Code UI server running (default port: 3020)
2. Claude CLI installed on each client machine
3. API token created for each client

## Testing Steps

### 1. Create API Token

In the Web UI:
1. Log in to Claude Code UI
2. Go to Settings → API Tokens
3. Click "Create New Token"
4. Name it (e.g., "Test Machine 1")
5. Copy the token immediately (shown only once!)

### 2. Setup Client Machine

On the remote machine:

```bash
# Clone repository
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui/client

# Install dependencies
npm install

# Create configuration
cp config.example.json config.json

# Edit config.json:
{
  "serverAddress": "http://your-server:3020",
  "authToken": "your-api-token-from-step-1",
  "clientName": "Test Machine 1",
  "capabilities": ["claude-cli", "git", "file-access", "shell"]
}

# Run the client
npm start
```

### 3. Verify Machine Connection

1. Check client console for:
   ```
   [INFO] WebSocket connected
   [SUCCESS] Successfully registered with server as "Test Machine 1"
   ```

2. In the Web UI:
   - Machine selector dropdown should show your machine
   - Green status indicator means online
   - Machine name matches your config

### 4. Test Machine Selection

1. Select your machine from the dropdown
2. Browse projects - should show projects from that machine
3. Select a project and session
4. Verify in client logs:
   ```
   [INFO] API Request: GET /projects
   ```

### 5. Test Claude Commands

1. With machine and project selected
2. Send a message in chat
3. Verify in client logs:
   ```
   [INFO] Executing Claude command: <your message>
   ```
4. Response should stream back to Web UI

### 6. Test Machine Disconnection

1. Stop the client (Ctrl+C)
2. Machine shows offline immediately (gray/red indicator)
3. Try to use it - should get error:
   ```
   Target machine is not available
   ```

### 7. Test Machine Removal

1. While machine is offline, click X button
2. Machine removed from list
3. If it was selected, selection clears

### 8. Test Multi-Machine Setup

1. Start a second client with different:
   - API token (create new one)
   - Client name
   - Different machine
2. Both should appear in dropdown
3. Can switch between them
4. Each shows its own projects

## Expected Behavior

- **Online machines**: Green indicator, can execute commands
- **Offline machines**: Gray/red indicator, cannot execute, can be removed
- **Real-time status**: Updates immediately on connect/disconnect
- **Independent operation**: Each machine has its own projects/sessions
- **Persistence**: Selected machine saved to localStorage

## Troubleshooting

### Machine not appearing in list
- Verify API token is correct in config.json
- Check server URL includes protocol (http:// or https://)
- Look for authentication errors in client console
- Ensure server is accessible from client machine

### "Invalid token" errors
- Token may have been revoked - create new one
- Ensure token is copied exactly (no extra spaces)
- Check token hasn't expired (if expiration was set)

### Commands not routing to machine
- Verify machine is selected in dropdown
- Check machine shows as online (green indicator)
- Look for "X-Machine-ID" header in server logs
- Ensure Claude CLI is installed on client machine

### Connection keeps dropping
- Check network stability
- Increase reconnectInterval in config.json
- Look for errors in both client and server logs
- Verify firewall allows WebSocket connections

## Security Notes

- API tokens are permanent until revoked
- Each client should have its own token
- Tokens are shown only once during creation
- Store tokens securely (don't commit config.json)
- Revoke unused tokens from Settings → API Tokens