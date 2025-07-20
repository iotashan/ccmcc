import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ClaudeHooksManager {
  constructor() {
    this.backupSuffix = '.ccui-backup';
    this.settingsFileName = 'settings.local.json';
  }

  /**
   * Get the path to the .claude directory in a project
   */
  getClaudeDir(projectPath) {
    return path.join(projectPath, '.claude');
  }

  /**
   * Get the path to settings.local.json
   */
  getSettingsPath(projectPath) {
    return path.join(this.getClaudeDir(projectPath), this.settingsFileName);
  }

  /**
   * Get the backup file path
   */
  getBackupPath(projectPath) {
    return this.getSettingsPath(projectPath) + this.backupSuffix;
  }

  /**
   * Check if settings.local.json exists
   */
  async settingsExists(projectPath) {
    try {
      await fs.access(this.getSettingsPath(projectPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read existing settings or return empty object
   */
  async readSettings(projectPath) {
    try {
      const content = await fs.readFile(this.getSettingsPath(projectPath), 'utf8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return {};
      }
      throw err;
    }
  }

  /**
   * Write settings to file (with atomic write)
   */
  async writeSettings(projectPath, settings) {
    const settingsPath = this.getSettingsPath(projectPath);
    const tempPath = `${settingsPath}.tmp.${Date.now()}`;
    
    try {
      // Ensure .claude directory exists
      await fs.mkdir(this.getClaudeDir(projectPath), { recursive: true });
      
      // Write to temp file first
      await fs.writeFile(tempPath, JSON.stringify(settings, null, 2));
      
      // Atomic rename
      await fs.rename(tempPath, settingsPath);
    } catch (err) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw err;
    }
  }

  /**
   * Backup existing settings
   */
  async backupSettings(projectPath) {
    const settingsPath = this.getSettingsPath(projectPath);
    const backupPath = this.getBackupPath(projectPath);
    
    try {
      await fs.copyFile(settingsPath, backupPath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No settings to backup
        return false;
      }
      throw err;
    }
  }

  /**
   * Restore settings from backup
   */
  async restoreSettings(projectPath) {
    const settingsPath = this.getSettingsPath(projectPath);
    const backupPath = this.getBackupPath(projectPath);
    
    try {
      // Check if backup exists
      await fs.access(backupPath);
      
      // Restore from backup
      await fs.copyFile(backupPath, settingsPath);
      
      // Remove backup file
      await fs.unlink(backupPath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // No backup to restore, try to remove settings file
        try {
          await fs.unlink(settingsPath);
        } catch {}
        return false;
      }
      throw err;
    }
  }

  /**
   * Generate hook configuration for CCUI
   */
  generateHookConfig(machineId, sessionId, serverUrl = 'http://localhost:3001') {
    const token = crypto.randomBytes(32).toString('hex');
    const hooksDir = path.join(__dirname, '..', '..', 'hooks');
    
    const hookConfig = {
      hooks: {
        UserPromptSubmit: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-session-start.cjs')}"`
          }]
        }],
        PreToolUse: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-tool-pending.cjs')}"`
          }]
        }],
        PostToolUse: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-tool-complete.cjs')}"`
          }]
        }],
        SubagentStop: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-subagent-done.cjs')}"`
          }]
        }],
        Notification: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-notification.cjs')}"`
          }]
        }],
        Stop: [{
          matcher: ".*",
          hooks: [{
            type: "command",
            command: `node "${path.join(hooksDir, 'claude-session-end.cjs')}"`
          }]
        }]
      }
    };

    // Add environment variables to each command
    Object.keys(hookConfig.hooks).forEach(hookType => {
      hookConfig.hooks[hookType].forEach(hookGroup => {
        hookGroup.hooks.forEach(hook => {
          const env = {
            CCUI_HOOK_TOKEN: token,
            CCUI_MACHINE_ID: machineId,
            CCUI_SESSION_ID: sessionId,
            CCUI_SERVER_URL: serverUrl
          };
          hook.command = Object.entries(env)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ') + ' ' + hook.command;
        });
      });
    });

    return { hookConfig, token };
  }

  /**
   * Inject hooks into project settings
   */
  async injectHooks(projectPath, machineId, sessionId, serverUrl) {
    try {
      // Backup existing settings
      await this.backupSettings(projectPath);
      
      // Read current settings
      const currentSettings = await this.readSettings(projectPath);
      
      // Generate hook configuration
      const { hookConfig, token } = this.generateHookConfig(machineId, sessionId, serverUrl);
      
      // Merge hooks (our hooks take precedence)
      const mergedSettings = {
        ...currentSettings,
        ...hookConfig
      };
      
      // Write merged settings
      await this.writeSettings(projectPath, mergedSettings);
      
      return { success: true, token };
    } catch (err) {
      console.error('Failed to inject hooks:', err);
      throw err;
    }
  }

  /**
   * Remove injected hooks and restore original settings
   */
  async removeHooks(projectPath) {
    try {
      return await this.restoreSettings(projectPath);
    } catch (err) {
      console.error('Failed to remove hooks:', err);
      throw err;
    }
  }

  /**
   * Clean up any backup files
   */
  async cleanup(projectPath) {
    try {
      await fs.unlink(this.getBackupPath(projectPath));
    } catch {
      // Ignore errors - backup might not exist
    }
  }
}

export default ClaudeHooksManager;