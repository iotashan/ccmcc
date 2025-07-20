import { spawn } from 'child_process';
import ClaudeHooksManager from './claudeHooks.js';

class ClaudeRunner {
  constructor() {
    this.hooksManager = new ClaudeHooksManager();
  }

  /**
   * Run Claude with hooks injected
   * @param {Object} options
   * @param {string} options.projectPath - Path to the project
   * @param {string} options.machineId - Machine ID
   * @param {string} options.sessionId - Session ID
   * @param {string} options.serverUrl - Server URL
   * @param {string} options.command - Claude command to run
   * @param {Array<string>} options.args - Arguments for Claude
   * @param {Function} options.onData - Callback for output data
   * @param {Function} options.onError - Callback for errors
   * @param {Function} options.onComplete - Callback for completion
   */
  async runWithHooks(options) {
    const {
      projectPath,
      machineId,
      sessionId,
      serverUrl = 'http://localhost:3001',
      command = 'claude',
      args = [],
      onData = () => {},
      onError = () => {},
      onComplete = () => {}
    } = options;

    let hookToken = null;
    let claudeProcess = null;

    try {
      // Inject hooks
      console.log('Injecting Claude hooks...');
      const result = await this.hooksManager.injectHooks(
        projectPath,
        machineId,
        sessionId,
        serverUrl
      );
      hookToken = result.token;

      // Small delay to ensure file is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start Claude process
      console.log('Starting Claude with command:', command, args.join(' '));
      claudeProcess = spawn(command, args, {
        cwd: projectPath,
        env: {
          ...process.env,
          // Pass token to environment for validation
          CCUI_HOOK_TOKEN: hookToken
        },
        shell: true
      });

      // Handle stdout
      claudeProcess.stdout.on('data', (data) => {
        onData({ type: 'stdout', data: data.toString() });
      });

      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        onData({ type: 'stderr', data: data.toString() });
      });

      // Handle process exit
      claudeProcess.on('close', async (code, signal) => {
        console.log(`Claude process exited with code ${code}`);
        
        // Remove hooks after Claude exits
        try {
          await this.hooksManager.removeHooks(projectPath);
          console.log('Hooks removed successfully');
        } catch (err) {
          console.error('Failed to remove hooks:', err);
        }

        onComplete({ code, signal });
      });

      // Handle process error
      claudeProcess.on('error', (err) => {
        console.error('Claude process error:', err);
        onError(err);
      });

      // Return process info
      return {
        success: true,
        process: claudeProcess,
        token: hookToken,
        kill: () => {
          if (claudeProcess && !claudeProcess.killed) {
            claudeProcess.kill('SIGTERM');
          }
        }
      };

    } catch (err) {
      console.error('Failed to run Claude with hooks:', err);
      
      // Try to clean up hooks if injection failed
      try {
        await this.hooksManager.removeHooks(projectPath);
      } catch {}

      throw err;
    }
  }

  /**
   * Kill a running Claude process and clean up
   */
  async cleanup(projectPath, claudeProcess) {
    // Kill process if running
    if (claudeProcess && !claudeProcess.killed) {
      claudeProcess.kill('SIGTERM');
      
      // Give it time to exit gracefully
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force kill if still running
      if (!claudeProcess.killed) {
        claudeProcess.kill('SIGKILL');
      }
    }

    // Remove hooks
    try {
      await this.hooksManager.removeHooks(projectPath);
    } catch (err) {
      console.error('Failed to remove hooks during cleanup:', err);
    }

    // Clean up any backup files
    try {
      await this.hooksManager.cleanup(projectPath);
    } catch {}
  }
}

export default ClaudeRunner;