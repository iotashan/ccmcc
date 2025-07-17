# PRD: Context-Aware Settings System

## Overview
This document outlines the implementation of a simplified context-aware settings system for Claude Code UI that allows users to manage settings for both the main server and connected remote clients through a unified interface.

## Problem Statement
Currently, the Settings modal shows a "Clients" tab for API token management, but users need to be able to configure settings for individual remote machines without complex UI context switching or separate client interfaces.

## Solution Approach
Implement a unified settings system where:
- The same Claude Code UI server runs on remote machines in "client mode"
- Remote clients connect to the main server via WebSocket using API tokens
- Settings are managed through the same UI but fetched from different sources (local vs remote)
- Settings synchronization is achieved through simple file copying, not complex state management

## Key Insights
- **Client = Server in different mode**: Remote clients run the same Claude Code UI server, just connecting as clients
- **Same settings structure**: No need for separate client settings schema
- **Unified UI**: No complex context switching - just different data sources
- **Simple sync**: Copy settings files instead of complex state synchronization

## Requirements

### 1. Tab Structure Changes
- **Current**: "Tools", "Appearance", "Clients"
- **New**: "Tools [Context]", "Appearance", "Server"

**Context Display:**
- When viewing main server: "Tools"
- When viewing remote client: "Tools [ClientName]"

### 2. Settings Context Behavior

**Server Context (Main Server):**
- Show: "Tools", "Appearance", "Server" tabs
- "Tools" tab: Configure main server MCP settings and tools
- "Server" tab: API token management (renamed from "Clients")
- "Appearance" tab: Web UI appearance settings (unchanged)

**Client Context (Remote Machine):**
- Show: "Tools [ClientName]", "Appearance" tabs
- "Server" tab: Hidden/disabled (no API token management on clients)
- "Tools [ClientName]" tab: Configure client-specific MCP settings and tools
- "Appearance" tab: Web UI appearance settings (unchanged)

### 3. Settings Synchronization

**Copy MCP Settings from Server:**
- Button in client "Tools [ClientName]" tab
- Copies server MCP configuration files to client
- Shows confirmation dialog with overwrite warning
- Preserves client-specific settings (machine paths, etc.)

**Settings Architecture:**
- Same settings file structure on server and clients
- Settings fetched via API calls to respective machines
- No complex state management - just file operations

### 4. Technical Implementation

**4.1 Machine Context Detection:**
- Leverage existing machine selection system
- Pass current machine context to Settings modal
- Determine server vs client based on machine properties

**4.2 Settings Data Flow:**
```
Web UI → Settings Modal → API Call → Target Machine (Server or Client)
```

**4.3 Settings Synchronization:**
```
Client Request → Main Server → Fetch Server Settings → Copy to Client → Validate
```

## User Experience Flow

### Viewing Server Settings
1. User has main server selected
2. Opens Settings modal
3. Sees: "Tools", "Appearance", "Server" tabs
4. "Tools" tab shows server MCP configuration
5. "Server" tab shows API token management

### Viewing Client Settings
1. User selects remote client from machine selector
2. Opens Settings modal
3. Sees: "Tools [ClientName]", "Appearance" tabs
4. "Tools [ClientName]" tab shows client-specific configuration
5. "Copy MCP Settings from Server" button available

### MCP Settings Synchronization
1. User on client settings clicks "Copy MCP Settings from Server"
2. System shows preview of settings to be copied
3. User confirms with warning about overwriting existing settings
4. System copies compatible settings from server to client
5. User receives confirmation and can test new settings

## Technical Requirements

### 1. Settings API Endpoints
- `GET /api/settings` - Get current machine settings
- `POST /api/settings` - Update current machine settings
- `POST /api/settings/sync-from-server` - Copy server settings to client

### 2. Settings File Structure
- Same MCP configuration format on server and clients
- Client-specific overrides for machine-dependent settings
- Validation for setting compatibility

### 3. UI Components
- Context-aware ToolsSettings component
- Dynamic tab rendering based on machine context
- Settings synchronization UI with confirmation dialogs

## Success Criteria

### Functional
- [ ] Settings modal correctly adapts to server/client context
- [ ] Tab structure changes based on selected machine
- [ ] MCP settings can be copied from server to client
- [ ] Settings persist correctly on both server and clients
- [ ] No breaking changes to existing functionality

### User Experience
- [ ] Clear visual indication of current context
- [ ] Intuitive settings management flow
- [ ] Proper confirmation dialogs for destructive operations
- [ ] Helpful error messages and recovery options

### Technical
- [ ] Unified settings architecture
- [ ] Clean separation of server and client contexts
- [ ] Reliable settings synchronization
- [ ] Proper error handling and validation

## Implementation Phases

### Phase 1: Foundation
- ✅ **Understand current machine selection system** 
  - **Status**: COMPLETED
  - **Key Findings**: 
    - Machine state managed via `useMachines` hook
    - Server context: `selectedMachine === 'local'`
    - Client context: Remote machines with unique IDs
    - Machine data includes: `{id, name, status, lastSeen, isLocal?}`
    - Context flows: App.jsx → MainContent.jsx → ChatInterface.jsx
    - Integration point: `selectedMachine` state and `machines` array
- ✅ **Modify ToolsSettings to accept machine context**
  - **Status**: COMPLETED
  - **Implementation**: 
    - Added `selectedMachine` and `machines` props to ToolsSettings component
    - Added context logic: `isServerContext = selectedMachine === 'local'`
    - Added machine name resolution: `machineName = isServerContext ? 'Server' : currentMachine?.name`
    - Updated App.jsx to pass machine context to ToolsSettings
- ✅ **Implement basic tab renaming and conditional rendering**
  - **Status**: COMPLETED
  - **Implementation**: 
    - Updated "Tools" tab to show "Tools [ClientName]" for clients
    - Renamed "Clients" tab to "Server" tab
    - Added conditional rendering (Server tab only shows in server context)
    - Added useEffect to ensure valid tab selection for context
    - Added "Copy MCP Settings from Server" button for client context
    - Added online/offline state handling for client machines
  - **Testing**: Successfully builds and compiles

### UI Fixes Applied
- ✅ **Fixed missing copy button in 'Setting up a remote machine' section**
  - **Implementation**: Added copy button back to code section with hover effect
  - **Feature**: Copy button appears on hover and copies complete .env configuration
- ✅ **Use token name for CLAUDE_CODE_UI_CLIENT_NAME default value**
  - **Implementation**: Changed default from "Remote Machine Name" to token name
  - **Logic**: `${newTokenResult ? newTokenResult.name : 'Remote Machine Name'}`
- ✅ **Changed 'Setting up a remote machine' icon to computer/networking icon**
  - **Implementation**: Replaced `Smartphone` icon with `Terminal` icon
  - **Visual**: More appropriate computer/networking representation
- ✅ **Clear token state when closing settings window**
  - **Implementation**: Added `handleClose()` function that clears `newTokenResult` state
  - **Security**: Ensures token value is not retained in memory after closing

### Phase 2: Settings Management
- ✅ **Implement settings API for remote machine access**
  - **Status**: COMPLETED
  - **Implementation**: 
    - Created `/server/routes/settings.js` with GET, POST, and sync-from-server endpoints
    - Added `machine_settings` table to database schema for persistent storage
    - Fixed database import issues - server starts successfully
    - API endpoints: `GET /api/settings`, `POST /api/settings`, `POST /api/settings/sync-from-server`
    - Machine-aware routing via `x-machine-id` header for remote machine access
    - JSON blob storage for flexible settings data structure
- ✅ **Create settings synchronization infrastructure**
  - **Status**: COMPLETED
  - **Implementation**: 
    - Added settings API endpoints to `/src/utils/api.js`: `api.settings.get()`, `api.settings.save()`, `api.settings.syncFromServer()`
    - Updated `loadSettings()` function to use API instead of localStorage (with fallback)
    - Updated `saveSettings()` function to use API with automatic machine routing
    - Added comprehensive error handling and backwards compatibility
- ✅ **Add MCP settings copy functionality to UI**
  - **Status**: COMPLETED
  - **Implementation**: 
    - Implemented `handleSyncFromServer()` function with confirmation flow
    - Added UI states: loading, confirmation, success/error feedback
    - Two-click confirmation: First click shows warning, second click confirms
    - Visual feedback: Loading spinner, status messages, confirmation dialog
    - Automatic reload of settings after successful sync
    - Cancel functionality for confirmation state
    - Proper error handling with user-friendly messages

### Phase 3: Encrypted Communication ✅
- ✅ **Implement application-level AES-256-GCM encryption**
  - **Status**: COMPLETED
  - **Implementation**:
    - Created `/server/utils/encryption.js` with comprehensive encryption/decryption functions
    - Implemented PBKDF2 key derivation with salt for added security
    - Added authentication tag support for message integrity
- ✅ **Add Pre-Shared Key (PSK) generation and storage**
  - **Status**: COMPLETED
  - **Implementation**:
    - Added `encryption_key` column to users table
    - Generate 256-bit encryption keys during user registration
    - Auto-generate keys for existing users on first access
- ✅ **Implement key distribution via API token UI**
  - **Status**: COMPLETED
  - **Implementation**:
    - Added encryption key as 4th line in API token .env display
    - Updated `/api/config` endpoint to return encryption key
    - Key format: `CLAUDE_CODE_UI_ENCRYPTION_KEY=<base64-encoded-key>`
- ✅ **Update client to support encrypted communications**
  - **Status**: COMPLETED
  - **Implementation**:
    - Created `/src/utils/encryption.js` with browser-compatible encryption
    - Updated `authenticatedFetch` to handle encrypted requests/responses
    - Added encryption support headers and automatic key retrieval
- ✅ **Integrate encryption middleware into server**
  - **Status**: COMPLETED
  - **Implementation**:
    - Added encryption/decryption middleware to Express routes
    - Updated WebSocket handlers to use encrypted messages
    - Implemented helper functions for encrypted WebSocket communication
- [ ] Test encrypted communication between server and clients

### Phase 4: Polish and Testing
- Add confirmation dialogs and error handling
- Implement comprehensive testing
- Add documentation and user guidance

## Risks and Mitigation

### Risk: Settings Corruption
- **Mitigation**: Automatic backup before any sync operation
- **Mitigation**: Settings validation before applying changes
- **Mitigation**: Rollback functionality for failed operations

### Risk: User Confusion
- **Mitigation**: Clear visual indicators for current context
- **Mitigation**: Descriptive tab labels with machine names
- **Mitigation**: Confirmation dialogs for destructive operations

### Risk: Network Failures
- **Mitigation**: Proper error handling and retry logic
- **Mitigation**: Timeout handling for remote operations
- **Mitigation**: Graceful degradation when clients are offline

## Dependencies

### Technical Dependencies
- Existing machine selection system
- WebSocket connection to remote clients
- API token authentication system
- MCP configuration file structure

### User Dependencies
- Understanding of server/client architecture
- Familiarity with MCP settings configuration
- Proper API token setup for remote clients

## Assumptions

1. Remote clients run the same Claude Code UI server codebase
2. MCP settings have compatible file formats across machines
3. Network connectivity is reliable for settings operations
4. Users understand the concept of server vs client context

## Success Metrics

- Settings operations complete successfully >95% of the time
- User can successfully copy MCP settings from server to client
- Zero data loss incidents during settings synchronization
- User feedback indicates clear understanding of context switching

## Conclusion

This simplified approach leverages the existing architecture where clients are essentially servers in different modes. By avoiding complex UI context switching and using the same settings structure everywhere, we can provide a clean, intuitive settings management experience while maintaining the robustness of the existing system.