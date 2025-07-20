import { securityLogger } from '../utils/securityLogger.js';

// Rate limiting configuration
const RATE_LIMITS = {
  // Command initiation - limited to prevent spam
  COMMAND_INITIATION: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    messageTypes: ['claude-command', 'abort-session', 'machine-remove']
  },
  
  // Control messages - moderate limits
  CONTROL_MESSAGES: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 1 minute
    messageTypes: ['resize', 'input', 'heartbeat', 'machine_heartbeat']
  },
  
  // Streaming data - unlimited (but tracked)
  STREAMING_DATA: {
    maxRequests: Infinity,
    windowMs: 60 * 1000,
    messageTypes: ['claude-response', 'shell:output', 'api:response', 'shell_output']
  }
};

// Connection limits
const CONNECTION_LIMITS = {
  maxConcurrentPerIP: 10,
  maxNewConnectionsPerMinute: 5,
  maxBandwidthPerMinuteMB: 50,
  idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
  maxMessageSizeMB: 10
};

// Abuse detection thresholds
const ABUSE_DETECTION = {
  commandSpam: {
    maxCommands: 5,
    windowMs: 30 * 1000 // 30 seconds
  },
  connectionCycling: {
    maxCycles: 10,
    windowMs: 5 * 60 * 1000 // 5 minutes
  },
  invalidMessages: {
    maxInvalid: 20,
    windowMs: 60 * 1000 // 1 minute
  }
};

class SmartRateLimit {
  constructor() {
    // Per-connection message counters
    this.connectionLimits = new Map();
    
    // Per-IP connection tracking
    this.ipConnections = new Map();
    this.ipConnectionHistory = new Map();
    
    // Abuse detection tracking
    this.abuseTracking = new Map();
    
    // Blocked IPs
    this.blockedIPs = new Map();
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if an IP is currently blocked
   */
  isIPBlocked(ip) {
    const blockInfo = this.blockedIPs.get(ip);
    if (!blockInfo) return false;
    
    if (Date.now() > blockInfo.expiresAt) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * Block an IP temporarily
   */
  blockIP(ip, reason, durationMs = 5 * 60 * 1000) { // 5 minutes default
    const expiresAt = Date.now() + durationMs;
    this.blockedIPs.set(ip, {
      reason,
      blockedAt: Date.now(),
      expiresAt
    });
    
    securityLogger.logSecurityEvent('IP_BLOCKED', {
      ip,
      reason,
      duration: durationMs,
      expiresAt: new Date(expiresAt).toISOString()
    });
  }

  /**
   * Check connection limits for new WebSocket connections
   */
  checkConnectionLimits(ip) {
    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      return {
        allowed: false,
        reason: 'IP_BLOCKED',
        details: this.blockedIPs.get(ip)
      };
    }

    // Check concurrent connections per IP
    const currentConnections = this.ipConnections.get(ip) || 0;
    if (currentConnections >= CONNECTION_LIMITS.maxConcurrentPerIP) {
      securityLogger.logSecurityEvent('CONNECTION_LIMIT_EXCEEDED', {
        ip,
        currentConnections,
        limit: CONNECTION_LIMITS.maxConcurrentPerIP
      });
      
      return {
        allowed: false,
        reason: 'TOO_MANY_CONNECTIONS',
        current: currentConnections,
        limit: CONNECTION_LIMITS.maxConcurrentPerIP
      };
    }

    // Check new connection rate
    const now = Date.now();
    const history = this.ipConnectionHistory.get(ip) || [];
    const recentConnections = history.filter(
      timestamp => now - timestamp < 60 * 1000
    );

    if (recentConnections.length >= CONNECTION_LIMITS.maxNewConnectionsPerMinute) {
      securityLogger.logSecurityEvent('CONNECTION_RATE_EXCEEDED', {
        ip,
        connectionsInLastMinute: recentConnections.length,
        limit: CONNECTION_LIMITS.maxNewConnectionsPerMinute
      });
      
      // Temporary block for connection spam
      this.blockIP(ip, 'CONNECTION_RATE_LIMIT', 2 * 60 * 1000); // 2 minutes
      
      return {
        allowed: false,
        reason: 'CONNECTION_RATE_LIMIT',
        rate: recentConnections.length,
        limit: CONNECTION_LIMITS.maxNewConnectionsPerMinute
      };
    }

    return { allowed: true };
  }

  /**
   * Register a new connection
   */
  registerConnection(connectionId, ip) {
    // Increment IP connection count
    const currentCount = this.ipConnections.get(ip) || 0;
    this.ipConnections.set(ip, currentCount + 1);

    // Add to connection history
    const history = this.ipConnectionHistory.get(ip) || [];
    history.push(Date.now());
    this.ipConnectionHistory.set(ip, history);

    // Initialize connection tracking
    this.connectionLimits.set(connectionId, {
      ip,
      messageCounters: {},
      lastActivity: Date.now(),
      totalMessages: 0,
      bandwidthUsed: 0,
      invalidMessageCount: 0
    });

    securityLogger.logSecurityEvent('CONNECTION_REGISTERED', {
      connectionId,
      ip,
      totalConnectionsForIP: currentCount + 1
    });
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(connectionId) {
    const connectionInfo = this.connectionLimits.get(connectionId);
    if (!connectionInfo) return;

    const { ip } = connectionInfo;
    
    // Decrement IP connection count
    const currentCount = this.ipConnections.get(ip) || 0;
    if (currentCount <= 1) {
      this.ipConnections.delete(ip);
    } else {
      this.ipConnections.set(ip, currentCount - 1);
    }

    // Remove connection tracking
    this.connectionLimits.delete(connectionId);

    securityLogger.logSecurityEvent('CONNECTION_UNREGISTERED', {
      connectionId,
      ip,
      remainingConnectionsForIP: Math.max(0, currentCount - 1)
    });
  }

  /**
   * Check message rate limits
   */
  checkMessageLimit(connectionId, messageType, messageSize = 0) {
    const connectionInfo = this.connectionLimits.get(connectionId);
    if (!connectionInfo) {
      return { allowed: false, reason: 'CONNECTION_NOT_FOUND' };
    }

    const { ip } = connectionInfo;

    // Check if IP is blocked
    if (this.isIPBlocked(ip)) {
      return { 
        allowed: false, 
        reason: 'IP_BLOCKED',
        details: this.blockedIPs.get(ip)
      };
    }

    // Check message size limit
    if (messageSize > CONNECTION_LIMITS.maxMessageSizeMB * 1024 * 1024) {
      securityLogger.logSecurityEvent('MESSAGE_SIZE_EXCEEDED', {
        connectionId,
        ip,
        messageType,
        size: messageSize,
        limit: CONNECTION_LIMITS.maxMessageSizeMB * 1024 * 1024
      });
      
      return {
        allowed: false,
        reason: 'MESSAGE_TOO_LARGE',
        size: messageSize,
        limit: CONNECTION_LIMITS.maxMessageSizeMB * 1024 * 1024
      };
    }

    // Update activity and bandwidth tracking
    connectionInfo.lastActivity = Date.now();
    connectionInfo.totalMessages++;
    connectionInfo.bandwidthUsed += messageSize;

    // Determine rate limit category
    let limitConfig = null;
    for (const [category, config] of Object.entries(RATE_LIMITS)) {
      if (config.messageTypes.includes(messageType)) {
        limitConfig = config;
        break;
      }
    }

    // If no specific limit found, treat as control message
    if (!limitConfig) {
      limitConfig = RATE_LIMITS.CONTROL_MESSAGES;
    }

    // Skip rate limiting for streaming data
    if (limitConfig === RATE_LIMITS.STREAMING_DATA) {
      return { allowed: true, category: 'STREAMING' };
    }

    // Check rate limit for this message type category
    const now = Date.now();
    const counterKey = limitConfig === RATE_LIMITS.COMMAND_INITIATION ? 'command' : 'control';
    
    if (!connectionInfo.messageCounters[counterKey]) {
      connectionInfo.messageCounters[counterKey] = [];
    }

    const counter = connectionInfo.messageCounters[counterKey];
    
    // Remove old entries outside the window
    const validEntries = counter.filter(
      timestamp => now - timestamp < limitConfig.windowMs
    );
    connectionInfo.messageCounters[counterKey] = validEntries;

    // Check if limit exceeded
    if (validEntries.length >= limitConfig.maxRequests) {
      securityLogger.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        connectionId,
        ip,
        messageType,
        category: counterKey,
        count: validEntries.length,
        limit: limitConfig.maxRequests,
        windowMs: limitConfig.windowMs
      });

      // Check for abuse patterns
      this.checkAbuse(connectionId, ip, messageType);

      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        category: counterKey,
        count: validEntries.length,
        limit: limitConfig.maxRequests,
        resetTime: Math.min(...validEntries) + limitConfig.windowMs
      };
    }

    // Add current request to counter
    validEntries.push(now);
    connectionInfo.messageCounters[counterKey] = validEntries;

    return { 
      allowed: true, 
      category: counterKey,
      count: validEntries.length,
      limit: limitConfig.maxRequests
    };
  }

  /**
   * Handle invalid message (for abuse detection)
   */
  handleInvalidMessage(connectionId, error) {
    const connectionInfo = this.connectionLimits.get(connectionId);
    if (!connectionInfo) return;

    connectionInfo.invalidMessageCount++;
    
    if (connectionInfo.invalidMessageCount >= ABUSE_DETECTION.invalidMessages.maxInvalid) {
      securityLogger.logSecurityEvent('INVALID_MESSAGE_ABUSE', {
        connectionId,
        ip: connectionInfo.ip,
        invalidCount: connectionInfo.invalidMessageCount,
        error: error.message
      });
      
      // Block IP for invalid message spam
      this.blockIP(connectionInfo.ip, 'INVALID_MESSAGE_SPAM', 10 * 60 * 1000); // 10 minutes
      
      return { shouldDisconnect: true, reason: 'INVALID_MESSAGE_ABUSE' };
    }

    return { shouldDisconnect: false };
  }

  /**
   * Check for abuse patterns
   */
  checkAbuse(connectionId, ip, messageType) {
    // Command spam detection
    if (RATE_LIMITS.COMMAND_INITIATION.messageTypes.includes(messageType)) {
      const abuseKey = `command_spam_${ip}`;
      const now = Date.now();
      
      if (!this.abuseTracking.has(abuseKey)) {
        this.abuseTracking.set(abuseKey, []);
      }
      
      const timestamps = this.abuseTracking.get(abuseKey);
      timestamps.push(now);
      
      // Remove old entries
      const validTimestamps = timestamps.filter(
        t => now - t < ABUSE_DETECTION.commandSpam.windowMs
      );
      this.abuseTracking.set(abuseKey, validTimestamps);
      
      if (validTimestamps.length >= ABUSE_DETECTION.commandSpam.maxCommands) {
        securityLogger.logSecurityEvent('COMMAND_SPAM_DETECTED', {
          connectionId,
          ip,
          commandCount: validTimestamps.length,
          timeWindow: ABUSE_DETECTION.commandSpam.windowMs
        });
        
        // Temporary block for command spam
        this.blockIP(ip, 'COMMAND_SPAM', 5 * 60 * 1000); // 5 minutes
      }
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {
      totalConnections: this.connectionLimits.size,
      connectionsByIP: {},
      blockedIPs: Array.from(this.blockedIPs.entries()).map(([ip, info]) => ({
        ip,
        ...info,
        expiresAt: new Date(info.expiresAt).toISOString()
      })),
      totalBlockedIPs: this.blockedIPs.size
    };

    // Count connections by IP
    for (const [connectionId, info] of this.connectionLimits.entries()) {
      const { ip } = info;
      if (!stats.connectionsByIP[ip]) {
        stats.connectionsByIP[ip] = {
          count: 0,
          totalMessages: 0,
          bandwidthUsed: 0
        };
      }
      stats.connectionsByIP[ip].count++;
      stats.connectionsByIP[ip].totalMessages += info.totalMessages;
      stats.connectionsByIP[ip].bandwidthUsed += info.bandwidthUsed;
    }

    return stats;
  }

  /**
   * Cleanup expired entries
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up blocked IPs
      for (const [ip, blockInfo] of this.blockedIPs.entries()) {
        if (now > blockInfo.expiresAt) {
          this.blockedIPs.delete(ip);
        }
      }
      
      // Clean up old connection history
      for (const [ip, history] of this.ipConnectionHistory.entries()) {
        const recentHistory = history.filter(
          timestamp => now - timestamp < 60 * 60 * 1000 // Keep 1 hour
        );
        if (recentHistory.length === 0) {
          this.ipConnectionHistory.delete(ip);
        } else {
          this.ipConnectionHistory.set(ip, recentHistory);
        }
      }
      
      // Clean up idle connections tracking
      for (const [connectionId, info] of this.connectionLimits.entries()) {
        if (now - info.lastActivity > CONNECTION_LIMITS.idleTimeoutMs) {
          securityLogger.logSecurityEvent('CONNECTION_IDLE_TIMEOUT', {
            connectionId,
            ip: info.ip,
            lastActivity: new Date(info.lastActivity).toISOString()
          });
          
          // Note: We don't remove here as the WebSocket should handle the cleanup
          // This is just for logging idle connections
        }
      }
      
      // Clean up abuse tracking
      for (const [key, timestamps] of this.abuseTracking.entries()) {
        const validTimestamps = timestamps.filter(
          t => now - t < 10 * 60 * 1000 // Keep 10 minutes
        );
        if (validTimestamps.length === 0) {
          this.abuseTracking.delete(key);
        } else {
          this.abuseTracking.set(key, validTimestamps);
        }
      }
      
    }, 60 * 1000); // Run every minute
  }
}

// Create singleton instance
export const smartRateLimit = new SmartRateLimit();

// Export rate limit checker functions
export function checkConnectionLimit(ip) {
  return smartRateLimit.checkConnectionLimits(ip);
}

export function registerConnection(connectionId, ip) {
  return smartRateLimit.registerConnection(connectionId, ip);
}

export function unregisterConnection(connectionId) {
  return smartRateLimit.unregisterConnection(connectionId);
}

export function checkMessageLimit(connectionId, messageType, messageSize = 0) {
  return smartRateLimit.checkMessageLimit(connectionId, messageType, messageSize);
}

export function handleInvalidMessage(connectionId, error) {
  return smartRateLimit.handleInvalidMessage(connectionId, error);
}

export function getConnectionStats() {
  return smartRateLimit.getConnectionStats();
}

export function isIPBlocked(ip) {
  return smartRateLimit.isIPBlocked(ip);
}

export function blockIP(ip, reason, duration) {
  return smartRateLimit.blockIP(ip, reason, duration);
}