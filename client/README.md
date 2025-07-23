# CCMCC Client Agent

Machine client for Claude Code Mission Control Center (CCMCC). This agent enables remote machines to connect to a CCMCC server, allowing you to manage Claude Code sessions across multiple machines from a single interface.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Client](#running-the-client)
- [Platform-Specific Service Setup](#platform-specific-service-setup)
  - [macOS (launchd)](#macos-launchd)
  - [Linux (systemd)](#linux-systemd)
  - [Linux (Docker)](#linux-docker)
  - [Windows Service](#windows-service)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Claude Code CLI** installed and configured on the machine
- Access to a running CCMCC server
- Valid API token from the CCMCC server

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone https://github.com/iotashan/ccmcc.git
   cd ccmcc/client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Configuration

### Environment Variables

Create a `.env` file in the client directory with the following variables:

```env
# Required: Server connection details
CLAUDE_CODE_UI_SERVER_ADDRESS=http://your-server:3020
CLAUDE_CODE_UI_CLIENT_NAME="My Remote Machine"
CLAUDE_CODE_UI_API_TOKEN=your-api-token-here

# Optional: Advanced settings
CLAUDE_CODE_UI_ENCRYPTION_KEY=your-encryption-key
CLAUDE_CODE_UI_LOG_LEVEL=info
CLAUDE_CODE_UI_RECONNECT_INTERVAL=5000
```

### Getting an API Token

1. Log into the CCMCC web interface as an admin
2. Go to Settings → Server → API Tokens
3. Create a new token with a descriptive name
4. Copy the token immediately (you won't see it again)

## Running the Client

### Manual Start

```bash
# Using npm
npm start

# Or directly with node
node src/index.js

# Development mode with auto-reload
npm run dev
```

### Command Line Options

```bash
# Override environment variables
node src/index.js \
  --server http://your-server:3020 \
  --name "My Remote Machine" \
  --token "your-api-token"

# Show all options
node src/index.js --help
```

## Platform-Specific Service Setup

### macOS (launchd)

macOS uses `launchd` for system services. Here's how to set up the CCMCC client:

1. **Create the service configuration**:
   ```bash
   sudo nano /Library/LaunchDaemons/com.ccmcc.client.plist
   ```

2. **Add the following content**:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <key>Label</key>
       <string>com.ccmcc.client</string>
       
       <key>ProgramArguments</key>
       <array>
           <string>/usr/local/bin/node</string>
           <string>/path/to/ccmcc/client/src/index.js</string>
       </array>
       
       <key>EnvironmentVariables</key>
       <dict>
           <key>CLAUDE_CODE_UI_SERVER_ADDRESS</key>
           <string>http://your-server:3020</string>
           <key>CLAUDE_CODE_UI_CLIENT_NAME</key>
           <string>My Mac</string>
           <key>CLAUDE_CODE_UI_API_TOKEN</key>
           <string>your-api-token-here</string>
           <key>CLAUDE_CODE_UI_ENCRYPTION_KEY</key>
           <string>your-encryption-key</string>
           <key>PATH</key>
           <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
           <key>HOME</key>
           <string>/Users/your-username</string>
       </dict>
       
       <key>WorkingDirectory</key>
       <string>/path/to/ccmcc/client</string>
       
       <key>RunAtLoad</key>
       <true/>
       
       <key>KeepAlive</key>
       <dict>
           <key>SuccessfulExit</key>
           <false/>
       </dict>
       
       <key>StandardOutPath</key>
       <string>/var/log/ccmcc-client.log</string>
       
       <key>StandardErrorPath</key>
       <string>/var/log/ccmcc-client.error.log</string>
       
       <key>UserName</key>
       <string>your-username</string>
   </dict>
   </plist>
   ```

3. **Set proper permissions**:
   ```bash
   sudo chown root:wheel /Library/LaunchDaemons/com.ccmcc.client.plist
   sudo chmod 644 /Library/LaunchDaemons/com.ccmcc.client.plist
   ```

4. **Load and start the service**:
   ```bash
   sudo launchctl load /Library/LaunchDaemons/com.ccmcc.client.plist
   sudo launchctl start com.ccmcc.client
   ```

5. **Manage the service**:
   ```bash
   # Check status
   sudo launchctl list | grep ccmcc
   
   # View logs
   tail -f /var/log/ccmcc-client.log
   
   # Stop service
   sudo launchctl stop com.ccmcc.client
   
   # Unload service
   sudo launchctl unload /Library/LaunchDaemons/com.ccmcc.client.plist
   ```

### Linux (systemd)

1. **Create the service file**:
   ```bash
   sudo nano /etc/systemd/system/ccmcc-client.service
   ```

2. **Add the following content**:
   ```ini
   [Unit]
   Description=CCMCC Client Agent
   Documentation=https://github.com/iotashan/ccmcc
   After=network-online.target
   Wants=network-online.target
   
   [Service]
   Type=simple
   User=your-username
   Group=your-group
   WorkingDirectory=/path/to/ccmcc/client
   
   # Environment variables
   Environment="NODE_ENV=production"
   Environment="CLAUDE_CODE_UI_SERVER_ADDRESS=http://your-server:3020"
   Environment="CLAUDE_CODE_UI_CLIENT_NAME=My Linux Machine"
   Environment="CLAUDE_CODE_UI_API_TOKEN=your-api-token-here"
   Environment="CLAUDE_CODE_UI_ENCRYPTION_KEY=your-encryption-key"
   Environment="PATH=/usr/local/bin:/usr/bin:/bin"
   
   # Start command
   ExecStart=/usr/bin/node /path/to/ccmcc/client/src/index.js
   
   # Restart configuration
   Restart=always
   RestartSec=10
   StartLimitInterval=200
   StartLimitBurst=5
   
   # Security settings
   NoNewPrivileges=true
   PrivateTmp=true
   ProtectSystem=strict
   ProtectHome=read-only
   ReadWritePaths=/home/your-username/.claude
   
   # Logging
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=ccmcc-client
   
   [Install]
   WantedBy=multi-user.target
   ```

3. **Enable and start the service**:
   ```bash
   # Reload systemd
   sudo systemctl daemon-reload
   
   # Enable auto-start
   sudo systemctl enable ccmcc-client
   
   # Start the service
   sudo systemctl start ccmcc-client
   
   # Check status
   sudo systemctl status ccmcc-client
   
   # View logs
   sudo journalctl -u ccmcc-client -f
   ```

### Linux (Docker)

1. **Create a Dockerfile** in the client directory:
   ```dockerfile
   FROM node:20-alpine
   
   # Install required dependencies
   RUN apk add --no-cache \
       python3 \
       make \
       g++ \
       git
   
   # Create app directory
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   
   # Install dependencies
   RUN npm ci --only=production
   
   # Copy application files
   COPY . .
   
   # Create non-root user
   RUN addgroup -g 1001 -S nodejs && \
       adduser -S nodejs -u 1001
   
   # Switch to non-root user
   USER nodejs
   
   # Start the client
   CMD ["node", "src/index.js"]
   ```

2. **Create docker-compose.yml**:
   ```yaml
   version: '3.8'
   
   services:
     ccmcc-client:
       build: .
       container_name: ccmcc-client
       restart: unless-stopped
       environment:
         - CLAUDE_CODE_UI_SERVER_ADDRESS=http://your-server:3020
         - CLAUDE_CODE_UI_CLIENT_NAME=Docker Client
         - CLAUDE_CODE_UI_API_TOKEN=your-api-token-here
         - CLAUDE_CODE_UI_ENCRYPTION_KEY=your-encryption-key
       volumes:
         - ~/.claude:/home/nodejs/.claude:ro
         - ./logs:/app/logs
       networks:
         - ccmcc-network
       logging:
         driver: "json-file"
         options:
           max-size: "10m"
           max-file: "3"
   
   networks:
     ccmcc-network:
       external: true
   ```

3. **Run with Docker**:
   ```bash
   # Build the image
   docker-compose build
   
   # Start the container
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   
   # Stop the container
   docker-compose down
   ```

### Windows Service

1. **Install Windows Service wrapper**:
   ```powershell
   npm install -g node-windows
   ```

2. **Create service installer** (`install-service.js`):
   ```javascript
   const Service = require('node-windows').Service;
   const path = require('path');
   
   // Create a new service object
   const svc = new Service({
     name: 'CCMCC Client',
     description: 'Claude Code Mission Control Center Client Agent',
     script: path.join(__dirname, 'src', 'index.js'),
     nodeOptions: [
       '--harmony',
       '--max_old_space_size=4096'
     ],
     env: [
       {
         name: 'CLAUDE_CODE_UI_SERVER_ADDRESS',
         value: 'http://your-server:3020'
       },
       {
         name: 'CLAUDE_CODE_UI_CLIENT_NAME',
         value: 'My Windows Machine'
       },
       {
         name: 'CLAUDE_CODE_UI_API_TOKEN',
         value: 'your-api-token-here'
       },
       {
         name: 'CLAUDE_CODE_UI_ENCRYPTION_KEY',
         value: 'your-encryption-key'
       }
     ]
   });
   
   // Listen for the "install" event
   svc.on('install', function() {
     console.log('Service installed successfully');
     svc.start();
   });
   
   svc.on('start', function() {
     console.log('Service started successfully');
   });
   
   // Install the service
   svc.install();
   ```

3. **Create service uninstaller** (`uninstall-service.js`):
   ```javascript
   const Service = require('node-windows').Service;
   const path = require('path');
   
   const svc = new Service({
     name: 'CCMCC Client',
     script: path.join(__dirname, 'src', 'index.js')
   });
   
   svc.on('uninstall', function() {
     console.log('Service uninstalled successfully');
   });
   
   svc.uninstall();
   ```

4. **Install and manage the service**:
   ```powershell
   # Install the service
   node install-service.js
   
   # The service will now appear in Windows Services
   # You can manage it through:
   # - Services management console (services.msc)
   # - PowerShell commands:
   
   # Check status
   Get-Service "CCMCC Client"
   
   # Start service
   Start-Service "CCMCC Client"
   
   # Stop service
   Stop-Service "CCMCC Client"
   
   # View logs (check Windows Event Viewer)
   ```

## Troubleshooting

### Connection Issues

1. **Check server connectivity**:
   ```bash
   curl http://your-server:3020/health
   ```

2. **Verify API token**:
   - Ensure the token hasn't been revoked
   - Check token permissions in server settings

3. **Review logs**:
   - macOS: `/var/log/ccmcc-client.log`
   - Linux: `journalctl -u ccmcc-client`
   - Windows: Event Viewer → Applications
   - Docker: `docker-compose logs`

### Common Problems

#### "Authentication failed"
- Verify your API token is correct
- Check if the token has been revoked on the server
- Ensure the server's encryption key matches

#### "Cannot connect to Claude CLI"
- Verify Claude Code CLI is installed: `which claude`
- Check PATH environment variable includes Claude CLI location
- Ensure the service user has permission to run Claude CLI

#### "Permission denied" errors
- Check file permissions for the service user
- Ensure the service has access to `~/.claude` directory
- Verify write permissions for log files

### Debug Mode

Run the client in debug mode for verbose logging:
```bash
CLAUDE_CODE_UI_LOG_LEVEL=debug npm start
```

## Security Considerations

1. **API Token Security**:
   - Store tokens securely (use environment variables, not hardcoded)
   - Use appropriate file permissions (600 for config files)
   - Rotate tokens regularly

2. **Network Security**:
   - Use HTTPS for production deployments
   - Consider VPN for remote connections
   - Implement firewall rules to restrict access

3. **Service Permissions**:
   - Run services as non-root users when possible
   - Limit file system access to necessary directories
   - Use systemd security features (ProtectSystem, PrivateTmp)

4. **Logging**:
   - Avoid logging sensitive information
   - Implement log rotation
   - Monitor logs for suspicious activity

## Advanced Configuration

### Custom Environment File

Specify a custom environment file location:
```bash
node src/index.js --env-file /etc/ccmcc/client.env
```

### Multiple Instances

Run multiple clients on the same machine with different configurations:
```bash
# Instance 1
CLAUDE_CODE_UI_CLIENT_NAME="Project A" \
CLAUDE_CODE_UI_API_TOKEN="token-a" \
node src/index.js

# Instance 2
CLAUDE_CODE_UI_CLIENT_NAME="Project B" \
CLAUDE_CODE_UI_API_TOKEN="token-b" \
node src/index.js
```

### Health Checks

The client exposes a health endpoint for monitoring:
```bash
curl http://localhost:3021/health
```

## Support

For issues and questions:
- Check the [main documentation](../README.md)
- Review [troubleshooting guide](../claude-docs/troubleshooting.md)
- Open an issue on [GitHub](https://github.com/iotashan/ccmcc/issues)