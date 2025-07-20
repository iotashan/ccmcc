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
        // Add command with --print flag like the server does
        args.push('--print', command);
      }
      
      // Add output format and model like the server does
      args.push('--output-format', 'stream-json', '--verbose');
      
      if (!options?.sessionId) {
        args.push('--model', 'sonnet');
      }
      
      // Change to project directory if specified
      const cwd = options?.projectPath || process.cwd();
      
      this.logger.info(`Spawning Claude with args: ${JSON.stringify(args)}`);
      this.logger.info(`Working directory: ${cwd}`);
      
      // Spawn Claude process
      let claudeProcess;
      try {
        // Use 'claude' command from PATH
        claudeProcess = spawn('claude', args, {
          cwd,
          env: process.env,
          shell: true // Use shell to find claude in PATH
        });
        this.logger.info('Claude process spawned successfully');
      } catch (spawnError) {
        this.logger.error('Failed to spawn Claude process:', spawnError);
        throw spawnError;
      }
      
      // Store process reference
      this.activeProcesses.set(request_id, claudeProcess);
      
      // Handle stdout
      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        this.logger.info('Claude stdout:', output);
        this.connection.send({
          type: ClientMessageTypes.CLAUDE_RESPONSE,
          request_id,
          data: output,
          stream: 'stdout'
        });
      });
      
      // Handle stderr
      claudeProcess.stderr.on('data', (data) => {
        this.logger.error('Claude stderr:', data.toString());
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