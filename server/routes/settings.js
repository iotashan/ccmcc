import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { userDb, db } from '../database/db.js';

const router = express.Router();

// Get settings for current machine
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const machineId = req.headers['x-machine-id'] || 'local';
    
    console.log(`[Settings] Getting settings for machine: ${machineId}, user: ${userId}`);
    
    // Get settings from database
    const stmt = db.prepare(`
      SELECT settings_data, updated_at 
      FROM machine_settings 
      WHERE machine_id = ? AND user_id = ?
    `);
    
    const result = stmt.get(machineId, userId);
    
    if (result) {
      const settings = JSON.parse(result.settings_data);
      console.log(`[Settings] Found existing settings for ${machineId}`);
      res.json(settings);
    } else {
      console.log(`[Settings] No settings found for ${machineId}, returning defaults`);
      // Return default settings
      const defaultSettings = {
        allowedTools: [],
        disallowedTools: [],
        skipPermissions: false,
        projectSortOrder: 'name',
        mcpServers: [],
        lastUpdated: new Date().toISOString()
      };
      res.json(defaultSettings);
    }
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings for current machine
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const machineId = req.headers['x-machine-id'] || 'local';
    const settings = req.body;
    
    console.log(`[Settings] Updating settings for machine: ${machineId}, user: ${userId}`);
    
    // Add timestamp
    settings.lastUpdated = new Date().toISOString();
    
    // Insert or update settings
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO machine_settings (machine_id, user_id, settings_data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(machineId, userId, JSON.stringify(settings));
    
    console.log(`[Settings] Settings saved for ${machineId}`);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Copy settings from server to current machine
router.post('/sync-from-server', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetMachineId = req.headers['x-machine-id'] || 'local';
    
    console.log(`[Settings] Syncing settings from server to machine: ${targetMachineId}, user: ${userId}`);
    
    // Prevent syncing server to itself
    if (targetMachineId === 'local') {
      return res.status(400).json({ error: 'Cannot sync server settings to server' });
    }
    
    // Get server settings
    const serverStmt = db.prepare(`
      SELECT settings_data 
      FROM machine_settings 
      WHERE machine_id = 'local' AND user_id = ?
    `);
    
    const serverResult = serverStmt.get(userId);
    
    if (!serverResult) {
      return res.status(404).json({ error: 'No server settings found to sync' });
    }
    
    const serverSettings = JSON.parse(serverResult.settings_data);
    
    // Filter out server-specific settings that shouldn't be copied
    const filteredSettings = {
      allowedTools: serverSettings.allowedTools || [],
      disallowedTools: serverSettings.disallowedTools || [],
      skipPermissions: serverSettings.skipPermissions || false,
      projectSortOrder: serverSettings.projectSortOrder || 'name',
      mcpServers: serverSettings.mcpServers || [],
      lastUpdated: new Date().toISOString()
    };
    
    // Save to target machine
    const updateStmt = db.prepare(`
      INSERT OR REPLACE INTO machine_settings (machine_id, user_id, settings_data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    updateStmt.run(targetMachineId, userId, JSON.stringify(filteredSettings));
    
    console.log(`[Settings] Settings synced from server to ${targetMachineId}`);
    res.json({ 
      success: true, 
      message: 'Settings synchronized from server successfully',
      settings: filteredSettings
    });
  } catch (error) {
    console.error('Error syncing settings:', error);
    res.status(500).json({ error: 'Failed to sync settings from server' });
  }
});

export default router;