#!/bin/bash
# Script to stop all Claude Code UI processes

echo "🛑 Stopping all Claude Code UI processes..."

# Kill dev server processes specific to this project
echo "📍 Stopping dev server..."
# First kill the parent npm process
pkill -f "npm run dev.*claudecodeui" 2>/dev/null
# Kill concurrently (which manages both server and client)
pkill -f "claudecodeui/node_modules/.bin/concurrently" 2>/dev/null
# Kill vite dev server
pkill -f "claudecodeui/node_modules/.bin/vite" 2>/dev/null
# Kill the API server
pkill -f "claudecodeui/server/index.js" 2>/dev/null
# Kill esbuild (vite's dependency)
pkill -f "claudecodeui/node_modules/@esbuild" 2>/dev/null

# Kill client processes specific to this project
echo "📍 Stopping client..."
pkill -f "claudecodeui/client/src/index.js" 2>/dev/null
pkill -f "npm start.*claudecodeui/client" 2>/dev/null

sleep 2

# Check if any processes are still running
if pgrep -f "claudecodeui" > /dev/null; then
    echo "⚠️  Some processes may still be running:"
    ps aux | grep claudecodeui | grep -v grep
    exit 1
else
    echo "✅ All processes stopped successfully"
    exit 0
fi