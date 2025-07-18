import { db } from './db.js';
import crypto from 'crypto';

// Machine database operations
const machineDb = {
  // Generate a secure token for machine authentication
  generateAuthToken: () => {
    return crypto.randomBytes(32).toString('hex');
  },

  // Check if any machines exist for a user
  hasMachines: (userId) => {
    try {
      const row = db.prepare(
        'SELECT COUNT(*) as count FROM machines WHERE user_id = ? AND is_removed = 0'
      ).get(userId);
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new machine
  createMachine: (machineData) => {
    try {
      const id = machineData.id || crypto.randomUUID();
      const authToken = machineDb.generateAuthToken();
      
      const stmt = db.prepare(`
        INSERT INTO machines (
          id, name, ip_address, status, capabilities, metadata, auth_token, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        machineData.name,
        machineData.ip_address || null,
        'online',
        JSON.stringify(machineData.capabilities || []),
        JSON.stringify(machineData.metadata || {}),
        authToken,
        machineData.user_id
      );
      
      return { id, authToken };
    } catch (err) {
      throw err;
    }
  },

  // Get machine by ID
  getMachine: (machineId) => {
    try {
      const row = db.prepare(
        'SELECT * FROM machines WHERE id = ? AND is_removed = 0'
      ).get(machineId);
      
      if (row) {
        row.capabilities = JSON.parse(row.capabilities || '[]');
        row.metadata = JSON.parse(row.metadata || '{}');
      }
      
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get machine by name
  getMachineByName: (name, userId) => {
    try {
      const row = db.prepare(
        'SELECT * FROM machines WHERE name = ? AND user_id = ? AND is_removed = 0'
      ).get(name, userId);
      
      if (row) {
        row.capabilities = JSON.parse(row.capabilities || '[]');
        row.metadata = JSON.parse(row.metadata || '{}');
      }
      
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get machine by auth token
  getMachineByToken: (authToken) => {
    try {
      const row = db.prepare(
        'SELECT * FROM machines WHERE auth_token = ? AND is_removed = 0'
      ).get(authToken);
      
      if (row) {
        row.capabilities = JSON.parse(row.capabilities || '[]');
        row.metadata = JSON.parse(row.metadata || '{}');
      }
      
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get all machines for a user
  getUserMachines: (userId) => {
    try {
      const rows = db.prepare(
        'SELECT * FROM machines WHERE user_id = ? AND is_removed = 0 ORDER BY status DESC, name ASC'
      ).all(userId);
      
      return rows.map(row => ({
        ...row,
        capabilities: JSON.parse(row.capabilities || '[]'),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (err) {
      throw err;
    }
  },

  // Update machine status
  updateMachineStatus: (machineId, status) => {
    try {
      const stmt = db.prepare(
        'UPDATE machines SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(status, machineId);
    } catch (err) {
      throw err;
    }
  },

  // Update machine info
  updateMachine: (machineId, updates) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.ip_address !== undefined) {
        fields.push('ip_address = ?');
        values.push(updates.ip_address);
      }
      
      if (updates.capabilities !== undefined) {
        fields.push('capabilities = ?');
        values.push(JSON.stringify(updates.capabilities));
      }
      
      if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
      }
      
      if (fields.length === 0) return;
      
      fields.push('last_seen = CURRENT_TIMESTAMP');
      values.push(machineId);
      
      const stmt = db.prepare(
        `UPDATE machines SET ${fields.join(', ')} WHERE id = ?`
      );
      stmt.run(...values);
    } catch (err) {
      throw err;
    }
  },

  // Soft delete a machine
  removeMachine: (machineId) => {
    try {
      const stmt = db.prepare(
        'UPDATE machines SET is_removed = 1, removed_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(machineId);
    } catch (err) {
      throw err;
    }
  },

  // Restore a removed machine
  restoreMachine: (machineId) => {
    try {
      const stmt = db.prepare(
        'UPDATE machines SET is_removed = 0, removed_at = NULL WHERE id = ?'
      );
      stmt.run(machineId);
    } catch (err) {
      throw err;
    }
  },

  // Upsert machine - create or update in a single operation
  upsertMachine: (machineData) => {
    try {
      const { name, ip_address, capabilities, user_id } = machineData;
      
      // Check if machine exists
      const existing = db.prepare(
        'SELECT * FROM machines WHERE name = ? AND user_id = ? AND is_removed = 0'
      ).get(name, user_id);
      
      if (existing) {
        // Update existing machine and set online in one query
        const stmt = db.prepare(`
          UPDATE machines 
          SET ip_address = ?, 
              capabilities = ?, 
              status = 'online', 
              last_seen = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        stmt.run(
          ip_address || existing.ip_address,
          JSON.stringify(capabilities || []),
          existing.id
        );
        
        return {
          ...existing,
          ip_address: ip_address || existing.ip_address,
          capabilities: capabilities || JSON.parse(existing.capabilities || '[]'),
          status: 'online'
        };
      } else {
        // Create new machine with online status
        const id = crypto.randomUUID();
        const authToken = machineDb.generateAuthToken();
        
        const stmt = db.prepare(`
          INSERT INTO machines (
            id, name, ip_address, status, capabilities, metadata, auth_token, user_id, last_seen
          ) VALUES (?, ?, ?, 'online', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(
          id,
          name,
          ip_address || null,
          JSON.stringify(capabilities || []),
          JSON.stringify({}),
          authToken,
          user_id
        );
        
        return {
          id,
          name,
          ip_address,
          status: 'online',
          capabilities: capabilities || [],
          metadata: {},
          auth_token: authToken,
          user_id,
          last_seen: new Date()
        };
      }
    } catch (err) {
      throw err;
    }
  },

  // Update machines offline if not seen recently
  updateOfflineMachines: (thresholdSeconds = 90) => {
    try {
      const stmt = db.prepare(`
        UPDATE machines 
        SET status = 'offline' 
        WHERE status = 'online' 
        AND datetime(last_seen) < datetime('now', '-' || ? || ' seconds')
      `);
      stmt.run(thresholdSeconds);
    } catch (err) {
      throw err;
    }
  },

  // Clean up old removed machines
  cleanupRemovedMachines: (daysOld = 30) => {
    try {
      const stmt = db.prepare(`
        DELETE FROM machines 
        WHERE is_removed = 1 
        AND datetime(removed_at) < datetime('now', '-' || ? || ' days')
      `);
      stmt.run(daysOld);
    } catch (err) {
      throw err;
    }
  }
};

export { machineDb };