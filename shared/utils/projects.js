import { promises as fs } from 'fs';
import path from 'path';

/**
 * Generate better display name from path
 * Tries to read package.json name first, then falls back to path-based naming
 * @param {string} projectName - Encoded project name or actual path
 * @param {string|null} actualProjectDir - Optional actual project directory
 * @returns {Promise<string>} - Display name for the project
 */
export async function generateDisplayName(projectName, actualProjectDir = null) {
  // Use actual project directory if provided, otherwise decode from project name
  let projectPath = actualProjectDir || projectName.replace(/-/g, '/');
  
  // Try to read package.json from the project path
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    // Return the name from package.json if it exists
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch (error) {
    // Fall back to path-based naming if package.json doesn't exist or can't be read
  }
  
  // If it starts with /, it's an absolute path
  if (projectPath.startsWith('/')) {
    const parts = projectPath.split('/').filter(Boolean);
    if (parts.length > 3) {
      // Show last 2 folders with ellipsis: "...projects/myapp"
      return `.../${parts.slice(-2).join('/')}`;
    } else {
      // Show full path if short: "/home/user"
      return projectPath;
    }
  }
  
  return projectPath;
}

/**
 * Encode a file system path to be used as a project name
 * @param {string} projectPath - Absolute file system path
 * @returns {string} - Encoded project name
 */
export function encodeProjectPath(projectPath) {
  return projectPath.replace(/\//g, '-');
}

/**
 * Decode a project name back to a file system path
 * @param {string} projectName - Encoded project name
 * @returns {string} - Decoded file system path
 */
export function decodeProjectName(projectName) {
  return projectName.replace(/-/g, '/');
}

/**
 * Validate that a project path exists and is accessible
 * @param {string} projectPath - Path to validate
 * @returns {Promise<boolean>} - Whether the path is valid and accessible
 */
export async function validateProjectPath(projectPath) {
  try {
    await fs.access(projectPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a path appears to be a valid project directory
 * (contains common project files like package.json, .git, etc.)
 * @param {string} projectPath - Path to check
 * @returns {Promise<{isProject: boolean, indicators: string[]}>} - Project status and indicators found
 */
export async function analyzeProjectDirectory(projectPath) {
  const indicators = [];
  const commonProjectFiles = [
    'package.json',
    '.git',
    'Cargo.toml',
    'pyproject.toml',
    'setup.py',
    'pom.xml',
    'build.gradle',
    'Makefile',
    'README.md'
  ];

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const fileNames = entries.map(entry => entry.name);

    for (const file of commonProjectFiles) {
      if (fileNames.includes(file)) {
        indicators.push(file);
      }
    }

    return {
      isProject: indicators.length > 0,
      indicators
    };
  } catch (error) {
    return {
      isProject: false,
      indicators: []
    };
  }
}