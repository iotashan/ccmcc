// Client-side encryption utilities
// Mirrors the server-side encryption but for browser environment

// AES-256-GCM encryption configuration
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits

/**
 * Derives a key from the base64 encryption key using PBKDF2
 * @param {string} base64Key - Base64 encoded encryption key
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>} - Derived key
 */
async function deriveKey(base64Key, salt) {
  // Convert base64 to array buffer
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  
  // Import the raw key
  const rawKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-256-GCM
 * @param {string|object} data - Data to encrypt (will be JSON stringified if object)
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Promise<string>} - Base64 encoded encrypted data
 */
export async function encrypt(data, encryptionKey) {
  if (!encryptionKey) {
    throw new Error('Encryption key is required');
  }

  try {
    // Convert data to string if it's an object
    const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);
    
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    // Derive key from the encryption key
    const key = await deriveKey(encryptionKey, salt);
    
    // Encrypt data
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: TAG_LENGTH * 8 // in bits
      },
      key,
      plaintextBuffer
    );
    
    // The last 16 bytes are the auth tag
    const encrypted = new Uint8Array(encryptedData);
    
    // Combine salt, iv, and encrypted data (which includes tag)
    const combined = new Uint8Array(salt.length + iv.length + encrypted.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encrypted, salt.length + iv.length);
    
    // Return base64 encoded result
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Promise<string|object>} - Decrypted data (parsed as JSON if possible)
 */
export async function decrypt(encryptedData, encryptionKey) {
  if (!encryptionKey) {
    throw new Error('Encryption key is required');
  }

  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);
    
    // Derive key from the encryption key
    const key = await deriveKey(encryptionKey, salt);
    
    // Decrypt data (includes auth tag verification)
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: TAG_LENGTH * 8
      },
      key,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    const decrypted = decoder.decode(decryptedBuffer);
    
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
 * Encrypts data for HTTP request body
 * @param {object} data - Request body data
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Promise<object>} - Encrypted request body
 */
export async function encryptRequestBody(data, encryptionKey) {
  if (!encryptionKey) {
    return data;
  }
  
  try {
    const encrypted = await encrypt(data, encryptionKey);
    return { encrypted };
  } catch (error) {
    console.error('Request encryption failed:', error);
    // Fall back to unencrypted
    return data;
  }
}

/**
 * Decrypts response body
 * @param {object} response - Response body
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Promise<object>} - Decrypted response data
 */
export async function decryptResponseBody(response, encryptionKey) {
  if (!encryptionKey || !response.encrypted) {
    return response;
  }
  
  try {
    return await decrypt(response.encrypted, encryptionKey);
  } catch (error) {
    console.error('Response decryption failed:', error);
    throw new Error('Failed to decrypt response');
  }
}

/**
 * Checks if encryption is supported by the browser
 * @returns {boolean} - True if encryption is supported
 */
export function isEncryptionSupported() {
  return !!(window.crypto && window.crypto.subtle);
}

/**
 * WebSocket message encryption
 * @param {object} message - Message to encrypt
 * @param {string} encryptionKey - Base64 encoded encryption key
 * @returns {Promise<string>} - Encrypted message as JSON string
 */
export async function encryptWebSocketMessage(message, encryptionKey) {
  if (!encryptionKey) {
    return JSON.stringify(message);
  }

  try {
    const encrypted = await encrypt(message, encryptionKey);
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
 * @returns {Promise<object>} - Decrypted message
 */
export async function decryptWebSocketMessage(data, encryptionKey) {
  if (!encryptionKey) {
    return JSON.parse(data);
  }

  try {
    const parsed = JSON.parse(data);
    
    if (parsed.isEncrypted && parsed.encrypted) {
      return await decrypt(parsed.encrypted, encryptionKey);
    }
    
    return parsed;
  } catch (error) {
    console.error('WebSocket decryption failed:', error);
    throw new Error('Failed to decrypt WebSocket message');
  }
}