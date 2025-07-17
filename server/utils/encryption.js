import crypto from 'crypto';

// AES-256-GCM encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derives a key from the base64 encryption key using PBKDF2
 * @param {string} base64Key - Base64 encoded encryption key
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} - Derived key
 */
function deriveKey(base64Key, salt) {
  const keyBuffer = Buffer.from(base64Key, 'base64');
  return crypto.pbkdf2Sync(keyBuffer, salt, 10000, 32, 'sha256');
}

/**
 * Encrypts data using AES-256-GCM
 * @param {string|object} data - Data to encrypt (will be JSON stringified if object)
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {string} - Base64 encoded encrypted data with format: salt:iv:tag:encrypted
 */
export function encrypt(data, encryptionKey) {
  if (!encryptionKey) {
    throw new Error('Encryption key is required');
  }

  try {
    // Convert data to string if it's an object
    const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Derive key from the encryption key
    const key = deriveKey(encryptionKey, salt);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    // Return base64 encoded result
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {string|object} - Decrypted data (parsed as JSON if possible)
 */
export function decrypt(encryptedData, encryptionKey) {
  if (!encryptionKey) {
    throw new Error('Encryption key is required');
  }

  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    // Derive key from the encryption key
    const key = deriveKey(encryptionKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
    
    // Try to parse as JSON, otherwise return as string
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Middleware to encrypt response bodies
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Function} Express middleware
 */
export function encryptionMiddleware(encryptionKey) {
  return (req, res, next) => {
    // Skip if no encryption key
    if (!encryptionKey) {
      return next();
    }

    // Check if client supports encryption (via header)
    const clientVersion = req.headers['x-client-version'];
    const supportsEncryption = req.headers['x-encryption-support'] === 'true';
    
    if (!supportsEncryption) {
      return next();
    }

    // Store original json method
    const originalJson = res.json;

    // Override json method to encrypt response
    res.json = function(data) {
      try {
        // Encrypt the response data
        const encrypted = encrypt(data, encryptionKey);
        
        // Set encryption header
        res.setHeader('X-Encrypted', 'true');
        
        // Send encrypted response
        return originalJson.call(this, { encrypted });
      } catch (error) {
        console.error('Response encryption failed:', error);
        // Fall back to unencrypted response
        return originalJson.call(this, data);
      }
    };

    next();
  };
}

/**
 * Middleware to decrypt request bodies
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Function} Express middleware
 */
export function decryptionMiddleware(encryptionKey) {
  return (req, res, next) => {
    // Skip if no encryption key
    if (!encryptionKey) {
      return next();
    }

    // Check if request is encrypted
    if (req.headers['x-encrypted'] !== 'true' || !req.body?.encrypted) {
      return next();
    }

    try {
      // Decrypt the request body
      req.body = decrypt(req.body.encrypted, encryptionKey);
      next();
    } catch (error) {
      console.error('Request decryption failed:', error);
      res.status(400).json({ error: 'Failed to decrypt request' });
    }
  };
}

/**
 * WebSocket message encryption
 * @param {object} message - Message to encrypt
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {string} - Encrypted message as JSON string
 */
export function encryptWebSocketMessage(message, encryptionKey) {
  if (!encryptionKey) {
    return JSON.stringify(message);
  }

  try {
    const encrypted = encrypt(message, encryptionKey);
    return JSON.stringify({ encrypted, isEncrypted: true });
  } catch (error) {
    console.error('WebSocket encryption failed:', error);
    return JSON.stringify(message);
  }
}

/**
 * WebSocket message decryption
 * @param {string} data - Received message data
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {object} - Decrypted message
 */
export function decryptWebSocketMessage(data, encryptionKey) {
  if (!encryptionKey) {
    return JSON.parse(data);
  }

  try {
    const parsed = JSON.parse(data);
    
    if (parsed.isEncrypted && parsed.encrypted) {
      return decrypt(parsed.encrypted, encryptionKey);
    }
    
    return parsed;
  } catch (error) {
    console.error('WebSocket decryption failed:', error);
    throw new Error('Failed to decrypt WebSocket message');
  }
}