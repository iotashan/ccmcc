# Multi-Machine Testing Guide

## Prerequisites

1. Claude Code UI server running
2. At least one remote machine with the client agent installed

## Testing Steps

### 1. Setup Client Machine

On the remote machine:

```bash
# Navigate to client directory
cd /path/to/claudecodeui/client

# Install dependencies
npm install

# Set environment variables
export CLAUDE_CODE_UI_SERVER_ADDRESS=http://your-server:3002
export CLAUDE_CODE_UI_CLIENT_NAME="My Remote Machine"

# Run the client
npm start
```

### 2. Verify Machine Connection

1. Open Claude Code UI in browser
2. Check the machine selector dropdown above projects
3. You should see:
   - "Local Machine" (always present)
   - Your remote machine name with a green dot (online)

### 3. Test Machine Selection

1. Select the remote machine from dropdown
2. Select a project
3. Send a Claude command
4. Verify in server logs:
   - Machine ID is logged correctly
   - Message is routed to the selected machine

### 4. Test Machine Status

1. Stop the client on remote machine
2. Wait ~30 seconds
3. Machine should show as offline (gray dot)
4. Try sending a command - should get "Machine is offline or unavailable" error

### 5. Test Machine Removal

1. Click the X button next to an offline machine
2. Machine should be removed from the list
3. Selection should revert to "Local Machine"

### 6. Test Persistence

1. Select a remote machine
2. Refresh the browser
3. Machine selection should persist

## Expected Behavior

- **Online machines**: Green dot, can execute commands
- **Offline machines**: Gray dot, cannot execute commands, can be removed
- **Local machine**: Always available, cannot be removed
- **Auto-refresh**: Machine status updates every 30 seconds
- **Persistence**: Machine selection saved to localStorage

## Troubleshooting

### Machine not appearing in list
- Check client is running with correct server address
- Verify authentication token is valid
- Check server logs for connection errors

### Commands not routing to machine
- Verify machine is selected in dropdown
- Check machine is online (green dot)
- Review server logs for routing errors

### Machine shows as offline when it's running
- Wait for auto-refresh (30 seconds)
- Check network connectivity
- Verify WebSocket connection in client logs