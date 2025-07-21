import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Monitor, MonitorOff, X, Plus } from 'lucide-react';
import { TEST_IDS } from '../utils/testIds';

const MachineSelector = ({ 
  machines = [], 
  selectedMachine = 'local', 
  onMachineSelect, 
  onMachineRemove,
  waitingSessions = {},
  className = '' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current machine info
  const currentMachine = selectedMachine === 'local' 
    ? { id: 'local', name: 'Local Machine', status: 'online' }
    : machines.find(m => m.id === selectedMachine) || { id: selectedMachine, name: 'Unknown', status: 'offline' };

  // Combine local option with remote machines
  const allMachines = [
    { id: 'local', name: 'Local Machine', status: 'online', isLocal: true },
    ...machines
  ];

  const handleSelect = (machineId) => {
    onMachineSelect(machineId);
    setIsOpen(false);
  };

  const handleRemove = (e, machineId) => {
    e.stopPropagation();
    if (confirm('Remove this machine from the list?')) {
      onMachineRemove(machineId);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'connecting':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
      case 'offline':
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Calculate total waiting sessions
  const totalWaitingSessions = Object.values(waitingSessions).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors w-full text-left border border-gray-600 relative"
        data-testid={TEST_IDS.nav.machineSelector}
      >
        <div className="flex items-center gap-2 flex-1">
          {currentMachine.status === 'online' ? (
            <Monitor className="w-4 h-4 text-gray-400" />
          ) : (
            <MonitorOff className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-sm text-gray-300 truncate">
            {currentMachine.name}
          </span>
          {getStatusIcon(currentMachine.status)}
        </div>
        <div className="flex items-center gap-2">
          {totalWaitingSessions > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center">
              {totalWaitingSessions}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto" data-testid={TEST_IDS.nav.machineDropdown}>
          {allMachines.map((machine) => {
            const machineWaitingCount = waitingSessions[machine.id] || 0;
            return (
              <div
                key={machine.id}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer transition-colors ${
                  machine.id === selectedMachine ? 'bg-gray-700' : ''
                }`}
                onClick={() => handleSelect(machine.id)}
                data-testid={TEST_IDS.nav.machineDropdownItem}
              >
                <div className="flex items-center gap-2 flex-1">
                  {machine.status === 'online' ? (
                    <Monitor className="w-4 h-4 text-gray-400" />
                  ) : (
                    <MonitorOff className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-gray-300">{machine.name}</div>
                    {!machine.isLocal && machine.status === 'offline' && (
                      <div className="text-xs text-gray-500">
                        Last seen: {formatLastSeen(machine.lastSeen)}
                      </div>
                    )}
                  </div>
                  {getStatusIcon(machine.status)}
                  {machineWaitingCount > 0 && (
                    <span className="bg-yellow-500 text-gray-900 text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {machineWaitingCount}
                    </span>
                  )}
                </div>
                
                {!machine.isLocal && machine.status === 'offline' && (
                  <button
                    onClick={(e) => handleRemove(e, machine.id)}
                    className="p-1 hover:bg-gray-600 rounded transition-colors"
                    title="Remove machine"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            );
          })}
          
          {machines.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-sm text-gray-500 mb-2">No remote machines connected</p>
              <p className="text-xs text-gray-600">
                Run the client on other machines to connect them
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MachineSelector;