import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFileTree,
  handleFileError,
  normalizePath,
  validateFilePath,
  getFileStats,
  fileExists,
  ensureDirectory,
  getFileExtension,
  isBinaryFile,
  getMimeType
} from '../files.js';
import path from 'path';

describe('File Utilities', () => {
  describe('getFileTree', () => {
    let mockFs;

    beforeEach(() => {
      mockFs = {
        readdir: vi.fn()
      };
    });

    it('should return file tree for directory', async () => {
      const mockItems = [
        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
        { name: 'folder1', isDirectory: () => true, isFile: () => false },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true }
      ];

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn()
            .mockResolvedValueOnce(mockItems)
            .mockResolvedValueOnce([]) // Empty folder1
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test');

      expect(tree).toEqual([
        {
          name: 'file1.js',
          type: 'file',
          path: '/test/file1.js'
        },
        {
          name: 'folder1',
          type: 'directory',
          path: '/test/folder1',
          children: []
        },
        {
          name: 'file2.txt',
          type: 'file',
          path: '/test/file2.txt'
        }
      ]);
    });

    it('should respect maxDepth option', async () => {
      const deepItem = { 
        name: 'deep', 
        isDirectory: () => true, 
        isFile: () => false 
      };

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockResolvedValue([deepItem])
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test', { maxDepth: 1 });

      expect(tree).toEqual([
        {
          name: 'deep',
          type: 'directory',
          path: '/test/deep',
          children: []
        }
      ]);
    });

    it('should exclude hidden files by default', async () => {
      const mockItems = [
        { name: '.hidden', isDirectory: () => false, isFile: () => true },
        { name: 'visible.js', isDirectory: () => false, isFile: () => true }
      ];

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockResolvedValue(mockItems)
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test');

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('visible.js');
    });

    it('should include hidden files when specified', async () => {
      const mockItems = [
        { name: '.hidden', isDirectory: () => false, isFile: () => true },
        { name: 'visible.js', isDirectory: () => false, isFile: () => true }
      ];

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockResolvedValue(mockItems)
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test', { includeHidden: true });

      expect(tree).toHaveLength(2);
      expect(tree.map(f => f.name)).toContain('.hidden');
    });

    it('should exclude specified directories', async () => {
      const mockItems = [
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: 'src', isDirectory: () => true, isFile: () => false }
      ];

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn()
            .mockResolvedValueOnce(mockItems)
            .mockResolvedValueOnce([]) // Empty src
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test');

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('src');
    });

    it('should filter by file extensions', async () => {
      const mockItems = [
        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file3.md', isDirectory: () => false, isFile: () => true }
      ];

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockResolvedValue(mockItems)
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test', { extensions: ['.js', '.md'] });

      expect(tree).toHaveLength(2);
      expect(tree.map(f => f.name)).toEqual(['file1.js', 'file3.md']);
    });

    it('should respect maxFiles limit', async () => {
      const mockItems = Array(10).fill(null).map((_, i) => ({
        name: `file${i}.js`,
        isDirectory: () => false,
        isFile: () => true
      }));

      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockResolvedValue(mockItems)
        }
      }));

      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test', { maxFiles: 3 });

      expect(tree).toHaveLength(4); // 3 files + 1 info message
      expect(tree[3]).toEqual({
        name: '... (max files reached)',
        type: 'info',
        path: '/test/...'
      });
    });

    it('should handle readdir errors gracefully', async () => {
      vi.doMock('fs', () => ({
        promises: {
          readdir: vi.fn().mockRejectedValue(new Error('Permission denied'))
        }
      }));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getFileTree } = await import('../files.js');
      const tree = await getFileTree('/test');

      expect(tree).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    afterEach(() => {
      vi.doUnmock('fs');
    });
  });

  describe('handleFileError', () => {
    it('should handle ENOENT error', () => {
      const error = new Error('No such file');
      error.code = 'ENOENT';
      
      const result = handleFileError(error);
      
      expect(result).toEqual({
        error: 'File or directory not found',
        code: 'ENOENT',
        originalError: 'No such file'
      });
    });

    it('should handle EACCES error', () => {
      const error = new Error('Access denied');
      error.code = 'EACCES';
      
      const result = handleFileError(error);
      
      expect(result).toEqual({
        error: 'Permission denied',
        code: 'EACCES',
        originalError: 'Access denied'
      });
    });

    it('should handle EISDIR error', () => {
      const error = new Error('Is a directory');
      error.code = 'EISDIR';
      
      const result = handleFileError(error);
      
      expect(result).toEqual({
        error: 'Cannot perform operation on a directory',
        code: 'EISDIR',
        originalError: 'Is a directory'
      });
    });

    it('should handle ENOSPC error', () => {
      const error = new Error('No space');
      error.code = 'ENOSPC';
      
      const result = handleFileError(error);
      
      expect(result).toEqual({
        error: 'No space left on device',
        code: 'ENOSPC',
        originalError: 'No space'
      });
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      
      const result = handleFileError(error);
      
      expect(result).toEqual({
        error: 'Unknown error',
        code: 'FILE_ERROR',
        originalError: 'Unknown error'
      });
    });
  });

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
    });

    it('should remove duplicate slashes', () => {
      expect(normalizePath('/path//to///file')).toBe('/path/to/file');
    });

    it('should remove trailing slash except for root', () => {
      expect(normalizePath('/path/to/dir/')).toBe('/path/to/dir');
      expect(normalizePath('/')).toBe('/');
    });

    it('should handle mixed separators', () => {
      expect(normalizePath('C:\\Users\\test//file//')).toBe('C:/Users/test/file');
    });
  });

  describe('validateFilePath', () => {
    it('should validate path within base directory', () => {
      const filePath = '/project/src/file.js';
      const basePath = '/project';
      
      expect(validateFilePath(filePath, basePath)).toBe(true);
    });

    it('should reject path outside base directory', () => {
      const filePath = '/other/file.js';
      const basePath = '/project';
      
      expect(validateFilePath(filePath, basePath)).toBe(false);
    });

    it('should handle relative paths', () => {
      const filePath = './src/file.js';
      const basePath = '.';
      
      expect(validateFilePath(filePath, basePath)).toBe(true);
    });

    it('should prevent directory traversal', () => {
      const filePath = '/project/../outside/file.js';
      const basePath = '/project';
      
      expect(validateFilePath(filePath, basePath)).toBe(false);
    });

    it('should handle invalid paths gracefully', () => {
      expect(validateFilePath(null, '/project')).toBe(false);
      expect(validateFilePath('/file', null)).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return file statistics', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2024-01-01'),
        birthtime: new Date('2024-01-01'),
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        mode: 0o644
      };

      vi.doMock('fs', () => ({
        promises: {
          stat: vi.fn().mockResolvedValue(mockStats)
        }
      }));

      const { getFileStats } = await import('../files.js');
      const stats = await getFileStats('/test/file.txt');

      expect(stats).toEqual({
        size: 1024,
        modified: mockStats.mtime,
        created: mockStats.birthtime,
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        permissions: {
          readable: true,
          writable: true,
          executable: false
        }
      });
    });

    it('should handle stat errors', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';

      vi.doMock('fs', () => ({
        promises: {
          stat: vi.fn().mockRejectedValue(error)
        }
      }));

      const { getFileStats } = await import('../files.js');
      
      await expect(getFileStats('/nonexistent')).rejects.toMatchObject({
        error: 'File or directory not found',
        code: 'ENOENT'
      });
    });

    afterEach(() => {
      vi.doUnmock('fs');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      vi.doMock('fs', () => ({
        promises: {
          access: vi.fn().mockResolvedValue(undefined)
        }
      }));

      const { fileExists } = await import('../files.js');
      expect(await fileExists('/existing/file.txt')).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      vi.doMock('fs', () => ({
        promises: {
          access: vi.fn().mockRejectedValue(new Error('ENOENT'))
        }
      }));

      const { fileExists } = await import('../files.js');
      expect(await fileExists('/nonexistent/file.txt')).toBe(false);
    });

    afterEach(() => {
      vi.doUnmock('fs');
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory recursively', async () => {
      const mockMkdir = vi.fn().mockResolvedValue(undefined);

      vi.doMock('fs', () => ({
        promises: {
          mkdir: mockMkdir
        }
      }));

      const { ensureDirectory } = await import('../files.js');
      await ensureDirectory('/path/to/new/dir');

      expect(mockMkdir).toHaveBeenCalledWith('/path/to/new/dir', { recursive: true });
    });

    it('should ignore EEXIST errors', async () => {
      const error = new Error('Directory exists');
      error.code = 'EEXIST';

      vi.doMock('fs', () => ({
        promises: {
          mkdir: vi.fn().mockRejectedValue(error)
        }
      }));

      const { ensureDirectory } = await import('../files.js');
      await expect(ensureDirectory('/existing/dir')).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';

      vi.doMock('fs', () => ({
        promises: {
          mkdir: vi.fn().mockRejectedValue(error)
        }
      }));

      const { ensureDirectory } = await import('../files.js');
      await expect(ensureDirectory('/protected/dir')).rejects.toMatchObject({
        error: 'Permission denied',
        code: 'EACCES'
      });
    });

    afterEach(() => {
      vi.doUnmock('fs');
    });
  });

  describe('getFileExtension', () => {
    it('should return lowercase extension with dot', () => {
      expect(getFileExtension('file.JS')).toBe('.js');
      expect(getFileExtension('document.PDF')).toBe('.pdf');
    });

    it('should handle multiple dots', () => {
      expect(getFileExtension('file.test.js')).toBe('.js');
    });

    it('should return .txt for files without extension', () => {
      expect(getFileExtension('README')).toBe('.txt');
      expect(getFileExtension('')).toBe('.txt');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('.txt');
      expect(getFileExtension('.env.local')).toBe('.local');
    });
  });

  describe('isBinaryFile', () => {
    it('should identify image files as binary', () => {
      expect(isBinaryFile('photo.jpg')).toBe(true);
      expect(isBinaryFile('icon.png')).toBe(true);
      expect(isBinaryFile('logo.svg')).toBe(true);
    });

    it('should identify document files as binary', () => {
      expect(isBinaryFile('document.pdf')).toBe(true);
      expect(isBinaryFile('spreadsheet.xlsx')).toBe(true);
    });

    it('should identify archive files as binary', () => {
      expect(isBinaryFile('archive.zip')).toBe(true);
      expect(isBinaryFile('backup.tar.gz')).toBe(true);
    });

    it('should identify text files as non-binary', () => {
      expect(isBinaryFile('script.js')).toBe(false);
      expect(isBinaryFile('styles.css')).toBe(false);
      expect(isBinaryFile('README.md')).toBe(false);
    });

    it('should handle case-insensitive extensions', () => {
      expect(isBinaryFile('IMAGE.JPG')).toBe(true);
      expect(isBinaryFile('ARCHIVE.ZIP')).toBe(true);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types for common files', () => {
      expect(getMimeType('index.html')).toBe('text/html');
      expect(getMimeType('styles.css')).toBe('text/css');
      expect(getMimeType('script.js')).toBe('text/javascript');
      expect(getMimeType('data.json')).toBe('application/json');
    });

    it('should return correct MIME types for images', () => {
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeType('icon.png')).toBe('image/png');
      expect(getMimeType('logo.svg')).toBe('image/svg+xml');
    });

    it('should return application/octet-stream for unknown types', () => {
      expect(getMimeType('file.unknown')).toBe('application/octet-stream');
      expect(getMimeType('data.bin')).toBe('application/octet-stream');
    });

    it('should handle case-insensitive extensions', () => {
      expect(getMimeType('INDEX.HTML')).toBe('text/html');
      expect(getMimeType('DATA.JSON')).toBe('application/json');
    });

    it('should handle files without extensions', () => {
      expect(getMimeType('README')).toBe('text/plain');
    });
  });
});