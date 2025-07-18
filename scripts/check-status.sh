#!/bin/bash
# Script to check status of all Claude Code UI components

echo "📊 Claude Code UI Status Check"
echo "=============================="

# Check Vite dev server
echo -n "🌐 Web UI (Vite): "
if pgrep -f "claudecodeui/node_modules/.bin/vite" > /dev/null; then
    echo "✅ Running on http://localhost:3021"
else
    echo "❌ Not running"
fi

# Check API server
echo -n "🔌 API Server: "
if pgrep -f "claudecodeui/server/index.js" > /dev/null; then
    echo "✅ Running on http://localhost:3020"
else
    echo "❌ Not running"
fi

# Check client
echo -n "💻 Client: "
if pgrep -f "claudecodeui/client/src/index.js" > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

# Check if API is responding
echo -n "🔍 API Health: "
if curl -s http://localhost:3020/api/health > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Check if Web UI is responding
echo -n "🔍 Web UI Health: "
if curl -s http://localhost:3021/ > /dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

echo ""
echo "📋 Log files:"
echo "  - Dev server: logs/dev-server.log"
echo "  - Client: logs/client.log"

# Exit with error if any component is not running
if ! pgrep -f "vite.*claudecodeui" > /dev/null || ! pgrep -f "claudecodeui/server/index.js" > /dev/null; then
    exit 1
else
    exit 0
fi