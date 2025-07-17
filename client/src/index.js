import { config, parseCommandLineArgs, mergeConfig } from './config.js';
import { Logger } from './logger.js';
import { MachineConnection } from './connection.js';
import { ClaudeHandler } from './handlers/claude.js';
import { ProjectsHandler } from './handlers/projects.js';
import { ApiHandler } from './handlers/apiHandler.js';

// Parse command line arguments
const cliOptions = parseCommandLineArgs(process.argv.slice(2));
const finalConfig = mergeConfig(cliOptions);

// Create logger
const logger = new Logger(finalConfig.debug);

// Show configuration
logger.info('Claude Code UI Client starting...');
logger.info(`Server: ${finalConfig.serverAddress}`);
logger.info(`Client Name: ${finalConfig.clientName}`);
logger.info(`Capabilities: ${finalConfig.capabilities.join(', ')}`);

// Create connection
const connection = new MachineConnection(finalConfig, logger);

// Create handlers
const claudeHandler = new ClaudeHandler(connection, logger);
const projectsHandler = new ProjectsHandler(connection, logger);
const apiHandler = new ApiHandler(connection, logger);

// Set up event handlers
connection.on('registered', (machine) => {
  logger.success(`Successfully registered with server as "${machine.name}"`);
});

connection.on('request:claude', (message) => {
  claudeHandler.handle(message);
});

connection.on('request:projects', (message) => {
  projectsHandler.handle(message);
});

connection.on('request:sessions', async (message) => {
  try {
    const result = await projectsHandler.getSessions(
      message.project_name,
      message.limit,
      message.offset
    );
    
    connection.send({
      type: 'session_list',
      request_id: message.request_id,
      ...result
    });
  } catch (error) {
    logger.error('Error handling sessions request:', error);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down...');
  connection.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  connection.disconnect();
  process.exit(0);
});

// Start connection
connection.connect().catch((error) => {
  logger.error('Failed to connect:', error);
  process.exit(1);
});