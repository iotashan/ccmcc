# CCMCC Client Agent

Machine client for Claude Code Mission Control Center (CCMCC). This agent enables remote machines to connect to a CCMCC server, allowing you to manage Claude Code sessions across multiple machines from a single interface.

## Installation

```bash
cd client
npm install
```

## Usage

### Running with Environment Variables

Set the following environment variables:

```bash
export CCMCC_SERVER_ADDRESS=http://your-server:3020
export CCMCC_CLIENT_NAME="My Remote Machine"
```

Then run:

```bash
npm start
```

Note: The client will automatically use the authentication token from `~/.claude-code/auth.json` that was created when you logged into CCMCC.

### Running with Command Line Arguments

```bash
node src/index.js --server http://your-server:3002 --name "My Remote Machine"
```

Or use the CLI wrapper:

```bash
./src/cli.js --server http://your-server:3002 --name "My Remote Machine"
```

### Command Line Options

- `-s, --server <address>`: CCMCC server address (default: http://localhost:3020)
- `-n, --name <name>`: Machine name (default: hostname)
- `-h, --help`: Display help information

### First Time Setup

1. Ensure you have logged into Claude Code UI at least once on this machine (this creates the auth token)
2. Run the client:
   ```bash
   npm start -- --server http://your-server:3002 --name "My Machine"
   ```
3. The machine will appear in the Claude Code UI machine selector

### Features

- Automatic reconnection on disconnect
- Heartbeat to maintain connection
- Claude CLI execution
- Project listing
- Session management
- File operations (coming soon)
- Git operations (coming soon)

### Systemd Service (Linux)

Create `/etc/systemd/system/claude-ui-client.service`:

```ini
[Unit]
Description=Claude Code UI Client
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/claude-code-ui/client
ExecStart=/usr/bin/node /path/to/claude-code-ui/client/src/index.js
Restart=always
RestartSec=10
Environment="CLAUDE_CODE_UI_SERVER_ADDRESS=http://your-server:3002"
Environment="CLAUDE_CODE_UI_CLIENT_NAME=My Remote Machine"

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable claude-ui-client
sudo systemctl start claude-ui-client
```

### Development

Run in development mode with auto-reload:
```bash
npm run dev
```