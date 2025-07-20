import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { ClientMessageTypes } from '../../../shared/protocol.js';

const execAsync = promisify(exec);

export class GitHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
  }

  async handle(message) {
    const { request_id, data } = message;
    
    try {
      // Extract the API path and method
      const { path: apiPath, method, query, body } = data;
      
      // Route the request based on path
      let response;
      
      if (apiPath === '/api/git/status' && method === 'GET') {
        response = await this.getStatus(query.project);
      } else if (apiPath === '/api/git/diff' && method === 'GET') {
        response = await this.getDiff(query.project, query.file);
      } else if (apiPath === '/api/git/commit' && method === 'POST') {
        response = await this.commit(body.project, body.message, body.files);
      } else if (apiPath === '/api/git/branches' && method === 'GET') {
        response = await this.getBranches(query.project);
      } else if (apiPath === '/api/git/checkout' && method === 'POST') {
        response = await this.checkout(body.project, body.branch);
      } else if (apiPath === '/api/git/create-branch' && method === 'POST') {
        response = await this.createBranch(body.project, body.branch);
      } else if (apiPath === '/api/git/commits' && method === 'GET') {
        response = await this.getCommits(query.project, query.limit);
      } else if (apiPath === '/api/git/commit-diff' && method === 'GET') {
        response = await this.getCommitDiff(query.project, query.commit);
      } else if (apiPath === '/api/git/remote-status' && method === 'GET') {
        response = await this.getRemoteStatus(query.project);
      } else if (apiPath === '/api/git/fetch' && method === 'POST') {
        response = await this.fetch(body.project);
      } else if (apiPath === '/api/git/pull' && method === 'POST') {
        response = await this.pull(body.project);
      } else if (apiPath === '/api/git/push' && method === 'POST') {
        response = await this.push(body.project);
      } else if (apiPath === '/api/git/publish' && method === 'POST') {
        response = await this.publish(body.project, body.branch);
      } else if (apiPath === '/api/git/discard' && method === 'POST') {
        response = await this.discard(body.project, body.file);
      } else if (apiPath === '/api/git/delete-untracked' && method === 'POST') {
        response = await this.deleteUntracked(body.project, body.file);
      } else if (apiPath === '/api/git/generate-commit-message' && method === 'POST') {
        response = await this.generateCommitMessage(body.project, body.files);
      } else {
        response = {
          status: 404,
          data: { error: 'Git endpoint not found' }
        };
      }
      
      // Send response back
      this.connection.send({
        type: ClientMessageTypes.API_RESPONSE,
        request_id,
        status: response.status || 200,
        headers: response.headers || { 'content-type': 'application/json' },
        data: response.data
      });
      
    } catch (error) {
      this.logger.error('Git handler error:', error);
      
      this.connection.send({
        type: ClientMessageTypes.API_RESPONSE,
        request_id,
        status: 500,
        headers: { 'content-type': 'application/json' },
        data: { error: error.message }
      });
    }
  }

  // Helper to get actual project path
  getActualProjectPath(projectName) {
    // Decode the actual project path from the encoded directory name
    if (projectName.startsWith('-')) {
      // Replace - with / to get the actual path
      let actualPath = projectName.replace(/-/g, '/');
      // Handle Windows paths (e.g., -C-Users-...)
      if (actualPath.match(/^\/[A-Z]\//) && process.platform === 'win32') {
        // Convert /C/Users/... to C:/Users/...
        actualPath = actualPath.substring(1, 2) + ':' + actualPath.substring(2);
      }
      return actualPath;
    }
    return projectName;
  }

  // Validate git repository
  async validateGitRepository(projectPath) {
    try {
      await fs.access(projectPath);
    } catch {
      throw new Error(`Project path not found: ${projectPath}`);
    }

    try {
      const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: projectPath });
      const normalizedGitRoot = path.resolve(gitRoot.trim());
      const normalizedProjectPath = path.resolve(projectPath);
      
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

  async getStatus(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      this.logger.info(`Git status for project: ${project} -> path: ${projectPath}`);
      
      await this.validateGitRepository(projectPath);

      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const { stdout: statusOutput } = await execAsync('git status --porcelain', { cwd: projectPath });
      
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
      
      return {
        data: {
          branch: branch.trim(),
          modified,
          added,
          deleted,
          untracked
        }
      };
    } catch (error) {
      this.logger.error('Git status error:', error);
      return {
        data: { 
          error: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository') 
            ? error.message 
            : 'Git operation failed',
          details: error.message.includes('not a git repository') || error.message.includes('Project directory is not a git repository')
            ? error.message
            : `Failed to get git status: ${error.message}`
        }
      };
    }
  }

  async getDiff(project, file) {
    if (!project || !file) {
      return { status: 400, data: { error: 'Project name and file path are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);
      
      const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
      const isUntracked = statusOutput.startsWith('??');
      
      let diff;
      if (isUntracked) {
        const fileContent = await fs.readFile(path.join(projectPath, file), 'utf-8');
        const lines = fileContent.split('\n');
        diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + 
               lines.map(line => `+${line}`).join('\n');
      } else {
        const { stdout } = await execAsync(`git diff HEAD -- "${file}"`, { cwd: projectPath });
        diff = stdout || '';
        
        if (!diff) {
          const { stdout: stagedDiff } = await execAsync(`git diff --cached -- "${file}"`, { cwd: projectPath });
          diff = stagedDiff;
        }
      }
      
      return { data: { diff } };
    } catch (error) {
      this.logger.error('Git diff error:', error);
      return { data: { error: error.message } };
    }
  }

  async commit(project, message, files) {
    if (!project || !message || !files || files.length === 0) {
      return { status: 400, data: { error: 'Project name, commit message, and files are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);
      
      for (const file of files) {
        await execAsync(`git add "${file}"`, { cwd: projectPath });
      }
      
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath });
      
      return { data: { success: true, output: stdout } };
    } catch (error) {
      this.logger.error('Git commit error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  async getBranches(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);
      
      const { stdout } = await execAsync('git branch -a', { cwd: projectPath });
      
      const branches = stdout
        .split('\n')
        .map(branch => branch.trim())
        .filter(branch => branch && !branch.includes('->'))
        .map(branch => {
          if (branch.startsWith('* ')) {
            return branch.substring(2);
          }
          if (branch.startsWith('remotes/origin/')) {
            return branch.substring(15);
          }
          return branch;
        })
        .filter((branch, index, self) => self.indexOf(branch) === index);
      
      return { data: { branches } };
    } catch (error) {
      this.logger.error('Git branches error:', error);
      return { data: { error: error.message } };
    }
  }

  async checkout(project, branch) {
    if (!project || !branch) {
      return { status: 400, data: { error: 'Project name and branch are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      const { stdout } = await execAsync(`git checkout "${branch}"`, { cwd: projectPath });
      
      return { data: { success: true, output: stdout } };
    } catch (error) {
      this.logger.error('Git checkout error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  async createBranch(project, branch) {
    if (!project || !branch) {
      return { status: 400, data: { error: 'Project name and branch name are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      const { stdout } = await execAsync(`git checkout -b "${branch}"`, { cwd: projectPath });
      
      return { data: { success: true, output: stdout } };
    } catch (error) {
      this.logger.error('Git create branch error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  async getCommits(project, limit = 10) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      
      const { stdout } = await execAsync(
        `git log --pretty=format:'%H|%an|%ae|%ad|%s' --date=relative -n ${limit}`,
        { cwd: projectPath }
      );
      
      const commits = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [hash, author, email, date, ...messageParts] = line.split('|');
          return {
            hash,
            author,
            email,
            date,
            message: messageParts.join('|')
          };
        });
      
      for (const commit of commits) {
        try {
          const { stdout: stats } = await execAsync(
            `git show --stat --format='' ${commit.hash}`,
            { cwd: projectPath }
          );
          commit.stats = stats.trim().split('\n').pop();
        } catch (error) {
          commit.stats = '';
        }
      }
      
      return { data: { commits } };
    } catch (error) {
      this.logger.error('Git commits error:', error);
      return { data: { error: error.message } };
    }
  }

  async getCommitDiff(project, commit) {
    if (!project || !commit) {
      return { status: 400, data: { error: 'Project name and commit hash are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      const { stdout } = await execAsync(`git show ${commit}`, { cwd: projectPath });
      
      return { data: { diff: stdout } };
    } catch (error) {
      this.logger.error('Git commit diff error:', error);
      return { data: { error: error.message } };
    }
  }

  async getRemoteStatus(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const branch = currentBranch.trim();

      let trackingBranch;
      let remoteName;
      try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        trackingBranch = stdout.trim();
        remoteName = trackingBranch.split('/')[0];
      } catch (error) {
        let hasRemote = false;
        let remoteName = null;
        try {
          const { stdout } = await execAsync('git remote', { cwd: projectPath });
          const remotes = stdout.trim().split('\n').filter(r => r.trim());
          if (remotes.length > 0) {
            hasRemote = true;
            remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
          }
        } catch (remoteError) {
          // No remotes configured
        }
        
        return { 
          data: {
            hasRemote,
            hasUpstream: false,
            branch,
            remoteName,
            message: 'No remote tracking branch configured'
          }
        };
      }

      const { stdout: countOutput } = await execAsync(
        `git rev-list --count --left-right ${trackingBranch}...HEAD`,
        { cwd: projectPath }
      );
      
      const [behind, ahead] = countOutput.trim().split('\t').map(Number);

      return {
        data: {
          hasRemote: true,
          hasUpstream: true,
          branch,
          remoteBranch: trackingBranch,
          remoteName,
          ahead: ahead || 0,
          behind: behind || 0,
          isUpToDate: ahead === 0 && behind === 0
        }
      };
    } catch (error) {
      this.logger.error('Git remote status error:', error);
      return { data: { error: error.message } };
    }
  }

  async fetch(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const branch = currentBranch.trim();

      let remoteName = 'origin';
      try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        remoteName = stdout.trim().split('/')[0];
      } catch (error) {
        this.logger.info('No upstream configured, using origin as fallback');
      }

      const { stdout } = await execAsync(`git fetch ${remoteName}`, { cwd: projectPath });
      
      return { data: { success: true, output: stdout || 'Fetch completed successfully', remoteName } };
    } catch (error) {
      this.logger.error('Git fetch error:', error);
      return { 
        status: 500,
        data: { 
          error: 'Fetch failed', 
          details: error.message.includes('Could not resolve hostname') 
            ? 'Unable to connect to remote repository. Check your internet connection.'
            : error.message.includes('fatal: \'origin\' does not appear to be a git repository')
            ? 'No remote repository configured. Add a remote with: git remote add origin <url>'
            : error.message
        }
      };
    }
  }

  async pull(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const branch = currentBranch.trim();

      let remoteName = 'origin';
      let remoteBranch = branch;
      try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        const tracking = stdout.trim();
        remoteName = tracking.split('/')[0];
        remoteBranch = tracking.split('/').slice(1).join('/');
      } catch (error) {
        this.logger.info('No upstream configured, using origin/branch as fallback');
      }

      const { stdout } = await execAsync(`git pull ${remoteName} ${remoteBranch}`, { cwd: projectPath });
      
      return { 
        data: { 
          success: true, 
          output: stdout || 'Pull completed successfully', 
          remoteName,
          remoteBranch
        }
      };
    } catch (error) {
      this.logger.error('Git pull error:', error);
      
      let errorMessage = 'Pull failed';
      let details = error.message;
      
      if (error.message.includes('CONFLICT')) {
        errorMessage = 'Merge conflicts detected';
        details = 'Pull created merge conflicts. Please resolve conflicts manually in the editor, then commit the changes.';
      } else if (error.message.includes('Please commit your changes or stash them')) {
        errorMessage = 'Uncommitted changes detected';  
        details = 'Please commit or stash your local changes before pulling.';
      } else if (error.message.includes('Could not resolve hostname')) {
        errorMessage = 'Network error';
        details = 'Unable to connect to remote repository. Check your internet connection.';
      } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
        errorMessage = 'Remote not configured';
        details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
      } else if (error.message.includes('diverged')) {
        errorMessage = 'Branches have diverged';
        details = 'Your local branch and remote branch have diverged. Consider fetching first to review changes.';
      }
      
      return { 
        status: 500,
        data: { 
          error: errorMessage, 
          details: details
        }
      };
    }
  }

  async push(project) {
    if (!project) {
      return { status: 400, data: { error: 'Project name is required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const branch = currentBranch.trim();

      let remoteName = 'origin';
      let remoteBranch = branch;
      try {
        const { stdout } = await execAsync(`git rev-parse --abbrev-ref ${branch}@{upstream}`, { cwd: projectPath });
        const tracking = stdout.trim();
        remoteName = tracking.split('/')[0];
        remoteBranch = tracking.split('/').slice(1).join('/');
      } catch (error) {
        this.logger.info('No upstream configured, using origin/branch as fallback');
      }

      const { stdout } = await execAsync(`git push ${remoteName} ${remoteBranch}`, { cwd: projectPath });
      
      return { 
        data: { 
          success: true, 
          output: stdout || 'Push completed successfully', 
          remoteName,
          remoteBranch
        }
      };
    } catch (error) {
      this.logger.error('Git push error:', error);
      
      let errorMessage = 'Push failed';
      let details = error.message;
      
      if (error.message.includes('rejected')) {
        errorMessage = 'Push rejected';
        details = 'The remote has newer commits. Pull first to merge changes before pushing.';
      } else if (error.message.includes('non-fast-forward')) {
        errorMessage = 'Non-fast-forward push';
        details = 'Your branch is behind the remote. Pull the latest changes first.';
      } else if (error.message.includes('Could not resolve hostname')) {
        errorMessage = 'Network error';
        details = 'Unable to connect to remote repository. Check your internet connection.';
      } else if (error.message.includes('fatal: \'origin\' does not appear to be a git repository')) {
        errorMessage = 'Remote not configured';
        details = 'No remote repository configured. Add a remote with: git remote add origin <url>';
      } else if (error.message.includes('Permission denied')) {
        errorMessage = 'Authentication failed';
        details = 'Permission denied. Check your credentials or SSH keys.';
      } else if (error.message.includes('no upstream branch')) {
        errorMessage = 'No upstream branch';
        details = 'No upstream branch configured. Use: git push --set-upstream origin <branch>';
      }
      
      return { 
        status: 500,
        data: { 
          error: errorMessage, 
          details: details
        }
      };
    }
  }

  async publish(project, branch) {
    if (!project || !branch) {
      return { status: 400, data: { error: 'Project name and branch are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectPath });
      const currentBranchName = currentBranch.trim();
      
      if (currentBranchName !== branch) {
        return { 
          status: 400,
          data: { 
            error: `Branch mismatch. Current branch is ${currentBranchName}, but trying to publish ${branch}` 
          }
        };
      }

      let remoteName = 'origin';
      try {
        const { stdout } = await execAsync('git remote', { cwd: projectPath });
        const remotes = stdout.trim().split('\n').filter(r => r.trim());
        if (remotes.length === 0) {
          return { 
            status: 400,
            data: { 
              error: 'No remote repository configured. Add a remote with: git remote add origin <url>' 
            }
          };
        }
        remoteName = remotes.includes('origin') ? 'origin' : remotes[0];
      } catch (error) {
        return { 
          status: 400,
          data: { 
            error: 'No remote repository configured. Add a remote with: git remote add origin <url>' 
          }
        };
      }

      const { stdout } = await execAsync(`git push --set-upstream ${remoteName} ${branch}`, { cwd: projectPath });
      
      return { 
        data: { 
          success: true, 
          output: stdout || 'Branch published successfully', 
          remoteName,
          branch
        }
      };
    } catch (error) {
      this.logger.error('Git publish error:', error);
      
      let errorMessage = 'Publish failed';
      let details = error.message;
      
      if (error.message.includes('rejected')) {
        errorMessage = 'Publish rejected';
        details = 'The remote branch already exists and has different commits. Use push instead.';
      } else if (error.message.includes('Could not resolve hostname')) {
        errorMessage = 'Network error';
        details = 'Unable to connect to remote repository. Check your internet connection.';
      } else if (error.message.includes('Permission denied')) {
        errorMessage = 'Authentication failed';
        details = 'Permission denied. Check your credentials or SSH keys.';
      } else if (error.message.includes('fatal:') && error.message.includes('does not appear to be a git repository')) {
        errorMessage = 'Remote not configured';
        details = 'Remote repository not properly configured. Check your remote URL.';
      }
      
      return { 
        status: 500,
        data: { 
          error: errorMessage, 
          details: details
        }
      };
    }
  }

  async discard(project, file) {
    if (!project || !file) {
      return { status: 400, data: { error: 'Project name and file path are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
      
      if (!statusOutput.trim()) {
        return { status: 400, data: { error: 'No changes to discard for this file' } };
      }

      const status = statusOutput.substring(0, 2);
      
      if (status === '??') {
        await fs.unlink(path.join(projectPath, file));
      } else if (status.includes('M') || status.includes('D')) {
        await execAsync(`git restore "${file}"`, { cwd: projectPath });
      } else if (status.includes('A')) {
        await execAsync(`git reset HEAD "${file}"`, { cwd: projectPath });
      }
      
      return { data: { success: true, message: `Changes discarded for ${file}` } };
    } catch (error) {
      this.logger.error('Git discard error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  async deleteUntracked(project, file) {
    if (!project || !file) {
      return { status: 400, data: { error: 'Project name and file path are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      await this.validateGitRepository(projectPath);

      const { stdout: statusOutput } = await execAsync(`git status --porcelain "${file}"`, { cwd: projectPath });
      
      if (!statusOutput.trim()) {
        return { status: 400, data: { error: 'File is not untracked or does not exist' } };
      }

      const status = statusOutput.substring(0, 2);
      
      if (status !== '??') {
        return { status: 400, data: { error: 'File is not untracked. Use discard for tracked files.' } };
      }

      await fs.unlink(path.join(projectPath, file));
      
      return { data: { success: true, message: `Untracked file ${file} deleted successfully` } };
    } catch (error) {
      this.logger.error('Git delete untracked error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  async generateCommitMessage(project, files) {
    if (!project || !files || files.length === 0) {
      return { status: 400, data: { error: 'Project name and files are required' } };
    }

    try {
      const projectPath = this.getActualProjectPath(project);
      
      let combinedDiff = '';
      for (const file of files) {
        try {
          const { stdout } = await execAsync(
            `git diff HEAD -- "${file}"`,
            { cwd: projectPath }
          );
          if (stdout) {
            combinedDiff += `\n--- ${file} ---\n${stdout}`;
          }
        } catch (error) {
          this.logger.error(`Error getting diff for ${file}:`, error);
        }
      }
      
      const message = this.generateSimpleCommitMessage(files, combinedDiff);
      
      return { data: { message } };
    } catch (error) {
      this.logger.error('Generate commit message error:', error);
      return { status: 500, data: { error: error.message } };
    }
  }

  generateSimpleCommitMessage(files, diff) {
    const fileCount = files.length;
    const isMultipleFiles = fileCount > 1;
    
    const additions = (diff.match(/^\+[^+]/gm) || []).length;
    const deletions = (diff.match(/^-[^-]/gm) || []).length;
    
    let action = 'Update';
    if (additions > 0 && deletions === 0) {
      action = 'Add';
    } else if (deletions > 0 && additions === 0) {
      action = 'Remove';
    } else if (additions > deletions * 2) {
      action = 'Enhance';
    } else if (deletions > additions * 2) {
      action = 'Refactor';
    }
    
    if (isMultipleFiles) {
      const components = new Set(files.map(f => {
        const parts = f.split('/');
        return parts[parts.length - 2] || parts[0];
      }));
      
      if (components.size === 1) {
        return `${action} ${[...components][0]} component`;
      } else {
        return `${action} multiple components`;
      }
    } else {
      const fileName = files[0].split('/').pop();
      const componentName = fileName.replace(/\.(jsx?|tsx?|css|scss)$/, '');
      return `${action} ${componentName}`;
    }
  }
}