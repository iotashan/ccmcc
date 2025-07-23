# Claude Code Mission Control Center (CCMCC)

![Logo](public/logo.svg)

Claude Code Mission Control Center (CCMCC) is a comprehensive desktop and mobile
interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code),
Anthropic's official CLI for AI-assisted coding.

**CCMCC is a fork of the excellent
[Claude Code UI](https://github.com/siteboon/claudecodeui) project**, enhanced
with a focus on multi-project and multi-machine capabilities. This fork enables
developers to work on multiple Claude Code projects simultaneously, even across
different machines, providing a true mission control experience for managing all
your AI-assisted coding sessions from a single interface.


## Screenshots

### Desktop View

![Desktop Interface](public/screenshots/desktop-main.png)
*Main interface showing project overview and chat*

### Mobile Experience

![Mobile Interface](public/screenshots/mobile-chat.png)
*Responsive mobile design with touch navigation*

## Features

### Core Capabilities

- **Multi-Project Dashboard** - Manage multiple Claude Code projects
  simultaneously
- **Cross-Machine Control** - Connect to Claude Code instances on different
  machines
- **Session Management** - Track and switch between sessions across all projects
- **Responsive Design** - Works on desktop, tablet, and mobile devices

### Development Tools

- **Interactive Chat Interface** - Communication with Claude Code
- **Integrated Shell Terminal** - Direct CLI access
- **File Explorer** - Navigate and edit files with syntax highlighting
- **Git Integration** - View changes, stage files, and commit
- **Real-time Sync** - Live updates when switching between projects

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
  and configured

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

5. **Open your browser:**
   - Navigate to `http://localhost:3001` (or your configured port)
   - Default login: Use the credentials you set in `.env`

## ⚠️ SECURITY WARNING - LOCAL NETWORK ONLY!

### 🚨 CRITICAL: This software is for LOCAL NETWORK USE ONLY!

**CCMCC is designed for:**

- ✅ Virtual machines (VMs) on your local network
- ✅ Docker containers in development
- ✅ Computers on your trusted home/office network
- ✅ Local development environments

**NEVER use CCMCC for:**

- ❌ Public internet exposure
- ❌ Untrusted networks
- ❌ Production environments without proper security

This software provides powerful tools (file access, shell commands, code
execution) that could be **extremely dangerous** if exposed to the public
internet. It has basic security measures but is **NOT hardened** for external
threats.


## Security & Tools Configuration

**🔒 Important Notice**: All Claude Code tools are **disabled by default**.
This prevents potentially harmful operations from running automatically.

### Enabling Tools

To use Claude Code's full functionality, you'll need to manually enable tools:

1. **Open Tools Settings** - Click the gear icon in the sidebar
2. **Enable Selectively** - Turn on only the tools you need
3. **Apply Settings** - Your preferences are saved locally

![Tools Settings Modal](public/screenshots/tools-modal.png)
*Tools Settings interface - enable only what you need*

**Recommended approach**: Start with basic tools enabled and add more as
needed. You can always adjust these settings later.

## Usage

For detailed usage instructions, see [USAGE.md](./USAGE.md). It covers:

- Core features and how to use them
- Mobile app capabilities
- Multi-machine workflows
- Keyboard shortcuts
- Tips and best practices

## Architecture

CCMCC uses a secure 3-tier architecture: Web UI → Server → Client

For detailed architecture information, see
[claude-docs/architecture.md](./claude-docs/architecture.md).

## Advanced Setup

### Remote Machine Client

For connecting remote machines and running the client as a system service:
- See [client/README.md](./client/README.md) for detailed setup instructions
- Includes platform-specific service configuration for:
  - **macOS** - launchd service setup
  - **Linux** - systemd service and Docker options
  - **Windows** - Windows Service configuration

## Testing

This project includes a comprehensive test suite with unit, integration, and end-to-end tests.

### Running Tests Locally

```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests only
```

### Docker Testing

For consistent test environments, use the Docker-based testing pipeline:

```bash
# Build and run all tests
./scripts/test-docker.sh

# Or use docker-compose directly
docker-compose -f docker-compose.test.yml up test-runner
```

### Test Coverage

- **Unit Tests**: Authentication, API endpoints, WebSocket connections
- **Integration Tests**: Server-client communication, auth flows, Git operations
- **E2E Tests**: User workflows, multi-machine scenarios

See [tests/README.md](tests/README.md) for detailed testing documentation.

## Contributing

We welcome contributions! Please see
[CONTRIBUTING.md](./.github/CONTRIBUTING.md) for guidelines on:

- Getting started with development
- Code style and quality standards
- Submitting pull requests
- Types of contributions we're looking for

## Troubleshooting

### Common Issues & Solutions

#### "No Claude projects found"

**Problem**: The UI shows no projects or empty project list
**Solutions**:

- Ensure [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) is
  properly installed
- Run `claude` command in at least one project directory to initialize
- Verify `~/.claude/projects/` directory exists and has proper permissions

#### File Explorer Issues

**Problem**: Files not loading, permission errors, empty directories
**Solutions**:

- Check project directory permissions (`ls -la` in terminal)
- Verify the project path exists and is accessible
- Review server console logs for detailed error messages
- Ensure you're not trying to access system directories outside project scope

## License

GNU General Public License v3.0 - see [LICENSE](LICENSE) file for details.

This project is open source and free to use, modify, and distribute under the
GPL v3 license.

## Credits & Acknowledgments

**CCMCC is a fork of
[Claude Code UI](https://github.com/siteboon/claudecodeui)** by the Siteboon
team. We are deeply grateful for their excellent work in creating the original
interface for Claude Code.

### Built With

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** -
  Anthropic's official CLI
- **[React](https://react.dev/)** - User interface library
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[CodeMirror](https://codemirror.net/)** - Advanced code editor

## Support & Community

### Stay Updated

- **Star** this repository to show support
- **Watch** for updates and new releases
- **Follow** the project for announcements

---

**Made with care for developers who juggle multiple AI-assisted coding
projects.**