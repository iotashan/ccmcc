# CCMCC Usage Guide

This guide covers how to use Claude Code Mission Control Center effectively for
managing multiple AI-assisted coding projects.

## Core Features

### Project Management

The UI automatically discovers Claude Code projects from `~/.claude/projects/`
and provides:

- **Visual Project Browser** - All available projects with metadata and session counts
- **Project Actions** - Rename, delete, and organize projects
- **Smart Navigation** - Quick access to recent projects and sessions

### Chat Interface

- **Use responsive chat or Claude Code CLI** - You can either use the adapted
  chat interface or use the shell button to connect to Claude Code CLI
- **Real-time Communication** - Stream responses from Claude with WebSocket connection
- **Session Management** - Resume previous conversations or start fresh sessions
- **Message History** - Complete conversation history with timestamps and metadata
- **Multi-format Support** - Text, code blocks, and file references

### File Explorer & Editor

- **Interactive File Tree** - Browse project structure with expand/collapse navigation
- **Live File Editing** - Read, modify, and save files directly in the interface
- **Syntax Highlighting** - Support for multiple programming languages
- **File Operations** - Create, rename, delete files and directories

### Git Explorer

The Git panel provides visual git status and operations:

- **Change Tracking** - See modified, added, and deleted files at a glance
- **Diff Viewer** - Review changes before committing
- **Stage/Unstage** - Manage your staging area visually
- **Commit Interface** - Commit changes with descriptive messages
- **Branch Information** - View current branch and status

### Session Management

- **Session Persistence** - All conversations automatically saved
- **Session Organization** - Group sessions by project and timestamp
- **Session Actions** - Rename, delete, and export conversation history
- **Cross-device Sync** - Access sessions from any device

## Mobile Experience

### Progressive Web App (PWA)

- **Responsive Design** - Optimized for all screen sizes
- **Touch-friendly Interface** - Swipe gestures and touch navigation
- **Mobile Navigation** - Bottom tab bar for easy thumb navigation
- **Adaptive Layout** - Collapsible sidebar and smart content prioritization
- **Add to Home Screen** - Install as a PWA for app-like experience

### Mobile-Specific Features

1. **Install as App**:
   - iOS: Tap Share → Add to Home Screen
   - Android: Tap menu → Install App

2. **Gesture Navigation**:
   - Swipe right to open sidebar
   - Swipe left to close sidebar
   - Pull down to refresh

3. **Optimized UI**:
   - Larger touch targets
   - Bottom navigation for thumb access
   - Condensed information display

## Multi-Machine Workflow

### Working with Remote Machines

1. **Machine Selector** - Choose which machine to control from the dropdown
2. **Real-time Status** - See connection status for each machine
3. **Seamless Switching** - Change machines without losing context
4. **Unified Interface** - Same features regardless of target machine

### Best Practices

1. **Name Machines Clearly** - Use descriptive names like "Work Laptop" or
   "Home Desktop"
2. **Monitor Connections** - Check the status indicator for active connections
3. **Use Appropriate Machines** - Select machines with the required tools and access
4. **Secure Your Network** - Only use on trusted local networks

## Keyboard Shortcuts

### Global Shortcuts

- `Ctrl/Cmd + K` - Quick project search
- `Ctrl/Cmd + N` - New session
- `Ctrl/Cmd + ,` - Open settings
- `Ctrl/Cmd + /` - Toggle sidebar

### Editor Shortcuts

- `Ctrl/Cmd + S` - Save current file
- `Ctrl/Cmd + F` - Find in file
- `Ctrl/Cmd + H` - Find and replace
- `Esc` - Close editor

### Chat Shortcuts

- `Enter` - Send message
- `Shift + Enter` - New line in message
- `Up Arrow` - Previous message (when input empty)
- `Ctrl/Cmd + L` - Clear chat

## Tips and Tricks

### Productivity Tips

1. **Use Project Templates** - Set up template projects for common tasks
2. **Session Naming** - Give sessions descriptive names for easy reference
3. **Keyboard Navigation** - Learn shortcuts to work faster
4. **Multi-tab Workflow** - Open multiple projects in browser tabs

### Performance Optimization

1. **Close Unused Sessions** - Free up resources by closing old sessions
2. **Limit File Explorer Depth** - Collapse large directories when not needed
3. **Use Search** - Find files quickly instead of browsing
4. **Regular Cleanup** - Delete old projects and sessions periodically

### Security Reminders

1. **Local Network Only** - Never expose CCMCC to the public internet
2. **Secure Credentials** - Use strong passwords and rotate API tokens
3. **Monitor Access** - Check machine connections regularly
4. **Update Regularly** - Keep CCMCC and dependencies up to date

## Troubleshooting Common Issues

### Connection Problems

- **Check Server Status** - Ensure the server is running
- **Verify Network** - Confirm machines are on the same network
- **Firewall Rules** - Allow CCMCC through firewall
- **Token Validity** - Regenerate API tokens if needed

### Performance Issues

- **Clear Browser Cache** - Remove old cached data
- **Reduce Active Sessions** - Close unnecessary sessions
- **Check Network Speed** - Ensure good connection between machines
- **Update Browser** - Use latest version of Chrome/Firefox/Safari

### Feature-Specific Help

- **File Explorer Empty** - Check project permissions
- **Chat Not Responding** - Verify Claude CLI is installed
- **Git Panel Issues** - Ensure git is configured properly
- **Mobile App Problems** - Clear PWA cache and reinstall

