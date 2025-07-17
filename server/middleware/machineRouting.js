import { ServerMessageTypes } from '../../shared/protocol.js';

// Middleware to handle machine routing for API requests
export const machineRoutingMiddleware = (machineManager) => {
  return async (req, res, next) => {
    const machineId = req.headers['x-machine-id'];
    
    // If no machine ID or it's 'local', proceed normally
    if (!machineId || machineId === 'local') {
      return next();
    }
    
    // Check if machine is connected
    const machine = machineManager.getMachine(machineId);
    if (!machine || !machine.is_online) {
      return res.status(503).json({ 
        error: 'Target machine is not available',
        machineId,
        status: machine ? 'offline' : 'not found'
      });
    }
    
    // Create a unique request ID for tracking
    const requestId = `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Extract the API path and method
    const apiPath = req.path;
    const method = req.method;
    
    // Prepare the request data
    const requestData = {
      path: apiPath,
      method: method,
      query: req.query,
      body: req.body,
      headers: {
        // Forward relevant headers but remove sensitive ones
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
        // Don't forward authorization or machine-id headers
      }
    };
    
    try {
      // Send request to the remote machine
      const response = await machineManager.sendRequest(machineId, {
        type: ServerMessageTypes.REQUEST_API_FORWARD,
        requestId,
        data: requestData
      });
      
      // Forward the response from the remote machine
      if (response.error) {
        return res.status(response.status || 500).json({ error: response.error });
      }
      
      // Set response headers if provided
      if (response.headers) {
        Object.entries(response.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      // Send the response
      res.status(response.status || 200).json(response.data);
      
    } catch (error) {
      console.error('Machine routing error:', error);
      return res.status(500).json({ 
        error: 'Failed to route request to machine',
        machineId,
        details: error.message
      });
    }
  };
};

// Helper function to create machine-aware route handlers
export const createMachineAwareHandler = (localHandler) => {
  return async (req, res, next) => {
    // If the request has been handled by machine routing, skip local handler
    if (res.headersSent) {
      return;
    }
    
    // Otherwise, use the local handler
    return localHandler(req, res, next);
  };
};