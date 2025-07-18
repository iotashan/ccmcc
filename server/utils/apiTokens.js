import crypto from 'crypto';
import { apiTokensDb } from '../database/db.js';

// Token cache for performance
const tokenCache = new Map();

// Generate a secure API token
export const generateApiToken = () => {
  // Generate 32 bytes (256 bits) of random data
  const randomBytes = crypto.randomBytes(32);
  // Convert to base64url for safe URL usage
  return randomBytes.toString('base64url');
};

// Hash a token using SHA-256
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Validate an API token
export const validateApiToken = async (token) => {
  if (!token) return null;

  const tokenHash = hashToken(token);
  
  // Check cache first
  if (tokenCache.has(tokenHash)) {
    const cachedToken = tokenCache.get(tokenHash);
    // Update last used timestamp asynchronously
    apiTokensDb.updateLastUsed(tokenHash);
    return cachedToken;
  }

  // Get from database
  const tokenData = apiTokensDb.getTokenByHash(tokenHash);
  if (!tokenData) return null;

  // Cache the token data
  tokenCache.set(tokenHash, tokenData);
  
  // Update last used timestamp
  apiTokensDb.updateLastUsed(tokenHash);
  
  return tokenData;
};

// Create a new API token
export const createApiToken = async (userId, name, expiresAt = null) => {
  const rawToken = generateApiToken();
  const tokenHash = hashToken(rawToken);
  
  // Store hashed token in database
  const tokenData = apiTokensDb.createToken(userId, tokenHash, name, expiresAt);
  
  // Cache the token
  tokenCache.set(tokenHash, {
    ...tokenData,
    user_id: userId,
    token_hash: tokenHash
  });
  
  return {
    id: tokenData.id,
    name,
    rawToken, // Only returned once, never stored
    expiresAt
  };
};

// Revoke an API token
export const revokeApiToken = async (tokenId, userId) => {
  const result = apiTokensDb.deactivateToken(tokenId, userId);
  
  // Remove from cache - we need to find by token ID
  // This is inefficient but revocation is rare
  for (const [hash, data] of tokenCache.entries()) {
    if (data.id === tokenId) {
      tokenCache.delete(hash);
      break;
    }
  }
  
  return result;
};

// Get all tokens for a user
export const getUserApiTokens = (userId) => {
  return apiTokensDb.getUserTokens(userId);
};

// Clear token cache (useful for testing)
export const clearTokenCache = () => {
  tokenCache.clear();
};

// Load all active tokens into cache on startup
export const loadTokensIntoCache = async () => {
  try {
    // Get all active tokens using the getAllActiveTokens method
    const tokens = apiTokensDb.getAllActiveTokens();
    if (tokens && tokens.length > 0) {
      tokens.forEach(token => {
        tokenCache.set(token.token_hash, token);
      });
      console.log(`✅ Loaded ${tokens.length} API tokens into cache`);
    } else {
      console.log('✅ No API tokens to load into cache');
    }
  } catch (error) {
    console.error('Error loading tokens into cache:', error);
  }
};