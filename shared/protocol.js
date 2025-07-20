// WebSocket Protocol Definitions for Multi-Machine Support

export const PROTOCOL_VERSION = '2.0';

// Message types from client machines to server
export const ClientMessageTypes = {
  // Machine registration
  MACHINE_REGISTER: 'machine_register',
  MACHINE_HEARTBEAT: 'machine_heartbeat',
  
  // Project/session operations
  PROJECT_LIST: 'project_list',
  SESSION_LIST: 'session_list',
  SESSION_MESSAGES: 'session_messages',
  
  // Claude operations
  CLAUDE_EXECUTE: 'claude_execute',
  CLAUDE_RESPONSE: 'claude_response',
  CLAUDE_ERROR: 'claude_error',
  CLAUDE_COMPLETE: 'claude_complete',
  
  // File operations
  FILE_LIST: 'file_list',
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  FILE_DELETE: 'file_delete',
  
  // Git operations
  GIT_STATUS: 'git_status',
  GIT_DIFF: 'git_diff',
  GIT_COMMIT: 'git_commit',
  GIT_BRANCH: 'git_branch',
  GIT_CHECKOUT: 'git_checkout',
  GIT_PULL: 'git_pull',
  GIT_PUSH: 'git_push',
  
  // Shell operations
  SHELL_OUTPUT: 'shell_output',
  SHELL_EXIT: 'shell_exit',
  
  // Claude session tracking
  CLAUDE_SESSION_START: 'claude_session_start',
  CLAUDE_SESSION_UPDATE: 'claude_session_update',
  CLAUDE_SESSION_END: 'claude_session_end',
  
  // API forwarding
  API_RESPONSE: 'api_response'
};

// Message types from server to client machines
export const ServerMessageTypes = {
  // Registration responses
  REGISTER_ACK: 'register_ack',
  REGISTER_ERROR: 'register_error',
  
  // Heartbeat
  HEARTBEAT_ACK: 'heartbeat_ack',
  
  // Command requests (server asks client to execute)
  REQUEST_PROJECT_LIST: 'request_project_list',
  REQUEST_SESSION_LIST: 'request_session_list',
  REQUEST_SESSION_MESSAGES: 'request_session_messages',
  REQUEST_CLAUDE_EXECUTE: 'request_claude_execute',
  REQUEST_FILE_OPERATION: 'request_file_operation',
  REQUEST_GIT_OPERATION: 'request_git_operation',
  REQUEST_API_FORWARD: 'request_api_forward',
  
  // Shell requests
  REQUEST_SHELL_INIT: 'request_shell_init',
  REQUEST_SHELL_INPUT: 'request_shell_input',
  REQUEST_SHELL_RESIZE: 'request_shell_resize',
  REQUEST_SHELL_EXIT: 'request_shell_exit'
};

// Message types for UI clients
export const UIMessageTypes = {
  // Machine management
  MACHINE_LIST_UPDATE: 'machine_list_update',
  MACHINE_STATUS_UPDATE: 'machine_status_update',
  MACHINE_SELECTED: 'machine_selected',
  MACHINE_REMOVE: 'machine_remove',
  
  // All existing message types work with machine_id prefix
  PROJECTS_UPDATED: 'projects_updated',
  SESSION_CREATED: 'session_created',
  SESSION_ABORTED: 'session_aborted',
  // ... etc
};

// Machine capabilities
export const MachineCapabilities = {
  CLAUDE_CLI: 'claude-cli',
  GIT: 'git',
  FILE_ACCESS: 'file-access',
  SHELL: 'shell',
  MCP_TOOLS: 'mcp-tools'
};

// Machine status values
export const MachineStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  CONNECTING: 'connecting'
};

// Create a message with machine context
export function createMachineMessage(type, machineId, data = {}) {
  return {
    type,
    machine_id: machineId,
    timestamp: new Date().toISOString(),
    protocol_version: PROTOCOL_VERSION,
    ...data
  };
}

// Extract machine ID from message
export function getMachineId(message) {
  return message.machine_id || 'local';
}

// Check if message is from a specific machine
export function isFromMachine(message, machineId) {
  return getMachineId(message) === machineId;
}

// Validate protocol version
export function isCompatibleVersion(version) {
  const [major] = version.split('.');
  const [currentMajor] = PROTOCOL_VERSION.split('.');
  return major === currentMajor;
}