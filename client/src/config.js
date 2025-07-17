import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import fs from 'fs';

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

// Get local IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export const config = {
  // Server connection settings
  serverAddress: process.env.CLAUDE_CODE_UI_SERVER_ADDRESS || 'ws://localhost:3000',
  clientName: process.env.CLAUDE_CODE_UI_CLIENT_NAME || getLocalIPAddress(),
  
  // Authentication
  authToken: process.env.CLAUDE_CODE_UI_API_TOKEN || null,
  
  // Connection settings
  reconnectInterval: 5000, // 5 seconds
  heartbeatInterval: 30000, // 30 seconds
  maxReconnectAttempts: 10,
  
  // Logging
  debug: process.env.DEBUG === 'true',
  
  // Capabilities
  capabilities: [
    'claude-cli',
    'git',
    'file-access',
    'shell'
  ]
};

// Parse command line arguments
export function parseCommandLineArgs(args) {
  const options = {};
  
  // Parse server address
  const serverIndex = args.indexOf('--server');
  if (serverIndex > -1 && args[serverIndex + 1]) {
    options.serverAddress = args[serverIndex + 1];
  }
  
  // Parse client name
  const nameIndex = args.indexOf('--name');
  if (nameIndex > -1 && args[nameIndex + 1]) {
    options.clientName = args[nameIndex + 1];
  }
  
  // Parse auth token
  const tokenIndex = args.indexOf('--token');
  if (tokenIndex > -1 && args[tokenIndex + 1]) {
    options.authToken = args[tokenIndex + 1];
  }
  
  // Parse debug flag
  if (args.includes('--debug')) {
    options.debug = true;
  }
  
  return options;
}

// Merge configurations with priority: CLI args > env vars > defaults
export function mergeConfig(cliOptions) {
  return {
    ...config,
    ...cliOptions
  };
}