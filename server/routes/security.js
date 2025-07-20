import express from 'express';
import { 
  getSecurityStats, 
  getRecentEvents, 
  searchSecurityLogs 
} from '../utils/securityLogger.js';
import { 
  getMonitorConnectionStats,
  getConnectionDetails,
  forceDisconnect,
  getUserConnections 
} from '../utils/connectionMonitor.js';
import { 
  getConnectionStats as getRateLimitStats,
  blockIP,
  isIPBlocked 
} from '../middleware/smartRateLimit.js';

const router = express.Router();

// Get overall security dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 60 * 60 * 1000; // Default: 1 hour
    
    const dashboard = {
      securityStats: getSecurityStats(timeWindow),
      connectionStats: getMonitorConnectionStats(),
      rateLimitStats: getRateLimitStats(),
      timestamp: new Date().toISOString()
    };
    
    res.json(dashboard);
  } catch (error) {
    console.error('Error getting security dashboard:', error);
    res.status(500).json({ error: 'Failed to get security dashboard' });
  }
});

// Get recent security events
router.get('/events', async (req, res) => {
  try {
    const {
      limit = 100,
      eventType,
      level,
      offset = 0
    } = req.query;
    
    const events = getRecentEvents(
      parseInt(limit),
      eventType,
      level
    ).slice(parseInt(offset));
    
    res.json({
      events,
      total: events.length,
      filters: { eventType, level, limit, offset }
    });
  } catch (error) {
    console.error('Error getting security events:', error);
    res.status(500).json({ error: 'Failed to get security events' });
  }
});

// Search security logs
router.post('/events/search', async (req, res) => {
  try {
    const criteria = req.body;
    const results = searchSecurityLogs(criteria);
    
    res.json({
      results,
      count: results.length,
      criteria
    });
  } catch (error) {
    console.error('Error searching security logs:', error);
    res.status(500).json({ error: 'Failed to search security logs' });
  }
});

// Get real-time connection information
router.get('/connections', async (req, res) => {
  try {
    const {
      type,
      user,
      ip,
      includeInactive = false
    } = req.query;
    
    let stats = getMonitorConnectionStats();
    
    // Filter connections if requested
    if (type || user || ip || includeInactive === 'false') {
      // Apply filters to active connections
      const filtered = {};
      
      for (const [ipAddr, ipData] of Object.entries(stats.activeConnectionsByIP)) {
        if (ip && ipAddr !== ip) continue;
        
        const filteredConnections = ipData.connections.filter(conn => {
          if (type && conn.type !== type) return false;
          if (user && conn.user !== user) return false;
          return true;
        });
        
        if (filteredConnections.length > 0) {
          filtered[ipAddr] = {
            ...ipData,
            connections: filteredConnections,
            count: filteredConnections.length
          };
        }
      }
      
      stats.activeConnectionsByIP = filtered;
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting connections:', error);
    res.status(500).json({ error: 'Failed to get connection data' });
  }
});

// Get detailed connection information
router.get('/connections/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const details = getConnectionDetails(connectionId);
    
    if (!details) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    res.json(details);
  } catch (error) {
    console.error('Error getting connection details:', error);
    res.status(500).json({ error: 'Failed to get connection details' });
  }
});

// Force disconnect a connection (admin action)
router.post('/connections/:connectionId/disconnect', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const { reason = 'Admin disconnect' } = req.body;
    
    const success = forceDisconnect(connectionId, reason);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Connection disconnected successfully',
        connectionId,
        reason
      });
    } else {
      res.status(404).json({ error: 'Connection not found or already disconnected' });
    }
  } catch (error) {
    console.error('Error force disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect connection' });
  }
});

// Get connections for a specific user
router.get('/users/:userId/connections', async (req, res) => {
  try {
    const { userId } = req.params;
    const connections = getUserConnections(parseInt(userId));
    
    res.json({
      userId: parseInt(userId),
      connections,
      count: connections.length
    });
  } catch (error) {
    console.error('Error getting user connections:', error);
    res.status(500).json({ error: 'Failed to get user connections' });
  }
});

// Block an IP address
router.post('/ip-blocks', async (req, res) => {
  try {
    const { 
      ip, 
      reason = 'Admin block', 
      duration = 60 * 60 * 1000 // 1 hour default
    } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    blockIP(ip, reason, duration);
    
    res.json({
      success: true,
      ip,
      reason,
      duration,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      message: 'IP blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking IP:', error);
    res.status(500).json({ error: 'Failed to block IP' });
  }
});

// Check if IP is blocked
router.get('/ip-blocks/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    const isBlocked = isIPBlocked(ip);
    
    res.json({
      ip,
      isBlocked,
      checked: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking IP block status:', error);
    res.status(500).json({ error: 'Failed to check IP block status' });
  }
});

// Get rate limiting statistics
router.get('/rate-limits', async (req, res) => {
  try {
    const stats = getRateLimitStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting rate limit stats:', error);
    res.status(500).json({ error: 'Failed to get rate limit statistics' });
  }
});

// Get security health check
router.get('/health', async (req, res) => {
  try {
    const stats = getMonitorConnectionStats();
    const securityStats = getSecurityStats(10 * 60 * 1000); // Last 10 minutes
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        totalConnections: stats.totalConnections,
        errorRate: stats.health.errorRate,
        connectionSuccessRate: stats.health.connectionSuccessRate,
        blockedIPs: stats.rateLimiting.totalBlockedIPs,
        recentSecurityEvents: securityStats.totalEvents,
        recentAlerts: securityStats.alertCount
      },
      warnings: [],
      alerts: []
    };
    
    // Check for concerning metrics
    if (stats.health.errorRate > 5) {
      health.warnings.push('High error rate detected');
    }
    
    if (stats.health.connectionSuccessRate < 95) {
      health.warnings.push('Low connection success rate');
    }
    
    if (securityStats.alertCount > 0) {
      health.alerts.push(`${securityStats.alertCount} security alerts in last 10 minutes`);
    }
    
    if (stats.rateLimiting.totalBlockedIPs > 10) {
      health.warnings.push('High number of blocked IPs');
    }
    
    // Determine overall status
    if (health.alerts.length > 0) {
      health.status = 'critical';
    } else if (health.warnings.length > 0) {
      health.status = 'warning';
    }
    
    res.json(health);
  } catch (error) {
    console.error('Error getting security health:', error);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to get security health status',
      timestamp: new Date().toISOString()
    });
  }
});

// Export security events (CSV format)
router.get('/events/export', async (req, res) => {
  try {
    const {
      format = 'json',
      startTime,
      endTime,
      eventType,
      level
    } = req.query;
    
    const criteria = { eventType, level, startTime, endTime, limit: 10000 };
    const events = searchSecurityLogs(criteria);
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = ['timestamp', 'eventId', 'eventType', 'level', 'ip', 'user', 'details'];
      const csv = [
        headers.join(','),
        ...events.map(event => [
          event.timestamp,
          event.eventId,
          event.eventType,
          event.level,
          event.details.ip || '',
          event.details.username || '',
          JSON.stringify(event.details).replace(/"/g, '""')
        ].map(field => `"${field}"`).join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="security-events-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      res.json({
        events,
        count: events.length,
        exported: new Date().toISOString(),
        criteria
      });
    }
  } catch (error) {
    console.error('Error exporting security events:', error);
    res.status(500).json({ error: 'Failed to export security events' });
  }
});

// Get system security configuration
router.get('/config', async (req, res) => {
  try {
    const config = {
      rateLimits: {
        commandInitiation: { maxRequests: 10, windowMs: 60000 },
        controlMessages: { maxRequests: 60, windowMs: 60000 },
        streamingData: { maxRequests: 'unlimited' }
      },
      connectionLimits: {
        maxConcurrentPerIP: 10,
        maxNewConnectionsPerMinute: 5,
        maxBandwidthPerMinuteMB: 50,
        idleTimeoutMs: 30 * 60 * 1000,
        maxMessageSizeMB: 10
      },
      abuseDetection: {
        commandSpam: { maxCommands: 5, windowMs: 30000 },
        connectionCycling: { maxCycles: 10, windowMs: 300000 },
        invalidMessages: { maxInvalid: 20, windowMs: 60000 }
      },
      logRetention: {
        recentEventsBuffer: 1000,
        alertThresholds: 'configured'
      }
    };
    
    res.json(config);
  } catch (error) {
    console.error('Error getting security config:', error);
    res.status(500).json({ error: 'Failed to get security configuration' });
  }
});

export default router;