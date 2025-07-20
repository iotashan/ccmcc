import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { X, Plus, Settings, Shield, AlertTriangle, Server, Edit3, Trash2, Play, Download, Toggle } from 'lucide-react';
import { api } from '../utils/api';

function ProjectMCPPanel({ selectedProject, selectedMachine }) {
  const [mcpServers, setMcpServers] = useState([]);
  const [userMcpServers, setUserMcpServers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [strictMode, setStrictMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'stdio',
    config: {
      command: '',
      args: [],
      env: {},
      url: '',
      headers: {},
      timeout: 30000
    }
  });

  // Load project MCP configuration
  useEffect(() => {
    if (selectedProject) {
      loadProjectMcpConfig();
      loadUserMcpServers();
    }
  }, [selectedProject]);

  const loadProjectMcpConfig = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/projects/${selectedProject.id}/mcp`);
      if (response.ok) {
        const data = await response.json();
        setMcpServers(data.mcpServers || []);
        setStrictMode(data.strictMode || false);
      }
    } catch (error) {
      console.error('Failed to load project MCP config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserMcpServers = async () => {
    try {
      const response = await api.get(`/api/projects/${selectedProject.id}/mcp/discover`);
      if (response.ok) {
        const data = await response.json();
        setUserMcpServers(data.userServers || []);
      }
    } catch (error) {
      console.error('Failed to discover user MCP servers:', error);
    }
  };

  const saveProjectMcpConfig = async () => {
    try {
      setIsSaving(true);
      const response = await api.put(`/api/projects/${selectedProject.id}/mcp`, {
        mcpServers,
        strictMode
      });
      if (!response.ok) {
        throw new Error('Failed to save MCP configuration');
      }
    } catch (error) {
      console.error('Failed to save project MCP config:', error);
      alert('Failed to save MCP configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddServer = () => {
    if (!formData.name.trim()) return;
    
    const newServer = {
      id: Date.now().toString(),
      ...formData,
      config: { ...formData.config }
    };
    
    setMcpServers([...mcpServers, newServer]);
    setFormData({
      name: '',
      type: 'stdio',
      config: {
        command: '',
        args: [],
        env: {},
        url: '',
        headers: {},
        timeout: 30000
      }
    });
    setShowAddForm(false);
    saveProjectMcpConfig();
  };

  const handleEditServer = (server) => {
    setEditingServer(server);
    setFormData({ ...server });
    setShowAddForm(true);
  };

  const handleUpdateServer = () => {
    const updatedServers = mcpServers.map(server => 
      server.id === editingServer.id ? { ...formData } : server
    );
    setMcpServers(updatedServers);
    setEditingServer(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      type: 'stdio',
      config: {
        command: '',
        args: [],
        env: {},
        url: '',
        headers: {},
        timeout: 30000
      }
    });
    saveProjectMcpConfig();
  };

  const handleDeleteServer = (serverId) => {
    setMcpServers(mcpServers.filter(server => server.id !== serverId));
    saveProjectMcpConfig();
  };

  const handleImportServers = async (selectedServerNames) => {
    try {
      const response = await api.post(`/api/projects/${selectedProject.id}/mcp/import`, {
        serverNames: selectedServerNames
      });
      if (response.ok) {
        loadProjectMcpConfig();
        setShowImportDialog(false);
      }
    } catch (error) {
      console.error('Failed to import MCP servers:', error);
      alert('Failed to import MCP servers');
    }
  };

  const handleStrictModeToggle = () => {
    setStrictMode(!strictMode);
    // Save immediately when toggling strict mode
    setTimeout(saveProjectMcpConfig, 100);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <p>Loading MCP configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Project MCP Configuration</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage Model Context Protocol servers for this project
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Strict Mode Toggle */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Project-only mode
              </label>
              <button
                onClick={handleStrictModeToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  strictMode 
                    ? 'bg-blue-600' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    strictMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            {/* Import Button */}
            {userMcpServers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Import
              </Button>
            )}
            
            {/* Add Button */}
            <Button
              onClick={() => setShowAddForm(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </Button>
          </div>
        </div>
        
        {/* Mode Description */}
        <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {strictMode ? (
              <span>
                <strong>Project-only mode:</strong> Only project MCP servers will be available. User-level servers are ignored.
              </span>
            ) : (
              <span>
                <strong>Additive mode:</strong> Project MCP servers are combined with your user-level servers.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            {/* Project MCP Servers */}
            <div className="space-y-4">
              {mcpServers.length === 0 ? (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No MCP servers configured
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Add MCP servers to extend Claude's capabilities for this project.
                  </p>
                  {userMcpServers.length > 0 ? (
                    <div className="space-x-3">
                      <Button onClick={() => setShowImportDialog(true)} variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Import from User Config
                      </Button>
                      <Button onClick={() => setShowAddForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Server
                      </Button>
                    </div>
                  ) : (
                    <Button onClick={() => setShowAddForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Server
                    </Button>
                  )}
                </div>
              ) : (
                mcpServers.map((server) => (
                  <div
                    key={server.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {server.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            {server.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Project
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {server.type === 'stdio' && (
                            <div>
                              <strong>Command:</strong> {server.config.command}
                              {server.config.args?.length > 0 && (
                                <span> {server.config.args.join(' ')}</span>
                              )}
                            </div>
                          )}
                          {server.type === 'sse' && (
                            <div><strong>URL:</strong> {server.config.url}</div>
                          )}
                          {server.type === 'http' && (
                            <div><strong>URL:</strong> {server.config.url}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditServer(server)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteServer(server.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* User-level MCP Servers (if not in strict mode) */}
            {!strictMode && userMcpServers.length > 0 && (
              <div className="mt-8">
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Inherited User-level Servers
                  </h3>
                  <div className="space-y-3">
                    {userMcpServers.map((server, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-gray-700 dark:text-gray-300">
                              {server.name}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              User
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Add/Edit Server Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingServer(null);
                  setFormData({
                    name: '',
                    type: 'stdio',
                    config: {
                      command: '',
                      args: [],
                      env: {},
                      url: '',
                      headers: {},
                      timeout: 30000
                    }
                  });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Server Name
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., filesystem, database, api"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="stdio">stdio</option>
                  <option value="sse">SSE</option>
                  <option value="http">HTTP</option>
                </select>
              </div>

              {formData.type === 'stdio' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Command
                    </label>
                    <Input
                      value={formData.config.command}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: { ...formData.config, command: e.target.value }
                      })}
                      placeholder="e.g., npx, python, node"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Arguments (one per line)
                    </label>
                    <textarea
                      value={formData.config.args?.join('\n') || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        config: {
                          ...formData.config,
                          args: e.target.value.split('\n').filter(arg => arg.trim())
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={3}
                      placeholder="--flag&#10;value&#10;--another-flag"
                    />
                  </div>
                </>
              )}

              {(formData.type === 'sse' || formData.type === 'http') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <Input
                    value={formData.config.url}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config, url: e.target.value }
                    })}
                    placeholder="https://api.example.com/mcp"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingServer(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingServer ? handleUpdateServer : handleAddServer}
                disabled={!formData.name.trim() || isSaving}
              >
                {isSaving ? 'Saving...' : editingServer ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog
          userServers={userMcpServers}
          onImport={handleImportServers}
          onClose={() => setShowImportDialog(false)}
        />
      )}
    </div>
  );
}

// Import Dialog Component
function ImportDialog({ userServers, onImport, onClose }) {
  const [selectedServers, setSelectedServers] = useState([]);

  const handleServerToggle = (serverName) => {
    setSelectedServers(prev => 
      prev.includes(serverName)
        ? prev.filter(name => name !== serverName)
        : [...prev, serverName]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import MCP Servers
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select user-level MCP servers to import into this project:
        </p>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {userServers.map((server, index) => (
            <label
              key={index}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <input
                type="checkbox"
                checked={selectedServers.includes(server.name)}
                onChange={() => handleServerToggle(server.name)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {server.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {server.command || server.url}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onImport(selectedServers)}
            disabled={selectedServers.length === 0}
          >
            Import {selectedServers.length} Server{selectedServers.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProjectMCPPanel;