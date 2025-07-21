// Database field mapping utilities
// Converts between snake_case (database) and camelCase (JavaScript)

/**
 * Convert snake_case to camelCase
 * @param {string} str - Snake case string
 * @returns {string} Camel case string
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 * @param {string} str - Camel case string
 * @returns {string} Snake case string
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 * @param {Object} obj - Object with snake_case keys
 * @returns {Object} Object with camelCase keys
 */
export function mapDbRowToJs(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mapDbRowToJs);
  
  const mapped = {};
  for (const [key, value] of Object.entries(obj)) {
    mapped[snakeToCamel(key)] = value;
  }
  return mapped;
}

/**
 * Convert object keys from camelCase to snake_case
 * @param {Object} obj - Object with camelCase keys
 * @returns {Object} Object with snake_case keys
 */
export function mapJsToDbRow(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(mapJsToDbRow);
  
  const mapped = {};
  for (const [key, value] of Object.entries(obj)) {
    mapped[camelToSnake(key)] = value;
  }
  return mapped;
}

// Field mapping for users table
export const userFieldMap = {
  // DB field -> JS field
  id: 'id',
  username: 'username',
  password_hash: 'passwordHash',
  encryption_key: 'encryptionKey',
  created_at: 'createdAt',
  last_login: 'lastLogin',
  is_active: 'isActive'
};

// Field mapping for machines table
export const machineFieldMap = {
  // DB field -> JS field
  id: 'id',
  name: 'name',
  ip_address: 'ipAddress',
  status: 'status',
  last_seen: 'lastSeen',
  first_seen: 'firstSeen',
  capabilities: 'capabilities',
  metadata: 'metadata',
  is_removed: 'isRemoved',
  removed_at: 'removedAt',
  auth_token: 'authToken',
  user_id: 'userId'
};

// Field mapping for api_tokens table
export const apiTokenFieldMap = {
  // DB field -> JS field
  id: 'id',
  user_id: 'userId',
  token_hash: 'tokenHash',
  name: 'name',
  created_at: 'createdAt',
  last_used_at: 'lastUsedAt',
  expires_at: 'expiresAt',
  is_active: 'isActive'
};

// Field mapping for machine_settings table
export const machineSettingsFieldMap = {
  // DB field -> JS field
  id: 'id',
  machine_id: 'machineId',
  user_id: 'userId',
  settings_data: 'settingsData',
  created_at: 'createdAt',
  updated_at: 'updatedAt'
};