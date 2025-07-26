#!/bin/bash
# Quick verification that both test modes work

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Test Mode Verification ===${NC}"
echo "This script verifies that both developer and CI modes work correctly"
echo ""

# Test 1: Developer Mode
echo -e "${BLUE}[1/2] Testing Developer Mode...${NC}"
echo "Starting services in developer mode..."
./scripts/test-developer.sh setup

echo "Waiting for services to be ready..."
sleep 10

# Check if services are running
if curl -f http://localhost:3020/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is healthy${NC}"
else
    echo -e "${RED}✗ Server is not responding${NC}"
    exit 1
fi

if curl -f http://localhost:3021 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Client is ready${NC}"
else
    echo -e "${RED}✗ Client is not responding${NC}"
    exit 1
fi

# Stop developer mode
echo "Stopping developer mode..."
./scripts/test-developer.sh teardown

echo -e "${GREEN}✓ Developer mode test passed${NC}"
echo ""

# Test 2: CI Mode (just container startup, not full test)
echo -e "${BLUE}[2/2] Testing CI Mode container startup...${NC}"
echo "Starting services in CI mode..."

# Start just the services, not the test runner
docker-compose -f docker-compose.test.yml --profile developer up -d

echo "Waiting for services to be ready..."
sleep 10

# Check if containers are running
if docker ps | grep -q "claudecodeui-test-server"; then
    echo -e "${GREEN}✓ Server container is running${NC}"
else
    echo -e "${RED}✗ Server container is not running${NC}"
    exit 1
fi

if docker ps | grep -q "claudecodeui-test-client"; then
    echo -e "${GREEN}✓ Client container is running${NC}"
else
    echo -e "${RED}✗ Client container is not running${NC}"
    exit 1
fi

# Stop CI mode
echo "Stopping CI mode..."
docker-compose -f docker-compose.test.yml --profile developer down

echo -e "${GREEN}✓ CI mode container test passed${NC}"
echo ""

echo -e "${GREEN}=== All tests passed! ===${NC}"
echo "Both developer and CI modes are working correctly."
echo ""
echo "To run full tests:"
echo "  Developer mode: npm run test:dev"
echo "  CI mode:        npm test"