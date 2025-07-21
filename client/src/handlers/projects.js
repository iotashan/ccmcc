import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ClientMessageTypes } from '../../../shared/protocol.js';
import { generateDisplayName, encodeProjectPath, decodeProjectName } from '../../../shared/utils/projects.js';

export class ProjectsHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
  }

  // Use shared generateDisplayName utility
  async generateDisplayName(projectName, actualProjectPath = null) {
    return await generateDisplayName(projectName, actualProjectPath);
  }

  async handle(message) {
    const { request_id } = message;
    
    try {
      const projects = await this.getProjects();
      
      this.connection.send({
        type: ClientMessageTypes.PROJECT_LIST,
        request_id,
        projects
      });
    } catch (error) {
      this.logger.error('Error getting projects:', error);
      
      this.connection.send({
        type: ClientMessageTypes.PROJECT_LIST,
        request_id,
        projects: [],
        error: error.message
      });
    }
  }

  async getProjects() {
    try {
      const entries = await fs.readdir(this.claudeProjectsPath, { withFileTypes: true });
      const projects = [];
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectName = entry.name;
          const projectPath = path.join(this.claudeProjectsPath, projectName);
          
          try {
            // Decode the actual project path from the encoded directory name first
            let actualProjectPath = projectPath;
            // The project name is the encoded path - decode it
            if (projectName.startsWith('-')) {
              // Replace - with / to get the actual path
              actualProjectPath = decodeProjectName(projectName);
              // Handle Windows paths (e.g., -C-Users-...)
              if (actualProjectPath.match(/^\/[A-Z]\//) && process.platform === 'win32') {
                // Convert /C/Users/... to C:/Users/...
                actualProjectPath = actualProjectPath.substring(1, 2) + ':' + actualProjectPath.substring(2);
              }
            }
            
            // Generate display name similar to server logic
            let displayName = await this.generateDisplayName(projectName, actualProjectPath);
            
            // Read project metadata if available to get custom display name
            const metadataPath = path.join(projectPath, '.claude', 'project.json');
            try {
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
              if (metadata.displayName) {
                displayName = metadata.displayName;
              }
            } catch (e) {
              // No metadata file, use generated display name
            }
            
            // Get project stats
            const stats = await fs.stat(projectPath);
            
            projects.push({
              name: projectName,
              displayName,
              path: projectPath,
              fullPath: actualProjectPath,
              lastModified: stats.mtime,
              created: stats.birthtime
            });
          } catch (error) {
            this.logger.warn(`Error reading project ${projectName}:`, error.message);
          }
        }
      }
      
      return projects;
    } catch (error) {
      this.logger.error('Error reading projects directory:', error);
      return [];
    }
  }

  async getSessions(projectName, limit = 10, offset = 0) {
    try {
      const projectPath = path.join(this.claudeProjectsPath, projectName);
      const sessionsPath = path.join(projectPath, '.claude', 'sessions');
      
      try {
        const entries = await fs.readdir(sessionsPath, { withFileTypes: true });
        const sessions = [];
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const sessionId = entry.name;
            const sessionPath = path.join(sessionsPath, sessionId);
            
            try {
              // Read session metadata
              const metadataPath = path.join(sessionPath, 'metadata.json');
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
              
              sessions.push({
                id: sessionId,
                created: metadata.created,
                lastModified: metadata.lastModified,
                messageCount: metadata.messageCount || 0
              });
            } catch (error) {
              this.logger.warn(`Error reading session ${sessionId}:`, error.message);
            }
          }
        }
        
        // Sort by last modified descending
        sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        // Apply pagination
        const paginatedSessions = sessions.slice(offset, offset + limit);
        
        return {
          sessions: paginatedSessions,
          total: sessions.length,
          limit,
          offset
        };
      } catch (error) {
        // No sessions directory
        return {
          sessions: [],
          total: 0,
          limit,
          offset
        };
      }
    } catch (error) {
      this.logger.error('Error getting sessions:', error);
      throw error;
    }
  }
}