import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Security event types
export const SecurityEventTypes = {
  // Authentication events
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  TOKEN_VALIDATION_FAILED: 'TOKEN_VALIDATION_FAILED',
  
  // Connection events
  CONNECTION_REGISTERED: 'CONNECTION_REGISTERED',
  CONNECTION_UNREGISTERED: 'CONNECTION_UNREGISTERED',
  CONNECTION_LIMIT_EXCEEDED: 'CONNECTION_LIMIT_EXCEEDED',
  CONNECTION_RATE_EXCEEDED: 'CONNECTION_RATE_EXCEEDED',
  CONNECTION_IDLE_TIMEOUT: 'CONNECTION_IDLE_TIMEOUT',
  
  // Rate limiting events
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MESSAGE_SIZE_EXCEEDED: 'MESSAGE_SIZE_EXCEEDED',
  
  // Abuse detection events
  IP_BLOCKED: 'IP_BLOCKED',
  IP_UNBLOCKED: 'IP_UNBLOCKED',
  COMMAND_SPAM_DETECTED: 'COMMAND_SPAM_DETECTED',
  INVALID_MESSAGE_ABUSE: 'INVALID_MESSAGE_ABUSE',
  CONNECTION_CYCLING_ABUSE: 'CONNECTION_CYCLING_ABUSE',
  
  // WebSocket events
  WEBSOCKET_AUTH_FAILED: 'WEBSOCKET_AUTH_FAILED',
  WEBSOCKET_PROTOCOL_ERROR: 'WEBSOCKET_PROTOCOL_ERROR',
  WEBSOCKET_MESSAGE_ERROR: 'WEBSOCKET_MESSAGE_ERROR',
  
  // General security events
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION'
};

// Log levels
export const LogLevels = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

class SecurityLogger {
  constructor() {
    this.logDirectory = path.join(__dirname, '../../logs');
    this.securityLogFile = path.join(this.logDirectory, 'security.log');
    this.alertLogFile = path.join(this.logDirectory, 'security-alerts.log');
    
    // Ensure logs directory exists
    this.ensureLogDirectory();
    
    // In-memory buffer for recent events (for monitoring dashboard)
    this.recentEvents = [];
    this.maxRecentEvents = 1000;
    
    // Alert thresholds
    this.alertThresholds = {
      [SecurityEventTypes.AUTH_FAILURE]: { count: 5, windowMs: 5 * 60 * 1000 }, // 5 failures in 5 minutes
      [SecurityEventTypes.RATE_LIMIT_EXCEEDED]: { count: 10, windowMs: 10 * 60 * 1000 }, // 10 rate limits in 10 minutes
      [SecurityEventTypes.IP_BLOCKED]: { count: 1, windowMs: 0 }, // Any IP block is critical
      [SecurityEventTypes.COMMAND_SPAM_DETECTED]: { count: 1, windowMs: 0 } // Any command spam is critical
    };
    
    // Alert tracking
    this.alertCounts = new Map();
    
    // Start cleanup interval
    this.startCleanup();
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Log a security event
   */
  logSecurityEvent(eventType, details = {}, level = LogLevels.INFO) {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId();
    
    const logEntry = {
      eventId,
      timestamp,
      eventType,
      level,
      details,
      environment: process.env.NODE_ENV || 'development'
    };

    // Add to recent events buffer
    this.recentEvents.unshift(logEntry);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.pop();
    }

    // Write to security log file
    this.writeToLogFile(this.securityLogFile, logEntry);

    // Check if this should trigger an alert
    if (this.shouldAlert(eventType, logEntry)) {
      this.handleAlert(logEntry);
    }

    // Console output based on environment and level
    this.outputToConsole(logEntry);
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Write log entry to file
   */
  writeToLogFile(filePath, logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(filePath, logLine);
    } catch (error) {
      console.error('Failed to write to security log:', error);
    }
  }

  /**
   * Output to console based on environment and log level
   */
  outputToConsole(logEntry) {
    const { eventType, level, details, timestamp } = logEntry;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Only output WARN and above in production, everything in development
    if (!isDevelopment && level === LogLevels.INFO) {
      return;
    }

    const message = `[${timestamp}] SECURITY ${level}: ${eventType}`;
    
    switch (level) {
      case LogLevels.CRITICAL:
        console.error('🚨', message, details);
        break;
      case LogLevels.ERROR:
        console.error('❌', message, details);
        break;
      case LogLevels.WARN:
        console.warn('⚠️', message, details);
        break;
      case LogLevels.INFO:
        if (isDevelopment) {
          console.log('ℹ️', message, details);
        }
        break;
    }
  }

  /**
   * Check if event should trigger an alert
   */
  shouldAlert(eventType, logEntry) {
    const threshold = this.alertThresholds[eventType];
    if (!threshold) return false;

    // For immediate alerts (windowMs = 0)
    if (threshold.windowMs === 0) {
      return true;
    }

    // For count-based alerts
    const now = Date.now();
    const alertKey = `${eventType}_${logEntry.details.ip || 'global'}`;
    
    if (!this.alertCounts.has(alertKey)) {
      this.alertCounts.set(alertKey, []);
    }
    
    const counts = this.alertCounts.get(alertKey);
    counts.push(now);
    
    // Remove old entries
    const validCounts = counts.filter(timestamp => now - timestamp < threshold.windowMs);
    this.alertCounts.set(alertKey, validCounts);
    
    return validCounts.length >= threshold.count;
  }

  /**
   * Handle security alert
   */
  handleAlert(logEntry) {
    const alertEntry = {
      ...logEntry,
      alertGenerated: true,
      alertTimestamp: new Date().toISOString()
    };

    // Write to alerts log
    this.writeToLogFile(this.alertLogFile, alertEntry);

    // Always output alerts to console
    console.error('🚨 SECURITY ALERT:', logEntry.eventType, logEntry.details);

    // TODO: Add webhook notifications, email alerts, etc. here
    // For now, just log to console and file
  }

  /**
   * Get recent security events (for monitoring dashboard)
   */
  getRecentEvents(limit = 100, eventType = null, level = null) {
    let events = this.recentEvents;
    
    if (eventType) {
      events = events.filter(event => event.eventType === eventType);
    }
    
    if (level) {
      events = events.filter(event => event.level === level);
    }
    
    return events.slice(0, limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(timeWindowMs = 60 * 60 * 1000) { // Default: last hour
    const now = Date.now();
    const cutoff = now - timeWindowMs;
    
    const recentEvents = this.recentEvents.filter(
      event => new Date(event.timestamp).getTime() > cutoff
    );

    const stats = {
      totalEvents: recentEvents.length,
      eventsByType: {},
      eventsByLevel: {},
      topIPs: {},
      alertCount: 0,
      timeWindow: {
        start: new Date(cutoff).toISOString(),
        end: new Date(now).toISOString()
      }
    };

    recentEvents.forEach(event => {
      // Count by type
      stats.eventsByType[event.eventType] = (stats.eventsByType[event.eventType] || 0) + 1;
      
      // Count by level
      stats.eventsByLevel[event.level] = (stats.eventsByLevel[event.level] || 0) + 1;
      
      // Count by IP
      const ip = event.details.ip;
      if (ip) {
        stats.topIPs[ip] = (stats.topIPs[ip] || 0) + 1;
      }
      
      // Count alerts
      if (event.alertGenerated) {
        stats.alertCount++;
      }
    });

    // Sort top IPs
    stats.topIPs = Object.entries(stats.topIPs)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [ip, count]) => {
        obj[ip] = count;
        return obj;
      }, {});

    return stats;
  }

  /**
   * Search security logs
   */
  searchLogs(criteria = {}) {
    const { eventType, level, ip, startTime, endTime, limit = 100 } = criteria;
    
    let results = this.recentEvents;
    
    if (eventType) {
      results = results.filter(event => event.eventType === eventType);
    }
    
    if (level) {
      results = results.filter(event => event.level === level);
    }
    
    if (ip) {
      results = results.filter(event => event.details.ip === ip);
    }
    
    if (startTime) {
      const start = new Date(startTime).getTime();
      results = results.filter(event => new Date(event.timestamp).getTime() >= start);
    }
    
    if (endTime) {
      const end = new Date(endTime).getTime();
      results = results.filter(event => new Date(event.timestamp).getTime() <= end);
    }
    
    return results.slice(0, limit);
  }

  /**
   * Cleanup old data
   */
  startCleanup() {
    setInterval(() => {
      // Clean up old alert counts
      const now = Date.now();
      for (const [key, timestamps] of this.alertCounts.entries()) {
        const validTimestamps = timestamps.filter(
          timestamp => now - timestamp < 60 * 60 * 1000 // Keep 1 hour
        );
        if (validTimestamps.length === 0) {
          this.alertCounts.delete(key);
        } else {
          this.alertCounts.set(key, validTimestamps);
        }
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Log authentication events
   */
  logAuthSuccess(details) {
    this.logSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, details, LogLevels.INFO);
  }

  logAuthFailure(details) {
    this.logSecurityEvent(SecurityEventTypes.AUTH_FAILURE, details, LogLevels.WARN);
  }

  logWebSocketAuthFailed(details) {
    this.logSecurityEvent(SecurityEventTypes.WEBSOCKET_AUTH_FAILED, details, LogLevels.WARN);
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(details) {
    this.logSecurityEvent(SecurityEventTypes.RATE_LIMIT_EXCEEDED, details, LogLevels.WARN);
  }

  /**
   * Log security violations
   */
  logSecurityViolation(details) {
    this.logSecurityEvent(SecurityEventTypes.SECURITY_VIOLATION, details, LogLevels.ERROR);
  }

  logSuspiciousActivity(details) {
    this.logSecurityEvent(SecurityEventTypes.SUSPICIOUS_ACTIVITY, details, LogLevels.WARN);
  }
}

// Create singleton instance
export const securityLogger = new SecurityLogger();

// Export convenience functions
export function logSecurityEvent(eventType, details, level) {
  return securityLogger.logSecurityEvent(eventType, details, level);
}

export function getSecurityStats(timeWindow) {
  return securityLogger.getSecurityStats(timeWindow);
}

export function getRecentEvents(limit, eventType, level) {
  return securityLogger.getRecentEvents(limit, eventType, level);
}

export function searchSecurityLogs(criteria) {
  return securityLogger.searchLogs(criteria);
}