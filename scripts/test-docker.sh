#!/bin/bash
# Script to test the Docker testing pipeline

set -e

echo "🚀 Starting Docker test pipeline..."

# Set up environment
if [ ! -f .env.test ]; then
    echo "📝 Creating .env.test from example..."
    cp .env.test.example .env.test
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true

# Build images
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.test.yml build

# Run tests
echo "🧪 Running tests..."
docker-compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from test-runner test-runner

# Capture exit code
TEST_EXIT_CODE=$?

# Clean up
echo "🧹 Cleaning up..."
docker-compose -f docker-compose.test.yml down -v

# Exit with test exit code
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Tests passed!"
else
    echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE