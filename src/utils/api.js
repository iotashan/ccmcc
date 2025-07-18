import { encryptRequestBody, decryptResponseBody, isEncryptionSupported } from './encryption.js';

// Cache for encryption key
let encryptionKeyCache = null;

// Get encryption key from cache or config
const getEncryptionKey = async () => {
  // Web GUI does not use encryption - only API token machine clients do
  // Return null to disable encryption for web GUI
  return null;
};

// Clear encryption key cache on logout
export const clearEncryptionKey = () => {
  encryptionKeyCache = null;
};

// Utility function for authenticated API calls with encryption support
export const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('auth-token');
  const selectedMachine = localStorage.getItem('selectedMachine') || 'local';
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  // Add machine_id header for routing
  if (selectedMachine && selectedMachine !== 'local') {
    defaultHeaders['X-Machine-ID'] = selectedMachine;
  }
  
  // Get encryption key first to determine if encryption should be used
  const encryptionKey = await getEncryptionKey();
  
  // Check if encryption is supported AND we have an encryption key
  if (isEncryptionSupported() && encryptionKey) {
    defaultHeaders['X-Encryption-Support'] = 'true';
    
    // Encrypt request body if present
    if (options.body && options.headers?.['Content-Type'] !== 'multipart/form-data') {
      try {
        const data = JSON.parse(options.body);
        const encryptedBody = await encryptRequestBody(data, encryptionKey);
        options.body = JSON.stringify(encryptedBody);
        defaultHeaders['X-Encrypted'] = 'true';
      } catch (error) {
        console.error('Request encryption failed:', error);
      }
    }
    
    // Perform the fetch
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
    
    // Check for authentication errors and clear session
    if (response.status === 401 || response.status === 403) {
      console.warn('Authentication failed, clearing session');
      localStorage.removeItem('auth-token');
      clearEncryptionKey();
      // Redirect to login page
      window.location.href = '/';
      return response;
    }
    
    // Check if response is encrypted and decrypt if needed
    if (response.headers.get('X-Encrypted') === 'true') {
      // Clone response to read body
      const clonedResponse = response.clone();
      
      try {
        const encryptedData = await clonedResponse.json();
        const decryptedData = await decryptResponseBody(encryptedData, encryptionKey);
        
        // Create new response with decrypted data
        const decryptedResponse = new Response(JSON.stringify(decryptedData), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        
        // Copy custom properties
        Object.keys(response).forEach(key => {
          if (!(key in Response.prototype)) {
            decryptedResponse[key] = response[key];
          }
        });
        
        return decryptedResponse;
      } catch (error) {
        console.error('Response decryption failed:', error);
        // Fall back to original response if decryption fails
        return response;
      }
    }
    
    return response;
  }
  
  // Fall back to unencrypted fetch
  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });
  
  // Check for authentication errors and clear session
  if (response.status === 401 || response.status === 403) {
    console.warn('Authentication failed, clearing session');
    localStorage.removeItem('auth-token');
    clearEncryptionKey();
    // Redirect to login page
    window.location.href = '/';
  }
  
  return response;
};

// API endpoints
export const api = {
  // Auth endpoints (no token required)
  auth: {
    status: () => fetch('/api/auth/status'),
    login: (username, password) => fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    register: (username, password) => fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    user: () => authenticatedFetch('/api/auth/user'),
    logout: async () => {
      const response = await authenticatedFetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        clearEncryptionKey();
      }
      return response;
    },
  },
  
  // Protected endpoints
  config: () => authenticatedFetch('/api/config'),
  projects: () => authenticatedFetch('/api/projects'),
  sessions: (projectName, limit = 5, offset = 0) => 
    authenticatedFetch(`/api/projects/${projectName}/sessions?limit=${limit}&offset=${offset}`),
  sessionMessages: (projectName, sessionId) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}/messages`),
  renameProject: (projectName, displayName) =>
    authenticatedFetch(`/api/projects/${projectName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ displayName }),
    }),
  deleteSession: (projectName, sessionId) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  deleteProject: (projectName) =>
    authenticatedFetch(`/api/projects/${projectName}`, {
      method: 'DELETE',
    }),
  createProject: (path) =>
    authenticatedFetch('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),
  readFile: (projectName, filePath) =>
    authenticatedFetch(`/api/projects/${projectName}/file?filePath=${encodeURIComponent(filePath)}`),
  saveFile: (projectName, filePath, content) =>
    authenticatedFetch(`/api/projects/${projectName}/file`, {
      method: 'PUT',
      body: JSON.stringify({ filePath, content }),
    }),
  getFiles: (projectName) =>
    authenticatedFetch(`/api/projects/${projectName}/files`),
  transcribe: (formData) =>
    authenticatedFetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    }),
  
  // Settings endpoints
  settings: {
    get: () => authenticatedFetch('/api/settings'),
    save: (settings) => authenticatedFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
    syncFromServer: () => authenticatedFetch('/api/settings/sync-from-server', {
      method: 'POST',
    }),
  },
  
  // Generic HTTP methods
  get: (url) => authenticatedFetch(url),
  post: (url, data) => authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (url, data) => authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (url) => authenticatedFetch(url, {
    method: 'DELETE',
  }),
};