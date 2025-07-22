import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createErrorResponse,
  handleGitError,
  handleFileError,
  handleShellError,
  withErrorHandling,
  logError,
  retryWithBackoff,
  isRetryableError
} from '../errors.js';
import { 
  GitOperationError, 
  FileOperationError, 
  ShellOperationError, 
  ErrorCodes 
} from '../../types/errors.js';

describe('Error Utilities', () => {
  describe('createErrorResponse', () => {
    it('should create a standardized error response', () => {
      const response = createErrorResponse('Test error', 'TEST_ERROR', { foo: 'bar' });
      
      expect(response).toMatchObject({
        error: 'Test error',
        code: 'TEST_ERROR',
        timestamp: expect.any(String),
        foo: 'bar'
      });
      
      // Verify timestamp is ISO format
      expect(new Date(response.timestamp)).toBeInstanceOf(Date);
    });

    it('should use default code when not provided', () => {
      const response = createErrorResponse('Test error');
      
      expect(response.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle empty details', () => {
      const response = createErrorResponse('Test error', 'TEST_ERROR');
      
      expect(response).toEqual({
        error: 'Test error',
        code: 'TEST_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handleGitError', () => {
    it('should handle "not a git repository" error', () => {
      const error = new Error('fatal: not a git repository');
      const result = handleGitError(error);
      
      expect(result).toBeInstanceOf(GitOperationError);
      expect(result.message).toBe('Not a git repository');
      expect(result.code).toBe(ErrorCodes.GIT_NOT_REPOSITORY);
    });

    it('should handle "no upstream branch" error', () => {
      const error = new Error('fatal: no upstream branch configured');
      const result = handleGitError(error);
      
      expect(result.message).toBe('No upstream branch configured');
      expect(result.code).toBe(ErrorCodes.GIT_NO_UPSTREAM);
    });

    it('should handle merge conflict error', () => {
      const error = new Error('CONFLICT (content): Merge conflict in file.js');
      const result = handleGitError(error);
      
      expect(result.message).toBe('Merge conflicts detected');
      expect(result.code).toBe(ErrorCodes.GIT_MERGE_CONFLICT);
    });

    it('should handle uncommitted changes error', () => {
      const error = new Error('error: Your local changes would be overwritten by merge. Please commit your changes or stash them before you merge.');
      const result = handleGitError(error);
      
      expect(result.message).toBe('Uncommitted changes present');
      expect(result.code).toBe(ErrorCodes.GIT_UNCOMMITTED_CHANGES);
    });

    it('should handle authentication error', () => {
      const error = new Error('Permission denied (publickey)');
      const result = handleGitError(error);
      
      expect(result.message).toBe('Authentication failed');
      expect(result.code).toBe(ErrorCodes.GIT_AUTH_FAILED);
    });

    it('should handle network error', () => {
      const error = new Error('ssh: Could not resolve hostname github.com');
      const result = handleGitError(error);
      
      expect(result.message).toBe('Network error');
      expect(result.code).toBe(ErrorCodes.GIT_NETWORK_ERROR);
    });

    it('should handle generic git error', () => {
      const error = new Error('Something went wrong');
      const result = handleGitError(error);
      
      expect(result.message).toBe('Something went wrong');
      expect(result.code).toBe(ErrorCodes.GIT_ERROR);
    });
  });

  describe('handleFileError', () => {
    it('should handle file not found error', () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      const result = handleFileError(error);
      
      expect(result).toBeInstanceOf(FileOperationError);
      expect(result.message).toBe('File not found');
      expect(result.code).toBe(ErrorCodes.FILE_NOT_FOUND);
    });

    it('should handle permission denied error', () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      const result = handleFileError(error);
      
      expect(result.message).toBe('Permission denied');
      expect(result.code).toBe(ErrorCodes.FILE_ACCESS_DENIED);
    });

    it('should handle EPERM as permission denied', () => {
      const error = new Error('Operation not permitted');
      error.code = 'EPERM';
      const result = handleFileError(error);
      
      expect(result.message).toBe('Permission denied');
      expect(result.code).toBe(ErrorCodes.FILE_ACCESS_DENIED);
    });

    it('should handle file already exists error', () => {
      const error = new Error('File exists');
      error.code = 'EEXIST';
      const result = handleFileError(error);
      
      expect(result.message).toBe('File already exists');
      expect(result.code).toBe(ErrorCodes.FILE_ALREADY_EXISTS);
    });

    it('should handle is directory error', () => {
      const error = new Error('Is a directory');
      error.code = 'EISDIR';
      const result = handleFileError(error);
      
      expect(result.message).toBe('Path is a directory');
      expect(result.code).toBe(ErrorCodes.FILE_INVALID_PATH);
    });

    it('should handle not a directory error', () => {
      const error = new Error('Not a directory');
      error.code = 'ENOTDIR';
      const result = handleFileError(error);
      
      expect(result.message).toBe('Path is not a directory');
      expect(result.code).toBe(ErrorCodes.FILE_INVALID_PATH);
    });

    it('should handle generic file error', () => {
      const error = new Error('File operation failed');
      const result = handleFileError(error);
      
      expect(result.message).toBe('File operation failed');
      expect(result.code).toBe(ErrorCodes.FILE_ERROR);
    });
  });

  describe('handleShellError', () => {
    it('should handle command not found error', () => {
      const error = new Error('Command not found');
      error.code = 127;
      const result = handleShellError(error);
      
      expect(result).toBeInstanceOf(ShellOperationError);
      expect(result.message).toBe('Command not found');
      expect(result.code).toBe(ErrorCodes.SHELL_NOT_FOUND);
    });

    it('should handle permission denied error', () => {
      const error = new Error('Permission denied');
      error.code = 126;
      const result = handleShellError(error);
      
      expect(result.message).toBe('Permission denied');
      expect(result.code).toBe(ErrorCodes.SHELL_PERMISSION_DENIED);
    });

    it('should handle timeout error', () => {
      const error = new Error('Command killed');
      error.killed = true;
      const result = handleShellError(error);
      
      expect(result.message).toBe('Command timed out');
      expect(result.code).toBe(ErrorCodes.SHELL_TIMEOUT);
    });

    it('should handle generic shell error', () => {
      const error = new Error('Command failed');
      error.code = 1;
      const result = handleShellError(error);
      
      expect(result.message).toBe('Command failed');
      expect(result.code).toBe(ErrorCodes.SHELL_COMMAND_FAILED);
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap successful async function', async () => {
      const successFn = async (x) => x * 2;
      const errorHandler = vi.fn();
      const wrapped = withErrorHandling(successFn, errorHandler);
      
      const result = await wrapped(5);
      expect(result).toBe(10);
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('should handle errors with error handler', async () => {
      const error = new Error('Test error');
      const failingFn = async () => { throw error; };
      const handledError = new Error('Handled error');
      const errorHandler = vi.fn().mockReturnValue(handledError);
      const wrapped = withErrorHandling(failingFn, errorHandler);
      
      await expect(wrapped()).rejects.toThrow('Handled error');
      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    it('should preserve function arguments', async () => {
      const fn = async (a, b, c) => a + b + c;
      const errorHandler = vi.fn();
      const wrapped = withErrorHandling(fn, errorHandler);
      
      const result = await wrapped(1, 2, 3);
      expect(result).toBe(6);
    });
  });

  describe('logError', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        error: vi.fn()
      };
    });

    it('should log error with default logger', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      error.code = 'TEST_CODE';
      
      logError(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error occurred:', expect.objectContaining({
        message: 'Test error',
        stack: expect.any(String),
        code: 'TEST_CODE',
        timestamp: expect.any(String)
      }));
      
      consoleErrorSpy.mockRestore();
    });

    it('should log error with custom logger', () => {
      const error = new Error('Test error');
      const context = { userId: 123, action: 'test' };
      
      logError(error, context, mockLogger);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred:', expect.objectContaining({
        message: 'Test error',
        stack: expect.any(String),
        timestamp: expect.any(String),
        userId: 123,
        action: 'test'
      }));
    });

    it('should handle errors without code', () => {
      const error = new Error('Test error');
      
      logError(error, {}, mockLogger);
      
      expect(mockLogger.error).toHaveBeenCalledWith('Error occurred:', expect.objectContaining({
        message: 'Test error',
        code: undefined
      }));
    });
  });

  describe('retryWithBackoff', () => {
    let mockOperation;

    beforeEach(() => {
      vi.useFakeTimers();
      mockOperation = vi.fn();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      mockOperation.mockResolvedValue('success');
      
      const promise = retryWithBackoff(mockOperation);
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockOperation
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      const promise = retryWithBackoff(mockOperation, 3, 100);
      
      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(mockOperation).toHaveBeenCalledTimes(1);
      
      // Wait for first retry (100ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(mockOperation).toHaveBeenCalledTimes(2);
      
      // Wait for second retry (200ms - exponential backoff)
      await vi.advanceTimersByTimeAsync(200);
      expect(mockOperation).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });

    it('should throw last error after max retries', async () => {
      const finalError = new Error('Final failure');
      mockOperation
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(finalError);
      
      const promise = retryWithBackoff(mockOperation, 2, 100);
      
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(0);   // First attempt
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry
      
      await expect(promise).rejects.toThrow('Final failure');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff', async () => {
      mockOperation.mockRejectedValue(new Error('Always fails'));
      
      const promise = retryWithBackoff(mockOperation, 3, 100);
      
      // Track when each call happens
      const callTimes = [];
      mockOperation.mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.reject(new Error('Always fails'));
      });
      
      // Run through all attempts
      await vi.advanceTimersByTimeAsync(0);   // First attempt at 0ms
      await vi.advanceTimersByTimeAsync(100); // Second attempt at 100ms
      await vi.advanceTimersByTimeAsync(200); // Third attempt at 300ms (100 + 200)
      await vi.advanceTimersByTimeAsync(400); // Fourth attempt at 700ms (100 + 200 + 400)
      
      await expect(promise).rejects.toThrow('Always fails');
      expect(mockOperation).toHaveBeenCalledTimes(4);
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const error = new Error('Network error');
      error.code = ErrorCodes.GIT_NETWORK_ERROR;
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify file access errors as retryable', () => {
      const error = new Error('Permission denied');
      error.code = ErrorCodes.FILE_ACCESS_DENIED;
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new Error('Timeout');
      error.code = ErrorCodes.SHELL_TIMEOUT;
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify ECONNRESET errors as retryable', () => {
      const error = new Error('read ECONNRESET');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify ETIMEDOUT errors as retryable', () => {
      const error = new Error('connect ETIMEDOUT');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify ENOTFOUND errors as retryable', () => {
      const error = new Error('getaddrinfo ENOTFOUND github.com');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not identify other errors as retryable', () => {
      const error = new Error('Syntax error');
      error.code = 'SYNTAX_ERROR';
      
      expect(isRetryableError(error)).toBe(false);
    });
  });
});