#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  fs.readFileSync(join(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

program
  .name('claude-ui-client')
  .description('Machine client for Claude Code UI multi-machine support')
  .version(packageJson.version)
  .option('-s, --server <address>', 'Claude Code UI server address (default: ws://localhost:3000)')
  .option('-n, --name <name>', 'Machine name (default: IP address)')
  .option('-t, --token <token>', 'Authentication token for reconnection')
  .option('-d, --debug', 'Enable debug logging')
  .action((options) => {
    // Convert options to argv format for index.js
    const args = [];
    
    if (options.server) {
      args.push('--server', options.server);
    }
    if (options.name) {
      args.push('--name', options.name);
    }
    if (options.token) {
      args.push('--token', options.token);
    }
    if (options.debug) {
      args.push('--debug');
    }
    
    // Set process.argv for the main script
    process.argv = ['node', 'index.js', ...args];
    
    // Run the main script
    import('./index.js');
  });

program.parse();