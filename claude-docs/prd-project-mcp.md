# Product Requirements Document: Project-Level MCP Management

## Executive Summary

This PRD outlines the implementation of project-level MCP (Model Context Protocol) management in Claude Code UI. The feature will enable users to configure MCPs specific to each project via `.claude/ccui-mcp.json` files, accessible through a new "MCP" tab in the project screen interface.

## Background

Currently, Claude Code UI supports MCP configuration at the machine level through the Settings interface. This limitation means all projects on a machine share the same MCP configuration. Project-level MCP support will allow:

- Project-specific tool and data source configurations
- Better team collaboration through shared `.claude/ccui-mcp.json` files
- Fine-grained control over MCP scopes (local, project, user)
- Improved security through project-level trust management

## Objectives

1. Enable project-specific MCP configuration through `.claude/ccui-mcp.json` files
2. Provide intuitive UI for managing project MCPs
3. Implement proper scope precedence (local > project > user)
4. Ensure security through trust dialogs and approval mechanisms
5. Maintain backward compatibility with existing machine-level MCPs

## Requirements

### Functional Requirements

#### 1. UI Navigation
- Add new "MCP" tab in project screen after "Source Control" tab
- Tab should be visible in both desktop and mobile views
- Tab icon should clearly represent MCP/tools functionality

#### 2. Project MCP Management Interface
- Display current project MCP configuration from `.claude/ccui-mcp.json`
- Show clear scope indicators (local/project/user)  
- Allow add/edit/remove operations for MCP servers
- Provide server connection testing functionality
- Display inherited user-scope MCPs with clear visual hierarchy
- **Import Feature**: Detect and offer to import existing MCP servers that Claude CLI finds without --mcp-config
- Provide toggle between additive mode (project + user MCPs) and strict mode (project-only MCPs)

#### 3. File Operations
- Read `ccui-mcp.json` from project `.claude/` directory only
- Write updated configurations back to `.claude/ccui-mcp.json`
- Handle missing files gracefully (create `.claude/` directory and file on first save)
- Validate JSON structure before saving
- **CONSTRAINT**: Never modify files in user home directory (`~/*`) for project-level settings
- Support importing existing MCP servers detected by Claude CLI (without --mcp-config)

#### 4. MCP Server Configuration
Support all MCP server types:
- stdio (command-based servers)
- SSE (Server-Sent Events)
- HTTP (REST endpoints)

Configuration fields:
```json
{
  "mcpServers": {
    "server-name": {
      "command": "/path/to/server",
      "args": ["arg1", "arg2"],
      "env": {
        "KEY": "value"
      }
    }
  }
}
```

#### 5. Scope Management
- Clear visual indicators for scope hierarchy
- Allow switching between scopes for each server
- Show which MCPs are active at each scope level
- Implement proper precedence: local > project > user

#### 6. Security Features
- Display approval dialog when project MCPs are first detected
- Show trust indicators for each MCP server
- Allow users to disable specific project MCPs
- Remember trust decisions per project

#### 7. Integration Requirements
- Update Claude CLI spawning to include project MCPs via `--mcp-config .claude/ccui-mcp.json`
- Pass `--strict-mcp-config` flag when strict mode is enabled (project-only MCPs)
- Ensure project MCPs are loaded before session starts
- Handle MCP conflicts according to scope precedence
- Implement MCP discovery functionality to detect existing user-level MCPs for import option

### Non-Functional Requirements

1. **Performance**: File operations should not block UI
2. **Security**: Never execute untrusted MCP servers without approval
3. **Usability**: Interface should match existing ToolsSettings patterns
4. **Reliability**: Handle file system errors gracefully
5. **Compatibility**: Work with all Claude CLI versions that support MCP

## Technical Architecture

### Frontend Components

```
ProjectMCPPanel (Main container)
├── MCPScopeSelector (Toggle between scopes)
├── MCPServerList (Display servers by scope)
│   ├── MCPServerItem (Individual server display)
│   └── MCPServerActions (Edit/Test/Delete)
├── MCPServerEditor (Add/Edit form)
└── MCPTrustDialog (Security approval)
```

### API Endpoints

```
GET    /api/projects/:projectId/mcp          - Read .claude/ccui-mcp.json
PUT    /api/projects/:projectId/mcp          - Write .claude/ccui-mcp.json
POST   /api/projects/:projectId/mcp/test     - Test MCP server
GET    /api/projects/:projectId/mcp/trust    - Get trust status
POST   /api/projects/:projectId/mcp/trust    - Update trust status
GET    /api/projects/:projectId/mcp/discover - Discover available MCP servers for import
POST   /api/projects/:projectId/mcp/import   - Import selected MCP servers from user-level config
```

### Data Flow

```
1. User clicks MCP tab
2. Frontend requests project MCP configuration
3. Backend reads .claude/ccui-mcp.json from project
4. Backend discovers available user-level MCPs for import
5. Frontend displays configuration with scope indicators and import options
6. User makes changes or imports MCPs
7. Frontend sends updated configuration to backend  
8. Backend validates and writes .claude/ccui-mcp.json
9. Claude sessions include project MCPs via --mcp-config .claude/ccui-mcp.json on next spawn
```

## Implementation Phases

### Phase 0: Research & Validation Spike ✅ COMPLETED
- [x] **Test `.mcp.json` file support in Claude CLI** - ✅ CONFIRMED: Claude CLI supports --mcp-config flag
- [x] Research Claude CLI `--mcp-config` flag behavior with project-relative paths - ✅ CONFIRMED: Works with relative paths
- [x] Test scope precedence when both user-level and project-level MCPs are present - ✅ CONFIRMED: Additive by default, strict mode available
- [x] Verify that project-level configs work WITHOUT modifying user home directory (`~/*`) - ✅ CONFIRMED: No user config modifications
- [x] Document findings and determine if alternative approaches are needed - ✅ COMPLETE: See phase0-technical-feasibility-report.md
- [x] **Deliverable**: Technical feasibility report confirming `.mcp.json` support or alternative solution - ✅ DELIVERED

### Phase 1: Core Infrastructure
- [ ] Add MCP tab to MainContent.jsx navigation
- [ ] Create basic ProjectMCPPanel component structure
- [ ] Implement .claude/ccui-mcp.json read/write API endpoints
- [ ] Add route handlers for project MCP operations
- [ ] Implement MCP discovery API endpoint (detect user-level MCPs)

### Phase 2: MCP Management UI
- [ ] Build MCP server list display component
- [ ] Implement add/edit/delete functionality
- [ ] Create server configuration forms
- [ ] Add server connection testing
- [ ] Implement scope selector controls
- [ ] Build MCP import interface for user-level MCPs
- [ ] Add additive/strict mode toggle

### Phase 3: Integration & Security
- [ ] Update claude-cli.js to load project MCPs via --mcp-config .claude/ccui-mcp.json
- [ ] Implement additive vs strict mode via --strict-mcp-config flag
- [ ] Add trust approval dialog system
- [ ] Create trust persistence mechanism
- [ ] Handle MCP loading during session spawn
- [ ] Implement MCP import functionality

### Phase 4: Polish & Enhancement
- [ ] Add visual scope hierarchy indicators
- [ ] Implement MCP enable/disable toggles
- [ ] Create comprehensive error handling
- [ ] Add loading states and feedback
- [ ] Implement keyboard shortcuts

## Success Metrics

1. Users can successfully manage project-specific MCPs
2. Proper scope precedence is maintained (local > project > user)
3. Security approval flow prevents unauthorized MCP execution
4. Feature integrates seamlessly with existing functionality
5. No regression in machine-level MCP management

## Security Considerations

1. **Trust Model**: Project MCPs require explicit user approval
2. **Scope Isolation**: Project MCPs cannot override user security settings
3. **Validation**: All MCP configurations validated before execution
4. **Audit Trail**: Log MCP trust decisions and configuration changes

## Migration Strategy

1. Existing machine-level MCPs continue to work unchanged
2. Projects without `.claude/ccui-mcp.json` files use only user-scope MCPs
3. First-time users guided through project MCP benefits and import options
4. Easy import of existing user-level MCPs into project-level configuration
5. Documentation updated to explain scope hierarchy and additive/strict modes

## Open Questions

1. ~~Should we support `.claude/mcp.json` in addition to `.mcp.json`?~~ RESOLVED: Using `.claude/ccui-mcp.json`
2. How to handle MCP servers that require authentication?
3. Should project MCPs be automatically synchronized across team members?
4. What level of MCP configuration validation is appropriate?
5. Should the import feature be available on first project setup or always visible?
6. How should conflicting MCP server names be handled during import?

## Future Enhancements

1. MCP marketplace integration for discovering servers
2. Team-wide MCP configuration templates
3. MCP usage analytics and insights
4. Advanced MCP chaining and composition
5. Project-specific MCP development tools