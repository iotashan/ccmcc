<div align="center">
  <img src="public/logo.svg" alt="Claude Code Mission Control Center" width="64" height="64">
  <h1>Claude Code Mission Control Center</h1>
  <h3>CCMCC</h3>
</div>


Claude Code Mission Control Center (CCMCC) is a comprehensive desktop and mobile interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), Anthropic's official CLI for AI-assisted coding. 

**CCMCC is a fork of the excellent [Claude Code UI](https://github.com/siteboon/claudecodeui) project**, enhanced with a focus on multi-project and multi-machine capabilities. This fork enables developers to work on multiple Claude Code projects simultaneously, even across different machines, providing a true mission control experience for managing all your AI-assisted coding sessions from a single interface.

Key enhancements in CCMCC:
- **Multi-Project Management** - Work on multiple Claude Code projects simultaneously without context switching
- **Cross-Machine Control** - Connect to and manage Claude Code sessions running on different machines
- **Unified Mission Control** - Single interface to oversee all your AI coding activities across projects and machines
- **Enhanced Session Management** - Improved handling of concurrent sessions and project switching 

## Screenshots

<div align="center">
  
<table>
<tr>
<td align="center">
<h3>Desktop View</h3>
<img src="public/screenshots/desktop-main.png" alt="Desktop Interface" width="400">
<br>
<em>Main interface showing project overview and chat</em>
</td>
<td align="center">
<h3>Mobile Experience</h3>
<img src="public/screenshots/mobile-chat.png" alt="Mobile Interface" width="250">
<br>
<em>Responsive mobile design with touch navigation</em>
</td>
</tr>
</table>



</div>

## Features

### Core Capabilities
- **Multi-Project Dashboard** - Manage multiple Claude Code projects simultaneously from a single interface
- **Cross-Machine Control** - Connect to Claude Code instances running on different machines (local and remote)
- **Unified Session Management** - Track and switch between sessions across all your projects and machines
- **Responsive Design** - Works seamlessly across desktop, tablet, and mobile devices

### Development Tools
- **Interactive Chat Interface** - Seamless communication with Claude Code across all your projects
- **Integrated Shell Terminal** - Direct CLI access with project-specific contexts
- **File Explorer** - Navigate and edit files with syntax highlighting
- **Git Integration** - View changes, stage files, and commit across projects
- **Real-time Sync** - Live updates when switching between projects and machines


## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and configured

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/iotashan/ccmcc.git
cd ccmcc
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

4. **Start the application:**
```bash
# Development mode (with hot reload)
npm run dev

```
The application will start at the port you specified in your .env

5. **Open your browser:**
   - Development: `http://localhost:3001`

## Security & Tools Configuration

**🔒 Important Notice**: All Claude Code tools are **disabled by default**. This prevents potentially harmful operations from running automatically.

### Enabling Tools

To use Claude Code's full functionality, you'll need to manually enable tools:

1. **Open Tools Settings** - Click the gear icon in the sidebar
3. **Enable Selectively** - Turn on only the tools you need
4. **Apply Settings** - Your preferences are saved locally

<div align="center">

![Tools Settings Modal](public/screenshots/tools-modal.png)
*Tools Settings interface - enable only what you need*

</div>

**Recommended approach**: Start with basic tools enabled and add more as needed. You can always adjust these settings later.

## Usage Guide

### Core Features

#### Project Management
The UI automatically discovers Claude Code projects from `~/.claude/projects/` and provides:
- **Visual Project Browser** - All available projects with metadata and session counts
- **Project Actions** - Rename, delete, and organize projects
- **Smart Navigation** - Quick access to recent projects and sessions

#### Chat Interface
- **Use responsive chat or Claude Code CLI** - You can either use the adapted chat interface or use the shell button to connect to Claude Code CLI. 
- **Real-time Communication** - Stream responses from Claude with WebSocket connection
- **Session Management** - Resume previous conversations or start fresh sessions
- **Message History** - Complete conversation history with timestamps and metadata
- **Multi-format Support** - Text, code blocks, and file references

#### File Explorer & Editor
- **Interactive File Tree** - Browse project structure with expand/collapse navigation
- **Live File Editing** - Read, modify, and save files directly in the interface
- **Syntax Highlighting** - Support for multiple programming languages
- **File Operations** - Create, rename, delete files and directories

#### Git Explorer


#### Session Management
- **Session Persistence** - All conversations automatically saved
- **Session Organization** - Group sessions by project and timestamp
- **Session Actions** - Rename, delete, and export conversation history
- **Cross-device Sync** - Access sessions from any device

### Mobile App
- **Responsive Design** - Optimized for all screen sizes
- **Touch-friendly Interface** - Swipe gestures and touch navigation
- **Mobile Navigation** - Bottom tab bar for easy thumb navigation
- **Adaptive Layout** - Collapsible sidebar and smart content prioritization
- **Add shortcut to Home Screen** - Add a shortcut to your home screen and the app will behave like a PWA

## Architecture

### System Overview

Claude Code UI follows a client-server architecture that enables remote machine control:

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Web UI        │         │   Server        │         │   Client        │
│   (Browser)     │◄───────►│ (Central Hub)   │◄───────►│  (Remote PC)    │
│                 │  HTTPS  │                 │   WS    │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
        │                            │                            │
        │                            │                            │
        ▼                            ▼                            ▼
   User Interface            Manages Connections           Claude CLI
   - View projects           - Routes API calls           - Executes commands
   - Chat interface          - Auth & security            - File operations
   - File explorer           - WebSocket relay            - Git operations
```

### How It Works

1. **Server (Central Hub)** - Runs on a publicly accessible machine
   - Manages authentication (JWT for web UI, API tokens for clients)
   - Routes API requests from web UI to appropriate clients
   - Maintains WebSocket connections with all clients
   - Handles user management and permissions

2. **Web UI** - Accessed through any modern browser
   - Connects to server via HTTPS/WSS
   - Provides interface for managing Claude Code projects
   - Can control any connected client machine
   - Uses JWT authentication for user sessions

3. **Client (Remote Machines)** - Runs on machines with Claude CLI
   - Connects to server using API token authentication
   - Executes Claude CLI commands locally
   - Handles file system operations
   - Reports back to server with results

### Remote Machine Control

The key feature is that the Web UI never connects directly to clients. Instead:
- Web UI sends requests to the server with a `X-Machine-ID` header
- Server forwards these requests to the appropriate connected client
- Client processes the request locally and sends results back
- Server relays the results to the Web UI

This architecture allows you to:
- Control multiple remote machines from a single interface
- Access Claude Code projects on any machine from anywhere
- Maintain security through centralized authentication
- Work with files and run commands on remote machines

## Starting the Client

### Prerequisites for Client Machine

- Node.js v20 or higher
- Claude CLI installed and configured
- Network access to the server

### Client Installation

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

### Getting an API Token

1. Log into the Web UI
2. Go to Settings → API Tokens
3. Click "Create New Token"
4. Give it a name (e.g., "Work Computer")
5. Copy the token and use it in your client configuration

### Running Client as a Service

For production use, you may want to run the client as a system service:

**On Linux (systemd):**
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
WorkingDirectory=/path/to/claudecodeui/client
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable claude-code-client
sudo systemctl start claude-code-client
```

**On Windows:** Consider using [node-windows](https://github.com/coreybutler/node-windows) or Task Scheduler.

**On macOS:** Use launchd with a plist file in `~/Library/LaunchAgents/`.

### Backend (Node.js + Express)
- **Express Server** - RESTful API with static file serving
- **WebSocket Server** - Bidirectional communication for real-time updates
- **Authentication** - Dual auth system (JWT for web, API tokens for clients)
- **Machine Management** - Tracks and routes to connected clients
- **Request Forwarding** - Routes API calls to appropriate client machines

### Frontend (React + Vite)
- **React 18** - Modern component architecture with hooks
- **CodeMirror** - Advanced code editor with syntax highlighting
- **Machine Selector** - UI for choosing which client to control
- **Real-time Updates** - WebSocket connection for live data





### Contributing

We welcome contributions! Please follow these guidelines:

#### Getting Started
1. **Fork** the repository
2. **Clone** your fork: `git clone <your-fork-url>`
3. **Install** dependencies: `npm install`
4. **Create** a feature branch: `git checkout -b feature/amazing-feature`

#### Development Process
1. **Make your changes** following the existing code style
2. **Test thoroughly** - ensure all features work correctly
3. **Run quality checks**: `npm run lint && npm run format`
4. **Commit** with descriptive messages following [Conventional Commits](https://conventionalcommits.org/)
5. **Push** to your branch: `git push origin feature/amazing-feature`
6. **Submit** a Pull Request with:
   - Clear description of changes
   - Screenshots for UI changes
   - Test results if applicable

#### What to Contribute
- **Bug fixes** - Help us improve stability
- **New features** - Enhance functionality (discuss in issues first)
- **Documentation** - Improve guides and API docs
- **UI/UX improvements** - Better user experience
- **Performance optimizations** - Make it faster

## Troubleshooting

### Common Issues & Solutions

#### "No Claude projects found"
**Problem**: The UI shows no projects or empty project list
**Solutions**:
- Ensure [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) is properly installed
- Run `claude` command in at least one project directory to initialize
- Verify `~/.claude/projects/` directory exists and has proper permissions
d

#### File Explorer Issues
**Problem**: Files not loading, permission errors, empty directories
**Solutions**:
- Check project directory permissions (`ls -la` in terminal)
- Verify the project path exists and is accessible
- Review server console logs for detailed error messages
- Ensure you're not trying to access system directories outside project scope


## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) file for details.

This project is open source and free to use, modify, and distribute under the GPL v3 license.

## Credits & Acknowledgments

### Original Project
**CCMCC is a fork of [Claude Code UI](https://github.com/siteboon/claudecodeui)** by the Siteboon team. We are deeply grateful for their excellent work in creating the original interface for Claude Code. Their project laid the foundation that made CCMCC possible.

### Built With
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[React](https://react.dev/)** - User interface library
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[CodeMirror](https://codemirror.net/)** - Advanced code editor


## Support & Community

### Stay Updated
- **Star** this repository to show support
- **Watch** for updates and new releases
- **Follow** the project for announcements

### Contributing
We welcome contributions! Whether it's bug fixes, new features, or documentation improvements, your help makes CCMCC better for everyone.

---

<div align="center">
  <strong>Made with care for developers who juggle multiple AI-assisted coding projects.</strong>
  <br>
  <em>Fork of the original Claude Code UI project</em>
</div>
