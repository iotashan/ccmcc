#!/bin/bash
# Minimal script to restart client - exits immediately to avoid Claude Code Bash tool hanging

echo "🔄 Restarting Claude client..."

# Kill existing processes
pkill -f "ccmcc/client/src/index.js" 2>/dev/null
pkill -f "npm start.*ccmcc/client" 2>/dev/null

# Start in background and exit immediately
cd /Users/shan/dev/iotashan/ccmcc/client
npm start > ../logs/client.log 2>&1 &
echo "✅ Client starting in background"
echo "📋 Logs: logs/client.log"
exit 0