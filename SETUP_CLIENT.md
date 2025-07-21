# Setting Up CCMCC Client on Remote Machines

This guide covers detailed setup instructions for running the CCMCC client on remote machines to enable multi-machine Claude Code control.

## ⚠️ CRITICAL SECURITY WARNING

**CCMCC is designed for LOCAL NETWORK USE ONLY!**

This system has basic security measures but is **NOT hardened for public internet exposure**. Only use CCMCC for:
- Virtual machines (VMs) on your local network
- Docker containers
- Computers on your trusted local network
- Development environments

**NEVER expose CCMCC to the public internet!** The tools available through Claude Code (file access, shell commands, etc.) are extremely powerful and dangerous if exposed to untrusted networks.

## Prerequisites for Client Machine

- Node.js v20 or higher
- Claude CLI installed and configured
- Network access to the server
- Appropriate permissions for Claude CLI operations

## Client Installation

1. **Clone the repository on the client machine:**
```bash
git clone https://github.com/iotashan/ccmcc.git
cd ccmcc/client
```

2. **Install client dependencies:**
```bash
npm install
```

3. **Configure the client:**
```bash
# Create configuration file
cp config.example.json config.json

# Edit config.json with your settings:
{
  "serverAddress": "https://your-server-address:3020",
  "authToken": "your-api-token-from-server",
  "clientName": "My Work Computer",
  "capabilities": ["claude-cli", "git", "file-access", "shell"]
}
```

4. **Start the client:**
```bash
npm start
```

The client will:
- Connect to the server using WebSocket
- Authenticate using the API token
- Register itself with the server
- Begin listening for commands from the Web UI

## Getting an API Token

1. Log into the Web UI
2. Go to Settings → API Tokens
3. Click "Create New Token"
4. Give it a name (e.g., "Work Computer")
5. Copy the token and use it in your client configuration

## Running Client as a Service

For production use, you may want to run the client as a system service:

### On Linux (systemd)

```bash
# Create service file
sudo nano /etc/systemd/system/claude-code-client.service

# Add this content:
[Unit]
Description=Claude Code UI Client
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/ccmcc/client
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable claude-code-client
sudo systemctl start claude-code-client
```

### On Windows

Consider using [node-windows](https://github.com/coreybutler/node-windows) or Task Scheduler.

### On macOS

Use launchd with a plist file in `~/Library/LaunchAgents/`.

## Client Configuration Options

The `config.json` file supports the following options:

```json
{
  "serverAddress": "https://server:3020",  // Server URL
  "authToken": "your-token",               // API token from server
  "clientName": "My Machine",              // Display name in UI
  "capabilities": [                        // Available features
    "claude-cli",
    "git", 
    "file-access",
    "shell"
  ],
  "reconnectInterval": 5000,               // Reconnect delay (ms)
  "maxReconnectAttempts": 10              // Max reconnection tries
}
```

## Troubleshooting Client Connection

### Client won't connect
- Verify server is running and accessible
- Check firewall rules allow connection to server port
- Ensure API token is valid
- Check client logs for error messages

### Authentication failures
- Regenerate API token in Web UI
- Ensure token is copied correctly (no extra spaces)
- Verify server logs for auth errors

### Commands not working
- Ensure Claude CLI is installed and accessible
- Check client has necessary permissions
- Verify capabilities match what's needed
- Review client console output for errors

## Security Best Practices

1. **Network Security**
   - Only run on trusted local networks
   - Use VPN for remote access instead of exposing to internet
   - Configure firewall rules to limit access

2. **Token Management**
   - Rotate API tokens regularly
   - Use unique tokens for each client
   - Store tokens securely

3. **Client Permissions**
   - Run client with minimal necessary permissions
   - Restrict file system access where possible
   - Monitor client activity logs

## Advanced Configuration

### Environment Variables

The client supports these environment variables:

```bash
NODE_ENV=production      # Production mode
DEBUG=true              # Enable debug logging
SERVER_ADDRESS=...      # Override config file
AUTH_TOKEN=...         # Override config file
```

### Custom Capabilities

You can limit client capabilities for security:

```json
{
  "capabilities": ["claude-cli", "git"]  // No shell or file access
}
```

### Logging

Client logs are written to:
- Console output (stdout/stderr)
- `client.log` file in the client directory

To increase log verbosity:
```bash
DEBUG=true npm start
```
