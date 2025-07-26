// tests/config/vitest.setup.js
// Vitest setup for ES modules - clean and simple

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Suppress console noise during tests
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  // Suppress expected warnings
  if (message.includes('ExperimentalWarning') ||
      message.includes('VM Modules') ||
      message.includes('⚠️') ||
      message.includes('SECURITY WARN:')) {
    return;
  }
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  const message = args[0]?.toString() || '';
  // Suppress expected test errors
  if (message.includes('❌') ||
      message.includes('ECONNREFUSED') ||
      message.includes('Error reading sessions') ||
      message.includes('Error reading messages') ||
      message.includes('Test error handler:')) {
    return;
  }
  originalConsoleError(...args);
};

// Database setup and cleanup
let db;

beforeAll(async () => {
  // Initialize test database
  const { initializeDatabase, db: database } = await import('../../server/database/db.js');
  await initializeDatabase();
  db = database;
});

afterAll(async () => {
  // Clean up database connection
  if (db) {
    try {
      db.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

beforeEach(async () => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Clear database tables for clean test state
  if (db) {
    try {
      const tables = ['machine_auth_codes', 'api_tokens', 'machines', 'users'];
      for (const table of tables) {
        const tableExists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(table);
        
        if (tableExists) {
          db.exec(`DELETE FROM ${table}`);
        }
      }
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }
});

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks();
});

// Mock child_process for Claude CLI
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    spawn: vi.fn((command, args, options) => {
      if (command === 'claude') {
        // Mock Claude CLI responses
        const mockProcess = {
          stdout: { 
            on: vi.fn((event, callback) => {
              if (event === 'data') {
                setTimeout(() => {
                  callback(Buffer.from('Mock Claude response: ' + args.join(' ')));
                }, 100);
              }
            })
          },
          stderr: { on: vi.fn() },
          on: vi.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 200);
            }
          }),
          kill: vi.fn(),
          pid: Math.floor(Math.random() * 10000)
        };
        return mockProcess;
      }
      // For other commands, use real implementation
      return actual.spawn(command, args, options);
    })
  };
});

// Global test utilities
global.testUtils = {
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    path: '/test',
    ...overrides
  }),
  
  createMockResponse: () => {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    res.end = vi.fn().mockReturnValue(res);
    res.setHeader = vi.fn().mockReturnValue(res);
    res.cookie = vi.fn().mockReturnValue(res);
    res.clearCookie = vi.fn().mockReturnValue(res);
    return res;
  },
  
  createMockWebSocket: () => ({
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    OPEN: 1,
    on: vi.fn(),
    emit: vi.fn(),
    terminate: vi.fn()
  }),
  
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  createTestUser: async (overrides = {}) => {
    const { userDb } = await import('../../server/database/db.js');
    const { hashPassword } = await import('../../server/utils/auth.js');
    const crypto = await import('crypto');
    
    const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(7);
    const userData = {
      username: overrides.username || 'testuser_' + uniqueId,
      email: overrides.email || `test_${uniqueId}@example.com`,
      password: 'TestPass123!',
      ...overrides
    };
    
    const hashedPassword = await hashPassword(userData.password);
    const userResult = userDb.createUser(
      userData.username,
      hashedPassword,
      userData.encryptionKey || crypto.randomBytes(32).toString('base64')
    );
    
    return {
      ...userData,
      id: userResult.id,
      hashedPassword,
      encryptionKey: userResult.encryptionKey
    };
  },
  
  createTestApiToken: async (userId, name = 'Test Token') => {
    const { createApiToken } = await import('../../server/utils/apiTokens.js');
    const tokenData = await createApiToken(userId, name);
    return {
      id: tokenData.id,
      token: tokenData.rawToken,
      name: tokenData.name
    };
  },
  
  createMockProject: (overrides = {}) => ({
    id: 'test-project-' + Date.now(),
    name: 'Test Project',
    path: '/test/project',
    type: 'nodejs',
    ...overrides
  }),
  
  getTestPort: () => {
    // Return a random port for testing
    return Math.floor(Math.random() * 10000) + 40000;
  }
};