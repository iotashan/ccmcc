import { db } from './db.js';
import crypto from 'crypto';
import { mapDbRowToJs } from './fieldMapping.js';

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
        const machine = mapDbRowToJs(row);
        machine.capabilities = JSON.parse(machine.capabilities || '[]');
        machine.metadata = JSON.parse(machine.metadata || '{}');
        return machine;
      }
      
      return null;
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
        const machine = mapDbRowToJs(row);
        machine.capabilities = JSON.parse(machine.capabilities || '[]');
        machine.metadata = JSON.parse(machine.metadata || '{}');
        return machine;
      }
      
      return null;
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
        const machine = mapDbRowToJs(row);
        machine.capabilities = JSON.parse(machine.capabilities || '[]');
        machine.metadata = JSON.parse(machine.metadata || '{}');
        return machine;
      }
      
      return null;
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
      
      return rows.map(row => {
        const machine = mapDbRowToJs(row);
        machine.capabilities = JSON.parse(machine.capabilities || '[]');
        machine.metadata = JSON.parse(machine.metadata || '{}');
        return machine;
      });
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
      
      if (updates.ipAddress !== undefined) {
        fields.push('ip_address = ?');
        values.push(updates.ipAddress);
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
      // Accept both camelCase and snake_case for backwards compatibility
      const name = machineData.name;
      const ip_address = machineData.ipAddress || machineData.ip_address;
      const capabilities = machineData.capabilities;
      const user_id = machineData.userId || machineData.user_id;
      
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
        
        const machine = mapDbRowToJs(existing);
        machine.ipAddress = ip_address || machine.ipAddress;
        machine.capabilities = capabilities || JSON.parse(existing.capabilities || '[]');
        machine.status = 'online';
        return machine;
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
          ipAddress: ip_address,
          status: 'online',
          capabilities: capabilities || [],
          metadata: {},
          authToken: authToken,
          userId: user_id,
          lastSeen: new Date()
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