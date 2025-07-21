import express from 'express';
import { machineDb, db } from '../database/db.js';
import { machineManager } from '../machines/MachineManager.js';

const router = express.Router();

// Get all machines for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const machines = await machineDb.getUserMachines(userId);
    
    // Format response
    const formattedMachines = machines.map(m => ({
      id: m.id,
      name: m.name,
      status: m.status,
      lastSeen: m.lastSeen,
      firstSeen: m.firstSeen,
      capabilities: m.capabilities,
      ipAddress: m.ipAddress,
      metadata: m.metadata
    }));
    
    res.json({
      machines: formattedMachines,
      stats: machineManager.getStats()
    });
  } catch (error) {
    console.error('Error getting machines:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific machine
router.get('/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const machine = await machineDb.getMachine(machineId);
    
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    
    // Check if user owns this machine
    if (machine.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      id: machine.id,
      name: machine.name,
      status: machine.status,
      lastSeen: machine.lastSeen,
      firstSeen: machine.firstSeen,
      capabilities: machine.capabilities,
      ipAddress: machine.ip_address,
      metadata: machine.metadata
    });
  } catch (error) {
    console.error('Error getting machine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a machine (soft delete)
router.delete('/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const machine = await machineDb.getMachine(machineId);
    
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    
    // Check if user owns this machine
    if (machine.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Remove the machine
    await machineDb.removeMachine(machineId);
    
    // Disconnect if online
    const connection = machineManager.getMachineConnection(machineId);
    if (connection) {
      await machineManager.handleMachineDisconnect(machineId);
    }
    
    res.json({ success: true, message: 'Machine removed' });
  } catch (error) {
    console.error('Error removing machine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore a removed machine
router.post('/:machineId/restore', async (req, res) => {
  try {
    const { machineId } = req.params;
    
    // Get machine including removed ones
    const stmt = db.prepare('SELECT * FROM machines WHERE id = ?');
    const machine = stmt.get(machineId);
    
    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    
    // Check if user owns this machine
    if (machine.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Restore the machine
    await machineDb.restoreMachine(machineId);
    
    res.json({ success: true, message: 'Machine restored' });
  } catch (error) {
    console.error('Error restoring machine:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get machine statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const machines = await machineDb.getUserMachines(userId);
    
    const stats = {
      total: machines.length,
      online: machines.filter(m => m.status === 'online').length,
      offline: machines.filter(m => m.status === 'offline').length,
      connecting: machines.filter(m => m.status === 'connecting').length,
      capabilities: {}
    };
    
    // Count capabilities
    machines.forEach(m => {
      m.capabilities.forEach(cap => {
        stats.capabilities[cap] = (stats.capabilities[cap] || 0) + 1;
      });
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting machine stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;