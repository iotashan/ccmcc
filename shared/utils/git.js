import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Get the current branch name, handling empty repositories gracefully
 * @param {string} projectPath - The path to the git repository
 * @param {Function} execAsyncOverride - Optional override for execAsync (for testing)
 * @returns {Promise<string>} The current branch name
 */
export async function getCurrentBranch(projectPath, execAsyncOverride = execAsync) {
  const execFn = execAsyncOverride || execAsync;
  
  try {
    // Use git branch --show-current which works with empty repositories
    const { stdout } = await execFn('git branch --show-current', { cwd: projectPath });
    const branch = stdout.trim();
    return branch || 'main'; // Fallback to 'main' if no output
  } catch (error) {
    // If that fails, try symbolic-ref approach
    try {
      const { stdout } = await execFn('git symbolic-ref HEAD', { cwd: projectPath });
      return stdout.trim().replace('refs/heads/', '');
    } catch (symbolicError) {
      // Final fallback for very old git versions or edge cases
      return 'main';
    }
  }
}

/**
 * Validate that a directory is a git repository at the root level
 * @param {string} projectPath - The path to validate
 * @param {Object} fs - File system module
 * @param {Function} execAsyncOverride - Optional override for execAsync (for testing)
 * @returns {Promise<void>} Throws if not a valid git repository
 */
export async function validateGitRepository(projectPath, fs, execAsyncOverride = execAsync) {
  const execFn = execAsyncOverride || execAsync;
  
  try {
    // Check if directory exists
    await fs.access(projectPath);
  } catch {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Use --show-toplevel to get the root of the git repository
    const { stdout: gitRoot } = await execFn('git rev-parse --show-toplevel', { cwd: projectPath });
    
    // Resolve symlinks for proper path comparison (important on macOS where /var -> /private/var)
    const normalizedGitRoot = await fs.realpath(path.resolve(gitRoot.trim()));
    const normalizedProjectPath = await fs.realpath(path.resolve(projectPath));
    
    // Ensure the git root matches our project path (prevent using parent git repos)
    if (normalizedGitRoot !== normalizedProjectPath) {
      throw new Error(`Project directory is not a git repository. This directory is inside a git repository at ${normalizedGitRoot}, but git operations should be run from the repository root.`);
    }
  } catch (error) {
    if (error.message.includes('Project directory is not a git repository')) {
      throw error;
    }
    throw new Error('Not a git repository. This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.');
  }
}

/**
 * Execute a git command safely with error handling
 * @param {string} command - The git command to execute
 * @param {string} projectPath - The path to the git repository
 * @param {Function} execAsyncOverride - Optional override for execAsync (for testing)
 * @returns {Promise<{stdout: string, stderr: string}>} Command output
 */
export async function safeGitCommand(command, projectPath, execAsyncOverride = execAsync) {
  const execFn = execAsyncOverride || execAsync;
  
  try {
    const result = await execFn(command, { cwd: projectPath });
    return result;
  } catch (error) {
    // Enhance error with more context
    const enhancedError = new Error(`Git command failed: ${command}`);
    enhancedError.originalError = error;
    enhancedError.stderr = error.stderr;
    enhancedError.stdout = error.stdout;
    enhancedError.code = error.code;
    throw enhancedError;
  }
}

/**
 * Standard git error handler
 * @param {Error} error - The error to handle
 * @returns {Object} Formatted error response
 */
export function gitErrorHandler(error) {
  let errorMessage = 'Git operation failed';
  let details = error.message;
  
  // Common git error patterns
  if (error.message.includes('not a git repository')) {
    errorMessage = 'Not a git repository';
    details = 'This directory does not contain a .git folder. Initialize a git repository with "git init" to use source control features.';
  } else if (error.message.includes('Project directory is not a git repository')) {
    errorMessage = 'Not a git repository';
    details = error.message;
  } else if (error.message.includes('Could not resolve hostname')) {
    errorMessage = 'Network error';
    details = 'Unable to connect to remote repository. Check your internet connection.';
  } else if (error.message.includes('Permission denied')) {
    errorMessage = 'Authentication failed';
    details = 'Permission denied. Check your credentials or SSH keys.';
  } else if (error.message.includes('CONFLICT')) {
    errorMessage = 'Merge conflicts detected';
    details = 'Please resolve conflicts manually in the editor, then commit the changes.';
  } else if (error.message.includes('Please commit your changes or stash them')) {
    errorMessage = 'Uncommitted changes detected';
    details = 'Please commit or stash your local changes before proceeding.';
  } else if (error.message.includes('rejected')) {
    errorMessage = 'Push/Pull rejected';
    details = 'The remote has newer commits. Pull first to merge changes.';
  } else if (error.message.includes('non-fast-forward')) {
    errorMessage = 'Non-fast-forward';
    details = 'Your branch is behind the remote. Pull the latest changes first.';
  } else if (error.message.includes('diverged')) {
    errorMessage = 'Branches have diverged';
    details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
  } else if (error.message.includes('no upstream branch')) {
    errorMessage = 'No upstream branch';
    details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
  } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
    errorMessage = 'Remote not configured';
    details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
  }
  
  return {
    error: errorMessage,
    details: details,
    originalError: error.message
  };
}

/**
 * Check if a repository is empty (has no commits)
 * @param {string} projectPath - The path to the git repository
 * @param {Function} execAsyncOverride - Optional override for execAsync (for testing)
 * @returns {Promise<boolean>} True if the repository has no commits
 */
export async function isEmptyRepository(projectPath, execAsyncOverride = execAsync) {
  const execFn = execAsyncOverride || execAsync;
  
  try {
    await execFn('git rev-parse HEAD', { cwd: projectPath });
    return false; // If successful, repository has commits
  } catch (error) {
    // Check if error is because of no commits
    if (error.message.includes('fatal: ambiguous argument \'HEAD\'') ||
        error.message.includes('unknown revision or path')) {
      return true;
    }
    // Other errors should be thrown
    throw error;
  }
}

/**
 * Get remote information with smart detection
 * @param {string} projectPath - The path to the git repository
 * @param {string} branch - The current branch name
 * @param {Function} execAsyncOverride - Optional override for execAsync (for testing)
 * @returns {Promise<{hasRemote: boolean, hasUpstream: boolean, remoteName: string|null, trackingBranch: string|null}>}
 */
export async function getRemoteInfo(projectPath, branch, execAsyncOverride = execAsync) {
  const execFn = execAsyncOverride || execAsync;
  
  let trackingBranch = null;
  let remoteName = null;
  let hasUpstream = false;
  
  try {
    const { stdout } = await execFn(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
    trackingBranch = stdout.trim();
    remoteName = trackingBranch.split('/')[0];
    hasUpstream = true;
  } catch (error) {
    // No upstream branch configured - check if we have remotes
    try {
      const { stdout } = await execFn('git remote', { cwd: projectPath });
      const remotes = stdout.trim().split('\n').filter(r => r.trim());
      if (remotes.length > 0) {
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
      }
    } catch (remoteError) {
      // No remotes configured
    }
  }
  
  return {
    hasRemote: !!remoteName,
    hasUpstream,
    remoteName,
    trackingBranch
  };
}

/**
 * Parse git status output into structured data
 * @param {string} statusOutput - Output from git status --porcelain
 * @returns {Object} Parsed status with arrays for modified, added, deleted, untracked
 */
export function parseGitStatus(statusOutput) {
  const modified = [];
  const added = [];
  const deleted = [];
  const untracked = [];
  
  statusOutput.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    const status = line.substring(0, 2);
    const file = line.substring(3);
    
    if (status === 'M ' || status === ' M' || status === 'MM') {
      modified.push(file);
    } else if (status === 'A ' || status === 'AM') {
      added.push(file);
    } else if (status === 'D ' || status === ' D') {
      deleted.push(file);
    } else if (status === '??') {
      untracked.push(file);
    }
  });
  
  return { modified, added, deleted, untracked };
}