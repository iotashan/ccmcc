#!/bin/bash
# Setup realistic Claude CLI session files for testing
# Creates JSONL conversation files, project settings, and custom commands

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Base directory for test data
TEST_DATA_DIR="${TEST_DATA_DIR:-/test-data}"
CLAUDE_DIR="${TEST_DATA_DIR}/.claude"
PROJECTS_DIR="${CLAUDE_DIR}/projects"
COMMANDS_DIR="${CLAUDE_DIR}/commands"

# Ensure directories exist
mkdir -p "${PROJECTS_DIR}"
mkdir -p "${COMMANDS_DIR}"

# Function to create a base64 encoded path (mimicking Claude's behavior)
encode_project_path() {
    echo -n "$1" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '='
}

# Create realistic session files for each project
print_section "Creating Claude session files"

# Session 1: Node.js project - Express Validator
print_status "Creating session for express-validator..."
PROJECT_PATH="/test-data/projects/project-nodejs"
ENCODED_PATH=$(encode_project_path "${PROJECT_PATH}")
SESSION_DIR="${PROJECTS_DIR}/${ENCODED_PATH}"
mkdir -p "${SESSION_DIR}"

cat > "${SESSION_DIR}/session-001.jsonl" << 'EOF'
{"type":"user","content":"Help me add input validation for email fields in my Express app"}
{"type":"assistant","content":"I'll help you add email validation using express-validator. Let me first examine your current setup."}
{"type":"tool_use","name":"Read","parameters":{"file_path":"src/index.js"}}
{"type":"tool_result","content":"const express = require('express');\nconst app = express();\n\napp.post('/users', (req, res) => {\n  // TODO: Add validation\n  res.json({ message: 'User created' });\n});"}
{"type":"assistant","content":"I see you have a basic Express endpoint. Let me add email validation using express-validator:\n\n```javascript\nconst { body, validationResult } = require('express-validator');\n```"}
{"type":"tool_use","name":"Edit","parameters":{"file_path":"src/index.js","old_string":"const express = require('express');\nconst app = express();","new_string":"const express = require('express');\nconst { body, validationResult } = require('express-validator');\nconst app = express();"}}
{"type":"tool_result","content":"File edited successfully"}
{"type":"user","content":"Great! Now add the validation middleware"}
{"type":"assistant","content":"I'll add the validation middleware for the email field:"}
{"type":"tool_use","name":"Edit","parameters":{"file_path":"src/index.js","old_string":"app.post('/users', (req, res) => {\n  // TODO: Add validation\n  res.json({ message: 'User created' });\n});","new_string":"app.post('/users', [\n  body('email').isEmail().withMessage('Must be a valid email'),\n  body('email').normalizeEmail(),\n], (req, res) => {\n  const errors = validationResult(req);\n  if (!errors.isEmpty()) {\n    return res.status(400).json({ errors: errors.array() });\n  }\n  res.json({ message: 'User created', email: req.body.email });\n});"}}
{"type":"tool_result","content":"File edited successfully"}
{"type":"assistant","content":"Perfect! I've added email validation to your Express endpoint. The validation now:\n\n1. Checks if the email is valid using `isEmail()`\n2. Normalizes the email (lowercase, removes dots from Gmail addresses, etc.)\n3. Returns a 400 error with validation messages if the email is invalid\n\nWould you like me to add more validation rules or create tests for this?"}
{"type":"user","content":"Yes, add a test file"}
{"type":"assistant","content":"I'll create a test file for the email validation:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"test/validation.test.js","content":"const request = require('supertest');\nconst app = require('../src/index');\n\ndescribe('POST /users', () => {\n  it('should accept valid email', async () => {\n    const res = await request(app)\n      .post('/users')\n      .send({ email: 'test@example.com' });\n    \n    expect(res.status).toBe(200);\n    expect(res.body.email).toBe('test@example.com');\n  });\n\n  it('should reject invalid email', async () => {\n    const res = await request(app)\n      .post('/users')\n      .send({ email: 'invalid-email' });\n    \n    expect(res.status).toBe(400);\n    expect(res.body.errors[0].msg).toBe('Must be a valid email');\n  });\n});"}}
{"type":"tool_result","content":"File created successfully"}
EOF

# Create a summary file for this session
cat > "${SESSION_DIR}/summary-001.jsonl" << 'EOF'
{"type":"summary","content":"Added email validation to Express app using express-validator. Created validation middleware and test file.","created":"2024-01-15T10:30:00Z"}
EOF

# Session 2: Python project - Environment Configuration
print_status "Creating session for python-dotenv..."
PROJECT_PATH="/test-data/projects/project-python"
ENCODED_PATH=$(encode_project_path "${PROJECT_PATH}")
SESSION_DIR="${PROJECTS_DIR}/${ENCODED_PATH}"
mkdir -p "${SESSION_DIR}"

cat > "${SESSION_DIR}/session-002.jsonl" << 'EOF'
{"type":"user","content":"I need to add support for loading .env files with different environments like .env.production"}
{"type":"assistant","content":"I'll help you extend python-dotenv to support environment-specific .env files. Let me first check the current implementation."}
{"type":"tool_use","name":"Grep","parameters":{"pattern":"load_dotenv","path":"src/"}}
{"type":"tool_result","content":"src/dotenv/main.py:15:def load_dotenv(dotenv_path=None, stream=None, verbose=False, override=False, interpolate=True, encoding=\"utf-8\"):"}
{"type":"assistant","content":"Let me create a helper function to load environment-specific .env files:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"src/dotenv/env_loader.py","content":"import os\nfrom pathlib import Path\nfrom .main import load_dotenv\n\ndef load_env_for_environment(env_name=None, base_path='.'):\n    \"\"\"\n    Load environment variables from .env files based on environment.\n    \n    Loads in this order:\n    1. .env\n    2. .env.{environment} (e.g., .env.production)\n    \"\"\"\n    if env_name is None:\n        env_name = os.getenv('PYTHON_ENV', 'development')\n    \n    base_path = Path(base_path)\n    \n    # Load base .env file\n    base_env = base_path / '.env'\n    if base_env.exists():\n        load_dotenv(base_env)\n    \n    # Load environment-specific file\n    env_specific = base_path / f'.env.{env_name}'\n    if env_specific.exists():\n        load_dotenv(env_specific, override=True)\n    \n    return env_name"}}
{"type":"tool_result","content":"File created successfully"}
{"type":"user","content":"Can you add tests for this?"}
{"type":"assistant","content":"I'll create comprehensive tests for the environment-specific loader:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"tests/test_env_loader.py","content":"import os\nimport tempfile\nimport pytest\nfrom pathlib import Path\nfrom dotenv.env_loader import load_env_for_environment\n\nclass TestEnvLoader:\n    def test_load_base_env_only(self):\n        with tempfile.TemporaryDirectory() as tmpdir:\n            # Create .env file\n            env_file = Path(tmpdir) / '.env'\n            env_file.write_text('BASE_VAR=base_value\\n')\n            \n            # Load and verify\n            load_env_for_environment(base_path=tmpdir)\n            assert os.getenv('BASE_VAR') == 'base_value'\n    \n    def test_load_env_with_override(self):\n        with tempfile.TemporaryDirectory() as tmpdir:\n            # Create .env files\n            base_env = Path(tmpdir) / '.env'\n            base_env.write_text('VAR1=base\\nVAR2=base\\n')\n            \n            prod_env = Path(tmpdir) / '.env.production'\n            prod_env.write_text('VAR2=production\\nVAR3=prod_only\\n')\n            \n            # Load production environment\n            load_env_for_environment('production', base_path=tmpdir)\n            \n            assert os.getenv('VAR1') == 'base'\n            assert os.getenv('VAR2') == 'production'  # Overridden\n            assert os.getenv('VAR3') == 'prod_only'\n    \n    def test_auto_detect_environment(self):\n        with tempfile.TemporaryDirectory() as tmpdir:\n            os.environ['PYTHON_ENV'] = 'staging'\n            \n            staging_env = Path(tmpdir) / '.env.staging'\n            staging_env.write_text('STAGE=staging\\n')\n            \n            env_name = load_env_for_environment(base_path=tmpdir)\n            \n            assert env_name == 'staging'\n            assert os.getenv('STAGE') == 'staging'"}}
{"type":"tool_result","content":"File created successfully"}
EOF

# Session 3: Mixed project - API Testing
print_status "Creating session for json-server..."
PROJECT_PATH="/test-data/projects/project-mixed"
ENCODED_PATH=$(encode_project_path "${PROJECT_PATH}")
SESSION_DIR="${PROJECTS_DIR}/${ENCODED_PATH}"
mkdir -p "${SESSION_DIR}"

cat > "${SESSION_DIR}/session-003.jsonl" << 'EOF'
{"type":"user","content":"I want to add authentication to json-server. Can you help?"}
{"type":"assistant","content":"I'll help you add authentication to json-server. Let me first check the current setup and then create a middleware for JWT authentication."}
{"type":"tool_use","name":"Read","parameters":{"file_path":"server.js"}}
{"type":"tool_result","content":"const jsonServer = require('json-server')\nconst server = jsonServer.create()\nconst router = jsonServer.router('db.json')\nconst middlewares = jsonServer.defaults()\n\nserver.use(middlewares)\nserver.use(router)\nserver.listen(3000, () => {\n  console.log('JSON Server is running')\n})"}
{"type":"assistant","content":"I'll create an authentication middleware for json-server:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"auth-middleware.js","content":"const jwt = require('jsonwebtoken');\nconst SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';\n\n// Simple user database\nconst users = [\n  { id: 1, email: 'admin@example.com', password: 'admin123' },\n  { id: 2, email: 'user@example.com', password: 'user123' }\n];\n\n// Generate JWT token\nfunction generateToken(user) {\n  return jwt.sign(\n    { id: user.id, email: user.email },\n    SECRET_KEY,\n    { expiresIn: '1h' }\n  );\n}\n\n// Auth middleware\nfunction authMiddleware(req, res, next) {\n  // Skip auth for login endpoint\n  if (req.path === '/auth/login' && req.method === 'POST') {\n    return handleLogin(req, res);\n  }\n  \n  // Check for token\n  const token = req.headers.authorization?.split(' ')[1];\n  \n  if (!token) {\n    return res.status(401).json({ error: 'No token provided' });\n  }\n  \n  try {\n    const decoded = jwt.verify(token, SECRET_KEY);\n    req.user = decoded;\n    next();\n  } catch (error) {\n    return res.status(401).json({ error: 'Invalid token' });\n  }\n}\n\n// Login handler\nfunction handleLogin(req, res) {\n  const { email, password } = req.body;\n  \n  const user = users.find(u => u.email === email && u.password === password);\n  \n  if (!user) {\n    return res.status(401).json({ error: 'Invalid credentials' });\n  }\n  \n  const token = generateToken(user);\n  res.json({ token, user: { id: user.id, email: user.email } });\n}\n\nmodule.exports = authMiddleware;"}}
{"type":"tool_result","content":"File created successfully"}
{"type":"assistant","content":"Now let me update the server to use the authentication middleware:"}
{"type":"tool_use","name":"Edit","parameters":{"file_path":"server.js","old_string":"const jsonServer = require('json-server')\nconst server = jsonServer.create()\nconst router = jsonServer.router('db.json')\nconst middlewares = jsonServer.defaults()","new_string":"const jsonServer = require('json-server')\nconst server = jsonServer.create()\nconst router = jsonServer.router('db.json')\nconst middlewares = jsonServer.defaults()\nconst authMiddleware = require('./auth-middleware')"}}
{"type":"tool_result","content":"File edited successfully"}
{"type":"tool_use","name":"Edit","parameters":{"file_path":"server.js","old_string":"server.use(middlewares)\nserver.use(router)","new_string":"server.use(middlewares)\nserver.use(jsonServer.bodyParser)\nserver.use(authMiddleware)\nserver.use(router)"}}
{"type":"tool_result","content":"File edited successfully"}
{"type":"user","content":"Great! Can you create a quick test script to verify the authentication works?"}
{"type":"assistant","content":"I'll create a test script to verify the authentication:"}
{"type":"tool_use","name":"Write","parameters":{"file_path":"test-auth.js","content":"const axios = require('axios');\n\nconst API_URL = 'http://localhost:3000';\n\nasync function testAuth() {\n  try {\n    console.log('1. Testing unauthenticated request...');\n    try {\n      await axios.get(`${API_URL}/posts`);\n    } catch (error) {\n      console.log('✓ Unauthenticated request blocked:', error.response.status);\n    }\n    \n    console.log('\\n2. Testing login...');\n    const loginResponse = await axios.post(`${API_URL}/auth/login`, {\n      email: 'admin@example.com',\n      password: 'admin123'\n    });\n    console.log('✓ Login successful:', loginResponse.data);\n    \n    const token = loginResponse.data.token;\n    \n    console.log('\\n3. Testing authenticated request...');\n    const postsResponse = await axios.get(`${API_URL}/posts`, {\n      headers: { Authorization: `Bearer ${token}` }\n    });\n    console.log('✓ Authenticated request successful, posts:', postsResponse.data.length);\n    \n    console.log('\\n4. Testing invalid credentials...');\n    try {\n      await axios.post(`${API_URL}/auth/login`, {\n        email: 'wrong@example.com',\n        password: 'wrongpass'\n      });\n    } catch (error) {\n      console.log('✓ Invalid credentials rejected:', error.response.status);\n    }\n    \n  } catch (error) {\n    console.error('Test failed:', error.message);\n  }\n}\n\n// Run tests\nconsole.log('Starting authentication tests...\\n');\ntestAuth();"}}
{"type":"tool_result","content":"File created successfully"}
EOF

# Session 4: Long stress test session
print_status "Creating long stress test session..."
PROJECT_PATH="/test-data/projects/project-nodejs"
ENCODED_PATH=$(encode_project_path "${PROJECT_PATH}")
SESSION_DIR="${PROJECTS_DIR}/${ENCODED_PATH}"

cat > "${SESSION_DIR}/session-stress-test.jsonl" << 'EOF'
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
EOF

# Add many more ridiculous entries for stress testing
for i in {1..50}; do
    echo "{\"type\":\"user\",\"content\":\"Duck request #$i: Add feature $(shuf -n1 -e 'time-travel' 'teleportation' 'mind-reading' 'invisibility' 'laser-eyes')\"}" >> "${SESSION_DIR}/session-stress-test.jsonl"
    echo "{\"type\":\"assistant\",\"content\":\"Implementing duck feature #$i...\"}" >> "${SESSION_DIR}/session-stress-test.jsonl"
done

# Create global Claude settings
print_section "Creating Claude settings"
cat > "${CLAUDE_DIR}/settings.json" << 'EOF'
{
  "theme": "dark",
  "editor": "vscode",
  "autoSave": true,
  "testMode": true,
  "sessionTimeout": 3600000,
  "maxSessionLength": 10000,
  "defaultModel": "claude-3-opus",
  "features": {
    "codeCompletion": true,
    "autoIndent": true,
    "syntaxHighlighting": true,
    "gitIntegration": true,
    "debugMode": false
  },
  "shortcuts": {
    "newSession": "cmd+n",
    "saveSession": "cmd+s",
    "runCode": "cmd+enter",
    "formatCode": "shift+alt+f"
  }
}
EOF

# Create custom slash commands
print_section "Creating custom commands"

cat > "${COMMANDS_DIR}/fix-bug.md" << 'EOF'
You are helping with bug fixing. Follow this systematic approach:

1. First, understand the bug by reading error messages and stack traces
2. Use grep/search to find the problematic code
3. Examine the code context thoroughly
4. Consider edge cases and side effects
5. Implement a fix that addresses the root cause
6. Add tests to prevent regression
7. Verify the fix works across the codebase

Focus on:
- Clear communication about what you're doing
- Explaining your reasoning
- Being careful not to introduce new bugs
- Following existing code patterns
EOF

cat > "${COMMANDS_DIR}/refactor.md" << 'EOF'
You are helping with code refactoring. Your approach should be:

1. Understand the current code structure and its purpose
2. Identify code smells and areas for improvement
3. Plan the refactoring in small, safe steps
4. Maintain backward compatibility where needed
5. Ensure all tests pass after each change
6. Update documentation as needed

Refactoring priorities:
- Improve readability and maintainability
- Reduce code duplication
- Follow SOLID principles
- Optimize performance only when necessary
- Keep changes focused and incremental
EOF

cat > "${COMMANDS_DIR}/test.md" << 'EOF'
You are helping with test creation and improvement. Focus on:

1. Understanding what needs to be tested
2. Writing clear, descriptive test names
3. Following the AAA pattern (Arrange, Act, Assert)
4. Testing edge cases and error conditions
5. Using appropriate mocking and stubbing
6. Ensuring tests are independent and repeatable

Test guidelines:
- Aim for high code coverage but focus on meaningful tests
- Test behavior, not implementation details
- Keep tests simple and focused
- Use descriptive assertions
- Consider both positive and negative test cases
EOF

# Create project context files (CLAUDE.md)
print_section "Creating project context files"

cat > "${TEST_DATA_DIR}/projects/project-nodejs/CLAUDE.md" << 'EOF'
# Express Validator Project Context

This is the express-validator project, a middleware library for Express.js that provides validation and sanitization for user input.

## Key Information
- Main language: TypeScript/JavaScript
- Framework: Express.js
- Test runner: Jest
- Package manager: npm

## Project Structure
- `src/` - Source code
- `test/` - Test files
- `docs/` - Documentation

## Development Guidelines
- Follow existing TypeScript patterns
- All new features need tests
- Use descriptive error messages
- Maintain backward compatibility

## Common Tasks
- Run tests: `npm test`
- Build: `npm run build`
- Lint: `npm run lint`
EOF

cat > "${TEST_DATA_DIR}/projects/project-python/CLAUDE.md" << 'EOF'
# Python Dotenv Project Context

Python-dotenv loads environment variables from .env files, making it easy to manage configuration in development.

## Key Information
- Language: Python 3.6+
- Test framework: pytest
- Package manager: pip
- Code style: PEP 8

## Project Structure
- `src/dotenv/` - Main package code
- `tests/` - Test suite
- `docs/` - Sphinx documentation

## Development Guidelines
- Maintain Python 3.6+ compatibility
- Follow PEP 8 style guide
- Write docstrings for all public functions
- Add tests for new features

## Common Commands
- Run tests: `pytest`
- Install dev deps: `pip install -e .[dev]`
- Format code: `black .`
EOF

cat > "${TEST_DATA_DIR}/projects/project-mixed/CLAUDE.md" << 'EOF'
# JSON Server Project Context

JSON Server provides a full fake REST API with zero coding in less than 30 seconds. Perfect for front-end developers who need a quick back-end for prototyping and mocking.

## Key Information
- Language: JavaScript (Node.js)
- Main dependency: Express.js
- Purpose: Mock REST API server
- License: MIT

## Features
- RESTful routes
- Filters, pagination, and sorting
- Full-text search
- Relationships
- Static file serving

## Common Usage
- Start server: `json-server --watch db.json`
- Custom routes: Use `routes.json`
- Add middleware: Modify `server.js`
EOF

# Create MCP configuration files
print_section "Creating MCP configurations"

cat > "${CLAUDE_DIR}/mcp-config.json" << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/test-data/projects"],
      "env": {}
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    },
    "test-server": {
      "command": "node",
      "args": ["/test-data/mcp-test-server.js"],
      "env": {
        "TEST_MODE": "true"
      }
    }
  }
}
EOF

cat > "${CLAUDE_DIR}/mcp-config-minimal.json" << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/test-data/projects"],
      "env": {}
    }
  }
}
EOF

cat > "${CLAUDE_DIR}/mcp-config-corporate.json" << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/test-data/projects"],
      "env": {
        "RESTRICTED_MODE": "true"
      }
    },
    "corporate-tools": {
      "command": "node",
      "args": ["/test-data/corporate-mcp-server.js"],
      "env": {
        "CORPORATE_NETWORK": "true",
        "SECURITY_LEVEL": "high"
      }
    }
  }
}
EOF

# Create a session index
print_section "Creating session index"
cat > "${PROJECTS_DIR}/sessions-index.json" << EOF
{
  "sessions": [
    {
      "id": "session-001",
      "project": "express-validator",
      "path": "/test-data/projects/project-nodejs",
      "created": "2024-01-15T10:30:00Z",
      "lastAccessed": "2024-01-15T11:00:00Z",
      "title": "Add email validation",
      "messageCount": 10
    },
    {
      "id": "session-002",
      "project": "python-dotenv",
      "path": "/test-data/projects/project-python",
      "created": "2024-01-16T14:20:00Z",
      "lastAccessed": "2024-01-16T15:45:00Z",
      "title": "Environment-specific .env files",
      "messageCount": 6
    },
    {
      "id": "session-003",
      "project": "json-server",
      "path": "/test-data/projects/project-mixed",
      "created": "2024-01-17T09:00:00Z",
      "lastAccessed": "2024-01-17T10:30:00Z",
      "title": "Add JWT authentication",
      "messageCount": 12
    },
    {
      "id": "session-stress-test",
      "project": "express-validator",
      "path": "/test-data/projects/project-nodejs",
      "created": "2024-01-18T16:00:00Z",
      "lastAccessed": "2024-01-18T17:30:00Z",
      "title": "Rubber duck authentication system",
      "messageCount": 120
    }
  ]
}
EOF

# Create session statistics
cat > "${CLAUDE_DIR}/session-stats.json" << EOF
{
  "totalSessions": 4,
  "totalMessages": 148,
  "activeProjects": 3,
  "lastActivity": "2024-01-18T17:30:00Z",
  "mostActiveProject": "express-validator",
  "toolUsage": {
    "Read": 4,
    "Write": 8,
    "Edit": 6,
    "Bash": 1,
    "Grep": 1
  },
  "languageBreakdown": {
    "javascript": 45,
    "typescript": 25,
    "python": 20,
    "html": 10
  }
}
EOF

print_section "Claude session setup complete!"
print_status "Created ${GREEN}4${NC} realistic sessions (including stress test)"
print_status "Created ${GREEN}3${NC} custom commands"
print_status "Created ${GREEN}3${NC} MCP configurations"
print_status "Created ${GREEN}3${NC} CLAUDE.md project files"
print_status "Session data location: ${CLAUDE_DIR}"