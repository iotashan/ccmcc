#!/bin/bash
# scripts/test-developer.sh
# Run Playwright tests in developer mode with headed browser

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
COMMAND=${1:-"run"}
TEST_PATTERN=${2:-""}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[Developer Mode]${NC} $1"
}

print_error() {
    echo -e "${RED}[Error]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[Success]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[Warning]${NC} $1"
}

# Function to check if services are healthy
check_services() {
    print_status "Checking if services are healthy..."
    
    # Check server
    if curl -f http://localhost:3020/health > /dev/null 2>&1; then
        print_success "Server is healthy"
    else
        print_error "Server is not responding on port 3020"
        return 1
    fi
    
    # Check if initialization completed
    print_status "Waiting for server initialization to complete..."
    for i in {1..30}; do
        if docker-compose -f docker-compose.test.yml logs server-init 2>/dev/null | grep -q "Server initialization complete"; then
            print_success "Server initialization complete"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Server initialization failed to complete"
            return 1
        fi
        echo -n "."
        sleep 2
    done
    
    # Now check if client is ready (give it some time to start with auth)
    print_status "Waiting for client to be ready..."
    for i in {1..30}; do
        if curl -f http://localhost:3021 > /dev/null 2>&1; then
            print_success "Client is ready"
            return 0
        fi
        if [ $i -eq 30 ]; then
            print_warning "Client may not be fully ready, but continuing..."
            return 0
        fi
        sleep 1
    done
    
    return 0
}

# Function to setup developer environment
setup() {
    print_status "Setting up developer mode environment..."
    
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

    # Phase 3: Set up Docker environment for E2E tests
    print_status "Phase 3/3: Setting up Docker environment for E2E tests..."
    
    # Stop any existing containers first (to be safe)
    print_status "Stopping any existing test containers..."
    docker-compose -f docker-compose.test.yml --profile developer down 2>/dev/null || true
    docker-compose -f docker-compose.test.yml --profile ci down 2>/dev/null || true
    
    # Create test results directory
    mkdir -p test-results/{artifacts,playwright-report,screenshots,videos,traces}
    
    # Check if Playwright is installed locally
    if ! npx playwright --version > /dev/null 2>&1; then
        print_warning "Playwright not found locally. Installing..."
        npm install -D @playwright/test
        npx playwright install chromium firefox
    fi
    
    # Start Docker services in developer profile
    print_status "Starting Docker services..."
    docker-compose -f docker-compose.test.yml --profile developer up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 5
    
    # Retry health check up to 30 seconds
    for i in {1..30}; do
        if check_services; then
            print_success "All services are ready!"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Services failed to start after 30 seconds"
            exit 1
        fi
        sleep 1
    done
}

# Function to run tests
run_tests() {
    print_status "Running Playwright tests in developer mode..."
    
    # Export environment variables
    export DEVELOPER_MODE=true
    export DEVELOPER_PAUSE_DURATION=${DEVELOPER_PAUSE_DURATION:-20}
    export SERVER_URL=http://localhost:3020
    export CLIENT_URL=http://localhost:3021
    export CI=false
    
    # Log the mode
    echo ""
    echo "========================================"
    echo "🧪 DEVELOPER MODE E2E TESTS"
    echo "   - Pipeline: Unit → Integration → E2E"
    echo "   - Headed browser: Yes"
    echo "   - Pause duration: ${DEVELOPER_PAUSE_DURATION}s"
    echo "   - Server URL: ${SERVER_URL}"
    echo "   - Client URL: ${CLIENT_URL}"
    echo "========================================"
    echo ""
    
    # Run tests
    if [ -n "$TEST_PATTERN" ]; then
        print_status "Running tests matching pattern: $TEST_PATTERN"
        npx playwright test --config=tests/config/playwright.config.js --grep "$TEST_PATTERN"
    else
        print_status "Running full e2e test suite..."
        npx playwright test --config=tests/config/playwright.config.js tests/e2e/specs/
    fi
}

# Function to teardown environment
teardown() {
    print_status "Tearing down developer environment..."
    
    # Stop Docker services
    docker-compose -f docker-compose.test.yml --profile developer down
    
    print_success "Developer environment stopped"
}

# Main script logic
case "$COMMAND" in
    "setup")
        setup
        ;;
    "run")
        # Check if CI containers are running and stop them
        if docker ps -a | grep -q "claudecodeui-test-runner"; then
            print_warning "CI containers detected, stopping them first..."
            docker-compose -f docker-compose.test.yml --profile ci down 2>/dev/null || true
        fi
        
        if ! check_services > /dev/null 2>&1; then
            print_warning "Services not running, starting them first..."
            setup
        fi
        run_tests
        ;;
    "teardown")
        teardown
        ;;
    "full")
        setup
        run_tests
        teardown
        ;;
    *)
        echo "Usage: $0 {setup|run|teardown|full} [test-pattern]"
        echo ""
        echo "Commands:"
        echo "  setup     - Start Docker services in developer mode"
        echo "  run       - Run tests (starts services if needed)"
        echo "  teardown  - Stop Docker services"
        echo "  full      - Run complete cycle: setup, test, teardown"
        echo ""
        echo "Examples:"
        echo "  $0 run                    # Run all tests"
        echo "  $0 run 'auth.*login'      # Run tests matching pattern"
        echo "  $0 full                   # Complete test cycle"
        exit 1
        ;;
esac