/**
 * Shell configuration and utility functions
 */

// Default shell configuration
export const SHELL_DEFAULTS = {
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
};

/**
 * Create PTY configuration for terminal sessions
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 * @param {string} cwd - Working directory
 * @returns {Object} PTY configuration object
 */
export function createPtyConfig(cols = SHELL_DEFAULTS.cols, rows = SHELL_DEFAULTS.rows, cwd = SHELL_DEFAULTS.cwd) {
  return {
    name: 'xterm-color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    }
  };
}

/**
 * Build shell command with proper project path
 * @param {string} projectPath - The project directory path
 * @param {string} sessionId - Optional session ID for tracking
 * @returns {Object} Shell command configuration
 */
export function buildShellCommand(projectPath, sessionId = null) {
  const shell = process.platform === 'win32' ? 'cmd.exe' : process.env.SHELL || '/bin/bash';
  const args = process.platform === 'win32' ? [] : ['-l']; // Login shell for Unix
  
  return {
    shell,
    args,
    cwd: projectPath,
    sessionId,
    platform: process.platform
  };
}

/**
 * Generate welcome message for shell sessions
 * @param {string} type - Type of session ('terminal', 'claude', etc.)
 * @param {string} sessionId - Session identifier
 * @param {string} projectPath - Project directory path
 * @returns {string} Formatted welcome message
 */
export function generateWelcomeMessage(type = 'terminal', sessionId = null, projectPath = null) {
  const timestamp = new Date().toISOString();
  const messages = {
    terminal: `\r\n🚀 Terminal session started at ${timestamp}\r\n`,
    claude: `\r\n🤖 Claude session ${sessionId ? `(${sessionId})` : ''} started at ${timestamp}\r\n`,
    shell: `\r\n💻 Shell session started at ${timestamp}\r\n`
  };
  
  let message = messages[type] || messages.terminal;
  
  if (projectPath) {
    message += `📁 Working directory: ${projectPath}\r\n`;
  }
  
  message += `\r\n`;
  
  return message;
}

/**
 * Normalize shell output for consistent display
 * @param {string} output - Raw shell output
 * @returns {string} Normalized output
 */
export function normalizeShellOutput(output) {
  // Handle different line endings
  return output
    .replace(/\r\n/g, '\n')  // Windows CRLF to LF
    .replace(/\r/g, '\n')    // Old Mac CR to LF
    .replace(/\n+$/, '');    // Remove trailing newlines
}

/**
 * Check if a command is potentially dangerous
 * @param {string} command - Command to check
 * @returns {boolean} True if command might be dangerous
 */
export function isDangerousCommand(command) {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//, // rm -rf /
    /:\(\)\s*{\s*:\|:&\s*};/, // Fork bomb
    /dd\s+if=.*of=\/dev\/[sh]d/, // dd overwriting disk
    />\/dev\/[sh]da/, // Overwriting disk
    /mkfs\./, // Formatting filesystem
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command));
}

/**
 * Get shell-specific configuration
 * @param {string} shellType - Type of shell (bash, zsh, fish, etc.)
 * @returns {Object} Shell-specific configuration
 */
export function getShellConfig(shellType) {
  const configs = {
    bash: {
      prompt: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
      rcFile: '.bashrc',
      historyFile: '.bash_history'
    },
    zsh: {
      prompt: '%F{green}%n@%m%f:%F{blue}%~%f%# ',
      rcFile: '.zshrc',
      historyFile: '.zsh_history'
    },
    fish: {
      prompt: null, // Fish uses functions for prompts
      rcFile: 'config.fish',
      historyFile: 'fish_history',
      configDir: '.config/fish'
    }
  };
  
  return configs[shellType] || configs.bash;
}