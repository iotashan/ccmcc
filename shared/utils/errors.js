/**
 * Error handling utilities
 */

import { GitOperationError, FileOperationError, ShellOperationError, ErrorCodes } from '../types/errors.js';

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(message, code = 'UNKNOWN_ERROR', details = {}) {
  return {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...details
  };
}

/**
 * Handle Git-specific errors
 * @param {Error} error - The error to handle
 * @returns {GitOperationError} Formatted Git error
 */
export function handleGitError(error) {
  let code = ErrorCodes.GIT_ERROR;
  let message = error.message;
  
  if (error.message.includes('not a git repository')) {
    code = ErrorCodes.GIT_NOT_REPOSITORY;
    message = 'Not a git repository';
  } else if (error.message.includes('no upstream branch')) {
    code = ErrorCodes.GIT_NO_UPSTREAM;
    message = 'No upstream branch configured';
  } else if (error.message.includes('CONFLICT')) {
    code = ErrorCodes.GIT_MERGE_CONFLICT;
    message = 'Merge conflicts detected';
  } else if (error.message.includes('uncommitted changes')) {
    code = ErrorCodes.GIT_UNCOMMITTED_CHANGES;
    message = 'Uncommitted changes present';
  } else if (error.message.includes('Permission denied')) {
    code = ErrorCodes.GIT_AUTH_FAILED;
    message = 'Authentication failed';
  } else if (error.message.includes('Could not resolve hostname')) {
    code = ErrorCodes.GIT_NETWORK_ERROR;
    message = 'Network error';
  }
  
  return new GitOperationError(message, code);
}

/**
 * Handle file operation errors
 * @param {Error} error - The error to handle
 * @returns {FileOperationError} Formatted file error
 */
export function handleFileError(error) {
  let code = ErrorCodes.FILE_ERROR;
  let message = error.message;
  
  if (error.code === 'ENOENT') {
    code = ErrorCodes.FILE_NOT_FOUND;
    message = 'File not found';
  } else if (error.code === 'EACCES' || error.code === 'EPERM') {
    code = ErrorCodes.FILE_ACCESS_DENIED;
    message = 'Permission denied';
  } else if (error.code === 'EEXIST') {
    code = ErrorCodes.FILE_ALREADY_EXISTS;
    message = 'File already exists';
  } else if (error.code === 'EISDIR') {
    code = ErrorCodes.FILE_INVALID_PATH;
    message = 'Path is a directory';
  } else if (error.code === 'ENOTDIR') {
    code = ErrorCodes.FILE_INVALID_PATH;
    message = 'Path is not a directory';
  }
  
  return new FileOperationError(message, code);
}

/**
 * Handle shell operation errors
 * @param {Error} error - The error to handle
 * @returns {ShellOperationError} Formatted shell error
 */
export function handleShellError(error) {
  let code = ErrorCodes.SHELL_COMMAND_FAILED;
  let message = error.message;
  
  if (error.code === 127) {
    code = ErrorCodes.SHELL_NOT_FOUND;
    message = 'Command not found';
  } else if (error.code === 126) {
    code = ErrorCodes.SHELL_PERMISSION_DENIED;
    message = 'Permission denied';
  } else if (error.killed) {
    code = ErrorCodes.SHELL_TIMEOUT;
    message = 'Command timed out';
  }
  
  return new ShellOperationError(message, code);
}

/**
 * Wrap an async function with error handling
 * @param {Function} fn - The async function to wrap
 * @param {Function} errorHandler - Error handler function
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, errorHandler) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handledError = errorHandler(error);
      throw handledError;
    }
  };
}

/**
 * Log error with context
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context
 * @param {Object} logger - Logger instance
 */
export function logError(error, context = {}, logger = console) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  logger.error('Error occurred:', errorInfo);
}

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise} Result of the operation
 */
export async function retryWithBackoff(operation, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
  const retryableCodes = [
    ErrorCodes.GIT_NETWORK_ERROR,
    ErrorCodes.FILE_ACCESS_DENIED, // Sometimes temporary
    ErrorCodes.SHELL_TIMEOUT
  ];
  
  return retryableCodes.includes(error.code) ||
         error.message.includes('ECONNRESET') ||
         error.message.includes('ETIMEDOUT') ||
         error.message.includes('ENOTFOUND');
}