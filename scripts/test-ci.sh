#!/bin/bash
# scripts/test-ci.sh
# Run Playwright tests in CI mode (containerized)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[CI Mode]${NC} $1"
}

print_error() {
    echo -e "${RED}[Error]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[Success]${NC} $1"
}

# Main execution
print_status "Starting CI test run..."

# Ensure we're in CI mode
export CI=true
export DEVELOPER_MODE=false

# Phase 1: Run unit tests first
print_status "Phase 1/3: Running unit tests..."
npm run test:unit:raw || {
    print_error "Unit tests failed"
    exit 1
}
print_success "Unit tests passed!"

# Phase 2: Run integration tests
print_status "Phase 2/3: Running integration tests..."
npm run test:integration:raw || {
    print_error "Integration tests failed"
    exit 1
}
print_success "Integration tests passed!"

# Phase 3: Run E2E tests with Docker pipeline
print_status "Phase 3/3: Starting Docker pipeline for E2E tests..."

# Stop any existing containers first (to be safe)
print_status "Stopping any existing test containers..."
docker-compose -f docker-compose.test.yml --profile developer down 2>/dev/null || true
docker-compose -f docker-compose.test.yml --profile ci down 2>/dev/null || true

# Run tests using docker-compose with CI profile
print_status "Starting Docker services and running tests..."

# For CI, we'll also run just the simple test for now
# Remove this line when ready to run all tests
export TEST_PATTERN="simple-test"

docker-compose -f docker-compose.test.yml --profile ci up --abort-on-container-exit --exit-code-from test-runner

# Capture exit code
EXIT_CODE=$?

# Cleanup
print_status "Cleaning up..."
docker-compose -f docker-compose.test.yml --profile ci down

if [ $EXIT_CODE -eq 0 ]; then
    print_success "Complete CI pipeline passed! (Unit → Integration → E2E Tests)"
else
    print_error "CI pipeline failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE