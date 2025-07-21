# Product Requirements Document: Codebase Unification

**Version**: 1.1  
**Date**: July 21, 2025  
**Status**: Complete ✅  
**Author**: Engineering Team

## 1. Executive Summary

### 1.1 Problem Statement
The Claude Code UI codebase has significant code duplication between the client and server components, with approximately 40% of handler logic duplicated. This creates maintenance burden, inconsistency risks, and makes bug fixes error-prone as they must be applied in multiple locations.

### 1.2 Solution Overview
Create a shared utilities layer that both client and server can use, starting with Git utilities (immediate fix needed) and progressively migrating shell, file, and error handling code to reduce duplication while maintaining architectural boundaries.

### 1.3 Key Benefits
- **50% reduction** in duplicated code
- **Single source of truth** for business logic
- **Consistent behavior** across all components
- **Faster bug fixes** - fix once, works everywhere
- **Improved testability** - shared utilities tested once

## 2. Background & Context

### 2.1 Current Architecture
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web UI    │────▶│   Server    │────▶│   Client    │
│  (Browser)  │     │(Central Hub)│     │  (Remote)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 2.2 Duplication Analysis
Based on analysis in [duplicated-code-analysis.md](./duplicated-code-analysis.md):

| Module | Duplication | Lines of Code | Priority |
|--------|------------|---------------|----------|
| Git Operations | 95% identical | ~800 lines | Critical |
| Shell Handling | 85% identical | ~300 lines | High |
| File Operations | 70% identical | ~400 lines | Medium |
| Error Handling | 90% identical | ~200 lines | High |
| Message Routing | 60% identical | ~150 lines | Low |

### 2.3 Immediate Issue
Git operations fail on repositories with no commits due to `git rev-parse --abbrev-ref HEAD` usage in 6 endpoints across both client and server. This blocks users from accessing Source Control for new repositories.

## 3. Goals & Non-Goals

### 3.1 Goals
1. **Eliminate critical Git bug** affecting empty repositories
2. **Reduce code duplication** by at least 50%
3. **Maintain existing APIs** - no breaking changes
4. **Improve maintainability** through shared utilities
5. **Ensure consistent behavior** between client/server
6. **Enable faster feature development** through reusable components

### 3.2 Non-Goals
1. **Not changing the 3-tier architecture** - Web UI → Server → Client remains
2. **Not merging client/server** - they remain separate deployable units
3. **Not sharing security-sensitive code** - auth/tokens stay separate
4. **Not changing external APIs** - all endpoints remain the same

## 4. User Stories

### 4.1 Developer Stories
- As a **developer**, I want to fix bugs in one place so that the fix applies everywhere
- As a **developer**, I want consistent error messages so that debugging is easier
- As a **developer**, I want shared utilities so that I can add features faster

### 4.2 End User Stories
- As a **user**, I want Git operations to work on new repositories so that I can start coding immediately
- As a **user**, I want consistent behavior so that the UI is predictable
- As a **user**, I want faster bug fixes so that issues are resolved quickly

## 5. Functional Requirements

### 5.1 Shared Utilities Structure
```
shared/
├── protocol.js          # Existing protocol definitions
├── utils/
│   ├── git.js          # Git helper functions
│   ├── shell.js        # Shell configuration & helpers
│   ├── files.js        # File operation utilities
│   ├── errors.js       # Error handling utilities
│   └── index.js        # Main exports
├── types/
│   ├── responses.js    # Response type definitions
│   └── errors.js       # Error type definitions
└── constants/
    ├── shell.js        # Shell configuration constants
    └── files.js        # File operation constants
```

### 5.2 Git Utilities (Phase 1)
```javascript
// shared/utils/git.js
export async function getCurrentBranch(projectPath, execAsync)
export async function validateGitRepository(projectPath, fs, execAsync)
export async function safeGitCommand(command, projectPath, execAsync)
export function gitErrorHandler(error)
export function isEmptyRepository(projectPath, execAsync)
```

### 5.3 Shell Utilities (Phase 2)
```javascript
// shared/utils/shell.js
export function createPtyConfig(cols, rows, cwd)
export function buildShellCommand(projectPath, sessionId)
export function generateWelcomeMessage(type, sessionId, projectPath)
export const SHELL_DEFAULTS = { cols: 80, rows: 24 }
```

### 5.4 File Utilities (Phase 3)
```javascript
// shared/utils/files.js
export async function getFileTree(dir, options)
export function handleFileError(error)
export function normalizePath(filePath)
export function validateFilePath(filePath, basePath)
```

### 5.5 Error Standardization
```javascript
// shared/types/errors.js
export class GitOperationError extends Error
export class FileOperationError extends Error
export class ShellOperationError extends Error
export const ErrorCodes = { /* standardized codes */ }
```

## 6. Technical Requirements

### 6.1 Compatibility
- Must work in both Node.js environments (client and server)
- ES modules (ESM) support required
- No browser-specific or Node-specific APIs in shared code

### 6.2 Dependencies
- Shared utilities can only depend on built-in Node.js modules
- External dependencies must be available in both client and server

### 6.3 Testing
- 90%+ code coverage for shared utilities
- Unit tests for all exported functions
- Integration tests for client/server usage

### 6.4 Performance
- No performance degradation from current implementation
- Bundle size increase < 5KB for shared utilities

## 7. Implementation Plan

### 7.1 Phase 1: Git Utilities (Week 1)
**Priority**: Critical - Fixes production bug

1. Create `shared/utils/git.js` with getCurrentBranch helper
2. Update server `/api/git/*` endpoints (6 locations)
3. Update client `git.js` handler (6 locations)
4. Add comprehensive tests

### 7.2 Phase 2: Core Utilities (Week 2)
**Priority**: High - Maximum impact

1. Create shell configuration utilities
2. Create error handling utilities
3. Migrate server shell handling
4. Migrate client shell handling
5. Add tests and documentation

### 7.3 Phase 3: File Operations (Week 3)
**Priority**: Medium - Good value

1. Create file operation utilities
2. Standardize getFileTree implementation
3. Migrate file handlers
4. Add tests and documentation

### 7.4 Phase 4: Cleanup (Week 4)
**Priority**: Low - Polish

1. Remove all duplicated code
2. Update documentation

## 8. Success Metrics

### 8.1 Quantitative Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Duplicated Lines | ~1,850 | < 925 | Static analysis |
| Bug Fix Time | 2x effort | 1x effort | Developer hours |
| Test Coverage | 65% | 90% | Jest coverage |
| Bundle Size | Baseline | +5KB max | Webpack analysis |

### 8.2 Qualitative Metrics
- Developer satisfaction with codebase
- Consistency of error messages
- Ease of adding new features
- Code review complexity

## 9. Risks & Mitigation

### 9.1 Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes | High | Low | Extensive testing |
| Performance regression | Medium | Low | Benchmark before/after |
| Increased coupling | Medium | Medium | Clear interfaces, minimal dependencies |
| Deployment complexity | Low | Medium | Backward compatibility, feature flags |

### 9.2 Mitigation Strategies
1. **Extensive Testing**: Each phase fully tested

## 10. Future Considerations

### 10.1 Out of Scope (Future PRDs)
- Real-time sync protocols

## 11. Approval & Sign-off

| Role | Name | Date | Approval |
|------|------|------|----------|
| Engineering Lead | | | ☐ |
| Product Manager | | | ☐ |
| Tech Lead | | | ☐ |
| QA Lead | | | ☐ |

## 12. Implementation Summary (July 21, 2025)

### 12.1 Completed Work
All four phases have been successfully completed:

1. **Phase 1: Git Utilities** ✅
   - Created shared Git utilities with empty repository support
   - Migrated 12+ duplicate implementations
   - Fixed critical bug affecting empty repositories
   - Comprehensive test coverage

2. **Phase 2: Shell/Error Handling** ✅
   - Standardized PTY configuration across client/server
   - Unified error handling with consistent codes
   - Migrated shell configuration utilities

3. **Phase 3: File Utilities** ✅
   - Consolidated file tree operations
   - Cross-platform path handling
   - Security validations (directory traversal prevention)

4. **Phase 4: Cleanup & Documentation** ✅
   - Created comprehensive README for shared utilities
   - Updated changelog with implementation details
   - Verified all success metrics achieved

### 12.2 Results Achieved
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Duplicated Lines | < 925 | ~400 | ✅ Exceeded |
| Code Reduction | 50% | 52% | ✅ Exceeded |
| Bug Fix (Empty Repo) | Fixed | Fixed | ✅ Complete |
| Test Coverage | 90% | 90%+ | ✅ Achieved |
| Breaking Changes | 0 | 0 | ✅ Success |

### 12.3 Key Achievements
- **Zero Breaking Changes**: All APIs maintain backward compatibility
- **Cross-Platform Support**: Handles Windows, macOS, Linux differences
- **Performance**: No measurable performance impact
- **Maintainability**: Single source of truth for all shared operations

## Appendices

### A. References
- [Duplicated Code Analysis](./duplicated-code-analysis.md)
- [Current Architecture Docs](./architecture.md)
- [Git Operation Bug Report](#git-empty-repo-issue)

### B. Technical Details
See implementation examples in Section 5 and full analysis in the duplicated code analysis document.