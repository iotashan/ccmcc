import pty from 'node-pty';
import { ClientMessageTypes } from '../../../shared/protocol.js';

export class ShellHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.activeSessions = new Map(); // Map of session IDs to PTY instances
  }

  async handle(message) {
    const { request_id } = message;
    
    try {
      // Handle different shell operations
      switch (message.type) {
        case 'request_shell_init':
          await this.handleShellInit(message);
          break;
          
        case 'request_shell_input':
          this.handleShellInput(message);
          break;
          
        case 'request_shell_resize':
          this.handleShellResize(message);
          break;
          
        case 'request_shell_exit':
          this.handleShellExit(message);
          break;
          
        default:
          this.logger.error('Unknown shell operation:', message.type);
      }
    } catch (error) {
      this.logger.error('Error handling shell operation:', error);
      
      // Send error response
      this.connection.send({
        type: ClientMessageTypes.SHELL_OUTPUT,
        request_id,
        data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
      });
    }
  }

  async handleShellInit(message) {
    const { request_id, projectPath, sessionId, hasSession, cols, rows } = message;
    
    this.logger.info('Initializing shell:', {
      projectPath,
      sessionId,
      hasSession,
      cols,
      rows
    });
    
    try {
      // If there's an existing session, close it
      if (this.activeSessions.has(request_id)) {
        const oldPty = this.activeSessions.get(request_id);
        oldPty.kill();
        this.activeSessions.delete(request_id);
      }
      
      // Build shell command
      let claudeCommand = 'claude';
      if (hasSession && sessionId) {
        claudeCommand = `claude --resume ${sessionId} || claude`;
      }
      
      // Create shell command that changes to project directory first
      const shellCommand = `cd "${projectPath}" && ${claudeCommand}`;
      
      // Start shell using PTY
      const shellProcess = pty.spawn('bash', ['-c', shellCommand], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.HOME || '/',
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '3',
          // Override browser opening to echo URL for detection
          BROWSER: 'echo "OPEN_URL:"'
        }
      });
      
      // Store the PTY instance
      this.activeSessions.set(request_id, shellProcess);
      
      // Send initial welcome message
      const welcomeMsg = hasSession ? 
        `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
        `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`;
      
      this.connection.send({
        type: ClientMessageTypes.SHELL_OUTPUT,
        request_id,
        data: welcomeMsg
      });
      
      // Handle shell output
      shellProcess.onData((data) => {
        // Send output back to server
        this.connection.send({
          type: ClientMessageTypes.SHELL_OUTPUT,
          request_id,
          data
        });
      });
      
      // Handle shell exit
      shellProcess.onExit((exitCode) => {
        this.logger.info('Shell process exited:', exitCode);
        
        // Clean up
        this.activeSessions.delete(request_id);
        
        // Send exit message
        this.connection.send({
          type: ClientMessageTypes.SHELL_EXIT,
          request_id,
          exitCode: exitCode.exitCode,
          signal: exitCode.signal
        });
      });
      
    } catch (error) {
      this.logger.error('Error starting shell:', error);
      throw error;
    }
  }

  handleShellInput(message) {
    const { request_id, data } = message;
    
    const shellProcess = this.activeSessions.get(request_id);
    if (shellProcess) {
      try {
        shellProcess.write(data);
      } catch (error) {
        this.logger.error('Error writing to shell:', error);
      }
    } else {
      this.logger.warn('No active shell session for request:', request_id);
    }
  }

  handleShellResize(message) {
    const { request_id, cols, rows } = message;
    
    const shellProcess = this.activeSessions.get(request_id);
    if (shellProcess) {
      try {
        shellProcess.resize(cols, rows);
        this.logger.debug('Shell resized:', { cols, rows });
      } catch (error) {
        this.logger.error('Error resizing shell:', error);
      }
    }
  }

  handleShellExit(message) {
    const { request_id } = message;
    
    const shellProcess = this.activeSessions.get(request_id);
    if (shellProcess) {
      try {
        shellProcess.kill();
        this.activeSessions.delete(request_id);
        this.logger.info('Shell session terminated:', request_id);
      } catch (error) {
        this.logger.error('Error killing shell:', error);
      }
    }
  }

  // Clean up all active sessions
  cleanup() {
    for (const [requestId, shellProcess] of this.activeSessions) {
      try {
        shellProcess.kill();
      } catch (error) {
        this.logger.error('Error killing shell process:', error);
      }
    }
    this.activeSessions.clear();
  }
}