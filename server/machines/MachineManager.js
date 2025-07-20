import { machineDb } from '../database/db.js';
import { validateApiToken } from '../utils/apiTokens.js';
import crypto from 'crypto';

class MachineManager {
  constructor() {
    this.connections = new Map(); // machineId -> { ws, userId, lastHeartbeat, ... }
    this.userConnections = new Map(); // ws -> userId (for UI clients)
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
    this.heartbeatInterval = 30000; // 30 seconds
    this.offlineThreshold = 90000; // 90 seconds
    this.statusCheckInterval = null;
  }

  // Start the status monitoring loop
  startStatusMonitoring() {
    if (this.statusCheckInterval) return;
    
    this.statusCheckInterval = setInterval(() => {
      this.checkMachineStatuses();
    }, 10000); // Check every 10 seconds
  }

  // Stop the status monitoring loop
  stopStatusMonitoring() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  // Check all machine statuses and update offline machines
  async checkMachineStatuses() {
    const now = Date.now();
    const offlineMachines = [];

    // Check heartbeats for connected machines
    for (const [machineId, connection] of this.connections) {
      if (now - connection.lastHeartbeat > this.offlineThreshold) {
        offlineMachines.push(machineId);
      }
    }

    // Mark machines as offline
    for (const machineId of offlineMachines) {
      await this.handleMachineDisconnect(machineId);
    }

    // Update database for machines that haven't been seen
    try {
      await machineDb.updateOfflineMachines(Math.floor(this.offlineThreshold / 1000));
    } catch (error) {
      console.error('Error updating offline machines:', error);
    }
  }

  // Register a UI client connection
  registerUIClient(ws, userId) {
    this.userConnections.set(ws, userId);
    
    // Send initial machine list
    this.sendMachineListToClient(ws, userId);
  }

  // Unregister a UI client connection
  unregisterUIClient(ws) {
    this.userConnections.delete(ws);
  }

  // Register a shell UI client for a specific machine
  registerShellUIClient(ws, machineId) {
    // Store shell UI client reference for routing shell output
    if (!this.shellUIClients) {
      this.shellUIClients = new Map();
    }
    this.shellUIClients.set(machineId, ws);
    console.log(`🐚 Registered shell UI client for machine ${machineId}`);
  }

  // Unregister a shell UI client
  unregisterShellUIClient(ws, machineId) {
    if (this.shellUIClients && this.shellUIClients.get(machineId) === ws) {
      this.shellUIClients.delete(machineId);
      console.log(`🐚 Unregistered shell UI client for machine ${machineId}`);
    }
  }

  // Register a machine connection
  async registerMachine(ws, machineData) {
    try {
      const { name, ip_address, capabilities, user_id, auth_token } = machineData;
      
      // Validate API token if provided
      let machine;
      let actualUserId = user_id;
      
      if (auth_token) {
        // Use new API token validation
        const tokenData = await validateApiToken(auth_token);
        if (!tokenData) {
          throw new Error('Invalid API token');
        }
        actualUserId = tokenData.user_id;
      }
      
      // Use upsert to create/update machine and set online status in one operation
      machine = await machineDb.upsertMachine({
        name,
        ip_address,
        capabilities,
        user_id: actualUserId
      });

      // Store connection
      this.connections.set(machine.id, {
        ws,
        userId: machine.user_id,
        machineId: machine.id,
        lastHeartbeat: Date.now(),
        capabilities: machine.capabilities
      });

      // Broadcast updated machine list
      await this.broadcastMachineList(machine.user_id);

      return {
        success: true,
        machine: {
          id: machine.id,
          name: machine.name,
          auth_token: machine.auth_token
        }
      };
    } catch (error) {
      console.error('Error registering machine:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle machine heartbeat
  async handleHeartbeat(machineId) {
    const connection = this.connections.get(machineId);
    if (connection) {
      connection.lastHeartbeat = Date.now();
      await machineDb.updateMachineStatus(machineId, 'online');
      return true;
    }
    return false;
  }

  // Handle machine disconnect
  async handleMachineDisconnect(machineId) {
    const connection = this.connections.get(machineId);
    if (!connection) return;

    // Update database
    await machineDb.updateMachineStatus(machineId, 'offline');

    // Remove from connections
    this.connections.delete(machineId);

    // Broadcast updated machine list
    await this.broadcastMachineList(connection.userId);
  }

  // Get machine connection by ID
  getMachineConnection(machineId) {
    return this.connections.get(machineId);
  }

  // Route a message to a specific machine
  routeToMachine(machineId, message) {
    const connection = this.connections.get(machineId);
    if (connection && connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // Send machine list to a specific UI client
  async sendMachineListToClient(ws, userId) {
    try {
      const machines = await machineDb.getUserMachines(userId);
      
      const machineList = machines.map(m => ({
        id: m.id,
        name: m.name,
        status: m.status,
        lastSeen: m.last_seen,
        capabilities: m.capabilities
      }));

      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'machine_list_update',
          machines: machineList
        }));
      }
    } catch (error) {
      console.error('Error sending machine list:', error);
    }
  }

  // Broadcast machine list to all UI clients for a user
  async broadcastMachineList(userId) {
    try {
      const machines = await machineDb.getUserMachines(userId);
      
      const machineList = machines.map(m => ({
        id: m.id,
        name: m.name,
        status: m.status,
        lastSeen: m.last_seen,
        capabilities: m.capabilities
      }));

      const message = JSON.stringify({
        type: 'machine_list_update',
        machines: machineList
      });

      // Send to all UI clients for this user
      for (const [ws, clientUserId] of this.userConnections) {
        if (clientUserId === userId && ws.readyState === 1) {
          ws.send(message);
        }
      }
    } catch (error) {
      console.error('Error broadcasting machine list:', error);
    }
  }

  // Broadcast Claude session updates to all UI clients
  broadcastClaudeSessionUpdate(userId, updateData) {
    const message = JSON.stringify({
      type: 'claude_session_update',
      ...updateData
    });

    // Send to all UI clients for this user
    for (const [ws, clientUserId] of this.userConnections) {
      if (clientUserId === userId && ws.readyState === 1) {
        ws.send(message);
      }
    }
  }

  // Get stats about connected machines
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      onlineMachines: 0,
      userStats: new Map()
    };

    for (const [machineId, connection] of this.connections) {
      stats.onlineMachines++;
      
      const userCount = stats.userStats.get(connection.userId) || 0;
      stats.userStats.set(connection.userId, userCount + 1);
    }

    return stats;
  }
  
  // Send a request to a machine and wait for response
  sendRequest(machineId, request) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(machineId);
      if (!connection || !connection.ws || connection.ws.readyState !== 1) {
        reject(new Error('Machine not connected'));
        return;
      }
      
      const requestId = request.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });
      
      // Send the request
      connection.ws.send(JSON.stringify({
        ...request,
        requestId
      }));
    });
  }
  
  // Handle response from a machine
  handleResponse(machineId, response) {
    const { requestId } = response;
    if (!requestId) return;
    
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    }
  }
}

// Create singleton instance
const machineManager = new MachineManager();

export { machineManager };