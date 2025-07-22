# Claude Code UI Test Suite

This directory contains the comprehensive test suite for Claude Code UI, including unit tests, integration tests, and end-to-end tests.

## Test Structure

```
tests/
├── config/              # Test configuration files
│   ├── jest.config.mjs  # Jest configuration
│   ├── jest.setup.js    # Test setup and utilities
│   ├── test-env.js      # Environment setup
│   └── playwright.config.js # Playwright E2E config
├── unit/               # Unit tests
│   ├── server/         # Server-side unit tests
│   │   ├── auth.test.js
│   │   ├── api.test.js
│   │   └── websocket.test.js
│   └── client/         # Client-side unit tests
│       ├── handlers.test.js
│       └── connection.test.js
├── integration/        # Integration tests
│   ├── server-client.test.js
│   ├── auth-flow.test.js
│   └── git-operations.test.js
├── e2e/               # End-to-end tests
│   ├── specs/
│   │   ├── new-user.spec.js
│   │   ├── developer-flow.spec.js
│   │   └── multi-machine.spec.js
│   └── pages/         # Page objects
│       ├── login.page.js
│       ├── dashboard.page.js
│       └── chat.page.js
└── utils/             # Test utilities
    └── test-helpers.js
```

## Running Tests

### Local Development

1. **Setup environment:**
   ```bash
   cp .env.test.example .env.test
   # Edit .env.test with your test configuration
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run all tests:**
   ```bash
   npm run test:all
   ```

4. **Run specific test suites:**
   ```bash
   # Unit tests only
   npm run test:unit

   # Integration tests only
   npm run test:integration

   # E2E tests only
   npm run test:e2e

   # Specific test file
   NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/server/auth.test.js
   ```

### Docker Testing

The project includes a comprehensive Docker-based testing pipeline:

1. **Build test images:**
   ```bash
   docker build -f Dockerfile.test --target test-runner -t claudecodeui-test:latest .
   ```

2. **Run tests in Docker:**
   ```bash
   # Using the test script
   ./scripts/test-docker.sh

   # Or manually with docker-compose
   docker-compose -f docker-compose.test.yml up test-runner
   ```

3. **Run specific tests in Docker:**
   ```bash
   docker run --rm \
     -e NODE_ENV=test \
     -e JWT_SECRET=test-jwt-secret-for-testing-only \
     -v $(pwd)/tests:/app/tests:ro \
     claudecodeui-test:latest \
     bash -c "NODE_OPTIONS='--experimental-vm-modules' npx jest --config=tests/config/jest.config.mjs tests/unit/server/auth.test.js"
   ```

## Test Configuration

### Environment Variables

Key environment variables for testing (see `.env.test.example`):

- `NODE_ENV=test` - Sets test environment
- `JWT_SECRET` - Secret for JWT token generation
- `DATABASE_URL=sqlite::memory:` - Uses in-memory database for tests
- `MOCK_CLAUDE_API=true` - Mocks Claude API calls
- `ENABLE_TEST_MODE=true` - Enables test-specific features

### Jest Configuration

The test suite uses Jest with the following key configurations:

- **Test Environment:** Node with experimental VM modules
- **Coverage:** Enabled by default, reports to `coverage/` directory
- **Timeouts:** 30 seconds default, can be overridden
- **Database:** In-memory SQLite for test isolation

## Writing Tests

### Unit Tests

Unit tests focus on individual components in isolation:

```javascript
import { describe, test, expect } from '@jest/globals';

describe('Component', () => {
  test('should behave correctly', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Integration tests verify component interactions:

```javascript
describe('Integration: Auth Flow', () => {
  test('should complete login flow', async () => {
    // Test multiple components working together
  });
});
```

### E2E Tests

E2E tests use Playwright to test the full application:

```javascript
import { test, expect } from '@playwright/test';

test('user can complete task', async ({ page }) => {
  await page.goto('/');
  // Full user flow
});
```

## Test Utilities

The test suite provides several utilities in `jest.setup.js`:

- `testUtils.createTestUser()` - Creates a test user with unique credentials
- `testUtils.createTestApiToken()` - Creates an API token for testing
- `testUtils.createMockRequest()` - Creates mock Express request
- `testUtils.createMockResponse()` - Creates mock Express response
- `testUtils.createMockWebSocket()` - Creates mock WebSocket connection

## Known Issues

1. **WebSocket Tests**: Some WebSocket tests may fail when running the full suite due to timing issues. The core authentication and API tests are stable.

2. **Database Cleanup**: Occasionally, database cleanup between tests may show errors in the console. These can be safely ignored as each test creates its own data.

3. **Docker Build**: Ensure Docker has sufficient resources allocated, especially for running Playwright tests.

## CI/CD Integration

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: |
    docker-compose -f docker-compose.test.yml up \
      --abort-on-container-exit \
      --exit-code-from test-runner
```

## Debugging Tests

1. **Run tests with verbose output:**
   ```bash
   npm run test:unit -- --verbose
   ```

2. **Debug specific test:**
   ```bash
   node --inspect-brk node_modules/.bin/jest tests/unit/server/auth.test.js
   ```

3. **Check test logs in Docker:**
   ```bash
   docker-compose -f docker-compose.test.yml logs test-runner
   ```

## Coverage Reports

Test coverage reports are generated in the `coverage/` directory:

```bash
# Generate coverage report
npm run test:unit -- --coverage

# View HTML report
open coverage/lcov-report/index.html
```

## Contributing

When adding new tests:

1. Place unit tests in the appropriate `unit/` subdirectory
2. Use the test utilities for common operations
3. Ensure tests are isolated and don't depend on external state
4. Add appropriate test data fixtures if needed
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure you're using `NODE_OPTIONS='--experimental-vm-modules'`
2. **Database locked errors**: Tests may be running in parallel, use `--runInBand` for sequential execution
3. **Port conflicts**: Ensure ports 3020-3024 are available for testing

### Getting Help

If you encounter issues:

1. Check the error logs carefully
2. Run tests individually to isolate problems
3. Ensure all dependencies are installed
4. Verify environment variables are set correctly