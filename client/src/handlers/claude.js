import { spawn } from 'child_process';
import { ClientMessageTypes } from '../../../shared/protocol.js';
import ClaudeRunner from '../../../src/utils/claudeRunner.js';

export class ClaudeHandler {
  constructor(connection, logger, config) {
    this.connection = connection;
    this.logger = logger;
    this.config = config;
    this.activeProcesses = new Map();
    this.claudeRunner = new ClaudeRunner();
  }

  async handle(message) {
    const { command, options, request_id } = message;
    
    this.logger.info(`Executing Claude command: ${command || '[Continue/Resume]'}`);
    
    try {
      // Build Claude command
      let args = [];
      
      if (options?.sessionId) {
        args.push('--resume', options.sessionId);
      }
      
      if (command && command.trim()) {
        // Add command with --print flag like the server does
        args.push('--print', command);
      }
      
      // Add output format and model like the server does
      args.push('--output-format', 'stream-json', '--verbose');
      
      if (!options?.sessionId) {
        args.push('--model', 'sonnet');
      }
      
      // Change to project directory if specified
      const projectPath = options?.projectPath || process.cwd();
      
      this.logger.info(`Running Claude with hooks enabled`);
      this.logger.info(`Working directory: ${projectPath}`);
      
      // Generate session ID
      const sessionId = options?.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Run Claude with hooks injected
      const result = await this.claudeRunner.runWithHooks({
        projectPath,
        machineId: this.config.machineId,
        sessionId,
        serverUrl: `http://${this.config.serverHost}:${this.config.serverPort}`,
        command: 'claude',
        args,
        onData: ({ type, data }) => {
          this.logger.info(`Claude ${type}:`, data);
          this.connection.send({
            type: ClientMessageTypes.CLAUDE_RESPONSE,
            request_id,
            data,
            stream: type
          });
        },
        onError: (error) => {
          this.logger.error('Claude process error:', error);
          this.connection.send({
            type: ClientMessageTypes.CLAUDE_ERROR,
            request_id,
            error: error.message
          });
        },
        onComplete: ({ code, signal }) => {
          this.logger.info(`Claude process exited with code ${code}`);
          this.connection.send({
            type: ClientMessageTypes.CLAUDE_COMPLETE,
            request_id,
            code,
            signal
          });
          this.activeProcesses.delete(request_id);
        }
      });
      
      // Store process reference
      if (result.process) {
        this.activeProcesses.set(request_id, result);
      }
      
    } catch (error) {
      this.logger.error('Error executing Claude:', error);
      
      this.connection.send({
        type: ClientMessageTypes.CLAUDE_ERROR,
        request_id,
        error: error.message
      });
    }
  }
  
  abort(sessionId) {
    // Find and kill process by session ID
    for (const [requestId, result] of this.activeProcesses) {
      if (result.sessionId === sessionId && result.kill) {
        result.kill();
        this.activeProcesses.delete(requestId);
        break;
      }
    }
  }
  
  // Clean up on exit
  cleanup() {
    for (const [requestId, result] of this.activeProcesses) {
      if (result.kill) {
        result.kill();
      }
    }
    this.activeProcesses.clear();
  }
}