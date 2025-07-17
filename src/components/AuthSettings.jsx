import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

function AuthSettings({ isOpen, onClose }) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [apiTokens, setApiTokens] = useState([]);
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenResult, setNewTokenResult] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      // Fetch server config to get actual IP
      api.config()
        .then(res => res.json())
        .then(data => {
          console.log('Server config received:', data);
          setServerInfo(data);
        })
        .catch(err => console.error('Failed to fetch server config:', err));
      
      // Fetch API tokens
      loadApiTokens();
    }
  }, [isOpen]);
  
  const loadApiTokens = async () => {
    try {
      const response = await api.get('/api/tokens');
      const tokens = await response.json();
      setApiTokens(tokens);
    } catch (error) {
      console.error('Failed to load API tokens:', error);
    }
  };
  
  const createApiToken = async () => {
    if (!newTokenName.trim()) return;
    
    setLoading(true);
    try {
      const response = await api.post('/api/tokens', {
        name: newTokenName.trim()
      });
      const result = await response.json();
      setNewTokenResult(result);
      setNewTokenName('');
      setShowNewTokenModal(false);
      await loadApiTokens();
    } catch (error) {
      console.error('Failed to create API token:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const revokeApiToken = async (tokenId) => {
    if (!confirm('Are you sure you want to revoke this token? Any clients using this token will need to be updated.')) {
      return;
    }
    
    try {
      await api.delete(`/api/tokens/${tokenId}`);
      await loadApiTokens();
    } catch (error) {
      console.error('Failed to revoke API token:', error);
    }
  };
  
  const handleCopyNewToken = (token) => {
    navigator.clipboard.writeText(token);
    setTimeout(() => setNewTokenResult(null), 30000); // Hide after 30 seconds
  };
  
  if (!isOpen) return null;
  
  const authToken = localStorage.getItem('auth-token');
  
  const handleCopyToken = () => {
    navigator.clipboard.writeText(`CLAUDE_CODE_UI_AUTH_TOKEN=${authToken}`);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };
  
  const getServerAddress = () => {
    if (serverInfo?.serverIP && serverInfo.serverIP !== 'localhost') {
      return `${serverInfo.serverProtocol || 'http'}://${serverInfo.serverIP}:${serverInfo.serverPort || '3020'}`;
    }
    // Fallback to current location
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = '3020'; // Backend port
    return `${protocol}//${hostname}:${port}`;
  };
  
  const handleCopyExample = () => {
    const exampleEnv = `CLAUDE_CODE_UI_SERVER_ADDRESS=${getServerAddress()}
CLAUDE_CODE_UI_CLIENT_NAME="Remote Machine Name"
CLAUDE_CODE_UI_AUTH_TOKEN=${authToken}`;
    navigator.clipboard.writeText(exampleEnv);
    setCopiedExample(true);
    setTimeout(() => setCopiedExample(false), 2000);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Client Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* New Token Creation Result */}
          {newTokenResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-900 dark:text-green-300 mb-2">
                New API Token Created
              </h4>
              <p className="text-sm text-green-800 dark:text-green-400 mb-3">
                Please copy this token now. You won't be able to see it again.
              </p>
              <div className="relative group">
                <div className="bg-green-100 dark:bg-green-900/50 rounded-lg p-3 mb-2 overflow-x-auto">
                  <code className="text-sm text-green-800 dark:text-green-200 whitespace-nowrap">
                    {newTokenResult.rawToken}
                  </code>
                </div>
                <button
                  onClick={() => handleCopyNewToken(newTokenResult.rawToken)}
                  className="absolute top-2 right-2 p-1.5 bg-green-200 dark:bg-green-800 hover:bg-green-300 dark:hover:bg-green-700 rounded transition-colors"
                  title="Copy token"
                >
                  <svg className="w-4 h-4 text-green-700 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* API Tokens Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                API Tokens
              </h3>
              <button
                onClick={() => setShowNewTokenModal(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
              >
                Create New Token
              </button>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.098 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Important
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    API tokens are persistent and survive server restarts. If you revoke a token, all clients using that token will need to be updated with a new token.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {apiTokens.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No API tokens created yet. Create one to connect remote clients.
                </p>
              ) : (
                apiTokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{token.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Created: {new Date(token.created_at).toLocaleDateString()}
                        {token.last_used_at && (
                          <span className="ml-2">
                            Last used: {new Date(token.last_used_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeApiToken(token.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* JWT Token Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Client Authentication Token
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Use this token to authenticate remote machines with Claude Code UI. 
              Add it to your client's <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> file as:
            </p>
            
            <div className="relative group">
              <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4 overflow-x-auto">
                <code className="text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  CLAUDE_CODE_UI_AUTH_TOKEN={authToken}
                </code>
              </div>
              <button
                onClick={handleCopyToken}
                className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Copy to clipboard"
              >
                {copiedToken ? (
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
            
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Keep this token secure
            </span>
          </div>
          
          {/* Instructions */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Setting up a remote machine:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>Install the Claude Code UI client on the remote machine</li>
              <li>Create a <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.env</code> file in the client directory</li>
              <li>Add the server address and authentication token:
                <div className="relative group mt-2">
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="font-mono text-xs text-gray-800 dark:text-gray-200">{`CLAUDE_CODE_UI_SERVER_ADDRESS=${getServerAddress()}
CLAUDE_CODE_UI_CLIENT_NAME="Remote Machine Name"
CLAUDE_CODE_UI_AUTH_TOKEN=${authToken}`}</pre>
                  </div>
                  <button
                    onClick={handleCopyExample}
                    className="absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy example"
                  >
                    {copiedExample ? (
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </li>
              <li>Run <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npm start</code> in the client directory</li>
            </ol>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      
      {/* New Token Modal */}
      {showNewTokenModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowNewTokenModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New API Token
              </h3>
              <button
                onClick={() => setShowNewTokenModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g., Remote Desktop, Laptop, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onKeyPress={(e) => e.key === 'Enter' && createApiToken()}
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowNewTokenModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createApiToken}
                  disabled={!newTokenName.trim() || loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Token'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthSettings;