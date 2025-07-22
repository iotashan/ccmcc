#!/bin/bash
# Minimal script to restart dev server - exits immediately to avoid Claude Code Bash tool hanging

echo "🔄 Restarting development server..."

# Kill existing processes
pkill -f "npm run dev.*ccmcc" 2>/dev/null
pkill -f "ccmcc/node_modules/.bin/vite" 2>/dev/null
pkill -f "ccmcc/server/index.js" 2>/dev/null
pkill -f "ccmcc/node_modules/.bin/concurrently" 2>/dev/null

# Start in background and exit immediately
cd /Users/shan/dev/iotashan/ccmcc
npm run dev > logs/dev-server.log 2>&1 &
echo "✅ Server starting in background"
echo "📋 Logs: logs/dev-server.log"
echo "🌐 Web UI: http://localhost:3021"
echo "🔌 API: http://localhost:3020"
exit 0