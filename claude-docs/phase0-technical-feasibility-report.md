# Phase 0: Technical Feasibility Report - Project-Level MCP Configuration

**Date**: July 20, 2025  
**Status**: ✅ FEASIBLE  
**Recommendation**: PROCEED with implementation

## Executive Summary

Project-level MCP configuration via `.mcp.json` files is **fully supported** by Claude CLI and meets all requirements for the planned feature. The implementation can proceed without modifications to user home directory files.

## Test Results

### ✅ Test 1: `.mcp.json` File Support
- **Result**: PASSED
- **Finding**: Claude CLI successfully loads and uses MCP servers defined in `.mcp.json` files when using the `--mcp-config` flag
- **Evidence**: Test filesystem MCP server was loaded and functional

### ✅ Test 2: CLI Flag Behavior  
- **Result**: CONFIRMED
- **Finding**: Claude CLI provides two modes:
  - `--mcp-config file.json`: Adds project MCPs to user-level MCPs
  - `--mcp-config file.json --strict-mcp-config`: Uses ONLY project MCPs, ignoring user-level
- **Evidence**: User-level MCPs remained available in normal mode, were excluded in strict mode

### ✅ Test 3: Scope Precedence
- **Result**: PASSED
- **Finding**: Project MCPs are additive to user-level MCPs by default, with strict mode available for isolation
- **Scope hierarchy**: Project MCPs + User MCPs (normal) | Project MCPs only (strict)

### ✅ Test 4: No Home Directory Modification
- **Result**: PASSED  
- **Finding**: Using `--mcp-config` with project files does NOT modify any files in `~/.config/claude/` or `~/.claude/`
- **Evidence**: MD5 checksums of user config files unchanged before/after testing

### ❌ Test 5: Auto-Detection
- **Result**: NOT SUPPORTED
- **Finding**: Claude CLI does NOT automatically detect `.mcp.json` files in the current directory
- **Implication**: Must explicitly pass `--mcp-config .mcp.json` flag

## Technical Implementation Requirements

### 1. Claude CLI Integration
```bash
# Required command format for project MCPs
claude --mcp-config .mcp.json [other args]

# For strict project-only mode
claude --mcp-config .mcp.json --strict-mcp-config [other args]
```

### 2. File Structure
```json
// .mcp.json format (confirmed working)
{
  "mcpServers": {
    "server-name": {
      "command": "command",
      "args": ["arg1", "arg2"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

### 3. UI Implementation Requirements
- Frontend must construct CLI commands with `--mcp-config` flag
- Must support both additive and strict modes
- No modifications to user config files required
- Project root directory is the correct location for `.mcp.json`

## Architecture Implications

### ✅ Confirmed Design Decisions
1. **File Location**: `.mcp.json` in project root is correct and supported
2. **User Isolation**: No user home directory modifications needed  
3. **Scope Control**: Both additive and isolated modes available
4. **CLI Integration**: Straightforward flag-based integration

### 🔄 Required Changes to PRD
1. **Auto-Detection**: Remove assumption that Claude CLI auto-detects `.mcp.json`
2. **CLI Flags**: Document required `--mcp-config` flag usage  
3. **Mode Selection**: Add support for strict vs additive modes

## Security Validation

- ✅ No user home directory modifications
- ✅ Project-level isolation maintained  
- ✅ User-level security settings preserved
- ✅ Explicit configuration required (no auto-detection)

## Implementation Recommendations

### Phase 1 Updates Needed
1. Update `claude-cli.js` to include `--mcp-config .mcp.json` flag when project has MCP config
2. Add logic to detect existence of `.mcp.json` in project root
3. Provide UI toggle for strict vs additive mode

### No Blockers Identified
- All planned functionality is technically feasible
- No workarounds required
- Implementation can proceed as designed

## Next Steps

1. ✅ **APPROVED**: Proceed to Phase 1 implementation
2. Update PRD based on auto-detection findings
3. Begin UI development with confirmed CLI integration approach

---

**Test Environment**: macOS Darwin 24.5.0, Claude CLI latest  
**Test Files**: `test-project-mcp/.mcp.json` with filesystem server  
**Validation**: Complete functional testing with no user directory impact