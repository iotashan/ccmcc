import ClaudeHooksManager from '../src/utils/claudeHooks.js';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testHookInjection() {
  const hooksManager = new ClaudeHooksManager();
  const testProjectPath = path.join(__dirname, 'test-project');
  
  console.log('=== Testing Claude Hooks Injection ===\n');

  try {
    // Create test project directory
    await fs.mkdir(testProjectPath, { recursive: true });
    console.log('✓ Created test project directory');

    // Test 1: Inject hooks into empty project
    console.log('\nTest 1: Injecting hooks into empty project...');
    const result1 = await hooksManager.injectHooks(
      testProjectPath,
      'test-machine-123',
      'test-session-456',
      'http://localhost:3001'
    );
    console.log('✓ Hooks injected successfully');
    console.log('  Token:', result1.token);

    // Verify settings file was created
    const settings1 = await hooksManager.readSettings(testProjectPath);
    console.log('✓ Settings file created with', Object.keys(settings1.hooks).length, 'hook types');

    // Test 2: Inject hooks with existing settings
    console.log('\nTest 2: Testing with existing settings...');
    
    // Create existing settings
    const existingSettings = {
      someOtherConfig: 'value',
      hooks: {
        CustomHook: [{
          matcher: ".*",
          hooks: [{ type: "command", command: "echo 'custom'" }]
        }]
      }
    };
    await hooksManager.writeSettings(testProjectPath, existingSettings);
    
    // Inject our hooks
    const result2 = await hooksManager.injectHooks(
      testProjectPath,
      'test-machine-789',
      'test-session-101',
      'http://localhost:3001'
    );
    console.log('✓ Hooks injected with existing settings');

    // Verify backup was created
    const backupExists = await fs.access(
      hooksManager.getBackupPath(testProjectPath)
    ).then(() => true).catch(() => false);
    console.log('✓ Backup file created:', backupExists);

    // Test 3: Remove hooks and restore
    console.log('\nTest 3: Removing hooks and restoring...');
    const restored = await hooksManager.removeHooks(testProjectPath);
    console.log('✓ Hooks removed, settings restored:', restored);

    // Verify original settings were restored
    const restoredSettings = await hooksManager.readSettings(testProjectPath);
    console.log('✓ Original settings restored:', 
      restoredSettings.someOtherConfig === 'value' ? 'Yes' : 'No'
    );

    // Test 4: Hook configuration generation
    console.log('\nTest 4: Testing hook configuration...');
    const { hookConfig, token } = hooksManager.generateHookConfig(
      'machine-abc',
      'session-xyz'
    );
    
    console.log('✓ Generated configuration for', Object.keys(hookConfig.hooks).length, 'hooks:');
    Object.keys(hookConfig.hooks).forEach(hookType => {
      console.log('  -', hookType);
    });

    // Clean up
    await fs.rm(testProjectPath, { recursive: true, force: true });
    console.log('\n✓ Test cleanup complete');

    console.log('\n=== All tests passed! ===');

  } catch (err) {
    console.error('\n✗ Test failed:', err);
    // Clean up on error
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {}
    process.exit(1);
  }
}

// Run tests
testHookInjection();