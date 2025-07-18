import jwt from 'jsonwebtoken';
import { userDb } from '../database/db.js';
import { validateApiToken } from '../utils/apiTokens.js';

// Get JWT secret from environment or use default (for development)
const JWT_SECRET = process.env.JWT_SECRET || 'claude-ui-dev-secret-change-in-production';

// Optional API key middleware
const validateApiKey = (req, res, next) => {
  // Skip API key validation if not configured
  if (!process.env.API_KEY) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Dual authentication middleware - supports both JWT and API tokens
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN


  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // First, try to validate as API token
    const apiTokenData = await validateApiToken(token);
    if (apiTokenData) {
      // API token validation successful
      req.user = {
        id: apiTokenData.user_id,
        username: apiTokenData.username
      };
      req.authType = 'api_token';
      return next();
    }

    // If API token validation fails, try JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('DEBUG: JWT verification successful, decoded:', decoded);
    
    // Verify user still exists and is active
    const user = userDb.getUserById(decoded.userId);
    console.log('DEBUG: User lookup result:', user ? 'Found' : 'Not found');
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    req.user = user;
    req.authType = 'jwt';
    console.log('DEBUG: HTTP JWT authentication successful for user:', user.username);
    next();
  } catch (error) {
    console.error('Token verification error:', error);
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
const authenticateWebSocket = async (token) => {
  if (!token) {
    return null;
  }
  
  try {
    // First, try to validate as API token
    const apiTokenData = await validateApiToken(token);
    if (apiTokenData) {
      return {
        userId: apiTokenData.user_id,
        username: apiTokenData.username,
        authType: 'api_token'
      };
    }

    // If API token validation fails, try JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      ...decoded,
      authType: 'jwt'
    };
  } catch (error) {
    console.error('WebSocket token verification error:', error);
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