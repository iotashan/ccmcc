// Load environment variables from .env file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = path.join(__dirname, '../.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  console.log('No .env file found or error reading it:', e.message);
}

console.log('PORT from env:', process.env.PORT);

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';

import { getProjects, getSessions, getSessionMessages, renameProject, deleteSession, deleteProject, addProjectManually, extractProjectDirectory, clearProjectDirectoryCache } from './projects.js';
import { spawnClaude, abortClaudeSession } from './claude-cli.js';
import gitRoutes from './routes/git.js';
import authRoutes from './routes/auth.js';
import mcpRoutes from './routes/mcp.js';
import machineRoutes from './routes/machines.js';
import settingsRoutes from './routes/settings.js';
import { initializeDatabase, machineDb } from './database/db.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';
import { machineManager } from './machines/MachineManager.js';
import { loadTokensIntoCache, createApiToken, revokeApiToken, getUserApiTokens } from './utils/apiTokens.js';
import { machineRoutingMiddleware } from './middleware/machineRouting.js';
import { PROTOCOL_VERSION, ClientMessageTypes, ServerMessageTypes, isCompatibleVersion } from '../shared/protocol.js';
import { encryptionMiddleware, decryptionMiddleware, encryptWebSocketMessage, decryptWebSocketMessage } from './utils/encryption.js';
import { userDb } from './database/db.js';

// File system watcher for projects folder
let projectsWatcher = null;
const connectedClients = new Set();

// Setup file system watcher for Claude projects folder using chokidar
async function setupProjectsWatcher() {
  const chokidar = (await import('chokidar')).default;
  const claudeProjectsPath = path.join(process.env.HOME, '.claude', 'projects');
  
  if (projectsWatcher) {
    projectsWatcher.close();
  }
  
  try {
    // Initialize chokidar watcher with optimized settings
    projectsWatcher = chokidar.watch(claudeProjectsPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/*.swp',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files on startup
      followSymlinks: false,
      depth: 10, // Reasonable depth limit
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file to stabilize
        pollInterval: 50
      }
    });
    
    // Debounce function to prevent excessive notifications
    let debounceTimer;
    const debouncedUpdate = async (eventType, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          
          // Clear project directory cache when files change
          clearProjectDirectoryCache();
          
          // Get updated projects list
          const updatedProjects = await getProjects();
          
          // Notify all connected clients about the project changes
          const updateMessage = JSON.stringify({
            type: 'projects_updated',
            projects: updatedProjects,
            timestamp: new Date().toISOString(),
            changeType: eventType,
            changedFile: path.relative(claudeProjectsPath, filePath)
          });
          
          connectedClients.forEach(client => {
            if (client.readyState === client.OPEN) {
              client.send(updateMessage);
            }
          });
          
        } catch (error) {
          console.error('❌ Error handling project changes:', error);
        }
      }, 300); // 300ms debounce (slightly faster than before)
    };
    
    // Set up event listeners
    projectsWatcher
      .on('add', (filePath) => debouncedUpdate('add', filePath))
      .on('change', (filePath) => debouncedUpdate('change', filePath))
      .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
      .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
      .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
      .on('error', (error) => {
        console.error('❌ Chokidar watcher error:', error);
      })
      .on('ready', () => {
      });
    
  } catch (error) {
    console.error('❌ Failed to setup projects watcher:', error);
  }
}


const app = express();
const server = http.createServer(app);

// Single WebSocket server that handles both paths
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info) => {
    console.log('WebSocket connection attempt to:', info.req.url);
    
    // Extract token from query parameters or headers
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token') || 
                  info.req.headers.authorization?.split(' ')[1];
    
    // Store token for later async verification
    info.req.wsToken = token;
    return true; // Allow connection, we'll verify async in the connection handler
  }
});

app.use(cors());
app.use(express.json());

// Optional API key validation (if configured)
app.use('/api', validateApiKey);

// Authentication routes (public)
app.use('/api/auth', authRoutes);

// API Token Management Routes (protected)
app.get('/api/tokens', authenticateToken, (req, res) => {
  try {
    const tokens = getUserApiTokens(req.user.id);
    res.json(tokens);
  } catch (error) {
    console.error('Error fetching API tokens:', error);
    res.status(500).json({ error: 'Failed to fetch API tokens' });
  }
});

app.post('/api/tokens', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    
    const tokenData = await createApiToken(req.user.id, name.trim());
    res.json(tokenData);
  } catch (error) {
    console.error('Error creating API token:', error);
    res.status(500).json({ error: 'Failed to create API token' });
  }
});

app.delete('/api/tokens/:tokenId', authenticateToken, async (req, res) => {
  try {
    const { tokenId } = req.params;
    const result = await revokeApiToken(parseInt(tokenId), req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking API token:', error);
    res.status(500).json({ error: 'Failed to revoke API token' });
  }
});

// Apply encryption middleware to authenticated API endpoints
// This must come after authentication but before route handlers
app.use('/api', authenticateToken, async (req, res, next) => {
  // Get user's encryption key for decryption/encryption
  if (req.user && req.user.id) {
    const encryptionKey = userDb.getEncryptionKey(req.user.id);
    req.encryptionKey = encryptionKey;
    
    // Apply decryption middleware for incoming requests
    decryptionMiddleware(encryptionKey)(req, res, () => {
      // Apply encryption middleware for outgoing responses
      encryptionMiddleware(encryptionKey)(req, res, next);
    });
  } else {
    next();
  }
});

// Apply machine routing middleware to all authenticated API endpoints
// This must come after authentication and encryption but before the actual route handlers
const machineRouter = machineRoutingMiddleware(machineManager);
app.use('/api', authenticateToken, machineRouter);

// Protected API Routes - these must come AFTER machine routing middleware
// Git API Routes (protected)
app.use('/api/git', authenticateToken, gitRoutes);

// MCP API Routes (protected)
app.use('/api/mcp', authenticateToken, mcpRoutes);

// Machine API Routes (protected)
app.use('/api/machines', authenticateToken, machineRoutes);

// Settings API Routes (protected)
app.use('/api/settings', authenticateToken, settingsRoutes);

// Static files served after API routes
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes (protected)
app.get('/api/config', authenticateToken, (req, res) => {
  const host = req.headers.host || `${req.hostname}:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  
  // Get local IP address
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and IPv6 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }
  
  console.log('Config API called - Returning host:', host, 'Protocol:', protocol, 'Local IP:', localIP);
  
  // Get encryption key for the user
  const encryptionKey = userDb.getEncryptionKey(req.user.id);
  
  res.json({
    serverPort: PORT,
    wsUrl: `${protocol}://${host}`,
    serverIP: localIP,
    serverProtocol: req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http',
    encryptionKey
  });
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:projectName/sessions', authenticateToken, async (req, res) => {
  try {
    const { limit = 5, offset = 0 } = req.query;
    const result = await getSessions(req.params.projectName, parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific session
app.get('/api/projects/:projectName/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    const messages = await getSessionMessages(projectName, sessionId);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename project endpoint
app.put('/api/projects/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    await renameProject(req.params.projectName, displayName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session endpoint
app.delete('/api/projects/:projectName/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    await deleteSession(projectName, sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project endpoint (only if empty)
app.delete('/api/projects/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    await deleteProject(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project endpoint
app.post('/api/projects/create', authenticateToken, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    
    if (!projectPath || !projectPath.trim()) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const project = await addProjectManually(projectPath.trim());
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read file content endpoint
app.get('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    
    console.log('📄 File read request:', projectName, filePath);
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    const content = await fsPromises.readFile(filePath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Serve binary file content endpoint (for images, etc.)
app.get('/api/projects/:projectName/files/content', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { path: filePath } = req.query;
    
    console.log('🖼️ Binary file serve request:', projectName, filePath);
    
    // Using fs from import
    // Using mime from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    try {
      await fsPromises.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file extension and set appropriate content type
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving binary file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Save file content endpoint
app.put('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    
    console.log('💾 File save request:', projectName, filePath);
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Create backup of original file
    try {
      const backupPath = filePath + '.backup.' + Date.now();
      await fsPromises.copyFile(filePath, backupPath);
      console.log('📋 Created backup:', backupPath);
    } catch (backupError) {
      console.warn('Could not create backup:', backupError.message);
    }
    
    // Write the new content
    await fsPromises.writeFile(filePath, content, 'utf8');
    
    res.json({ 
      success: true, 
      path: filePath,
      message: 'File saved successfully' 
    });
  } catch (error) {
    console.error('Error saving file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File or directory not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/projects/:projectName/files', authenticateToken, async (req, res) => {
  try {
    
    // Using fsPromises from import
    
    // Use extractProjectDirectory to get the actual project path
    let actualPath;
    try {
      actualPath = await extractProjectDirectory(req.params.projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      // Fallback to simple dash replacement
      actualPath = req.params.projectName.replace(/-/g, '/');
    }
    
    // Check if path exists
    try {
      await fsPromises.access(actualPath);
    } catch (e) {
      return res.status(404).json({ error: `Project path not found: ${actualPath}` });
    }
    
    const files = await getFileTree(actualPath, 3, 0, true);
    const hiddenFiles = files.filter(f => f.name.startsWith('.'));
    res.json(files);
  } catch (error) {
    console.error('❌ File tree error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler that routes based on URL path
wss.on('connection', async (ws, request) => {
  const url = request.url;
  console.log('🔗 Client connected to:', url);
  
  // Parse URL to get pathname without query parameters
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  
  // Perform async authentication using stored token
  const token = request.wsToken;
  const user = await authenticateWebSocket(token);
  
  if (!user) {
    console.log('❌ WebSocket authentication failed');
    ws.close(1008, 'Authentication failed');
    return;
  }
  
  console.log('✅ WebSocket authenticated:', user.username, 'via', user.authType);
  
  if (pathname === '/shell') {
    // Extract machineId from query parameters
    const machineId = urlObj.searchParams.get('machineId');
    handleShellConnection(ws, user, machineId);
  } else if (pathname === '/ws') {
    handleChatConnection(ws, user);
  } else if (pathname === '/machine') {
    handleMachineConnection(ws, user);
  } else {
    console.log('❌ Unknown WebSocket path:', pathname);
    ws.close();
  }
});

// Handle chat WebSocket connections
function handleChatConnection(ws, user) {
  console.log('💬 Chat WebSocket connected for user:', user?.username || 'unknown');
  
  // Add to connected clients for project updates
  connectedClients.add(ws);
  
  // Register UI client with machine manager
  if (user) {
    machineManager.registerUIClient(ws, user.id);
  }
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'claude-command') {
        console.log('💬 User message:', data.command || '[Continue/Resume]');
        console.log('📁 Project:', data.options?.projectPath || 'Unknown');
        console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
        console.log('🖥️  Machine:', data.options?.machine_id || 'local');
        
        // If machine_id is specified and not 'local', route to machine
        if (data.options?.machine_id && data.options.machine_id !== 'local') {
          const routed = machineManager.routeToMachine(data.options.machine_id, {
            type: ServerMessageTypes.REQUEST_CLAUDE_EXECUTE,
            command: data.command,
            options: data.options,
            request_id: crypto.randomUUID()
          });
          
          if (!routed) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Machine is offline or unavailable'
            }));
          }
        } else {
          // Local execution
          await spawnClaude(data.command, data.options, ws);
        }
      } else if (data.type === 'abort-session') {
        console.log('🛑 Abort session request:', data.sessionId);
        const success = abortClaudeSession(data.sessionId);
        ws.send(JSON.stringify({
          type: 'session-aborted',
          sessionId: data.sessionId,
          success
        }));
      } else if (data.type === 'machine-remove') {
        // Handle machine removal
        if (user && data.machine_id) {
          await machineDb.removeMachine(data.machine_id);
          await machineManager.broadcastMachineList(user.id);
        }
      }
    } catch (error) {
      console.error('❌ Chat WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Chat client disconnected');
    // Remove from connected clients
    connectedClients.delete(ws);
    // Unregister from machine manager
    if (user) {
      machineManager.unregisterUIClient(ws);
    }
  });
}

// Handle shell WebSocket connections
function handleShellConnection(ws, user, machineId) {
  console.log('🐚 Shell client connected', machineId ? `for machine: ${machineId}` : '(local)');
  let shellProcess = null;
  let isRemoteShell = false;
  let shellSessionId = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Shell message received:', data.type);
      
      if (data.type === 'init') {
        // Initialize shell with project path and session info
        const projectPath = data.projectPath || process.cwd();
        const sessionId = data.sessionId;
        const hasSession = data.hasSession;
        
        console.log('🚀 Starting shell in:', projectPath);
        console.log('📋 Session info:', hasSession ? `Resume session ${sessionId}` : 'New session');
        console.log('🖥️  Machine:', machineId || 'local');
        
        // Check if this is a remote shell request
        if (machineId && machineId !== 'local') {
          isRemoteShell = true;
          
          // Register this WebSocket as the shell UI client for routing responses
          machineManager.registerShellUIClient(ws, machineId);
          
          // Generate a consistent shell session ID for this connection
          shellSessionId = crypto.randomUUID();
          
          // First send a welcome message
          const welcomeMsg = hasSession ? 
            `\x1b[36mResuming Claude session ${sessionId} on remote machine: ${machineId}\x1b[0m\r\n` :
            `\x1b[36mStarting new Claude session on remote machine: ${machineId}\x1b[0m\r\n`;
          
          ws.send(JSON.stringify({
            type: 'output',
            data: welcomeMsg
          }));
          
          // Route shell init to remote machine
          const routed = machineManager.routeToMachine(machineId, {
            type: ServerMessageTypes.REQUEST_SHELL_INIT,
            request_id: shellSessionId,
            projectPath,
            sessionId,
            hasSession,
            cols: data.cols || 80,
            rows: data.rows || 24
          });
          
          if (!routed) {
            ws.send(JSON.stringify({
              type: 'output',
              data: '\r\n\x1b[31mError: Machine is offline or unavailable\x1b[0m\r\n'
            }));
            ws.close();
          }
          
          return; // Don't spawn local shell
        }
        
        // Local shell execution
        // First send a welcome message
        const welcomeMsg = hasSession ? 
          `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
          `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`;
        
        ws.send(JSON.stringify({
          type: 'output',
          data: welcomeMsg
        }));
        
        try {
          // Build shell command that changes to project directory first, then runs claude
          let claudeCommand = 'claude';
          
          if (hasSession && sessionId) {
            // Try to resume session, but with fallback to new session if it fails
            claudeCommand = `claude --resume ${sessionId} || claude`;
          }
          
          // Create shell command that cds to the project directory first
          const shellCommand = `cd "${projectPath}" && ${claudeCommand}`;
          
          console.log('🔧 Executing shell command:', shellCommand);
          
          // Start shell using PTY for proper terminal emulation
          shellProcess = pty.spawn('bash', ['-c', shellCommand], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME || '/', // Start from home directory
            env: { 
              ...process.env,
              TERM: 'xterm-256color',
              COLORTERM: 'truecolor',
              FORCE_COLOR: '3',
              // Override browser opening commands to echo URL for detection
              BROWSER: 'echo "OPEN_URL:"'
            }
          });
          
          console.log('🟢 Shell process started with PTY, PID:', shellProcess.pid);
          
          // Handle data output
          shellProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              let outputData = data;
              
              // Check for various URL opening patterns
              const patterns = [
                // Direct browser opening commands
                /(?:xdg-open|open|start)\s+(https?:\/\/[^\s\x1b\x07]+)/g,
                // BROWSER environment variable override
                /OPEN_URL:\s*(https?:\/\/[^\s\x1b\x07]+)/g,
                // Git and other tools opening URLs
                /Opening\s+(https?:\/\/[^\s\x1b\x07]+)/gi,
                // General URL patterns that might be opened
                /Visit:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
                /View at:\s*(https?:\/\/[^\s\x1b\x07]+)/gi,
                /Browse to:\s*(https?:\/\/[^\s\x1b\x07]+)/gi
              ];
              
              patterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(data)) !== null) {
                  const url = match[1];
                  console.log('🔗 Detected URL for opening:', url);
                  
                  // Send URL opening message to client
                  ws.send(JSON.stringify({
                    type: 'url_open',
                    url: url
                  }));
                  
                  // Replace the OPEN_URL pattern with a user-friendly message
                  if (pattern.source.includes('OPEN_URL')) {
                    outputData = outputData.replace(match[0], `🌐 Opening in browser: ${url}`);
                  }
                }
              });
              
              // Send regular output
              ws.send(JSON.stringify({
                type: 'output',
                data: outputData
              }));
            }
          });
          
          // Handle process exit
          shellProcess.onExit((exitCode) => {
            console.log('🔚 Shell process exited with code:', exitCode.exitCode, 'signal:', exitCode.signal);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}${exitCode.signal ? ` (${exitCode.signal})` : ''}\x1b[0m\r\n`
              }));
            }
            shellProcess = null;
          });
          
        } catch (spawnError) {
          console.error('❌ Error spawning process:', spawnError);
          ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
          }));
        }
        
      } else if (data.type === 'input') {
        // Route input to remote machine if this is a remote shell
        if (isRemoteShell && machineId) {
          const routed = machineManager.routeToMachine(machineId, {
            type: ServerMessageTypes.REQUEST_SHELL_INPUT,
            request_id: shellSessionId,
            data: data.data
          });
          
          if (!routed) {
            ws.send(JSON.stringify({
              type: 'output',
              data: '\r\n\x1b[31mError: Lost connection to remote machine\x1b[0m\r\n'
            }));
          }
        } else if (shellProcess && shellProcess.write) {
          // Local shell input
          try {
            shellProcess.write(data.data);
          } catch (error) {
            console.error('Error writing to shell:', error);
          }
        } else {
          console.warn('No active shell process to send input to');
        }
      } else if (data.type === 'resize') {
        // Route resize to remote machine if this is a remote shell
        if (isRemoteShell && machineId) {
          machineManager.routeToMachine(machineId, {
            type: ServerMessageTypes.REQUEST_SHELL_RESIZE,
            request_id: shellSessionId,
            cols: data.cols,
            rows: data.rows
          });
        } else if (shellProcess && shellProcess.resize) {
          // Local shell resize
          console.log('Terminal resize requested:', data.cols, 'x', data.rows);
          shellProcess.resize(data.cols, data.rows);
        }
      }
    } catch (error) {
      console.error('❌ Shell WebSocket error:', error.message);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
      }
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Shell client disconnected');
    
    // Clean up remote shell connection
    if (isRemoteShell && machineId) {
      machineManager.unregisterShellUIClient(ws, machineId);
      
      // Send shell exit command to remote machine
      machineManager.routeToMachine(machineId, {
        type: ServerMessageTypes.REQUEST_SHELL_EXIT,
        request_id: shellSessionId
      });
    }
    
    // Clean up local shell process
    if (shellProcess && shellProcess.kill) {
      console.log('🔴 Killing shell process:', shellProcess.pid);
      shellProcess.kill();
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ Shell WebSocket error:', error);
  });
}

// Handle machine client connections
function handleMachineConnection(ws, user) {
  console.log('🤖 Machine client connection attempt');
  let machineId = null;
  let encryptionKey = null;
  
  // Get user's encryption key
  if (user && user.id) {
    encryptionKey = userDb.getEncryptionKey(user.id);
  }
  
  // Helper function to send encrypted messages
  const sendEncrypted = (data) => {
    ws.send(encryptWebSocketMessage(data, encryptionKey));
  };
  
  ws.on('message', async (message) => {
    try {
      // Decrypt incoming message
      const data = decryptWebSocketMessage(message, encryptionKey);
      console.log('📨 Machine message received:', data.type);
      
      // Check protocol version
      if (data.protocol_version && !isCompatibleVersion(data.protocol_version)) {
        sendEncrypted({
          type: ServerMessageTypes.REGISTER_ERROR,
          error: `Incompatible protocol version. Server: ${PROTOCOL_VERSION}, Client: ${data.protocol_version}`
        });
        ws.close();
        return;
      }
      
      switch (data.type) {
        case ClientMessageTypes.MACHINE_REGISTER:
          // Register the machine
          const result = await machineManager.registerMachine(ws, {
            name: data.name || data.ip_address || 'Unknown',
            ip_address: data.ip_address,
            capabilities: data.capabilities || [],
            user_id: user.id,
            auth_token: data.auth_token
          });
          
          if (result.success) {
            machineId = result.machine.id;
            sendEncrypted({
              type: ServerMessageTypes.REGISTER_ACK,
              machine: result.machine,
              protocol_version: PROTOCOL_VERSION
            });
          } else {
            sendEncrypted({
              type: ServerMessageTypes.REGISTER_ERROR,
              error: result.error
            });
            ws.close();
          }
          break;
          
        case ClientMessageTypes.MACHINE_HEARTBEAT:
          if (machineId) {
            const success = await machineManager.handleHeartbeat(machineId);
            sendEncrypted({
              type: ServerMessageTypes.HEARTBEAT_ACK,
              success
            });
          }
          break;
          
        case ClientMessageTypes.PROJECT_LIST:
          // Send back project list
          if (machineId) {
            const projects = await getProjects();
            sendEncrypted({
              type: ClientMessageTypes.PROJECT_LIST,
              request_id: data.request_id,
              projects
            });
          }
          break;
          
        case ClientMessageTypes.SESSION_LIST:
          // Send back session list
          if (machineId && data.project_name) {
            const sessions = await getSessions(data.project_name, data.limit || 10, data.offset || 0);
            sendEncrypted({
              type: ClientMessageTypes.SESSION_LIST,
              request_id: data.request_id,
              sessions
            });
          }
          break;
          
        case ClientMessageTypes.CLAUDE_RESPONSE:
          // Forward Claude responses to UI clients with proper format
          if (machineId && data.request_id) {
            // Translate to UI format
            const uiMessage = {
              type: 'claude-response',
              data: {
                type: 'text',
                text: data.data,
                session_id: data.request_id // Using request_id as session_id for now
              }
            };
            
            // Broadcast to all UI clients for this user
            for (const [clientWs, clientUserId] of machineManager.userConnections) {
              if (clientUserId === user.id && clientWs.readyState === 1) {
                clientWs.send(JSON.stringify(uiMessage));
              }
            }
          }
          break;
          
        case ClientMessageTypes.CLAUDE_ERROR:
          // Forward Claude errors to UI clients
          if (machineId) {
            const errorMessage = {
              type: 'claude-error',
              error: data.error || data.data || 'Unknown error'
            };
            
            for (const [clientWs, clientUserId] of machineManager.userConnections) {
              if (clientUserId === user.id && clientWs.readyState === 1) {
                clientWs.send(JSON.stringify(errorMessage));
              }
            }
          }
          break;
          
        case ClientMessageTypes.CLAUDE_COMPLETE:
          // Forward Claude completion to UI clients
          if (machineId) {
            const completeMessage = {
              type: 'claude-complete',
              exitCode: data.exit_code || 0,
              isNewSession: false
            };
            
            for (const [clientWs, clientUserId] of machineManager.userConnections) {
              if (clientUserId === user.id && clientWs.readyState === 1) {
                clientWs.send(JSON.stringify(completeMessage));
              }
            }
          }
          break;
          
        case ClientMessageTypes.API_RESPONSE:
          // Handle API response from machine
          if (machineId) {
            machineManager.handleResponse(machineId, data);
          }
          break;
          
        case ClientMessageTypes.SHELL_OUTPUT:
          // Route shell output to the UI client
          if (machineId && machineManager.shellUIClients) {
            const shellWs = machineManager.shellUIClients.get(machineId);
            if (shellWs && shellWs.readyState === ws.OPEN) {
              shellWs.send(JSON.stringify({
                type: 'output',
                data: data.data
              }));
            }
          }
          break;
          
        case ClientMessageTypes.SHELL_EXIT:
          // Handle shell exit
          if (machineId && machineManager.shellUIClients) {
            const shellWs = machineManager.shellUIClients.get(machineId);
            if (shellWs && shellWs.readyState === ws.OPEN) {
              shellWs.send(JSON.stringify({
                type: 'output',
                data: `\r\n\x1b[33mRemote shell exited with code ${data.exitCode}${data.signal ? ` (${data.signal})` : ''}\x1b[0m\r\n`
              }));
            }
          }
          break;
          
        default:
          console.log('Unknown machine message type:', data.type);
      }
    } catch (error) {
      console.error('❌ Machine WebSocket error:', error.message);
      sendEncrypted({
        type: 'error',
        error: error.message
      });
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Machine client disconnected');
    if (machineId) {
      machineManager.handleMachineDisconnect(machineId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ Machine WebSocket error:', error);
  });
}
// Audio transcription endpoint
app.post('/api/transcribe', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Handle multipart form data
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to process audio file' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in server environment.' });
      }
      
      try {
        // Create form data for OpenAI
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        formData.append('language', 'en');
        
        // Make request to OpenAI
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
        }
        
        const data = await response.json();
        let transcribedText = data.text || '';
        
        // Check if enhancement mode is enabled
        const mode = req.body.mode || 'default';
        
        // If no transcribed text, return empty
        if (!transcribedText) {
          return res.json({ text: '' });
        }
        
        // If default mode, return transcribed text without enhancement
        if (mode === 'default') {
          return res.json({ text: transcribedText });
        }
        
        // Handle different enhancement modes
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey });
          
          let prompt, systemMessage, temperature = 0.7, maxTokens = 800;
          
          switch (mode) {
            case 'prompt':
              systemMessage = 'You are an expert prompt engineer who creates clear, detailed, and effective prompts.';
              prompt = `You are an expert prompt engineer. Transform the following rough instruction into a clear, detailed, and context-aware AI prompt.

Your enhanced prompt should:
1. Be specific and unambiguous
2. Include relevant context and constraints
3. Specify the desired output format
4. Use clear, actionable language
5. Include examples where helpful
6. Consider edge cases and potential ambiguities

Transform this rough instruction into a well-crafted prompt:
"${transcribedText}"

Enhanced prompt:`;
              break;
              
            case 'vibe':
            case 'instructions':
            case 'architect':
              systemMessage = 'You are a helpful assistant that formats ideas into clear, actionable instructions for AI agents.';
              temperature = 0.5; // Lower temperature for more controlled output
              prompt = `Transform the following idea into clear, well-structured instructions that an AI agent can easily understand and execute.

IMPORTANT RULES:
- Format as clear, step-by-step instructions
- Add reasonable implementation details based on common patterns
- Only include details directly related to what was asked
- Do NOT add features or functionality not mentioned
- Keep the original intent and scope intact
- Use clear, actionable language an agent can follow

Transform this idea into agent-friendly instructions:
"${transcribedText}"

Agent instructions:`;
              break;
              
            default:
              // No enhancement needed
              break;
          }
          
          // Only make GPT call if we have a prompt
          if (prompt) {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
              ],
              temperature: temperature,
              max_tokens: maxTokens
            });
            
            transcribedText = completion.choices[0].message.content || transcribedText;
          }
          
        } catch (gptError) {
          console.error('GPT processing error:', gptError);
          // Fall back to original transcription if GPT fails
        }
        
        res.json({ text: transcribedText });
        
      } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image upload endpoint
app.post('/api/projects/:projectName/upload-images', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;
    
    // Configure multer for image uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'claude-ui-uploads', String(req.user.id));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
      }
    });
    
    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
      }
    };
    
    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
      }
    });
    
    // Handle multipart form data
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }
      
      try {
        // Process uploaded images
        const processedImages = await Promise.all(
          req.files.map(async (file) => {
            // Read file and convert to base64
            const buffer = await fs.readFile(file.path);
            const base64 = buffer.toString('base64');
            const mimeType = file.mimetype;
            
            // Clean up temp file immediately
            await fs.unlink(file.path);
            
            return {
              name: file.originalname,
              data: `data:${mimeType};base64,${base64}`,
              size: file.size,
              mimeType: mimeType
            };
          })
        );
        
        res.json({ images: processedImages });
      } catch (error) {
        console.error('Error processing images:', error);
        // Clean up any remaining files
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
        res.status(500).json({ error: 'Failed to process images' });
      }
    });
  } catch (error) {
    console.error('Error in image upload endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Project MCP Configuration Routes
// GET /api/projects/:projectId/mcp - Read .claude/ccui-mcp.json
app.get('/api/projects/:projectId/mcp', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('📄 Reading project MCP config for:', projectId);
    
    // Get project by ID from projects cache/database
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const mcpConfigPath = path.join(project.fullPath, '.claude', 'ccui-mcp.json');
    
    try {
      const configContent = await fsPromises.readFile(mcpConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      res.json(config);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty config
        res.json({ mcpServers: [], strictMode: false });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error reading project MCP config:', error);
    res.status(500).json({ error: 'Failed to read MCP configuration' });
  }
});

// PUT /api/projects/:projectId/mcp - Write .claude/ccui-mcp.json
app.put('/api/projects/:projectId/mcp', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { mcpServers, strictMode } = req.body;
    console.log('💾 Writing project MCP config for:', projectId);
    
    // Get project by ID
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const claudeDir = path.join(project.fullPath, '.claude');
    const mcpConfigPath = path.join(claudeDir, 'ccui-mcp.json');
    
    // Ensure .claude directory exists
    try {
      await fsPromises.mkdir(claudeDir, { recursive: true });
    } catch (error) {
      // Directory already exists, that's fine
    }
    
    // Validate and prepare config
    const config = {
      mcpServers: mcpServers || [],
      strictMode: strictMode || false,
      lastUpdated: new Date().toISOString()
    };
    
    // Write config file
    await fsPromises.writeFile(mcpConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    
    res.json({ success: true, message: 'MCP configuration saved' });
  } catch (error) {
    console.error('Error writing project MCP config:', error);
    res.status(500).json({ error: 'Failed to save MCP configuration' });
  }
});

// GET /api/projects/:projectId/mcp/discover - Discover available MCP servers for import
app.get('/api/projects/:projectId/mcp/discover', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log('🔍 Discovering user MCP servers for project:', projectId);
    
    // Get user-level MCP servers using Claude CLI
    const { spawn } = await import('child_process');
    
    const process = spawn('claude', ['mcp', 'list'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        const userServers = parseClaudeListOutput(stdout);
        res.json({ userServers });
      } else {
        console.error('Claude CLI error:', stderr);
        res.json({ userServers: [] }); // Return empty array on error
      }
    });
    
    process.on('error', (error) => {
      console.error('Error running Claude CLI:', error);
      res.json({ userServers: [] }); // Return empty array on error
    });
  } catch (error) {
    console.error('Error discovering MCP servers:', error);
    res.status(500).json({ error: 'Failed to discover MCP servers' });
  }
});

// POST /api/projects/:projectId/mcp/import - Import selected MCP servers from user-level config
app.post('/api/projects/:projectId/mcp/import', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { serverNames } = req.body;
    console.log('📥 Importing MCP servers for project:', projectId, serverNames);
    
    if (!serverNames || !Array.isArray(serverNames)) {
      return res.status(400).json({ error: 'Invalid server names' });
    }
    
    // Get project by ID
    const projects = await getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get details for each server from Claude CLI
    const importedServers = [];
    
    for (const serverName of serverNames) {
      try {
        const serverDetails = await getClaudeServerDetails(serverName);
        if (serverDetails) {
          importedServers.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: serverName,
            type: serverDetails.type || 'stdio',
            config: serverDetails.config || {}
          });
        }
      } catch (error) {
        console.error(`Error getting details for server ${serverName}:`, error);
      }
    }
    
    // Read existing config
    const claudeDir = path.join(project.fullPath, '.claude');
    const mcpConfigPath = path.join(claudeDir, 'ccui-mcp.json');
    
    let existingConfig = { mcpServers: [], strictMode: false };
    try {
      const configContent = await fsPromises.readFile(mcpConfigPath, 'utf-8');
      existingConfig = JSON.parse(configContent);
    } catch (error) {
      // File doesn't exist, use empty config
    }
    
    // Merge imported servers with existing ones (avoid duplicates)
    const existingNames = existingConfig.mcpServers.map(s => s.name);
    const newServers = importedServers.filter(s => !existingNames.includes(s.name));
    
    const updatedConfig = {
      ...existingConfig,
      mcpServers: [...existingConfig.mcpServers, ...newServers],
      lastUpdated: new Date().toISOString()
    };
    
    // Ensure .claude directory exists
    await fsPromises.mkdir(claudeDir, { recursive: true });
    
    // Write updated config
    await fsPromises.writeFile(mcpConfigPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
    
    res.json({ 
      success: true, 
      imported: newServers.length,
      skipped: importedServers.length - newServers.length,
      message: `Imported ${newServers.length} MCP server(s)` 
    });
  } catch (error) {
    console.error('Error importing MCP servers:', error);
    res.status(500).json({ error: 'Failed to import MCP servers' });
  }
});

// Helper function to get server details from Claude CLI
async function getClaudeServerDetails(serverName) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    
    const process = spawn('claude', ['mcp', 'get', serverName], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        const serverDetails = parseClaudeGetOutput(stdout);
        resolve(serverDetails);
      } else {
        reject(new Error(`Claude CLI error: ${stderr}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

// Import the helper functions from mcp routes
function parseClaudeListOutput(output) {
  const servers = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    if (line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const name = line.substring(0, colonIndex).trim();
      const rest = line.substring(colonIndex + 1).trim();
      
      let type = 'stdio';
      let command = rest;
      let url = '';
      
      // Check if it has transport type in parentheses
      const typeMatch = rest.match(/\((\w+)\)\s*$/);
      if (typeMatch) {
        type = typeMatch[1].toLowerCase();
        command = rest.replace(/\s*\(\w+\)\s*$/, '').trim();
      } else if (rest.startsWith('http://') || rest.startsWith('https://')) {
        type = 'http';
        url = rest;
        command = '';
      }
      
      if (name) {
        servers.push({
          name,
          type,
          command,
          url
        });
      }
    }
  }
  
  return servers;
}

function parseClaudeGetOutput(output) {
  try {
    // Try to extract JSON if present
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Parse as text
    const server = { raw_output: output };
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('Name:')) {
        server.name = line.split(':')[1]?.trim();
      } else if (line.includes('Type:')) {
        server.type = line.split(':')[1]?.trim();
      } else if (line.includes('Command:')) {
        server.command = line.split(':')[1]?.trim();
      } else if (line.includes('URL:')) {
        server.url = line.split(':')[1]?.trim();
      }
    }
    
    // Build config based on type
    if (server.type === 'stdio' && server.command) {
      const parts = server.command.split(' ');
      server.config = {
        command: parts[0],
        args: parts.slice(1),
        env: {}
      };
    } else if ((server.type === 'http' || server.type === 'sse') && server.url) {
      server.config = {
        url: server.url,
        headers: {},
        timeout: 30000
      };
    }
    
    return server;
  } catch (error) {
    return { raw_output: output, parse_error: error.message };
  }
}

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Helper function to convert permissions to rwx format
function permToRwx(perm) {
  const r = perm & 4 ? 'r' : '-';
  const w = perm & 2 ? 'w' : '-';
  const x = perm & 1 ? 'x' : '-';
  return r + w + x;
}

async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
  // Using fsPromises from import
  const items = [];
  
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Debug: log all entries including hidden files
   
      
      // Skip only heavy build directories
      if (entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build') continue;
      
      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      // Get file stats for additional metadata
      try {
        const stats = await fsPromises.stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
        
        // Convert permissions to rwx format
        const mode = stats.mode;
        const ownerPerm = (mode >> 6) & 7;
        const groupPerm = (mode >> 3) & 7;
        const otherPerm = mode & 7;
        item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch (statError) {
        // If stat fails, provide default values
        item.size = 0;
        item.modified = null;
        item.permissions = '000';
        item.permissionsRwx = '---------';
      }
      
      if (entry.isDirectory() && currentDepth < maxDepth) {
        // Recursively get subdirectories but limit depth
        try {
          // Check if we can access the directory before trying to read it
          await fsPromises.access(item.path, fs.constants.R_OK);
          item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
        } catch (e) {
          // Silently skip directories we can't access (permission denied, etc.)
          item.children = [];
        }
      }
      
      items.push(item);
    }
  } catch (error) {
    // Only log non-permission errors to avoid spam
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      console.error('Error reading directory:', error);
    }
  }
  
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize authentication database
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Load API tokens into cache
    await loadTokensIntoCache();
    
    server.listen(PORT, '0.0.0.0', async () => {
      console.log(`Claude Code UI server running on http://0.0.0.0:${PORT}`);
      
      // Start watching the projects folder for changes
      await setupProjectsWatcher(); // Re-enabled with better-sqlite3
      
      // Start machine status monitoring
      machineManager.startStatusMonitoring();
      console.log('🤖 Machine manager started');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
