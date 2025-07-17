import fetch from 'node-fetch';
import { ClientMessageTypes } from '../../../shared/protocol.js';

export class ApiHandler {
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    
    // Register handler
    this.connection.on('request:api', this.handleApiRequest.bind(this));
  }
  
  async handleApiRequest(message) {
    const { requestId, data } = message;
    const { path, method, query, body, headers } = data;
    
    try {
      this.logger.info(`API Request: ${method} ${path}`);
      
      // Build the full URL with query parameters
      const url = new URL(path, 'http://localhost:3000/api');
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }
      
      // Prepare fetch options
      const options = {
        method,
        headers: headers || {}
      };
      
      // Add body for non-GET requests
      if (body && method !== 'GET' && method !== 'HEAD') {
        options.body = JSON.stringify(body);
        if (!options.headers['content-type']) {
          options.headers['content-type'] = 'application/json';
        }
      }
      
      // Make the local API call
      const response = await fetch(url.toString(), options);
      
      // Get response data
      const responseData = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }
      
      // Send response back
      this.connection.send({
        type: ClientMessageTypes.API_RESPONSE,
        requestId,
        machine_id: this.connection.machineId,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: parsedData
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
}