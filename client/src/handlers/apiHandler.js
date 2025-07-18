import { ClientMessageTypes } from '../../../shared/protocol.js';
import { ProjectsHandler } from './projects.js';
import fs from 'fs/promises';
import path from 'path';

export class ApiHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.projectsHandler = new ProjectsHandler(connection, logger);
    
    // Register handler
    this.connection.on('request:api', this.handleApiRequest.bind(this));
  }
  
  async handleApiRequest(message) {
    const { requestId, data } = message;
    const { path: apiPath, method, query, body, headers } = data;
    
    try {
      this.logger.info(`API Request: ${method} ${apiPath}`);
      
      // Route API requests to appropriate handlers
      let responseData;
      let status = 200;
      
      // Handle different API endpoints
      if (apiPath === '/projects' && method === 'GET') {
        // Get projects list
        responseData = await this.projectsHandler.getProjects();
      } 
      else if (apiPath.match(/^\/projects\/([^\/]+)\/sessions$/) && method === 'GET') {
        // Get sessions for a project
        const matches = apiPath.match(/^\/projects\/([^\/]+)\/sessions$/);
        const projectName = decodeURIComponent(matches[1]);
        const limit = parseInt(query?.limit || '10');
        const offset = parseInt(query?.offset || '0');
        responseData = await this.projectsHandler.getSessions(projectName, limit, offset);
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/sessions\/([^\/]+)\/messages$/) && method === 'GET') {
        // Get messages for a session
        const matches = apiPath.match(/^\/projects\/([^\/]+)\/sessions\/([^\/]+)\/messages$/);
        const projectName = decodeURIComponent(matches[1]);
        const sessionId = decodeURIComponent(matches[2]);
        responseData = await this.getSessionMessages(projectName, sessionId);
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/file$/) && method === 'GET') {
        // Read file content
        const filePath = query?.filePath;
        if (!filePath || !path.isAbsolute(filePath)) {
          status = 400;
          responseData = { error: 'Invalid file path' };
        } else {
          try {
            const content = await fs.readFile(filePath, 'utf8');
            responseData = { content, path: filePath };
          } catch (error) {
            if (error.code === 'ENOENT') {
              status = 404;
              responseData = { error: 'File not found' };
            } else if (error.code === 'EACCES') {
              status = 403;
              responseData = { error: 'Permission denied' };
            } else {
              throw error;
            }
          }
        }
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/file$/) && method === 'PUT') {
        // Save file content
        const { filePath, content } = body || {};
        if (!filePath || !path.isAbsolute(filePath)) {
          status = 400;
          responseData = { error: 'Invalid file path' };
        } else {
          try {
            await fs.writeFile(filePath, content, 'utf8');
            responseData = { success: true, path: filePath };
          } catch (error) {
            if (error.code === 'EACCES') {
              status = 403;
              responseData = { error: 'Permission denied' };
            } else {
              throw error;
            }
          }
        }
      }
      else {
        // Unsupported endpoint
        status = 404;
        responseData = { error: `Endpoint ${method} ${apiPath} not found` };
      }
      
      // Send response back
      this.connection.send({
        type: ClientMessageTypes.API_RESPONSE,
        requestId,
        machine_id: this.connection.machineId,
        status,
        headers: { 'content-type': 'application/json' },
        data: responseData
      });
      
    } catch (error) {
      this.logger.error('API request error:', error);
      
      // Send error response
      this.connection.send({
        type: ClientMessageTypes.API_RESPONSE,
        requestId,
        machine_id: this.connection.machineId,
        status: 500,
        error: error.message
      });
    }
  }
  
  async getSessionMessages(projectName, sessionId) {
    // TODO: Implement reading session messages from Claude's session files
    // For now, return empty messages
    return { messages: [] };
  }
}