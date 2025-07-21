/**
 * Base error class for Git operations
 */
export class GitOperationError extends Error {
  constructor(message, code = 'GIT_ERROR') {
    super(message);
    this.name = 'GitOperationError';
    this.code = code;
  }
}

/**
 * Base error class for file operations
 */
export class FileOperationError extends Error {
  constructor(message, code = 'FILE_ERROR') {
    super(message);
    this.name = 'FileOperationError';
    this.code = code;
  }
}

/**
 * Base error class for shell operations
 */
export class ShellOperationError extends Error {
  constructor(message, code = 'SHELL_ERROR') {
    super(message);
    this.name = 'ShellOperationError';
    this.code = code;
  }
}

/**
 * Standardized error codes
 */
export const ErrorCodes = {
  // Git errors
  GIT_NOT_REPOSITORY: 'GIT_NOT_REPOSITORY',
  GIT_EMPTY_REPOSITORY: 'GIT_EMPTY_REPOSITORY',
  GIT_NO_REMOTE: 'GIT_NO_REMOTE',
  GIT_NO_UPSTREAM: 'GIT_NO_UPSTREAM',
  GIT_MERGE_CONFLICT: 'GIT_MERGE_CONFLICT',
  GIT_UNCOMMITTED_CHANGES: 'GIT_UNCOMMITTED_CHANGES',
  GIT_PUSH_REJECTED: 'GIT_PUSH_REJECTED',
  GIT_NETWORK_ERROR: 'GIT_NETWORK_ERROR',
  GIT_AUTH_FAILED: 'GIT_AUTH_FAILED',
  
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
  FILE_ALREADY_EXISTS: 'FILE_ALREADY_EXISTS',
  FILE_INVALID_PATH: 'FILE_INVALID_PATH',
  
  // Shell errors
  SHELL_COMMAND_FAILED: 'SHELL_COMMAND_FAILED',
  SHELL_TIMEOUT: 'SHELL_TIMEOUT',
  SHELL_NOT_FOUND: 'SHELL_NOT_FOUND',
  SHELL_PERMISSION_DENIED: 'SHELL_PERMISSION_DENIED'
};