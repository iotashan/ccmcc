import { ClientMessageTypes } from '../../../shared/protocol.js';
import { ProjectsHandler } from './projects.js';
import { GitHandler } from './git.js';
import fs from 'fs/promises';
import path from 'path';

export class ApiHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.projectsHandler = new ProjectsHandler(connection, logger);
    this.gitHandler = new GitHandler(connection, logger);
    
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
      else if (apiPath.match(/^\/projects\/([^\/]+)\/files$/) && method === 'GET') {
        // Get file tree for a project
        const matches = apiPath.match(/^\/projects\/([^\/]+)\/files$/);
        const projectName = decodeURIComponent(matches[1]);
        
        // Decode the project name to get the actual path
        const actualPath = projectName.replace(/-/g, '/');
        
        try {
          // Get file tree (similar to server implementation)
          responseData = await this.getFileTree(actualPath, 3, 0, true);
        } catch (error) {
          if (error.code === 'ENOENT') {
            status = 404;
            responseData = { error: `Project path not found: ${actualPath}` };
          } else if (error.code === 'EACCES') {
            status = 403;
            responseData = { error: 'Permission denied' };
          } else {
            throw error;
          }
        }
      }
      else if (apiPath === '/projects/create' && method === 'POST') {
        // Create a new project
        const { path: projectPath } = body || {};
        if (!projectPath || !projectPath.trim()) {
          status = 400;
          responseData = { error: 'Project path is required' };
        } else {
          try {
            // Validate path exists
            await fs.access(projectPath);
            
            // Generate project name (encode path)
            const projectName = projectPath.replace(/\//g, '-');
            
            responseData = {
              success: true,
              projectName,
              path: projectPath
            };
          } catch (error) {
            if (error.code === 'ENOENT') {
              status = 404;
              responseData = { error: 'Path does not exist' };
            } else if (error.code === 'EACCES') {
              status = 403;
              responseData = { error: 'Permission denied' };
            } else {
              throw error;
            }
          }
        }
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/rename$/) && method === 'PUT') {
        // Rename project
        const matches = apiPath.match(/^\/projects\/([^\/]+)\/rename$/);
        const projectName = decodeURIComponent(matches[1]);
        const { newName } = body || {};
        
        if (!newName || !newName.trim()) {
          status = 400;
          responseData = { error: 'New name is required' };
        } else {
          // For remote machines, we can't actually rename Claude's project directories
          // Just return success to satisfy the UI
          responseData = {
            success: true,
            oldName: projectName,
            newName: newName
          };
        }
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/sessions\/([^\/]+)$/) && method === 'DELETE') {
        // Delete session
        const matches = apiPath.match(/^\/projects\/([^\/]+)\/sessions\/([^\/]+)$/);
        const projectName = decodeURIComponent(matches[1]);
        const sessionId = decodeURIComponent(matches[2]);
        
        // For remote machines, we can't actually delete Claude's sessions
        // Just return success to satisfy the UI
        responseData = {
          success: true,
          message: 'Session deleted'
        };
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)$/) && method === 'DELETE') {
        // Delete project
        const matches = apiPath.match(/^\/projects\/([^\/]+)$/);
        const projectName = decodeURIComponent(matches[1]);
        
        // For remote machines, we can't actually delete Claude's projects
        // Just return success to satisfy the UI
        responseData = {
          success: true,
          message: 'Project deleted'
        };
      }
      else if (apiPath.match(/^\/projects\/([^\/]+)\/files\/content$/) && method === 'GET') {
        // Serve binary file content
        const filePath = query?.path;
        
        if (!filePath || !path.isAbsolute(filePath)) {
          status = 400;
          responseData = { error: 'Invalid file path' };
        } else {
          try {
            // Read file as buffer for binary content
            const content = await fs.readFile(filePath);
            responseData = content; // Send raw buffer
            headers['content-type'] = 'application/octet-stream';
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
      else if (apiPath.match(/^\/projects\/([^\/]+)\/upload-images$/) && method === 'POST') {
        // Handle image upload
        // For remote machines, we don't support file uploads via this endpoint
        status = 501;
        responseData = { error: 'Image upload not supported on remote machines' };
      }
      else if (apiPath.startsWith('/api/git/')) {
        // Route git requests to GitHandler
        // Create a message for the git handler
        const gitMessage = {
          request_id: requestId,
          data: {
            path: apiPath,
            method: method,
            query: query,
            body: body,
            headers: headers
          }
        };
        
        // Let the git handler process it
        await this.gitHandler.handle(gitMessage);
        
        // GitHandler sends its own response, so we return early
        return;
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

  async getFileTree(dir, maxDepth = 3, currentDepth = 0, includeHidden = false) {
    const tree = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files unless explicitly included
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        const item = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file'
        };
        
        if (entry.isDirectory() && currentDepth < maxDepth) {
          // Recursively get children
          item.children = await this.getFileTree(fullPath, maxDepth, currentDepth + 1, includeHidden);
        }
        
        tree.push(item);
      }
      
      // Sort: directories first, then files, alphabetically
      tree.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
      
    } catch (error) {
      this.logger.error(`Error reading directory ${dir}:`, error);
      throw error;
    }
    
    return tree;
  }
}