import jwt from 'jsonwebtoken';
import { userDb } from '../database/db.js';
import { validateApiToken } from '../utils/apiTokens.js';
import { securityLogger, SecurityEventTypes, LogLevels } from '../utils/securityLogger.js';
import { getJWTSecret, getAPIKey } from '../../shared/utils/config.js';

// Get JWT secret using shared configuration utility
const JWT_SECRET = getJWTSecret();

// Optional API key middleware
const validateApiKey = (req, res, next) => {
  const configuredAPIKey = getAPIKey();
  
  // Skip API key validation if not configured
  if (!configuredAPIKey) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== configuredAPIKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Dual authentication middleware - supports both JWT and API tokens
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

  if (!token) {
    securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_FAILURE, {
      ip: clientIP,
      reason: 'No token provided',
      userAgent: req.headers['user-agent'],
      path: req.path
    }, LogLevels.WARN);
    
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // First, try to validate as API token
    const apiTokenData = await validateApiToken(token);
    if (apiTokenData) {
      // API token validation successful
      req.user = {
        id: apiTokenData.userId,
        username: apiTokenData.username
      };
      req.authType = 'api_token';
      
      securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, {
        ip: clientIP,
        userId: apiTokenData.userId,
        username: apiTokenData.username,
        authType: 'api_token',
        path: req.path
      }, LogLevels.INFO);
      
      return next();
    }

    // If API token validation fails, try JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_FAILURE, {
        ip: clientIP,
        reason: 'User not found',
        userId: decoded.userId,
        authType: 'jwt',
        path: req.path
      }, LogLevels.WARN);
      
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    req.user = user;
    req.authType = 'jwt';
    
    securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, {
      ip: clientIP,
      userId: user.id,
      username: user.username,
      authType: 'jwt',
      path: req.path
    }, LogLevels.INFO);
    
    next();
  } catch (error) {
    const isExpiredToken = error.name === 'TokenExpiredError';
    const isInvalidToken = error.name === 'JsonWebTokenError';
    
    securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_FAILURE, {
      ip: clientIP,
      reason: error.message,
      errorType: error.name,
      isExpiredToken,
      isInvalidToken,
      authType: 'jwt',
      path: req.path
    }, LogLevels.WARN);
    
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Generate JWT token (never expires)
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username 
    },
    JWT_SECRET
    // No expiration - token lasts forever
  );
};

// WebSocket authentication function - supports both JWT and API tokens
const authenticateWebSocket = async (token, clientIP = null) => {
  if (!token) {
    if (clientIP) {
      securityLogger.logSecurityEvent(SecurityEventTypes.WEBSOCKET_AUTH_FAILED, {
        ip: clientIP,
        reason: 'No token provided'
      }, LogLevels.WARN);
    }
    return null;
  }
  
  try {
    // First, try to validate as API token
    const apiTokenData = await validateApiToken(token);
    if (apiTokenData) {
      if (clientIP) {
        securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, {
          ip: clientIP,
          userId: apiTokenData.userId,
          username: apiTokenData.username,
          authType: 'api_token',
          connectionType: 'websocket'
        }, LogLevels.INFO);
      }
      
      return {
        id: apiTokenData.userId,
        userId: apiTokenData.userId,
        username: apiTokenData.username,
        authType: 'api_token',
        apiToken: token  // Include the actual token for encryption key derivation
      };
    }

    // If API token validation fails, try JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      if (clientIP) {
        securityLogger.logSecurityEvent(SecurityEventTypes.WEBSOCKET_AUTH_FAILED, {
          ip: clientIP,
          reason: 'User not found',
          userId: decoded.userId,
          authType: 'jwt'
        }, LogLevels.WARN);
      }
      return null;
    }
    
    if (clientIP) {
      securityLogger.logSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, {
        ip: clientIP,
        userId: user.id,
        username: user.username,
        authType: 'jwt',
        connectionType: 'websocket'
      }, LogLevels.INFO);
    }
    
    return {
      ...user,
      authType: 'jwt'
    };
  } catch (error) {
    if (clientIP) {
      securityLogger.logSecurityEvent(SecurityEventTypes.WEBSOCKET_AUTH_FAILED, {
        ip: clientIP,
        reason: error.message,
        errorType: error.name,
        authType: 'jwt'
      }, LogLevels.WARN);
    }
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket,
  JWT_SECRET
};