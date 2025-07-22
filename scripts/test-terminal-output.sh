#!/bin/bash
# Script to test terminal output rendering locally

set -e

echo "🧪 Running terminal output rendering tests..."

# Run just the terminal output rendering test
cd /Users/shan/dev/iotashan/claudecodeui

# Run the specific test file
npx playwright test tests/e2e/specs/terminal-output-rendering.spec.js --headed --project=chromium

echo "✅ Terminal output rendering test completed!"