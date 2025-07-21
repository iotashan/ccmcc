# Changelog

All notable changes to Claude Code UI are documented in this file.

## [July 21, 2025] - Codebase Unification Complete

### Major Refactoring
- **Implemented**: Shared utilities layer reducing code duplication by 50%+
- **Created**: `/shared` directory with utilities for Git, Shell, Files, and Error handling
- **Migrated**: 12+ duplicate implementations consolidated into shared modules
- **Impact**: ~1,400 lines of shared utilities replace ~2,800+ lines of duplicated code

### Fixed
- **Critical Bug**: Git operations now work correctly on empty repositories
  - **Old**: `git rev-parse --abbrev-ref HEAD` failed when HEAD doesn't exist
  - **New**: `git branch --show-current` with fallbacks handles all cases
  - **Files**: Both server and client now use shared `getCurrentBranch()` utility

### Added
- **Shared Utilities**:
  - `shared/utils/git.js` - Git operations with empty repo support
  - `shared/utils/shell.js` - PTY configuration and shell utilities
  - `shared/utils/errors.js` - Standardized error handling
  - `shared/utils/files.js` - File operations and tree traversal
  - `shared/types/errors.js` - Custom error classes and codes
- **Documentation**: Comprehensive README for shared utilities
- **Testing**: Test coverage for all shared utilities

### Technical Details
- **Architecture**: ES6 modules with dependency injection for testing
- **Compatibility**: Maintains backward compatibility with existing APIs
- **Cross-platform**: Handles platform-specific issues (macOS symlinks, Windows paths)
- **Error Handling**: Consistent error codes and messages across the system

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