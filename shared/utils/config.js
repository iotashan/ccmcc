/**
 * Shared configuration utilities for environment variable handling,
 * validation, and common configuration patterns
 */

/**
 * Get environment variable with optional default value and validation
 * @param {string} key - Environment variable key
 * @param {string|null} defaultValue - Default value if not set
 * @param {object} options - Validation options
 * @param {boolean} options.required - Whether the variable is required
 * @param {string} options.type - Expected type ('string', 'number', 'boolean', 'url')
 * @param {RegExp} options.pattern - Pattern to validate against
 * @returns {string|number|boolean} - Parsed environment variable value
 */
export function getEnvVar(key, defaultValue = null, options = {}) {
  const value = process.env[key];
  
  // Handle required variables
  if (options.required && (value === undefined || value === '')) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  // Use default if not set
  if (value === undefined || value === '') {
    return defaultValue;
  }
  
  // Type conversion and validation
  switch (options.type) {
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
      }
      return num;
      
    case 'boolean':
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      throw new Error(`Environment variable ${key} must be 'true' or 'false', got: ${value}`);
      
    case 'url':
      try {
        new URL(value);
        return value;
      } catch {
        throw new Error(`Environment variable ${key} must be a valid URL, got: ${value}`);
      }
      
    case 'string':
    default:
      // Pattern validation for strings
      if (options.pattern && !options.pattern.test(value)) {
        throw new Error(`Environment variable ${key} does not match required pattern`);
      }
      return value;
  }
}

/**
 * Get JWT secret with fallback for development
 * @returns {string} - JWT secret
 */
export function getJWTSecret() {
  return getEnvVar('JWT_SECRET', 'claude-ui-dev-secret-change-in-production');
}

/**
 * Get API key with optional validation
 * @returns {string|null} - API key or null if not configured
 */
export function getAPIKey() {
  return getEnvVar('API_KEY', null);
}

/**
 * Get server address with default for client connections
 * @returns {string} - Server WebSocket address
 */
export function getServerAddress() {
  return getEnvVar('CLAUDE_CODE_UI_SERVER_ADDRESS', 'ws://localhost:3000', { type: 'url' });
}

/**
 * Get client name with default
 * @returns {string} - Client name for identification
 */
export function getClientName() {
  return getEnvVar('CLAUDE_CODE_UI_CLIENT_NAME', getLocalIPAddress());
}

/**
 * Get API token for client authentication
 * @returns {string|null} - API token or null
 */
export function getAPIToken() {
  return getEnvVar('CLAUDE_CODE_UI_API_TOKEN', null);
}

/**
 * Check if debug mode is enabled
 * @returns {boolean} - Whether debug mode is enabled
 */
export function isDebugEnabled() {
  return getEnvVar('DEBUG', false, { type: 'boolean' });
}

/**
 * Get Claude base directory path
 * @returns {string} - Path to .claude directory
 */
export function getClaudeBasePath() {
  const homeDir = getEnvVar('HOME', '', { required: true });
  return `${homeDir}/.claude`;
}

/**
 * Get Claude projects directory path
 * @returns {string} - Path to Claude projects directory
 */
export function getClaudeProjectsPath() {
  return `${getClaudeBasePath()}/projects`;
}

/**
 * Get Claude config file path
 * @returns {string} - Path to project config file
 */
export function getClaudeConfigPath() {
  return `${getClaudeBasePath()}/project-config.json`;
}

/**
 * Get local IP address (helper function)
 * @returns {string} - Local IP address or localhost fallback
 */
function getLocalIPAddress() {
  // Return a placeholder that can be overridden by environment-specific implementations
  // This keeps the shared utility simple while allowing platform-specific logic
  return process.env.LOCAL_IP || '127.0.0.1';
}

/**
 * Validate token format (basic validation)
 * @param {string} token - Token to validate
 * @returns {boolean} - Whether token appears valid
 */
export function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Basic validation: should be at least 32 characters and contain only valid characters
  return token.length >= 32 && /^[A-Za-z0-9+/=_-]+$/.test(token);
}

/**
 * Parse command line arguments into configuration object
 * @param {string[]} args - Process arguments
 * @returns {object} - Parsed configuration
 */
export function parseCommandLineArgs(args) {
  const config = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--server':
        if (nextArg && !nextArg.startsWith('--')) {
          config.serverAddress = nextArg;
          i++; // Skip next argument
        }
        break;
        
      case '--name':
        if (nextArg && !nextArg.startsWith('--')) {
          config.clientName = nextArg;
          i++; // Skip next argument
        }
        break;
        
      case '--token':
        if (nextArg && !nextArg.startsWith('--')) {
          config.authToken = nextArg;
          i++; // Skip next argument
        }
        break;
        
      case '--debug':
        config.debug = true;
        break;
    }
  }
  
  return config;
}

/**
 * Merge configuration objects with precedence: CLI > env > defaults
 * @param {object} defaults - Default configuration
 * @param {object} envConfig - Environment-based configuration
 * @param {object} cliConfig - CLI argument configuration
 * @returns {object} - Merged configuration
 */
export function mergeConfig(defaults = {}, envConfig = {}, cliConfig = {}) {
  return {
    ...defaults,
    ...envConfig,
    ...cliConfig
  };
}