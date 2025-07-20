import { securityLogger, SecurityEventTypes, LogLevels } from './securityLogger.js';
import { getConnectionStats, isIPBlocked } from '../middleware/smartRateLimit.js';

class ConnectionMonitor {
  constructor() {
    // Active WebSocket connections tracking
    this.connections = new Map();
    
    // Connection metadata
    this.connectionMetadata = new Map();
    
    // Real-time statistics
    this.stats = {
      totalConnections: 0,
      peakConnections: 0,
      totalConnectionsEver: 0,
      connectionsByType: {
        chat: 0,
        shell: 0,
        machine: 0
      },
      connectionsByStatus: {
        connected: 0,
        disconnected: 0,
        error: 0
      }
    };

    // Health monitoring
    this.healthMetrics = {
      averageResponseTime: 0,
      errorRate: 0,
      connectionSuccessRate: 100
    };

    // Start monitoring
    this.startHealthMonitoring();
  }

  /**
   * Register a new WebSocket connection
   */
  registerConnection(connectionId, ws, metadata = {}) {
    const connectionInfo = {
      id: connectionId,
      ws,
      connectedAt: new Date().toISOString(),
      lastActivity: Date.now(),
      type: metadata.type || 'unknown',
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      user: metadata.user,
      machine: metadata.machine,
      messageCount: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      status: 'connected'
    };

    this.connections.set(connectionId, connectionInfo);
    this.connectionMetadata.set(connectionId, metadata);

    // Update statistics
    this.stats.totalConnections++;
    this.stats.totalConnectionsEver++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.stats.totalConnections);
    
    if (connectionInfo.type && this.stats.connectionsByType.hasOwnProperty(connectionInfo.type)) {
      this.stats.connectionsByType[connectionInfo.type]++;
    }
    this.stats.connectionsByStatus.connected++;

    // Log connection
    securityLogger.logSecurityEvent(SecurityEventTypes.CONNECTION_REGISTERED, {
      connectionId,
      ip: metadata.ip,
      type: metadata.type,
      user: metadata.user?.username,
      userAgent: metadata.userAgent
    }, LogLevels.INFO);

    // Set up connection event listeners
    this.setupConnectionListeners(connectionId, ws);

    return connectionInfo;
  }

  /**
   * Set up event listeners for connection monitoring
   */
  setupConnectionListeners(connectionId, ws) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    // Track messages
    const originalSend = ws.send;
    ws.send = (data) => {
      if (connectionInfo) {
        connectionInfo.bytesSent += Buffer.byteLength(data, 'utf8');
        connectionInfo.lastActivity = Date.now();
      }
      return originalSend.call(ws, data);
    };

    // Track errors
    ws.on('error', (error) => {
      this.handleConnectionError(connectionId, error);
    });

    // Track close
    ws.on('close', (code, reason) => {
      this.handleConnectionClose(connectionId, code, reason);
    });

    // Track pings/pongs for health
    ws.on('ping', () => {
      if (connectionInfo) {
        connectionInfo.lastActivity = Date.now();
      }
    });

    ws.on('pong', () => {
      if (connectionInfo) {
        connectionInfo.lastActivity = Date.now();
      }
    });
  }

  /**
   * Handle incoming message for connection tracking
   */
  handleMessage(connectionId, messageSize, messageType) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    connectionInfo.messageCount++;
    connectionInfo.bytesReceived += messageSize;
    connectionInfo.lastActivity = Date.now();

    // Track message types for analytics
    if (!connectionInfo.messageTypes) {
      connectionInfo.messageTypes = {};
    }
    connectionInfo.messageTypes[messageType] = (connectionInfo.messageTypes[messageType] || 0) + 1;
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(connectionId, error) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    connectionInfo.errors++;
    connectionInfo.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };

    // Update health metrics
    this.updateHealthMetrics();

    securityLogger.logSecurityEvent(SecurityEventTypes.WEBSOCKET_PROTOCOL_ERROR, {
      connectionId,
      ip: connectionInfo.ip,
      error: error.message,
      errorCount: connectionInfo.errors
    }, LogLevels.WARN);
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connectionId, code, reason) {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return;

    // Update connection info
    connectionInfo.status = 'disconnected';
    connectionInfo.disconnectedAt = new Date().toISOString();
    connectionInfo.closeCode = code;
    connectionInfo.closeReason = reason;

    // Calculate session duration
    const connectedTime = new Date(connectionInfo.connectedAt).getTime();
    const disconnectedTime = Date.now();
    connectionInfo.sessionDuration = disconnectedTime - connectedTime;

    // Update statistics
    this.stats.totalConnections--;
    this.stats.connectionsByStatus.connected--;
    this.stats.connectionsByStatus.disconnected++;
    
    if (connectionInfo.type && this.stats.connectionsByType.hasOwnProperty(connectionInfo.type)) {
      this.stats.connectionsByType[connectionInfo.type]--;
    }

    // Log disconnection
    securityLogger.logSecurityEvent(SecurityEventTypes.CONNECTION_UNREGISTERED, {
      connectionId,
      ip: connectionInfo.ip,
      sessionDuration: connectionInfo.sessionDuration,
      messageCount: connectionInfo.messageCount,
      closeCode: code,
      closeReason: reason
    }, LogLevels.INFO);

    // Keep connection info for a while for analytics
    setTimeout(() => {
      this.connections.delete(connectionId);
      this.connectionMetadata.delete(connectionId);
    }, 5 * 60 * 1000); // Keep for 5 minutes
  }

  /**
   * Get real-time connection statistics
   */
  getConnectionStats() {
    const rateLimitStats = getConnectionStats();
    
    return {
      // Basic counts
      ...this.stats,
      
      // Rate limiting stats
      rateLimiting: rateLimitStats,
      
      // Health metrics
      health: this.healthMetrics,
      
      // Active connections by IP
      activeConnectionsByIP: this.getConnectionsByIP(),
      
      // Recent activity
      recentActivity: this.getRecentActivity(),
      
      // Error summary
      errorSummary: this.getErrorSummary()
    };
  }

  /**
   * Get connections grouped by IP
   */
  getConnectionsByIP() {
    const ipMap = {};
    
    for (const [connectionId, info] of this.connections.entries()) {
      if (info.status !== 'connected') continue;
      
      const ip = info.ip || 'unknown';
      if (!ipMap[ip]) {
        ipMap[ip] = {
          count: 0,
          connections: [],
          totalMessages: 0,
          totalBytes: 0,
          isBlocked: isIPBlocked(ip)
        };
      }
      
      ipMap[ip].count++;
      ipMap[ip].connections.push({
        id: connectionId,
        type: info.type,
        user: info.user?.username,
        connectedAt: info.connectedAt,
        messageCount: info.messageCount,
        errors: info.errors
      });
      ipMap[ip].totalMessages += info.messageCount;
      ipMap[ip].totalBytes += info.bytesReceived + info.bytesSent;
    }
    
    return ipMap;
  }

  /**
   * Get recent connection activity
   */
  getRecentActivity(minutes = 10) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const activity = [];
    
    for (const [connectionId, info] of this.connections.entries()) {
      if (info.lastActivity > cutoff) {
        activity.push({
          connectionId,
          ip: info.ip,
          type: info.type,
          user: info.user?.username,
          lastActivity: new Date(info.lastActivity).toISOString(),
          messageCount: info.messageCount,
          status: info.status
        });
      }
    }
    
    return activity.sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errors = {
      totalErrors: 0,
      errorsByType: {},
      connectionErrors: 0,
      recentErrors: []
    };
    
    for (const [connectionId, info] of this.connections.entries()) {
      errors.totalErrors += info.errors;
      if (info.errors > 0) {
        errors.connectionErrors++;
      }
      
      if (info.lastError) {
        const errorTime = new Date(info.lastError.timestamp).getTime();
        if (Date.now() - errorTime < 60 * 60 * 1000) { // Last hour
          errors.recentErrors.push({
            connectionId,
            ip: info.ip,
            message: info.lastError.message,
            timestamp: info.lastError.timestamp
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Update health metrics
   */
  updateHealthMetrics() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let totalConnections = 0;
    let successfulConnections = 0;
    let totalErrors = 0;
    let totalMessages = 0;
    
    for (const [connectionId, info] of this.connections.entries()) {
      const connectedTime = new Date(info.connectedAt).getTime();
      if (connectedTime > oneHourAgo) {
        totalConnections++;
        if (info.errors === 0) {
          successfulConnections++;
        }
        totalErrors += info.errors;
        totalMessages += info.messageCount;
      }
    }
    
    // Calculate success rate
    if (totalConnections > 0) {
      this.healthMetrics.connectionSuccessRate = (successfulConnections / totalConnections) * 100;
    }
    
    // Calculate error rate
    if (totalMessages > 0) {
      this.healthMetrics.errorRate = (totalErrors / totalMessages) * 100;
    }
    
    // Average response time would need to be tracked separately
    // For now, we'll estimate based on connection health
    this.healthMetrics.averageResponseTime = totalErrors > 0 ? 150 : 50; // ms estimate
  }

  /**
   * Get connection details by ID
   */
  getConnectionDetails(connectionId) {
    const info = this.connections.get(connectionId);
    const metadata = this.connectionMetadata.get(connectionId);
    
    if (!info) return null;
    
    return {
      ...info,
      metadata,
      uptime: info.status === 'connected' ? Date.now() - new Date(info.connectedAt).getTime() : 0,
      isHealthy: info.errors < 5 && (Date.now() - info.lastActivity) < 5 * 60 * 1000 // 5 minutes
    };
  }

  /**
   * Force disconnect a connection
   */
  forceDisconnect(connectionId, reason = 'Admin disconnect') {
    const connectionInfo = this.connections.get(connectionId);
    if (!connectionInfo) return false;
    
    securityLogger.logSecurityEvent('ADMIN_FORCE_DISCONNECT', {
      connectionId,
      ip: connectionInfo.ip,
      reason,
      admin: 'system' // TODO: Get actual admin user
    }, LogLevels.WARN);
    
    try {
      connectionInfo.ws.close(1008, reason);
      return true;
    } catch (error) {
      console.error('Error force disconnecting:', error);
      return false;
    }
  }

  /**
   * Get connections for a specific user
   */
  getUserConnections(userId) {
    const userConnections = [];
    
    for (const [connectionId, info] of this.connections.entries()) {
      if (info.user && info.user.id === userId) {
        userConnections.push({
          connectionId,
          type: info.type,
          connectedAt: info.connectedAt,
          lastActivity: new Date(info.lastActivity).toISOString(),
          messageCount: info.messageCount,
          status: info.status,
          ip: info.ip
        });
      }
    }
    
    return userConnections;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Update health metrics every minute
    setInterval(() => {
      this.updateHealthMetrics();
    }, 60 * 1000);
    
    // Check for stale connections every 5 minutes
    setInterval(() => {
      this.checkStaleConnections();
    }, 5 * 60 * 1000);
  }

  /**
   * Check for stale connections
   */
  checkStaleConnections() {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [connectionId, info] of this.connections.entries()) {
      if (info.status === 'connected' && (now - info.lastActivity) > staleThreshold) {
        securityLogger.logSecurityEvent(SecurityEventTypes.CONNECTION_IDLE_TIMEOUT, {
          connectionId,
          ip: info.ip,
          idleTime: now - info.lastActivity,
          lastActivity: new Date(info.lastActivity).toISOString()
        }, LogLevels.WARN);
        
        // Optionally force disconnect very stale connections
        if ((now - info.lastActivity) > 2 * staleThreshold) {
          this.forceDisconnect(connectionId, 'Idle timeout');
        }
      }
    }
  }
}

// Create singleton instance
export const connectionMonitor = new ConnectionMonitor();

// Export convenience functions
export function registerConnection(connectionId, ws, metadata) {
  return connectionMonitor.registerConnection(connectionId, ws, metadata);
}

export function handleMessage(connectionId, messageSize, messageType) {
  return connectionMonitor.handleMessage(connectionId, messageSize, messageType);
}

export function getMonitorConnectionStats() {
  return connectionMonitor.getConnectionStats();
}

export function getConnectionDetails(connectionId) {
  return connectionMonitor.getConnectionDetails(connectionId);
}

export function forceDisconnect(connectionId, reason) {
  return connectionMonitor.forceDisconnect(connectionId, reason);
}

export function getUserConnections(userId) {
  return connectionMonitor.getUserConnections(userId);
}