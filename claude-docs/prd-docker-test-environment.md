# PRD: Docker-Based Isolated Test Environment for Claude Code UI

## Executive Summary

This document outlines the design and implementation of a comprehensive Docker-based testing environment for Claude Code UI. The system provides complete isolation for testing all features without affecting real data or systems, enabling reliable automated testing in CI/CD pipelines.

### Goals
- 100% isolated testing environment using Docker
- Complete feature coverage across all three tiers (Web UI, Server, Client)
- Reproducible and deterministic test execution
- Fast execution time (<10 minutes for full suite)
- Zero external dependencies during test runs

## Architecture Overview

### Docker Compose Services

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network: test-net                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Server    │   │   Client    │   │ Test Runner │     │
│  │  Port 3020  │◄──│  Connected  │   │ Playwright  │     │
│  │  JWT Auth   │   │  to Server  │   │ Jest Tests  │     │
│  └─────────────┘   └─────────────┘   └─────────────┘     │
│         ▲                                     │            │
│         └─────────────────────────────────────┘            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Shared Volume: /test-data               │  │
│  │  • project-nodejs/    • project-python/             │  │
│  │  • project-mixed/     • empty-project/              │  │
│  │  • .claude-sessions/  • test-credentials/           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Base Image Stack
- **Base**: Node.js 20 Alpine
- **Additional Tools**:
  - Git (with config for test commits)
  - Python 3.11 (for mixed projects)
  - Playwright browsers (Chromium, Firefox)
  - Claude Code CLI

## Test Data Specifications

### OSS Project Selection

We clone real open-source projects to ensure realistic testing scenarios:

#### 1. project-nodejs (express-validator)
- **Repository**: https://github.com/express-validator/express-validator
- **Clone Command**: `git clone --depth 50 https://github.com/express-validator/express-validator.git project-nodejs`
- **Characteristics**: 
  - Pure Node.js/TypeScript
  - Well-structured with tests
  - Active development history
  - Multiple branches and tags
- **Purpose**: Test JavaScript/TypeScript operations, npm workflows

#### 2. project-python (python-dotenv)
- **Repository**: https://github.com/theskumar/python-dotenv
- **Clone Command**: `git clone --depth 50 https://github.com/theskumar/python-dotenv.git project-python`
- **Characteristics**:
  - Clean Python codebase
  - Good test coverage
  - Multiple releases/tags
  - Simple enough for quick operations
- **Purpose**: Test Python-specific features, pip workflows

#### 3. project-mixed (json-server)
- **Repository**: https://github.com/typicode/json-server
- **Clone Command**: `git clone --depth 50 https://github.com/typicode/json-server.git project-mixed`
- **Characteristics**:
  - Node.js backend with frontend examples
  - Multiple file types (JS, JSON, HTML)
  - Good branch structure
  - Includes documentation
- **Purpose**: Test cross-language functionality, mixed content

#### 4. empty-project (New Project Testing)
```
empty-project/
└── .gitkeep
```
- **Purpose**: Test project initialization workflows

### Test Data Generation Script
```bash
#!/bin/bash
# scripts/generate-test-data.sh

# Clone OSS projects with specific commits for reproducibility
echo "Cloning test projects..."

# Node.js project
git clone --depth 50 https://github.com/express-validator/express-validator.git project-nodejs
cd project-nodejs && git checkout v7.0.1 && cd ..

# Python project  
git clone --depth 50 https://github.com/theskumar/python-dotenv.git project-python
cd project-python && git checkout v1.0.0 && cd ..

# Mixed project
git clone --depth 50 https://github.com/typicode/json-server.git project-mixed
cd project-mixed && git checkout v0.17.4 && cd ..

# Create empty project
mkdir -p empty-project
touch empty-project/.gitkeep

# Initialize git in empty project
cd empty-project
git init
git add .gitkeep
git commit -m "Initial commit"
cd ..

echo "Test projects ready!"
```

### Claude Code CLI Session Data

Based on research, Claude Code stores sessions in the following structure:

```
.claude/
├── projects/
│   └── [encoded-directory-paths]/
│       ├── [session-uuid].jsonl    # Full conversation history
│       └── [summary-uuid].jsonl    # Conversation summaries
├── settings.json                   # Project-specific settings
├── commands/                       # Custom slash commands
│   ├── fix-bug.md
│   └── refactor.md
└── CLAUDE.md                      # Project context

~/.claude/
├── settings.json                   # Global user preferences
├── .credentials.json              # Authentication (DO NOT INCLUDE IN TESTS)
└── projects/                      # Global project cache
```

#### Test Session Generation

Create realistic session files for testing:

```bash
#!/bin/bash
# scripts/setup-claude-sessions.sh

# Create .claude directory structure
mkdir -p /test-data/.claude/projects/express-validator
mkdir -p /test-data/.claude/projects/python-dotenv
mkdir -p /test-data/.claude/projects/json-server
mkdir -p /test-data/.claude/commands

# Create sample session files (JSONL format)
cat > /test-data/.claude/projects/express-validator/session-001.jsonl << 'EOF'
{"type":"user","content":"Help me add input validation for email fields"}
{"type":"assistant","content":"I'll help you add email validation using express-validator..."}
{"type":"tool_use","name":"Read","parameters":{"file_path":"src/validators/index.js"}}
{"type":"tool_result","content":"// file contents here"}
{"type":"assistant","content":"Let me create an email validator..."}
EOF

# Create project settings
cat > /test-data/.claude/settings.json << 'EOF'
{
  "theme": "dark",
  "editor": "vscode",
  "autoSave": true,
  "testMode": true
}
EOF

# Create custom commands
cat > /test-data/.claude/commands/test-command.md << 'EOF'
You are helping with test automation. Focus on:
- Writing comprehensive tests
- Following existing patterns
- Using page objects for UI tests
EOF
```

Each session includes:
- Conversation history (JSONL format)
- Tool usage logs
- File modifications
- Assistant responses
- Project context

### Authentication Data
```
test-credentials/
├── .env.test
├── .env.test.example
├── api-tokens.json
└── jwt-keys/
```

### Environment Configuration (.env.test.example)
```bash
# JWT Configuration
JWT_SECRET=your-test-jwt-secret-here
JWT_EXPIRES_IN=1h

# API Authentication
CLIENT_API_TOKEN=your-test-api-token-here
CLAUDE_API_KEY=your-claude-api-key-here

# Test User Credentials
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=testpass123
TEST_USER_USERNAME=testuser

# Database Configuration
DATABASE_URL=sqlite:///data/test.db
DATABASE_LOG=false

# Server Configuration
SERVER_PORT=3020
SERVER_HOST=0.0.0.0
CLIENT_PORT=3021

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Test Mode
ENABLE_TEST_MODE=true
MOCK_CLAUDE_API=true
TEST_TIMEOUT=30000

# Optional: Mock responses for offline testing
MOCK_CLAUDE_RESPONSES_PATH=/test-data/mock-responses.json
```

## Test Coverage Matrix

### Unit Tests (Jest)

| Component | Coverage Areas |
|-----------|---------------|
| Server Auth | JWT validation, token refresh, permissions |
| API Endpoints | All REST routes, error handling |
| WebSocket | Connection, message handling, reconnection |
| Database | CRUD operations, migrations |
| Client Handlers | Git, file, session management |

### Integration Tests

| Feature | Test Scenarios |
|---------|---------------|
| Server-Client | Connection establishment, message flow |
| Auth Flow | Login → Token → API calls → Logout |
| Git Operations | Status → Diff → Commit → Push |
| File Sync | Create → Edit → Delete → Search |

### E2E Tests (Playwright)

| Workflow | Steps |
|----------|-------|
| New User | Register → Login → Connect Machine → Create Project |
| Developer Flow | Open Project → Edit Files → Commit → View History |
| Collaboration | Switch Machines → Sync State → Resume Session |
| Error Handling | Network failure → Recovery → State consistency |

## Docker Configuration

### docker-compose.test.yml
```yaml
version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: server
    environment:
      - NODE_ENV=test
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=sqlite:///data/test.db
    volumes:
      - test-data:/test-data
      - ./server:/app/server
    ports:
      - "3020:3020"
    networks:
      - test-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3020/health"]
      interval: 5s
      timeout: 3s
      retries: 5

  client:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: client
    environment:
      - SERVER_URL=http://server:3020
      - API_TOKEN=${CLIENT_API_TOKEN}
    volumes:
      - test-data:/test-data
      - ./client:/app/client
    depends_on:
      server:
        condition: service_healthy
    networks:
      - test-net

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: test-runner
    environment:
      - SERVER_URL=http://server:3020
      - PLAYWRIGHT_BROWSERS_PATH=/browsers
    volumes:
      - test-data:/test-data
      - ./tests:/app/tests
      - test-results:/results
    depends_on:
      - server
      - client
    networks:
      - test-net
    command: npm run test:all

networks:
  test-net:
    driver: bridge

volumes:
  test-data:
  test-results:
```

### Dockerfile.test (Multi-stage)
```dockerfile
# Base stage with common dependencies
FROM node:20-alpine AS base
RUN apk add --no-cache git python3 py3-pip bash curl
RUN npm install -g claude-code-cli@latest

# Test data generation stage
FROM base AS test-data
WORKDIR /test-data
COPY scripts/generate-test-data.sh .
COPY scripts/setup-claude-sessions.sh .
COPY test-data/mock-responses.json .
RUN chmod +x generate-test-data.sh && ./generate-test-data.sh

# Server stage
FROM base AS server
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
COPY shared/ ./shared/
EXPOSE 3020
CMD ["npm", "run", "server"]

# Client stage
FROM base AS client
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY client/ ./client/
COPY shared/ ./shared/
CMD ["npm", "run", "client"]

# Test runner stage
FROM mcr.microsoft.com/playwright:v1.40.0-jammy AS test-runner
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx playwright install --with-deps
```

## Test Implementation

### Directory Structure
```
tests/
├── unit/
│   ├── server/
│   │   ├── auth.test.js
│   │   ├── api.test.js
│   │   └── websocket.test.js
│   └── client/
│       ├── handlers.test.js
│       └── connection.test.js
├── integration/
│   ├── server-client.test.js
│   ├── auth-flow.test.js
│   └── git-operations.test.js
├── e2e/
│   ├── fixtures/
│   │   ├── auth.fixture.js
│   │   └── test-data.fixture.js
│   ├── pages/
│   │   ├── login.page.js
│   │   ├── dashboard.page.js
│   │   └── chat.page.js
│   └── specs/
│       ├── new-user.spec.js
│       ├── developer-flow.spec.js
│       └── error-handling.spec.js
└── config/
    ├── jest.config.js
    └── playwright.config.js
```

### Test Utilities
```javascript
// tests/utils/test-helpers.js
export const testHelpers = {
  // Authentication helpers
  async loginTestUser(page) {
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  },

  // Git operation helpers
  async createTestCommit(projectPath, message) {
    const git = simpleGit(projectPath);
    await git.add('.');
    await git.commit(message);
  },

  // WebSocket helpers
  async waitForWebSocketMessage(page, type) {
    return page.waitForEvent('websocket.message', {
      predicate: msg => JSON.parse(msg).type === type
    });
  },

  // Screenshot helpers for both desktop and mobile
  async captureScreenshots(page, testName) {
    const timestamp = Date.now();
    
    // Desktop screenshot
    await page.screenshot({
      path: `test-results/screenshots/desktop-${testName}-${timestamp}.png`,
      fullPage: true
    });
    
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.screenshot({
      path: `test-results/screenshots/mobile-${testName}-${timestamp}.png`,
      fullPage: true
    });
    
    // Restore desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  }
};
```

### Playwright Configuration
```javascript
// tests/config/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../specs',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: 'http://localhost:3021',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
    
    // Mobile browsers
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        hasTouch: true
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        hasTouch: true
      },
    },
  ],

  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/report.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
});
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
      
    - name: Cache Docker layers
      uses: actions/cache@v3
      with:
        path: /tmp/.buildx-cache
        key: ${{ runner.os }}-buildx-${{ github.sha }}
        restore-keys: |
          ${{ runner.os }}-buildx-
    
    - name: Create .env.test
      run: |
        cp .env.test.example .env.test
        echo "JWT_SECRET=${{ secrets.TEST_JWT_SECRET }}" >> .env.test
        echo "CLIENT_API_TOKEN=${{ secrets.TEST_API_TOKEN }}" >> .env.test
        echo "CLAUDE_API_KEY=${{ secrets.TEST_CLAUDE_API_KEY }}" >> .env.test
    
    - name: Run Test Suite
      run: |
        docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
        
    - name: Upload Test Results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: test-results/
        
    - name: Upload Coverage
      uses: codecov/codecov-action@v3
      with:
        directory: ./test-results/coverage
```

## Setup Instructions

### Initial Setup
1. Clone the repository
2. Copy environment template:
   ```bash
   cp .env.test.example .env.test
   ```
3. Edit .env.test with your credentials (see .env.test.example for all options)

### Running Tests Locally
```bash
# Build and run all tests
docker-compose -f docker-compose.test.yml up --build

# Run specific test suites
docker-compose -f docker-compose.test.yml run test-runner npm run test:unit
docker-compose -f docker-compose.test.yml run test-runner npm run test:e2e

# Interactive debugging
docker-compose -f docker-compose.test.yml run test-runner npm run test:debug
```

### Maintenance Guidelines

#### Adding New Tests
1. Follow the existing directory structure
2. Use page objects for UI tests
3. Include test data in fixtures
4. Update the coverage matrix

#### Updating Test Data
1. Modify scripts in `scripts/generate-test-data.sh`
2. Rebuild the test-data stage
3. Verify changes don't break existing tests

#### Performance Optimization
- Use Docker layer caching
- Parallelize test execution where possible
- Minimize test data generation time
- Regular cleanup of test artifacts

#### Test Data Reset
```bash
# Clean all test data between runs
docker-compose -f docker-compose.test.yml down -v
docker volume prune -f

# Reset specific project
docker-compose -f docker-compose.test.yml exec test-runner rm -rf /test-data/project-nodejs/.git
docker-compose -f docker-compose.test.yml exec test-runner /scripts/generate-test-data.sh
```

#### Parallel Test Execution
```javascript
// jest.config.js
module.exports = {
  maxWorkers: '50%',  // Use 50% of available CPU cores
  testTimeout: 30000,
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/unit/server/**/*.test.js']
    },
    {
      displayName: 'client', 
      testMatch: ['<rootDir>/tests/unit/client/**/*.test.js']
    }
  ]
};
```

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature Coverage | 100% | Code coverage reports |
| Execution Time | <10 minutes | CI/CD pipeline duration |
| Test Reliability | Zero flakiness | Failure rate tracking |
| Maintenance Burden | <2 hours/month | Time tracking |

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Create Docker configuration files
- [ ] Set up basic docker-compose structure
- [ ] Implement health checks and networking
- [ ] Create .env.test template

### Phase 2: Test Data Generation (Week 1-2)
- [ ] Build test project structures
- [ ] Create git history generation scripts
- [ ] Set up Claude CLI mock sessions
- [ ] Generate authentication data

### Phase 3: Unit & Integration Tests (Week 2-3)
- [ ] Implement server unit tests
- [ ] Implement client unit tests
- [ ] Create integration test suite
- [ ] Set up test utilities and helpers

### Phase 4: E2E Test Suite (Week 3-4)
- [ ] Configure Playwright
- [ ] Create page objects
- [ ] Implement user workflow tests
- [ ] Add error handling scenarios

### Phase 5: CI/CD Integration (Week 4)
- [ ] Create GitHub Actions workflow
- [ ] Set up caching strategies
- [ ] Configure test reporting
- [ ] Add performance benchmarks

### Phase 6: Documentation & Training (Week 4-5)
- [ ] Complete setup documentation
- [ ] Create troubleshooting guide
- [ ] Record demo videos
- [ ] Conduct team training

### Phase 7: Multi-Machine Testing (Week 5-6)
- [ ] Create second Docker container for client machine
- [ ] Configure Docker networking between containers
- [ ] Implement multi-machine test scenarios
- [ ] Test machine switching and concurrent connections

#### Multi-Machine Docker Architecture
```yaml
# docker-compose.multi-machine.yml
version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: server
    networks:
      - test-net
    ports:
      - "3020:3020"

  client-machine-1:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: client
    environment:
      - MACHINE_NAME=machine-1
      - SERVER_URL=http://server:3020
      - API_TOKEN=${CLIENT_API_TOKEN_1}
    networks:
      - test-net
    volumes:
      - test-data-1:/test-data
    depends_on:
      server:
        condition: service_healthy

  client-machine-2:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: client
    environment:
      - MACHINE_NAME=machine-2
      - SERVER_URL=http://server:3020
      - API_TOKEN=${CLIENT_API_TOKEN_2}
    networks:
      - test-net
    volumes:
      - test-data-2:/test-data
    depends_on:
      server:
        condition: service_healthy

  test-runner:
    build:
      context: .
      dockerfile: Dockerfile.test
      target: test-runner
    environment:
      - SERVER_URL=http://server:3020
      - TEST_MULTI_MACHINE=true
    networks:
      - test-net
    depends_on:
      - server
      - client-machine-1
      - client-machine-2

networks:
  test-net:
    driver: bridge

volumes:
  test-data-1:
  test-data-2:
  test-results:
```

#### Multi-Machine Test Scenarios
- Machine status monitoring (online/offline)
- Switching between machines mid-session
- Concurrent operations on different machines
- Machine-specific MCP configurations
- Session synchronization across machines
- Conflict resolution between machines

## Appendix: Test Scenario Examples

### Authentication Test Flow
```javascript
describe('Authentication Flow', () => {
  test('Complete auth lifecycle', async ({ page }) => {
    // 1. Navigate to login
    await page.goto('/');
    
    // 2. Invalid credentials
    await page.fill('[data-testid="username"]', 'invalid');
    await page.fill('[data-testid="password"]', 'wrong');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('.error')).toContainText('Invalid credentials');
    
    // 3. Valid login
    await testHelpers.loginTestUser(page);
    
    // 4. Verify JWT token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    
    // 5. Test token refresh
    await page.waitForTimeout(TOKEN_EXPIRE_TIME);
    await page.reload();
    await expect(page).toHaveURL('/dashboard');
    
    // 6. Logout
    await page.click('[data-testid="logout"]');
    await expect(page).toHaveURL('/login');
  });
});
```

### Git Operations Test
```javascript
describe('Git Operations', () => {
  test('Full git workflow', async ({ page }) => {
    await testHelpers.loginTestUser(page);
    await page.click('[data-testid="project-nodejs"]');
    
    // Check status
    await page.click('[data-testid="git-status"]');
    await expect(page.locator('.git-output')).toContainText('nothing to commit');
    
    // Make changes
    await page.click('[data-testid="file-src/index.js"]');
    await page.fill('.editor', 'console.log("test");');
    
    // Verify diff
    await page.click('[data-testid="git-diff"]');
    await expect(page.locator('.diff-view')).toContainText('+console.log("test");');
    
    // Commit
    await page.fill('[data-testid="commit-message"]', 'test: add console log');
    await page.click('[data-testid="commit-button"]');
    await expect(page.locator('.git-output')).toContainText('1 file changed');
  });
});
```

## Troubleshooting

### Common Issues

#### Docker Build Failures
```bash
# Clear Docker cache
docker system prune -a
docker volume prune

# Rebuild without cache
docker-compose -f docker-compose.test.yml build --no-cache
```

#### Port Conflicts
```bash
# Check for processes using test ports
lsof -i :3020
lsof -i :3021

# Use alternative ports in .env.test
SERVER_PORT=4020
CLIENT_PORT=4021
```

#### Test Timeouts
- Increase PLAYWRIGHT_TIMEOUT in environment
- Check Docker resource limits
- Ensure health checks are passing

#### Authentication Issues
- Verify .env.test has valid tokens
- Check JWT_SECRET matches between services
- Ensure DATABASE_URL is accessible

### Mock Claude API Configuration

For offline testing, create `test-data/mock-responses.json`:

```json
{
  "responses": {
    "task_create": {
      "id": "task_123",
      "status": "created",
      "message": "Task created successfully"
    },
    "task_execute": {
      "output": "console.log('Hello from mock');",
      "status": "completed"
    },
    "session_list": [
      {
        "id": "session_1",
        "name": "Test Session 1",
        "created": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

Configure mock mode in .env.test:
```bash
MOCK_CLAUDE_API=true
MOCK_CLAUDE_RESPONSES_PATH=/test-data/mock-responses.json
```

## Long Session File for Stress Testing

Create a ridiculous, obviously fake session for stress testing large conversation histories:

```bash
#!/bin/bash
# scripts/generate-long-session.sh

cat > /test-data/.claude/projects/express-validator/session-stress-test.jsonl << 'EOF'
{"type":"user","content":"Help me build a rubber duck authentication system"}
{"type":"assistant","content":"I'll help you create a rubber duck authentication system! This is a critical security feature. Let me start by examining your existing code..."}
{"type":"tool_use","name":"Read","parameters":{"file_path":"src/security/duck-auth.js"}}
{"type":"tool_result","content":"Error: File not found"}
{"type":"assistant","content":"No duck authentication found! This is a serious security vulnerability. Creating a robust rubber duck authentication system..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/security/duck-auth.js","content":"const QUACK_PATTERN = /^quack{3,7}$/i;\n\nclass RubberDuckAuthenticator {\n  constructor() {\n    this.validDucks = new Map();\n    this.quackAttempts = 0;\n  }\n\n  validateDuck(duckId, quackSignature) {\n    if (!QUACK_PATTERN.test(quackSignature)) {\n      throw new Error('Invalid quack pattern. Duck may be an imposter!');\n    }\n    return true;\n  }\n}"}}
{"type":"user","content":"Great! Now make it support quantum ducks"}
{"type":"assistant","content":"Excellent idea! Quantum ducks require special handling due to superposition..."}
{"type":"tool_use","name":"Edit","parameters":{"file_path":"src/security/duck-auth.js","old_string":"class RubberDuckAuthenticator {","new_string":"class QuantumRubberDuckAuthenticator {"}}
{"type":"user","content":"I need it to authenticate 1 million ducks per second"}
{"type":"assistant","content":"That's a lot of ducks! Let me implement a high-performance duck authentication pipeline using advanced duck-pooling algorithms..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/security/duck-pool.js","content":"// Ultra-fast duck pooling for maximum quacks per second\nconst DUCK_POOL_SIZE = 10000;\nconst duckPool = Array(DUCK_POOL_SIZE).fill(null).map(() => ({ isQuacking: false, lastQuack: null }));"}}
{"type":"user","content":"Can you make the ducks blockchain-enabled?"}
{"type":"assistant","content":"Of course! Every modern duck needs blockchain. Implementing DuckChain™ technology..."}
{"type":"tool_use","name":"Bash","parameters":{"command":"npm install ethereal-duck-blockchain quack-ledger decentralized-pond"}}
{"type":"tool_result","content":"npm ERR! 404 Not Found - GET https://registry.npmjs.org/ethereal-duck-blockchain - Not found"}
{"type":"assistant","content":"These packages don't exist yet. We're truly pioneering here! Let me create a custom blockchain for ducks..."}
{"type":"user","content":"The ducks need AI capabilities"}
{"type":"assistant","content":"Implementing neural networks for duck intelligence! Each duck will have its own GPT (Greatly Paddling Transformer)..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/ai/duck-gpt.js","content":"class DuckGPT {\n  async generateQuack(context) {\n    // Advanced AI to determine optimal quack\n    const quackIntensity = Math.random() * 10;\n    return 'Q' + 'u'.repeat(Math.floor(quackIntensity)) + 'ack!';\n  }\n}"}}
{"type":"user","content":"Make them time-traveling ducks"}
{"type":"assistant","content":"Time-traveling ducks! This is getting complex. We'll need to handle temporal paradoxes..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/temporal/time-duck.js","content":"class TemporalDuck {\n  constructor() {\n    this.timeline = [];\n    this.paradoxes = [];\n  }\n  \n  travelTo(timestamp) {\n    if (timestamp < this.birthDate) {\n      this.paradoxes.push('Duck existed before hatching!');\n    }\n  }\n}"}}
{"type":"user","content":"They should mine cryptocurrency while swimming"}
{"type":"assistant","content":"Crypto-mining aquatic ducks! Implementing Proof-of-Paddle consensus mechanism..."}
{"type":"tool_use","name":"Grep","parameters":{"pattern":"swimming|paddle","path":"src/"}}
{"type":"tool_result","content":"No matches found"}
{"type":"assistant","content":"No swimming implementation found. Creating advanced hydrodynamic algorithms..."}
{"type":"user","content":"Add interdimensional travel"}
{"type":"assistant","content":"Interdimensional ducks require careful handling of reality anchors..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/dimensions/multiverse-duck.js","content":"const DIMENSIONS = ['pond-prime', 'duck-verse-2', 'quack-realm', 'the-breadcrumb-dimension'];"}}
{"type":"user","content":"Can they compose symphonies?"}
{"type":"assistant","content":"Musical ducks! Implementing the Quackoven Symphony Generator..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/music/duck-symphony.js","content":"class DuckSymphony {\n  composeOpus() {\n    return ['Quack', 'Quack', 'Quaaaaaack', 'splash'].join(' - ');\n  }\n}"}}
{"type":"user","content":"Make them solve world hunger"}
{"type":"assistant","content":"That's ambitious! Implementing the Global Duck Food Distribution Network..."}
{"type":"tool_use","name":"TodoWrite","parameters":{"todos":[{"content":"Solve world hunger with ducks","status":"pending"},{"content":"Achieve duck world peace","status":"pending"}]}}
{"type":"user","content":"They need to be quantum entangled"}
{"type":"assistant","content":"Quantum entanglement for ducks! When one duck quacks, its entangled partner quacks simultaneously across the universe..."}
{"type":"tool_use","name":"Bash","parameters":{"command":"echo 'Establishing quantum duck entanglement...'"}}
{"type":"user","content":"Add machine learning for predicting the next quack"}
{"type":"assistant","content":"Implementing QuackNet, a deep learning model trained on 10 million historical quacks..."}
{"type":"user","content":"Make them solar powered"}
{"type":"assistant","content":"Eco-friendly ducks! Adding photosynthetic feathers for sustainable quacking..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/green-tech/solar-duck.js","content":"class SolarDuck {\n  chargeLevel = 0;\n  \n  absorbSunlight(lumens) {\n    this.chargeLevel += lumens * 0.001; // Highly efficient duck panels\n  }\n}"}}
{"type":"user","content":"They should be able to debug their own code"}
{"type":"assistant","content":"Self-debugging ducks! Implementing recursive duck introspection..."}
{"type":"user","content":"Add support for duck NFTs"}
{"type":"assistant","content":"Non-Fungible Ducks! Each duck is unique and stored on the blockchain..."}
{"type":"user","content":"Make them telepathic"}
{"type":"assistant","content":"Telepathic ducks can share thoughts across the pond network..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/psychic/telepathic-duck.js","content":"class TelepathicDuck {\n  broadcastThought(thought) {\n    // Sends thought to all ducks within 50 meter radius\n    return `~~ ${thought} ~~`;\n  }\n}"}}
{"type":"user","content":"Can they predict stock prices?"}
{"type":"assistant","content":"Financial ducks! Implementing the Dow Jones Duck Index predictor..."}
{"type":"user","content":"Add holographic projection capabilities"}
{"type":"assistant","content":"Holographic ducks! They can now project 3D images of bread crumbs..."}
{"type":"user","content":"Make them capable of interdimensional cheese production"}
{"type":"assistant","content":"Interdimensional cheese-producing ducks? This is getting delightfully absurd! Implementing the Cosmic Cheddar Generator..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/dairy/quantum-cheese-duck.js","content":"class QuantumCheeseDuck {\n  async produceCheese(dimension) {\n    const cheeseTypes = ['cosmic-cheddar', 'nebula-swiss', 'black-hole-brie'];\n    return cheeseTypes[Math.floor(Math.random() * cheeseTypes.length)];\n  }\n}"}}
{"type":"user","content":"They need to speak 47 languages"}
{"type":"assistant","content":"Polyglot ducks! Implementing the Universal Duck Translator..."}
{"type":"user","content":"Add time dilation fields"}
{"type":"assistant","content":"Time dilation for ducks! They can now experience millennia in mere moments..."}
{"type":"user","content":"Make them run for political office"}
{"type":"assistant","content":"Political ducks! Implementing the campaign management system..."}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/politics/candidate-duck.js","content":"class PoliticalDuck {\n  campaign() {\n    return 'A quack in every pond, a breadcrumb for every duck!';\n  }\n}"}}
EOF

# Add 1000 more ridiculous interactions to really stress test
for i in {1..1000}; do
  echo "{\"type\":\"user\",\"content\":\"Duck request #$i: Make them juggle flaming pineapples while solving calculus\"}" >> /test-data/.claude/projects/express-validator/session-stress-test.jsonl
  echo "{\"type\":\"assistant\",\"content\":\"Implementing flaming pineapple juggling with integrated calculus solver for duck #$i...\"}" >> /test-data/.claude/projects/express-validator/session-stress-test.jsonl
  echo "{\"type\":\"tool_use\",\"name\":\"Write\",\"parameters\":{\"file_path\":\"src/circus/juggling-duck-$i.js\",\"content\":\"// Duck $i juggling implementation\"}}" >> /test-data/.claude/projects/express-validator/session-stress-test.jsonl
done

echo "Generated absurdly long duck session with $(wc -l < /test-data/.claude/projects/express-validator/session-stress-test.jsonl) lines"
```

## MCP Configuration for Testing

### User-Level MCP Configuration
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/test-data/projects"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"],
      "env": {
        "CONTEXT7_API_KEY": "optional-for-public-libs"
      }
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "duckduckgo": {
      "command": "npx",
      "args": ["-y", "@kreuzwerker/mcp-server-duckduckgo"]
    },
    "apidog": {
      "command": "npx",
      "args": ["-y", "@apidog/mcp-server"],
      "env": {
        "APIDOG_API_KEY": "test-key-123"
      }
    }
  }
}
```

### Project-Level MCP Configuration
```json
{
  "mcpServers": {
    "project-specific-db": {
      "command": "node",
      "args": ["./mcp-servers/custom-db-server.js"],
      "env": {
        "DB_PATH": "./project.db"
      }
    }
  },
  "strictMode": false
}
```

## Missing Application Features for Testing

Based on code review, we need to add test coverage for:

### 1. **Favorites/Starred Projects**
- Star/unstar projects
- Filter by starred status
- Persistence across sessions

### 2. **Project Settings Management**
- MCP configuration per project
- Project-specific environment variables
- Git configuration overrides

### 3. **Session Management**
- Resume session functionality
- Session renaming
- Session search/filtering
- Session export/import

### 4. **Advanced Git Features**
- Branch creation/switching
- Merge conflict resolution
- Git stash operations
- Tag management

### 5. **WebSocket & Real-time Features**
- WebSocket connection stability
- Real-time message synchronization
- Heartbeat monitoring
- Connection recovery

### 6. **Search Functionality**
- Global search across projects
- Search within sessions
- Search in chat history
- File content search

### 7. **Keyboard Shortcuts**
- Command palette (Cmd/Ctrl + K)
- Quick actions
- Navigation shortcuts

### 8. **Theme Management**
- Dark/light mode switching
- Custom theme colors
- Theme persistence

### 9. **Export/Import Features**
- Export session as markdown
- Import session history
- Backup/restore functionality

### 10. **Collaborative Features**
- Shared sessions (read-only)
- Session activity indicators
- User presence

### 11. **Performance Features**
- Large file handling
- Streaming responses
- Lazy loading of sessions
- Virtual scrolling in long lists

### 12. **Error Recovery**
- Automatic reconnection
- Session recovery after crash
- Partial message recovery
- Offline mode

### 13. **Notification System**
- Task completion alerts
- Error notifications
- System status updates

### 14. **File Operations**
- Drag and drop file upload
- Multiple file selection
- File preview
- Binary file handling

### 15. **Advanced UI States**
- Loading skeletons
- Empty states
- Error boundaries
- Progress indicators

This PRD provides a comprehensive blueprint for implementing a Docker-based isolated test environment for Claude Code UI, ensuring reliable and thorough testing of all features.