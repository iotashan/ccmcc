/**
 * File operation utilities
 */

import path from 'path';
import { promises as fs } from 'fs';

/**
 * Get file tree with configurable options
 * @param {string} dir - Directory to scan
 * @param {Object} options - Options for file tree generation
 * @returns {Promise<Array>} File tree structure
 */
export async function getFileTree(dir, options = {}) {
  const {
    maxDepth = 10,
    includeHidden = false,
    exclude = ['.git', 'node_modules', '.cache', 'dist', 'build'],
    maxFiles = 10000,
    extensions = null, // null means all extensions
    currentDepth = 0
  } = options;

  if (currentDepth >= maxDepth) {
    return [];
  }

  const tree = [];
  let fileCount = 0;

  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      if (fileCount >= maxFiles) {
        tree.push({
          name: '... (max files reached)',
          type: 'info',
          path: path.join(dir, '...')
        });
        break;
      }

      // Skip hidden files unless explicitly included
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }

      // Skip excluded directories
      if (exclude.includes(item.name)) {
        continue;
      }

      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const children = await getFileTree(fullPath, {
          ...options,
          currentDepth: currentDepth + 1
        });
        
        tree.push({
          name: item.name,
          type: 'directory',
          path: fullPath,
          children
        });
        
        fileCount += children.length;
      } else if (item.isFile()) {
        // Check extension filter if provided
        if (extensions && extensions.length > 0) {
          const ext = path.extname(item.name).toLowerCase();
          if (!extensions.includes(ext)) {
            continue;
          }
        }
        
        tree.push({
          name: item.name,
          type: 'file',
          path: fullPath
        });
        
        fileCount++;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    // Return empty array for unreadable directories
  }

  return tree;
}

/**
 * Handle file-specific errors with better messages
 * @param {Error} error - The error to handle
 * @returns {Object} Formatted error response
 */
export function handleFileError(error) {
  let message = error.message;
  let code = error.code;
  
  switch (error.code) {
    case 'ENOENT':
      message = 'File or directory not found';
      break;
    case 'EACCES':
      message = 'Permission denied';
      break;
    case 'EISDIR':
      message = 'Cannot perform operation on a directory';
      break;
    case 'ENOTDIR':
      message = 'Not a directory';
      break;
    case 'EMFILE':
      message = 'Too many open files';
      break;
    case 'ENOSPC':
      message = 'No space left on device';
      break;
    case 'EROFS':
      message = 'Read-only file system';
      break;
  }
  
  return {
    error: message,
    code: code || 'FILE_ERROR',
    originalError: error.message
  };
}

/**
 * Normalize file path for cross-platform compatibility
 * @param {string} filePath - Path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(filePath) {
  // Convert Windows backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');
  
  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');
  
  // Remove trailing slash unless it's the root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Validate file path to prevent directory traversal
 * @param {string} filePath - Path to validate
 * @param {string} basePath - Base directory that should contain the file
 * @returns {boolean} True if path is valid
 */
export function validateFilePath(filePath, basePath) {
  try {
    // Resolve both paths to absolute paths
    const resolvedFilePath = path.resolve(filePath);
    const resolvedBasePath = path.resolve(basePath);
    
    // Check if the file path is within the base path
    return resolvedFilePath.startsWith(resolvedBasePath);
  } catch (error) {
    return false;
  }
}

/**
 * Get file stats with additional information
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File statistics
 */
export async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    
    return {
      size: stats.size,
      modified: stats.mtime,
      created: stats.birthtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      permissions: {
        readable: (stats.mode & 0o400) !== 0,
        writable: (stats.mode & 0o200) !== 0,
        executable: (stats.mode & 0o100) !== 0
      }
    };
  } catch (error) {
    throw handleFileError(error);
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw handleFileError(error);
    }
  }
}

/**
 * Get file extension with proper handling
 * @param {string} filename - File name
 * @returns {string} File extension (lowercase, with dot)
 */
export function getFileExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext || '.txt'; // Default to .txt for no extension
}

/**
 * Check if file is binary based on extension
 * @param {string} filename - File name to check
 * @returns {boolean} True if file is likely binary
 */
export function isBinaryFile(filename) {
  const binaryExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv',
    '.ttf', '.otf', '.woff', '.woff2',
    '.db', '.sqlite'
  ];
  
  const ext = getFileExtension(filename);
  return binaryExtensions.includes(ext);
}

/**
 * Get MIME type for a file
 * @param {string} filename - File name
 * @returns {string} MIME type
 */
export function getMimeType(filename) {
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip'
  };
  
  const ext = getFileExtension(filename);
  return mimeTypes[ext] || 'application/octet-stream';
}