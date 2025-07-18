import { useState, useEffect, useCallback } from 'react';

export const useMachines = (websocketMessages = []) => {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState('local');

  // Load saved machine selection from localStorage
  useEffect(() => {
    const savedMachine = localStorage.getItem('selectedMachine');
    if (savedMachine) {
      setSelectedMachine(savedMachine);
    }
  }, []);

  // Save machine selection to localStorage
  const selectMachine = useCallback((machineId) => {
    setSelectedMachine(machineId);
    localStorage.setItem('selectedMachine', machineId);
  }, []);

  // Remove a machine
  const removeMachine = useCallback(async (machineId) => {
    try {
      const response = await fetch(`/api/machines/${machineId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove machine');
      }

      // Remove from local state
      setMachines(prev => prev.filter(m => m.id !== machineId));
      
      // If the removed machine was selected, switch to local
      if (selectedMachine === machineId) {
        selectMachine('local');
      }
    } catch (error) {
      console.error('Error removing machine:', error);
      throw error;
    }
  }, [selectedMachine, selectMachine]);

  // Fetch machines from API
  const fetchMachines = useCallback(async () => {
    try {
      console.log('Fetching machines from API...');
      const response = await fetch('/api/machines', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch machines');
      }

      const data = await response.json();
      console.log('Machines API response:', data);
      setMachines(data.machines || []);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    // Process the latest WebSocket message
    if (websocketMessages.length > 0) {
      const latestMessage = websocketMessages[websocketMessages.length - 1];
      
      if (latestMessage.type === 'machine_list_update') {
        setMachines(latestMessage.machines || []);
      } else if (latestMessage.type === 'machine_status_update') {
        setMachines(prev => prev.map(m => 
          m.id === latestMessage.machineId 
            ? { ...m, status: latestMessage.status, lastSeen: latestMessage.lastSeen }
            : m
        ));
      }
    }
  }, [websocketMessages]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    // Fetch immediately on mount
    fetchMachines();
    
    // Also fetch after a short delay to catch any machines that connect right after page load
    const initialTimeout = setTimeout(() => {
      fetchMachines();
    }, 1000);
    
    // Refresh machine list every 30 seconds
    const intervalId = setInterval(() => {
      fetchMachines();
    }, 30000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [fetchMachines]);

  // Check if selected machine is online
  const isSelectedMachineOnline = selectedMachine === 'local' || 
    machines.find(m => m.id === selectedMachine)?.status === 'online';

  return {
    machines,
    selectedMachine,
    selectMachine,
    removeMachine,
    isSelectedMachineOnline,
    refreshMachines: fetchMachines
  };
};