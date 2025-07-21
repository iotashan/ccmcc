/**
 * Manual test runner for Git utilities
 * Run with: node shared/utils/__tests__/git.test.manual.js
 */

import {
  getCurrentBranch,
  validateGitRepository,
  safeGitCommand,
  gitErrorHandler,
  isEmptyRepository,
  getRemoteInfo,
  parseGitStatus
} from '../git.js';
import { promises as fs } from 'fs';
import assert from 'assert';

const testResults = [];

function test(name, fn) {
  return fn()
    .then(() => {
      testResults.push({ name, passed: true });
      console.log(`✓ ${name}`);
    })
    .catch(error => {
      testResults.push({ name, passed: false, error });
      console.log(`✗ ${name}`);
      console.error(`  ${error.message}`);
    });
}

async function runTests() {
  console.log('Running Git Utilities Tests...\n');

  // Test getCurrentBranch with mocked execAsync
  await test('getCurrentBranch should return branch name', async () => {
    const mockExec = async (cmd, opts) => {
      if (cmd === 'git branch --show-current') {
        return { stdout: 'main\n' };
      }
      throw new Error('Unexpected command');
    };
    
    const result = await getCurrentBranch('/tmp', mockExec);
    assert.strictEqual(result, 'main');
  });

  await test('getCurrentBranch should handle empty repository', async () => {
    const mockExec = async (cmd, opts) => {
      if (cmd === 'git branch --show-current') {
        return { stdout: '' };
      }
      throw new Error('Unexpected command');
    };
    
    const result = await getCurrentBranch('/tmp', mockExec);
    assert.strictEqual(result, 'main');
  });

  // Test parseGitStatus
  await test('parseGitStatus should parse status correctly', async () => {
    const statusOutput = `M  file1.js
?? file2.js
A  file3.js
D  file4.js`;
    
    const result = parseGitStatus(statusOutput);
    assert.deepStrictEqual(result, {
      modified: ['file1.js'],
      added: ['file3.js'],
      deleted: ['file4.js'],
      untracked: ['file2.js']
    });
  });

  // Test gitErrorHandler
  await test('gitErrorHandler should handle common errors', async () => {
    const notRepoError = new Error('fatal: not a git repository');
    const result1 = gitErrorHandler(notRepoError);
    assert.strictEqual(result1.error, 'Not a git repository');
    
    const networkError = new Error('Could not resolve hostname');
    const result2 = gitErrorHandler(networkError);
    assert.strictEqual(result2.error, 'Network error');
  });

  // Test isEmptyRepository
  await test('isEmptyRepository should detect empty repo', async () => {
    const mockExecEmpty = async (cmd, opts) => {
      throw new Error('fatal: ambiguous argument \'HEAD\'');
    };
    
    const isEmpty = await isEmptyRepository('/tmp', mockExecEmpty);
    assert.strictEqual(isEmpty, true);
  });

  await test('isEmptyRepository should detect non-empty repo', async () => {
    const mockExecNonEmpty = async (cmd, opts) => {
      return { stdout: 'abc123' };
    };
    
    const isEmpty = await isEmptyRepository('/tmp', mockExecNonEmpty);
    assert.strictEqual(isEmpty, false);
  });

  // Test getRemoteInfo
  await test('getRemoteInfo should parse upstream info', async () => {
    const mockExec = async (cmd, opts) => {
      if (cmd.includes('@{upstream}')) {
        return { stdout: 'origin/main\n' };
      }
      throw new Error('Unexpected command');
    };
    
    const result = await getRemoteInfo('/tmp', 'main', mockExec);
    assert.deepStrictEqual(result, {
      hasRemote: true,
      hasUpstream: true,
      remoteName: 'origin',
      trackingBranch: 'origin/main'
    });
  });

  // Summary
  console.log('\n--- Test Summary ---');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Total: ${testResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`- ${r.name}: ${r.error.message}`);
    });
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);