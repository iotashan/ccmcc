#!/bin/bash
# Generate test data by cloning real OSS projects at specific commits
# This ensures reproducible test data across all test runs

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Base directory for test data
TEST_DATA_DIR="${TEST_DATA_DIR:-/test-data}"
PROJECTS_DIR="${TEST_DATA_DIR}/projects"

# Create directories
print_section "Setting up directory structure"
print_status "Creating test data directories..."
mkdir -p "${PROJECTS_DIR}"
mkdir -p "${TEST_DATA_DIR}/.claude/projects"
mkdir -p "${TEST_DATA_DIR}/.claude/commands"
mkdir -p "${TEST_DATA_DIR}/mock-responses"
mkdir -p "${TEST_DATA_DIR}/credentials/jwt-keys"
mkdir -p "${TEST_DATA_DIR}/db"
mkdir -p "${TEST_DATA_DIR}/logs"

# Function to clone or update a repository
clone_or_update_repo() {
    local repo_url="$1"
    local target_dir="$2"
    local commit="$3"
    local repo_name=$(basename "$target_dir")
    
    print_status "Processing ${repo_name}..."
    
    if [ -d "${target_dir}/.git" ]; then
        print_warning "${repo_name} already exists, updating..."
        cd "${target_dir}"
        git fetch origin
        git checkout "${commit}"
        cd - > /dev/null
    else
        print_status "Cloning ${repo_name}..."
        git clone --depth 50 "${repo_url}" "${target_dir}"
        cd "${target_dir}"
        git checkout "${commit}"
        cd - > /dev/null
    fi
    
    # Create a test branch for modifications
    cd "${target_dir}"
    git checkout -b test-branch 2>/dev/null || git checkout test-branch
    cd - > /dev/null
    
    print_status "✓ ${repo_name} ready at commit ${commit}"
}

# Clone OSS Projects
print_section "Cloning OSS Projects"

# 1. Node.js project - express-validator
clone_or_update_repo \
    "https://github.com/express-validator/express-validator.git" \
    "${PROJECTS_DIR}/project-nodejs" \
    "v7.0.1"

# 2. Python project - python-dotenv
clone_or_update_repo \
    "https://github.com/theskumar/python-dotenv.git" \
    "${PROJECTS_DIR}/project-python" \
    "v1.0.0"

# 3. Mixed project - json-server
clone_or_update_repo \
    "https://github.com/typicode/json-server.git" \
    "${PROJECTS_DIR}/project-mixed" \
    "v0.17.4"

# 4. Create empty project for initialization tests
print_status "Creating empty project..."
EMPTY_PROJECT="${PROJECTS_DIR}/empty-project"
mkdir -p "${EMPTY_PROJECT}"
cd "${EMPTY_PROJECT}"

# Initialize git if not already initialized
if [ ! -d .git ]; then
    git init
    echo "# Empty Test Project" > README.md
    echo "node_modules/" > .gitignore
    echo ".env" >> .gitignore
    echo ".DS_Store" >> .gitignore
    git add .
    git commit -m "Initial commit"
fi
cd - > /dev/null

print_status "✓ Empty project ready"

# 5. Create a project with merge conflicts for testing
print_status "Creating conflict project..."
CONFLICT_PROJECT="${PROJECTS_DIR}/conflict-project"
if [ ! -d "${CONFLICT_PROJECT}" ]; then
    mkdir -p "${CONFLICT_PROJECT}"
    cd "${CONFLICT_PROJECT}"
    git init
    
    # Create initial file
    echo "Line 1: Original content" > conflict.txt
    echo "Line 2: Shared content" >> conflict.txt
    echo "Line 3: Original content" >> conflict.txt
    git add conflict.txt
    git commit -m "Initial commit"
    
    # Create branch A
    git checkout -b branch-a
    echo "Line 1: Branch A content" > conflict.txt
    echo "Line 2: Shared content" >> conflict.txt
    echo "Line 3: Branch A content" >> conflict.txt
    git add conflict.txt
    git commit -m "Branch A changes"
    
    # Create branch B
    git checkout main
    git checkout -b branch-b
    echo "Line 1: Branch B content" > conflict.txt
    echo "Line 2: Shared content" >> conflict.txt
    echo "Line 3: Branch B content" >> conflict.txt
    git add conflict.txt
    git commit -m "Branch B changes"
    
    # Go back to main
    git checkout main
    cd - > /dev/null
    print_status "✓ Conflict project ready"
else
    print_warning "Conflict project already exists"
fi

# Create sample files in each project for testing
print_section "Adding test files to projects"

# Add test files to Node.js project
cat > "${PROJECTS_DIR}/project-nodejs/test-file.js" << 'EOF'
// Test file for Claude Code UI testing
const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.json({ message: 'Test endpoint for Claude Code UI' });
});

module.exports = app;
EOF

# Add test files to Python project
cat > "${PROJECTS_DIR}/project-python/test_file.py" << 'EOF'
"""Test file for Claude Code UI testing"""
import os
from dotenv import load_dotenv

def test_function():
    """Test function for Claude Code UI"""
    load_dotenv()
    return os.getenv('TEST_VAR', 'default_value')

if __name__ == '__main__':
    print(f"Test result: {test_function()}")
EOF

# Add test files to mixed project
cat > "${PROJECTS_DIR}/project-mixed/test.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code UI Test Page</title>
</head>
<body>
    <h1>Test Page for Claude Code UI</h1>
    <div id="test-content">
        <p>This is a test HTML file for E2E testing</p>
    </div>
</body>
</html>
EOF

# Create project metadata files
print_section "Creating project metadata"

# Node.js project metadata
cat > "${PROJECTS_DIR}/project-nodejs/.claude-project.json" << 'EOF'
{
  "name": "express-validator",
  "type": "nodejs",
  "language": "typescript",
  "framework": "express",
  "testFramework": "jest",
  "packageManager": "npm",
  "features": {
    "hasTests": true,
    "hasCI": true,
    "hasDocker": false
  }
}
EOF

# Python project metadata
cat > "${PROJECTS_DIR}/project-python/.claude-project.json" << 'EOF'
{
  "name": "python-dotenv",
  "type": "python",
  "language": "python",
  "framework": null,
  "testFramework": "pytest",
  "packageManager": "pip",
  "features": {
    "hasTests": true,
    "hasCI": true,
    "hasDocker": false
  }
}
EOF

# Mixed project metadata
cat > "${PROJECTS_DIR}/project-mixed/.claude-project.json" << 'EOF'
{
  "name": "json-server",
  "type": "mixed",
  "language": "javascript",
  "framework": "express",
  "testFramework": "jest",
  "packageManager": "npm",
  "features": {
    "hasTests": true,
    "hasCI": true,
    "hasDocker": false,
    "hasFrontend": true
  }
}
EOF

# Create a projects index file
cat > "${PROJECTS_DIR}/projects.json" << 'EOF'
{
  "projects": [
    {
      "id": "project-nodejs",
      "name": "Express Validator",
      "path": "/test-data/projects/project-nodejs",
      "type": "nodejs",
      "description": "Express.js validation middleware",
      "starred": true
    },
    {
      "id": "project-python",
      "name": "Python Dotenv",
      "path": "/test-data/projects/project-python",
      "type": "python",
      "description": "Python library for .env file support",
      "starred": false
    },
    {
      "id": "project-mixed",
      "name": "JSON Server",
      "path": "/test-data/projects/project-mixed",
      "type": "mixed",
      "description": "Full fake REST API with zero coding",
      "starred": true
    },
    {
      "id": "empty-project",
      "name": "Empty Project",
      "path": "/test-data/projects/empty-project",
      "type": "empty",
      "description": "Empty project for initialization testing",
      "starred": false
    },
    {
      "id": "conflict-project",
      "name": "Conflict Project",
      "path": "/test-data/projects/conflict-project",
      "type": "git",
      "description": "Project with merge conflicts for testing",
      "starred": false
    }
  ]
}
EOF

# Create mock API responses
print_section "Creating mock API responses"
cat > "${TEST_DATA_DIR}/mock-responses.json" << 'EOF'
{
  "responses": {
    "task_create": {
      "id": "task_123",
      "status": "created",
      "message": "Task created successfully"
    },
    "task_execute": {
      "output": "console.log('Hello from mock Claude API');",
      "status": "completed"
    },
    "session_list": [
      {
        "id": "session_1",
        "name": "Test Session 1",
        "created": "2024-01-01T00:00:00Z",
        "lastAccessed": "2024-01-01T12:00:00Z",
        "messageCount": 42
      },
      {
        "id": "session_2",
        "name": "Test Session 2",
        "created": "2024-01-02T00:00:00Z",
        "lastAccessed": "2024-01-02T15:30:00Z",
        "messageCount": 15
      }
    ],
    "code_completion": {
      "suggestion": "function testFunction() {\n  return 'test';\n}",
      "confidence": 0.95
    },
    "error_response": {
      "error": "Rate limit exceeded",
      "retry_after": 60
    },
    "file_operations": {
      "read": {
        "content": "// File content from mock",
        "encoding": "utf-8"
      },
      "write": {
        "success": true,
        "path": "/test/file.js"
      }
    }
  }
}
EOF

# Create test credentials structure
print_section "Setting up test credentials"
cat > "${TEST_DATA_DIR}/credentials/api-tokens.json" << 'EOF'
{
  "tokens": {
    "test-user-1": "test-api-token-12345",
    "test-user-2": "test-api-token-67890",
    "admin-user": "test-admin-token-11111"
  },
  "machines": {
    "machine-001": {
      "token": "test-client-api-token-machine-1",
      "name": "dev-machine-1",
      "type": "desktop",
      "status": "online"
    },
    "machine-002": {
      "token": "test-client-api-token-machine-2",
      "name": "dev-laptop",
      "type": "laptop",
      "status": "online"
    },
    "machine-003": {
      "token": "test-client-api-token-machine-3",
      "name": "work-desktop",
      "type": "desktop",
      "status": "offline"
    }
  }
}
EOF

# Create sample .env files for testing
print_section "Creating sample environment files"

cat > "${PROJECTS_DIR}/project-nodejs/.env.example" << 'EOF'
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/test
API_KEY=test-api-key
EOF

cat > "${PROJECTS_DIR}/project-python/.env.example" << 'EOF'
PYTHON_ENV=development
DATABASE_URL=postgresql://localhost/test
SECRET_KEY=test-secret-key
DEBUG=True
EOF

# Initialize test database
print_section "Initializing test database"
touch "${TEST_DATA_DIR}/db/test.db"
print_status "✓ Test database created"

# Generate JWT keys
print_section "Generating JWT keys"
if [ -f "/scripts/generate-jwt-keys.sh" ]; then
    /scripts/generate-jwt-keys.sh
else
    print_warning "JWT key generation script not found, skipping..."
fi

# Set proper permissions
print_section "Setting file permissions"
chmod -R 755 "${PROJECTS_DIR}"
find "${PROJECTS_DIR}" -name "*.sh" -exec chmod +x {} \;
print_status "✓ Permissions set"

# Create a summary file
print_section "Generating summary"
cat > "${TEST_DATA_DIR}/test-data-summary.txt" << EOF
Test Data Generation Summary
===========================
Generated at: $(date)

Projects cloned:
1. express-validator (Node.js) - v7.0.1
2. python-dotenv (Python) - v1.0.0
3. json-server (Mixed) - v0.17.4
4. empty-project (Empty) - initial commit
5. conflict-project (Git) - with merge conflicts

Total size: $(du -sh "${PROJECTS_DIR}" | cut -f1)

Test files added:
- project-nodejs/test-file.js
- project-python/test_file.py
- project-mixed/test.html

Metadata files created:
- .claude-project.json in each project
- projects.json index file

Mock data created:
- mock-responses.json
- api-tokens.json

Database initialized:
- test.db
EOF

print_status "Summary saved to: ${TEST_DATA_DIR}/test-data-summary.txt"

# Verify all projects exist
print_section "Verifying generated data"
for project in project-nodejs project-python project-mixed empty-project conflict-project; do
    if [ -d "${PROJECTS_DIR}/${project}" ]; then
        print_status "✓ ${project} exists"
    else
        print_error "✗ ${project} missing!"
        exit 1
    fi
done

print_section "Test data generation complete!"
print_status "All test data generated successfully!"
print_status "Test data location: ${TEST_DATA_DIR}"