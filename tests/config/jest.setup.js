// tests/config/jest.setup.js
// Note: Environment variables are set in test-env.js which runs before module loading

import { jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Initialize test database before all tests
beforeAll(async () => {
  console.log('Initializing test database...');
  // Dynamically import to ensure environment is set
  const { initializeDatabase } = await import('../../server/database/db.js');
  await initializeDatabase();
});

// Clean up database connection after all tests
afterAll(async () => {
  const { db } = await import('../../server/database/db.js');
  try {
    db.close();
  } catch (error) {
    // Ignore errors during cleanup
  }
});

// Mock only Claude CLI since we're not testing the actual Claude API
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    spawn: jest.fn((command, args, options) => {
      if (command === 'claude') {
        // Mock Claude CLI responses
        const mockProcess = {
          stdout: { 
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                setTimeout(() => {
                  callback(Buffer.from('Mock Claude response: ' + args.join(' ')));
                }, 100);
              }
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 200);
            }
          }),
          kill: jest.fn(),
          pid: Math.floor(Math.random() * 10000)
        };
        return mockProcess;
      }
      // For other commands, use real implementation
      return actual.spawn(command, args, options);
    })
  };
});

// Setup test database cleanup
beforeEach(async () => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Clear database tables for clean test state
  const { db } = await import('../../server/database/db.js');
  try {
    // Clear all data from tables if they exist
    const tables = ['machine_auth_codes', 'api_tokens', 'machines', 'users'];
    for (const table of tables) {
      // Check if table exists before trying to delete
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).get(table);
      
      if (tableExists) {
        db.exec(`DELETE FROM ${table}`);
      }
    }
  } catch (error) {
    // Silently ignore errors during cleanup
  }
});

afterEach(() => {
  // Clean up any test state
  jest.restoreAllMocks();
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
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },
  
  createMockWebSocket: () => ({
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
    OPEN: 1,
    on: jest.fn(),
    emit: jest.fn(),
    terminate: jest.fn()
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

// Console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Only show error if it's not from expected test scenarios
  if (!args[0]?.includes?.('Warning:') && 
      !args[0]?.includes?.('Error:') &&
      !args[0]?.includes?.('❌') &&
      !args[0]?.includes?.('ECONNREFUSED')) {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  // Suppress security warnings in test environment
  if (!args[0]?.includes?.('SECURITY WARN:') &&
      !args[0]?.includes?.('⚠️')) {
    originalConsoleWarn(...args);
  }
};

export default {};