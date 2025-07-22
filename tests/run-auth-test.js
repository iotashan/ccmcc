#!/usr/bin/env node
// Wrapper to ensure environment is set before running auth tests

// Set environment variables FIRST
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.MOCK_CLAUDE_API = 'true';
process.env.PORT = '0';

console.log('Environment set with JWT_SECRET:', process.env.JWT_SECRET);

// Now run the test
import { spawn } from 'child_process';

const args = [
  '--experimental-vm-modules',
  './node_modules/.bin/jest',
  '--config=tests/config/jest.config.mjs',
  'tests/unit/server/auth.test.js',
  '--runInBand',
  '--verbose'
];

const child = spawn('node', args, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code);
});