import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Create database connection
const db = new Database(DB_PATH);
console.log('Connected to SQLite database');

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash, encryptionKey) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash, encryption_key) VALUES (?, ?, ?)');
      const result = stmt.run(username, passwordHash, encryptionKey);
      return { id: result.lastInsertRowid, username, encryptionKey };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get encryption key for user
  getEncryptionKey: (userId) => {
    try {
      const row = db.prepare('SELECT encryption_key FROM users WHERE id = ? AND is_active = 1').get(userId);
      
      // If user exists but has no encryption key, generate one
      if (row && !row.encryption_key) {
        const crypto = require('crypto');
        const encryptionKey = crypto.randomBytes(32).toString('base64');
        db.prepare('UPDATE users SET encryption_key = ? WHERE id = ?').run(encryptionKey, userId);
        return encryptionKey;
      }
      
      return row ? row.encryption_key : null;
    } catch (err) {
      throw err;
    }
  }
};

// Import machine database operations
import { machineDb } from './machineDb.js';

// API tokens database operations
const apiTokensDb = {
  // Create a new API token
  createToken: (userId, tokenHash, name, expiresAt = null) => {
    try {
      const stmt = db.prepare('INSERT INTO api_tokens (user_id, token_hash, name, expires_at) VALUES (?, ?, ?, ?)');
      const result = stmt.run(userId, tokenHash, name, expiresAt);
      return { id: result.lastInsertRowid, userId, name, expiresAt };
    } catch (err) {
      throw err;
    }
  },

  // Get token by hash
  getTokenByHash: (tokenHash) => {
    try {
      const stmt = db.prepare(`
        SELECT t.*, u.username 
        FROM api_tokens t 
        JOIN users u ON t.user_id = u.id 
        WHERE t.token_hash = ? AND t.is_active = 1 
        AND (t.expires_at IS NULL OR t.expires_at > datetime('now'))
      `);
      return stmt.get(tokenHash);
    } catch (err) {
      throw err;
    }
  },

  // Update last used timestamp
  updateLastUsed: (tokenHash) => {
    try {
      const stmt = db.prepare('UPDATE api_tokens SET last_used_at = datetime("now") WHERE token_hash = ?');
      stmt.run(tokenHash);
    } catch (err) {
      throw err;
    }
  },

  // Get all tokens for a user
  getUserTokens: (userId) => {
    try {
      const stmt = db.prepare(`
        SELECT id, name, created_at, last_used_at, expires_at, is_active
        FROM api_tokens 
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
      `);
      return stmt.all(userId);
    } catch (err) {
      throw err;
    }
  },

  // Deactivate token
  deactivateToken: (tokenId, userId) => {
    try {
      const stmt = db.prepare('UPDATE api_tokens SET is_active = 0 WHERE id = ? AND user_id = ?');
      return stmt.run(tokenId, userId);
    } catch (err) {
      throw err;
    }
  },

  // Delete token
  deleteToken: (tokenId, userId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?');
      return stmt.run(tokenId, userId);
    } catch (err) {
      throw err;
    }
  },

  // Clean up expired tokens
  cleanupExpiredTokens: () => {
    try {
      const stmt = db.prepare('DELETE FROM api_tokens WHERE expires_at IS NOT NULL AND expires_at < datetime("now")');
      return stmt.run();
    } catch (err) {
      throw err;
    }
  }
};

export {
  db,
  initializeDatabase,
  userDb,
  machineDb,
  apiTokensDb
};