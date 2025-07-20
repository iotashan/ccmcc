# Changelog

All notable changes to Claude Code UI are documented in this file.

## [July 19, 2025] - Multi-Machine Bug Fixes

### Fixed

#### Shell Operations Routing
- **Issue**: Shell operations failed on remote machines with "No active shell session" errors
- **Cause**: Server generated new `request_id` for each shell operation
- **Fix**: Implemented persistent `shellSessionId` that maintains session across all operations
- **Files Changed**:
  - `src/components/MainContent.jsx` - Pass selectedMachine prop to Shell component
  - `src/components/Shell.jsx` - Include machineId in WebSocket URL
  - `server/index.js` - Maintain consistent shellSessionId
  - `client/handlers/shellHandler.js` - Handle shell operations on client

#### Git Operations Routing  
- **Issue**: Git operations accessed server paths instead of remote machine paths
- **Cause**: Git routes were defined before machine routing middleware
- **Fix**: Moved all protected API routes after machine routing middleware
- **Files Changed**:
  - `server/index.js` - Reordered route definitions
  - `src/components/GitPanel.jsx` - Pass selectedMachine prop

#### MCP Operations Machine-Specific
- **Issue**: MCP configurations were not isolated per machine
- **Cause**: ToolsSettings used direct fetch() instead of api utility
- **Fix**: Updated all MCP API calls to use api utility with X-Machine-ID header
- **Files Changed**:
  - `src/components/ToolsSettings.jsx` - Use api.get/post/delete methods

### Added

#### Documentation
- **New Files**:
  - `claude-docs/troubleshooting.md` - Comprehensive troubleshooting guide
  - `claude-docs/changelog.md` - This changelog
- **Updated Files**:
  - `claude-docs/00-current-status.md` - Added "Recent Bug Fixes" section
  - `claude-docs/websocket-protocol.md` - Added Shell Operations section
  - `claude-docs/api-reference.md` - Added MCP operations and machine routing info

#### Dependencies
- Added `node-pty` to client package.json for shell emulation

## [July 18, 2025] - Multi-Machine Testing

### Tested
- Complete multi-machine functionality test plan execution
- Verified core 3-tier architecture working correctly
- Identified and fixed machine list UI synchronization issue

### Fixed
- Machine list not updating in real-time when machines connect/disconnect

## [Initial Release]

### Features
- 3-tier architecture: Web UI → Server → Client
- JWT authentication for Web UI
- API token authentication for machine clients  
- Real-time WebSocket communication
- Machine registration and heartbeat monitoring
- Shell access to remote machines
- Git operations on remote repositories
- MCP server management
- Session protection during active conversations
- Automatic machine cleanup on disconnect