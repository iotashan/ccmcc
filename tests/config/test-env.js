// test-env.js - Set environment variables before any module imports
// This file MUST be imported before any other modules in tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.MOCK_CLAUDE_API = 'true';
process.env.PORT = '0'; // Use random port for tests

// Suppress experimental warnings
process.env.NODE_NO_WARNINGS = '1';