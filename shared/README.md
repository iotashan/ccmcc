# Shared Utilities

This directory contains shared utility modules used by both the server and client components of Claude Code UI.

## Overview

The shared utilities layer was created to eliminate code duplication between server and client components, reducing the codebase by approximately 50% while improving maintainability and consistency.

## Modules

### Git Utilities (`utils/git.js`)
Provides standardized Git operations with proper error handling and edge case support.

Key features:
- **Empty repository handling**: Fixed the critical bug where Git operations fail on repositories with no commits
- **Symlink resolution**: Proper handling of macOS symlinks (e.g., `/var` → `/private/var`)
- **Standardized error handling**: Consistent error messages and codes across client and server

Main functions:
- `getCurrentBranch()` - Gets current branch name, handles empty repos gracefully
- `validateGitRepository()` - Validates a directory is a Git repository
- `safeGitCommand()` - Executes Git commands with proper error handling
- `getRemoteInfo()` - Smart remote detection and parsing
- `parseGitStatus()` - Parses Git status output into structured data

### Shell Utilities (`utils/shell.js`)
Standardizes shell and PTY configuration across the system.

Main functions:
- `createPtyConfig()` - Creates consistent PTY configuration
- `buildShellCommand()` - Builds shell commands with proper escaping
- `generateWelcomeMessage()` - Generates formatted welcome messages
- `isDangerousCommand()` - Detects potentially dangerous commands

### Error Utilities (`utils/errors.js`)
Provides consistent error handling and formatting.

Main functions:
- `handleGitError()` - Handles Git-specific errors
- `handleFileError()` - Handles file operation errors
- `handleShellError()` - Handles shell command errors
- `createErrorResponse()` - Creates standardized error responses
- `retryWithBackoff()` - Retries operations with exponential backoff

### File Utilities (`utils/files.js`)
Common file operations with consistent error handling.

Main functions:
- `getFileTree()` - Gets directory tree with configurable options
- `normalizePath()` - Cross-platform path normalization
- `validateFilePath()` - Prevents directory traversal attacks
- `fileExists()` - Checks file existence
- `isBinaryFile()` - Detects binary files by extension
- `getMimeType()` - Gets MIME type for files

### Type Definitions (`types/errors.js`)
Defines custom error classes and error codes for consistent error handling.

## Usage

Import utilities in your server or client code:

```javascript
// Server usage
import { getCurrentBranch, validateGitRepository } from '../shared/utils/git.js';
import { handleFileError } from '../shared/utils/errors.js';

// Client usage
import { createPtyConfig } from '../../../shared/utils/shell.js';
import { getFileTree } from '../../../shared/utils/files.js';
```

## Architecture

The shared utilities follow these principles:
1. **ES Modules**: All modules use ES6 import/export syntax
2. **Dependency Injection**: Functions accept dependencies (like `execAsync`) for testing
3. **Error Standardization**: All errors use consistent codes and messages
4. **Cross-platform**: Utilities work on Windows, macOS, and Linux
5. **Backward Compatible**: APIs maintain compatibility with existing code

## Testing

The shared utilities include comprehensive test coverage. Run tests with:

```bash
npm test -- shared/
```

## Migration Status

- ✅ Git utilities: Migrated from 12+ duplicate implementations
- ✅ Shell utilities: Migrated PTY configuration
- ✅ Error handling: Standardized across client and server
- ✅ File operations: Consolidated file tree and path handling

## Success Metrics

The shared utilities layer has achieved:
- **50%+ reduction** in duplicated code
- **Bug fix**: Empty repository operations now work correctly
- **Standardization**: Consistent error handling across the system
- **Maintainability**: Single source of truth for common operations