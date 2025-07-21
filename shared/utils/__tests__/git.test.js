import { describe, it, expect, vi } from 'vitest';
import {
  getCurrentBranch,
  validateGitRepository,
  safeGitCommand,
  gitErrorHandler,
  isEmptyRepository,
  getRemoteInfo,
  parseGitStatus
} from '../git.js';

describe('Git Utilities', () => {
  describe('getCurrentBranch', () => {
    it('should return current branch using git branch --show-current', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'feature-branch\n' });
      const result = await getCurrentBranch('/project', mockExec);
      expect(result).toBe('feature-branch');
      expect(mockExec).toHaveBeenCalledWith('git branch --show-current', { cwd: '/project' });
    });

    it('should return main for empty output', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: '\n' });
      const result = await getCurrentBranch('/project', mockExec);
      expect(result).toBe('main');
    });

    it('should fallback to symbolic-ref when branch --show-current fails', async () => {
      const mockExec = vi.fn()
        .mockRejectedValueOnce(new Error('Command failed'))
        .mockResolvedValueOnce({ stdout: 'refs/heads/develop\n' });
      
      const result = await getCurrentBranch('/project', mockExec);
      expect(result).toBe('develop');
      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(mockExec).toHaveBeenLastCalledWith('git symbolic-ref HEAD', { cwd: '/project' });
    });

    it('should return main when both commands fail', async () => {
      const mockExec = vi.fn()
        .mockRejectedValueOnce(new Error('Command failed'))
        .mockRejectedValueOnce(new Error('Command failed'));
      
      const result = await getCurrentBranch('/project', mockExec);
      expect(result).toBe('main');
    });

    it('should handle empty repository correctly', async () => {
      const mockExec = vi.fn()
        .mockRejectedValueOnce(new Error('fatal: ambiguous argument \'HEAD\''))
        .mockResolvedValueOnce({ stdout: 'refs/heads/main\n' });
      
      const result = await getCurrentBranch('/project', mockExec);
      expect(result).toBe('main');
    });
  });

  describe('validateGitRepository', () => {
    it('should validate a valid git repository', async () => {
      const mockFs = { access: vi.fn().mockResolvedValue(undefined) };
      const mockExec = vi.fn().mockResolvedValue({ stdout: '/project\n' });
      
      await expect(validateGitRepository('/project', mockFs, mockExec)).resolves.toBeUndefined();
      expect(mockFs.access).toHaveBeenCalledWith('/project');
      expect(mockExec).toHaveBeenCalledWith('git rev-parse --show-toplevel', { cwd: '/project' });
    });

    it('should throw when directory does not exist', async () => {
      const mockFs = { access: vi.fn().mockRejectedValue(new Error('ENOENT')) };
      const mockExec = vi.fn();
      
      await expect(validateGitRepository('/project', mockFs, mockExec))
        .rejects.toThrow('Project path not found: /project');
    });

    it('should throw when not a git repository', async () => {
      const mockFs = { access: vi.fn().mockResolvedValue(undefined) };
      const mockExec = vi.fn().mockRejectedValue(new Error('fatal: not a git repository'));
      
      await expect(validateGitRepository('/project', mockFs, mockExec))
        .rejects.toThrow('Not a git repository. This directory does not contain a .git folder');
    });

    it('should throw when inside a parent git repository', async () => {
      const mockFs = { access: vi.fn().mockResolvedValue(undefined) };
      const mockExec = vi.fn().mockResolvedValue({ stdout: '/parent/project\n' });
      
      await expect(validateGitRepository('/project', mockFs, mockExec))
        .rejects.toThrow('Project directory is not a git repository');
    });
  });

  describe('safeGitCommand', () => {
    it('should execute git command successfully', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'success', stderr: '' });
      const result = await safeGitCommand('git status', '/project', mockExec);
      
      expect(result).toEqual({ stdout: 'success', stderr: '' });
      expect(mockExec).toHaveBeenCalledWith('git status', { cwd: '/project' });
    });

    it('should enhance error with context', async () => {
      const originalError = new Error('Command failed');
      originalError.stderr = 'error output';
      originalError.stdout = 'partial output';
      originalError.code = 128;
      
      const mockExec = vi.fn().mockRejectedValue(originalError);
      
      await expect(safeGitCommand('git push', '/project', mockExec))
        .rejects.toMatchObject({
          message: 'Git command failed: git push',
          originalError,
          stderr: 'error output',
          stdout: 'partial output',
          code: 128
        });
    });
  });

  describe('gitErrorHandler', () => {
    it('should handle not a git repository error', () => {
      const error = new Error('fatal: not a git repository');
      const result = gitErrorHandler(error);
      
      expect(result).toEqual({
        error: 'Not a git repository',
        details: 'This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.',
        originalError: error.message
      });
    });

    it('should handle network errors', () => {
      const error = new Error('Could not resolve hostname github.com');
      const result = gitErrorHandler(error);
      
      expect(result).toEqual({
        error: 'Network error',
        details: 'Unable to connect to remote repository. Check your internet connection.',
        originalError: error.message
      });
    });

    it('should handle merge conflicts', () => {
      const error = new Error('CONFLICT (content): Merge conflict in file.js');
      const result = gitErrorHandler(error);
      
      expect(result).toEqual({
        error: 'Merge conflicts detected',
        details: 'Please resolve conflicts manually in the editor, then commit the changes.',
        originalError: error.message
      });
    });

    it('should handle generic errors', () => {
      const error = new Error('Unknown error');
      const result = gitErrorHandler(error);
      
      expect(result).toEqual({
        error: 'Git operation failed',
        details: 'Unknown error',
        originalError: 'Unknown error'
      });
    });
  });

  describe('isEmptyRepository', () => {
    it('should return false for repository with commits', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'abc123' });
      const result = await isEmptyRepository('/project', mockExec);
      
      expect(result).toBe(false);
      expect(mockExec).toHaveBeenCalledWith('git rev-parse HEAD', { cwd: '/project' });
    });

    it('should return true for empty repository', async () => {
      const error = new Error('fatal: ambiguous argument \'HEAD\'');
      const mockExec = vi.fn().mockRejectedValue(error);
      const result = await isEmptyRepository('/project', mockExec);
      
      expect(result).toBe(true);
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied');
      const mockExec = vi.fn().mockRejectedValue(error);
      
      await expect(isEmptyRepository('/project', mockExec)).rejects.toThrow('Permission denied');
    });
  });

  describe('getRemoteInfo', () => {
    it('should return upstream information when configured', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: 'origin/main\n' });
      const result = await getRemoteInfo('/project', 'main', mockExec);
      
      expect(result).toEqual({
        hasRemote: true,
        hasUpstream: true,
        remoteName: 'origin',
        trackingBranch: 'origin/main'
      });
    });

    it('should detect remote without upstream', async () => {
      const mockExec = vi.fn()
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockResolvedValueOnce({ stdout: 'origin\nupstream\n' });
      
      const result = await getRemoteInfo('/project', 'main', mockExec);
      
      expect(result).toEqual({
        hasRemote: true,
        hasUpstream: false,
        remoteName: 'origin',
        trackingBranch: null
      });
    });

    it('should handle no remotes configured', async () => {
      const mockExec = vi.fn()
        .mockRejectedValueOnce(new Error('no upstream'))
        .mockResolvedValueOnce({ stdout: '\n' });
      
      const result = await getRemoteInfo('/project', 'main', mockExec);
      
      expect(result).toEqual({
        hasRemote: false,
        hasUpstream: false,
        remoteName: null,
        trackingBranch: null
      });
    });
  });

  describe('parseGitStatus', () => {
    it('should parse git status output correctly', () => {
      const statusOutput = `M  src/file1.js
 M src/file2.js
MM src/file3.js
A  src/new.js
AM src/added-modified.js
D  src/deleted.js
 D src/deleted2.js
?? src/untracked.js
?? src/untracked2.js`;

      const result = parseGitStatus(statusOutput);
      
      expect(result).toEqual({
        modified: ['src/file1.js', 'src/file2.js', 'src/file3.js'],
        added: ['src/new.js', 'src/added-modified.js'],
        deleted: ['src/deleted.js', 'src/deleted2.js'],
        untracked: ['src/untracked.js', 'src/untracked2.js']
      });
    });

    it('should handle empty status', () => {
      const result = parseGitStatus('');
      
      expect(result).toEqual({
        modified: [],
        added: [],
        deleted: [],
        untracked: []
      });
    });
  });
});