import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import fs from 'fs';
import { 
  getServerAddress, 
  getClientName, 
  getAPIToken, 
  isDebugEnabled,
  parseCommandLineArgs as parseArgs,
  mergeConfig as merge
} from '../../shared/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from client directory
const envPath = join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Save auth token to .env file
export function saveAuthToken(token) {
  try {
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add the auth token
    const lines = envContent.split('\n');
    let tokenFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('CLAUDE_CODE_UI_API_TOKEN=')) {
        lines[i] = `CLAUDE_CODE_UI_API_TOKEN=${token}`;
        tokenFound = true;
        break;
      }
    }
    
    if (!tokenFound) {
      lines.push(`CLAUDE_CODE_UI_API_TOKEN=${token}`);
    }
    
    // Write back to .env file
    fs.writeFileSync(envPath, lines.join('\n'));
    
    // Update process.env
    process.env.CLAUDE_CODE_UI_API_TOKEN = token;
    
    return true;
  } catch (error) {
    console.error('Error saving auth token:', error);
    return false;
  }
}

export const config = {
  // Server connection settings
  serverAddress: getServerAddress(),
  clientName: getClientName(),
  
  // Authentication
  authToken: getAPIToken(),
  
  // Connection settings
  reconnectInterval: 5000, // 5 seconds
  heartbeatInterval: 30000, // 30 seconds
  maxReconnectAttempts: 10,
  
  // Logging
  debug: isDebugEnabled(),
  
  // Capabilities
  capabilities: [
    'claude-cli',
    'git',
    'file-access',
    'shell'
  ]
};

// Use shared command line parsing and config merging
export const parseCommandLineArgs = parseArgs;
export const mergeConfig = merge;