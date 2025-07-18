import { spawn } from 'child_process';
import { ClientMessageTypes } from '../../../shared/protocol.js';

export class ClaudeHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.activeProcesses = new Map();
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
        args.push(...command.split(' '));
      }
      
      // Change to project directory if specified
      const cwd = options?.projectPath || process.cwd();
      
      // Spawn Claude process
      const claudeProcess = spawn('claude-code', args, {
        cwd,
        env: process.env,
        shell: true
      });
      
      // Store process reference
      this.activeProcesses.set(request_id, claudeProcess);
      
      // Handle stdout
      claudeProcess.stdout.on('data', (data) => {
        this.connection.send({
          type: ClientMessageTypes.CLAUDE_RESPONSE,
          request_id,
          data: data.toString(),
          stream: 'stdout'
        });
      });
      
      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        this.connection.send({
          type: ClientMessageTypes.CLAUDE_RESPONSE,
          request_id,
          data: data.toString(),
          stream: 'stderr'
        });
      });
      
      // Handle process exit
      claudeProcess.on('exit', (code, signal) => {
        this.logger.info(`Claude process exited with code ${code}`);
        
        this.connection.send({
          type: ClientMessageTypes.CLAUDE_COMPLETE,
          request_id,
          code,
          signal
        });
        
        this.activeProcesses.delete(request_id);
      });
      
      // Handle errors
      claudeProcess.on('error', (error) => {
        this.logger.error('Claude process error:', error);
        
        this.connection.send({
          type: ClientMessageTypes.CLAUDE_ERROR,
          request_id,
          error: error.message
        });
        
        this.activeProcesses.delete(request_id);
      });
      
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
    for (const [requestId, process] of this.activeProcesses) {
      // TODO: Match by session ID
      process.kill('SIGTERM');
    }
  }
}