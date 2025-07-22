#!/bin/bash
# Generate test JWT keys for authentication testing
# Creates RSA key pairs for JWT signing/verification

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
JWT_KEYS_DIR="${TEST_DATA_DIR}/credentials/jwt-keys"

# Ensure directory exists
mkdir -p "${JWT_KEYS_DIR}"

print_section "Generating JWT Test Keys"

# Generate RSA private key (2048 bits)
print_status "Generating RSA private key..."
openssl genrsa -out "${JWT_KEYS_DIR}/private.key" 2048 2>/dev/null

# Generate corresponding public key
print_status "Extracting public key..."
openssl rsa -in "${JWT_KEYS_DIR}/private.key" -pubout -out "${JWT_KEYS_DIR}/public.key" 2>/dev/null

# Generate a second key pair for key rotation testing
print_status "Generating secondary key pair for rotation testing..."
openssl genrsa -out "${JWT_KEYS_DIR}/private-secondary.key" 2048 2>/dev/null
openssl rsa -in "${JWT_KEYS_DIR}/private-secondary.key" -pubout -out "${JWT_KEYS_DIR}/public-secondary.key" 2>/dev/null

# Generate an expired key pair for testing
print_status "Generating expired key pair for testing..."
openssl genrsa -out "${JWT_KEYS_DIR}/private-expired.key" 2048 2>/dev/null
openssl rsa -in "${JWT_KEYS_DIR}/private-expired.key" -pubout -out "${JWT_KEYS_DIR}/public-expired.key" 2>/dev/null

# Create JWT configuration file
print_status "Creating JWT configuration..."
cat > "${JWT_KEYS_DIR}/jwt-config.json" << EOF
{
  "algorithm": "RS256",
  "issuer": "claudecodeui-test",
  "audience": "claudecodeui-test-clients",
  "expiresIn": "1h",
  "refreshExpiresIn": "7d",
  "keys": {
    "active": {
      "kid": "test-key-001",
      "privateKeyPath": "/test-data/credentials/jwt-keys/private.key",
      "publicKeyPath": "/test-data/credentials/jwt-keys/public.key",
      "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "status": "active"
    },
    "secondary": {
      "kid": "test-key-002",
      "privateKeyPath": "/test-data/credentials/jwt-keys/private-secondary.key",
      "publicKeyPath": "/test-data/credentials/jwt-keys/public-secondary.key",
      "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "status": "standby"
    },
    "expired": {
      "kid": "test-key-expired",
      "privateKeyPath": "/test-data/credentials/jwt-keys/private-expired.key",
      "publicKeyPath": "/test-data/credentials/jwt-keys/public-expired.key",
      "createdAt": "2020-01-01T00:00:00Z",
      "expiresAt": "2021-01-01T00:00:00Z",
      "status": "expired"
    }
  }
}
EOF

# Create sample JWT secrets for HMAC algorithms (for testing different algorithms)
print_status "Creating HMAC secrets for testing..."
cat > "${JWT_KEYS_DIR}/jwt-secrets.json" << EOF
{
  "secrets": {
    "test": {
      "secret": "your-test-jwt-secret-here-min-32-chars-change-this",
      "algorithm": "HS256",
      "environment": "test"
    },
    "development": {
      "secret": "development-secret-do-not-use-in-production-ever",
      "algorithm": "HS256",
      "environment": "development"
    },
    "weak": {
      "secret": "weak",
      "algorithm": "HS256",
      "environment": "test",
      "note": "Intentionally weak secret for security testing"
    }
  }
}
EOF

# Generate sample JWTs for testing
print_status "Generating sample JWT tokens..."

# Create a simple JWT generator script
cat > "${JWT_KEYS_DIR}/generate-test-token.js" << 'EOF'
#!/usr/bin/env node
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Read the private key
const privateKey = fs.readFileSync('/test-data/credentials/jwt-keys/private.key', 'utf8');

// Sample payloads
const payloads = [
  {
    sub: 'test-user-1',
    email: 'testuser@example.com',
    role: 'user',
    machineId: 'machine-001'
  },
  {
    sub: 'test-admin',
    email: 'admin@example.com',
    role: 'admin',
    machineId: 'machine-001'
  },
  {
    sub: 'test-user-expired',
    email: 'expired@example.com',
    role: 'user',
    machineId: 'machine-002',
    exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
  }
];

// Generate tokens
const tokens = payloads.map(payload => {
  const options = {
    algorithm: 'RS256',
    issuer: 'claudecodeui-test',
    audience: 'claudecodeui-test-clients',
    expiresIn: payload.exp ? undefined : '1h'
  };
  
  return {
    description: `Token for ${payload.email}`,
    payload: payload,
    token: jwt.sign(payload, privateKey, options)
  };
});

// Save sample tokens
fs.writeFileSync(
  '/test-data/credentials/jwt-keys/sample-tokens.json',
  JSON.stringify({ tokens }, null, 2)
);

console.log('Generated', tokens.length, 'sample tokens');
EOF

chmod +x "${JWT_KEYS_DIR}/generate-test-token.js"

# Create JWT validation rules for testing
print_status "Creating JWT validation rules..."
cat > "${JWT_KEYS_DIR}/validation-rules.json" << EOF
{
  "rules": {
    "standard": {
      "algorithms": ["RS256"],
      "issuer": "claudecodeui-test",
      "audience": "claudecodeui-test-clients",
      "clockTolerance": 60,
      "maxAge": "24h"
    },
    "strict": {
      "algorithms": ["RS256"],
      "issuer": "claudecodeui-test",
      "audience": "claudecodeui-test-clients",
      "clockTolerance": 0,
      "maxAge": "1h",
      "requireExp": true,
      "requireNbf": true
    },
    "lenient": {
      "algorithms": ["RS256", "HS256"],
      "issuer": "claudecodeui-test",
      "audience": ["claudecodeui-test-clients", "legacy-clients"],
      "clockTolerance": 300,
      "maxAge": "7d"
    }
  }
}
EOF

# Set proper permissions
chmod 600 "${JWT_KEYS_DIR}"/private*.key
chmod 644 "${JWT_KEYS_DIR}"/public*.key
chmod 644 "${JWT_KEYS_DIR}"/*.json

# Create a summary
print_section "JWT Key Generation Complete"
print_status "Generated files:"
print_status "  - private.key (main signing key)"
print_status "  - public.key (main verification key)"
print_status "  - private-secondary.key (for key rotation)"
print_status "  - public-secondary.key"
print_status "  - private-expired.key (for testing)"
print_status "  - public-expired.key"
print_status "  - jwt-config.json (configuration)"
print_status "  - jwt-secrets.json (HMAC secrets)"
print_status "  - validation-rules.json (validation presets)"
print_status "  - generate-test-token.js (token generator)"

# Display key fingerprints for verification
print_section "Key Fingerprints"
for key in "${JWT_KEYS_DIR}"/public*.key; do
    FINGERPRINT=$(openssl rsa -pubin -in "$key" -outform DER 2>/dev/null | openssl dgst -sha256 | awk '{print $2}')
    print_status "$(basename "$key"): SHA256:${FINGERPRINT}"
done

print_status "✓ JWT test keys ready for use!"