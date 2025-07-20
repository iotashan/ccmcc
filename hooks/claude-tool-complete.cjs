#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Parse environment variables
const {
  CCUI_HOOK_TOKEN,
  CCUI_MACHINE_ID,
  CCUI_SESSION_ID,
  CCUI_SERVER_URL = 'http://localhost:3001'
} = process.env;

// Read stdin
let inputData = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(inputData);
    
    // Extract tool information
    const toolName = data.tool_name || 'unknown';
    const toolOutput = data.tool_output || {};
    const success = !data.error && !toolOutput.error;
    
    // Extract relevant information
    const payload = {
      event: 'tool_complete',
      machineId: CCUI_MACHINE_ID,
      projectPath: data.cwd || process.cwd(),
      sessionId: CCUI_SESSION_ID || data.sessionId,
      metadata: {
        toolName,
        success,
        error: data.error || toolOutput.error,
        outputSize: JSON.stringify(toolOutput).length,
        timestamp: new Date().toISOString()
      }
    };
    
    // Send to server
    sendToServer(payload);
  } catch (err) {
    console.error('claude-tool-complete hook error:', err);
    process.exit(0); // Exit cleanly to not block Claude
  }
});

function sendToServer(payload) {
  const url = new URL(CCUI_SERVER_URL);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: '/api/hooks/session',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CCUI_HOOK_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(payload))
    },
    // Short timeout to not block Claude
    timeout: 2000
  };
  
  const req = httpModule.request(options, (res) => {
    // We don't need to process the response
    res.on('data', () => {});
    res.on('end', () => process.exit(0));
  });
  
  req.on('error', (err) => {
    console.error('Failed to send tool complete:', err.message);
    process.exit(0);
  });
  
  req.on('timeout', () => {
    req.destroy();
    process.exit(0);
  });
  
  req.write(JSON.stringify(payload));
  req.end();
}