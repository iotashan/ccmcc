# Authentication Documentation

## Overview

Claude Code UI implements a dual authentication system designed to secure different types of connections:

1. **JWT Authentication** - For web UI users accessing through browsers
2. **API Token Authentication** - For machine clients connecting programmatically

This separation ensures that web sessions are temporary and secure, while machine connections remain stable and persistent.

## Authentication Architecture

```
┌──────────────────┐         ┌──────────────────┐
│   Web Browser    │         │  Machine Client  │
│                  │         │                  │
│  JWT Token       │         │  API Token       │
│  (Temporary)     │         │  (Permanent)     │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │ HTTPS + Cookie             │ WSS + Query Param
         │                            │
    ┌────▼──────────────────────────▼─────┐
    │            Server                    │
    │                                      │
    │  ┌─────────────┐  ┌──────────────┐ │
    │  │ JWT Auth    │  │ API Token    │ │
    │  │ Middleware  │  │ Middleware   │ │
    │  └─────────────┘  └──────────────┘ │
    │                                      │
    │         ┌──────────────┐            │
    │         │   Database   │            │
    │         │              │            │
    │         │ • users      │            │
    │         │ • api_tokens │            │
    │         └──────────────┘            │
    └──────────────────────────────────────┘
```

## JWT Authentication (Web UI)

### Overview

JWT (JSON Web Tokens) are used for web UI authentication, providing secure, stateless sessions with automatic expiration.

### Login Flow

```
1. User submits credentials
   POST /api/auth/login
   { username, password }
   
2. Server validates credentials
   - Check username exists
   - Verify bcrypt password hash
   - Check account is active
   
3. Server generates JWT
   - Payload: { userId, username, role }
   - Expiration: 24 hours
   - Signed with JWT_SECRET
   
4. Server returns token
   - Set HTTP-only secure cookie
   - Include token in response body
   
5. Client stores token
   - Automatically sent with requests
   - Used for WebSocket authentication
```

### JWT Structure

```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "userId": 1,
  "username": "admin",
  "role": "admin",
  "iat": 1704067200,
  "exp": 1704153600
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  JWT_SECRET
)
```

### Security Features

1. **HTTP-Only Cookies**
   - Prevents XSS attacks
   - Not accessible via JavaScript
   - Automatically sent with requests

2. **Secure Flag**
   - HTTPS only in production
   - Prevents man-in-the-middle attacks

3. **CORS Protection**
   - Validates origin headers
   - Prevents CSRF attacks

4. **Short Expiration**
   - 24-hour default lifetime
   - Reduces exposure window
   - Automatic cleanup

### Implementation

```javascript
// Generating JWT
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Verifying JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}
```

## API Token Authentication (Machine Clients)

### Overview

API tokens provide permanent authentication for machine clients, designed for stability and ease of deployment.

### Token Generation Flow

```
1. User requests new token (Web UI)
   POST /api/auth/tokens
   { name: "Work Computer" }
   
2. Server generates token
   - Random 32-byte value
   - Base64 encoded
   - Cryptographically secure
   
3. Server stores hash
   - SHA-256 hash of token
   - Associated with user
   - Metadata (name, created)
   
4. Server returns token ONCE
   - Full token value
   - Never stored in plaintext
   - Cannot be retrieved again
   
5. User configures client
   - Add to config.json
   - Client uses for all connections
```

### Token Structure

```
Original Token (shown once):
cUI_tk_1234567890abcdef...xyz

Stored Hash (SHA-256):
a3f5e8b2c9d4e5f6...789

Database Record:
{
  id: 1,
  user_id: 1,
  name: "Work Computer",
  token_hash: "a3f5e8b2c9d4e5f6...789",
  created_at: "2024-01-01 00:00:00",
  last_used_at: "2024-01-01 12:00:00",
  expires_at: null,
  is_active: 1
}
```

### Security Features

1. **One-Way Hashing**
   - SHA-256 algorithm
   - Cannot reverse to get token
   - Comparison done via hash

2. **Secure Generation**
   - Cryptographically random
   - 256 bits of entropy
   - Unique prefix for identification

3. **No Expiration**
   - Permanent until revoked
   - Suitable for long-running services
   - Manual rotation when needed

4. **Usage Tracking**
   - Last used timestamp
   - Helps identify stale tokens
   - Audit trail

### Implementation

```javascript
// Generating API Token
const crypto = require('crypto');

function generateApiToken() {
  const prefix = 'cUI_tk_';
  const randomBytes = crypto.randomBytes(32);
  const token = prefix + randomBytes.toString('base64url');
  return token;
}

// Hashing for Storage
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// Validating Token
async function validateApiToken(token) {
  const hash = hashToken(token);
  
  const dbToken = await db.getTokenByHash(hash);
  if (!dbToken || !dbToken.is_active) {
    return false;
  }
  
  // Update last used
  await db.updateTokenLastUsed(hash);
  
  return dbToken;
}
```

## Authentication Middleware

### JWT Middleware

```javascript
// For HTTP requests
function requireJWT(req, res, next) {
  const token = req.cookies.jwt || 
                req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// For WebSocket connections
function authenticateWebSocket(ws, req) {
  const token = req.cookies.jwt;
  
  if (!token) {
    ws.close(1008, 'Authentication required');
    return false;
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    ws.user = decoded;
    return true;
  } catch (error) {
    ws.close(1008, 'Invalid token');
    return false;
  }
}
```

### API Token Middleware

```javascript
// For WebSocket machine connections
async function authenticateMachine(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    ws.close(1008, 'API token required');
    return false;
  }
  
  const validToken = await validateApiToken(token);
  if (!validToken) {
    ws.close(1008, 'Invalid API token');
    return false;
  }
  
  ws.machineAuth = {
    userId: validToken.user_id,
    tokenId: validToken.id,
    tokenName: validToken.name
  };
  
  return true;
}
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active INTEGER DEFAULT 1
);
```

### API Tokens Table

```sql
CREATE TABLE api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  expires_at DATETIME,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_user_tokens ON api_tokens(user_id, is_active);
```

## Security Best Practices

### 1. Environment Variables

```bash
# .env file
JWT_SECRET=long-random-string-at-least-32-chars
BCRYPT_ROUNDS=10
TOKEN_PREFIX=cUI_tk_
```

### 2. Password Requirements

- Minimum 8 characters
- Bcrypt with 10+ rounds
- No password reuse tracking (simplified)

### 3. Token Rotation

**JWT Tokens:**
- Automatic expiration
- Cannot be manually rotated
- New token on each login

**API Tokens:**
- Manual rotation recommended
- Revoke old tokens after rotation
- Monitor last used dates

### 4. Rate Limiting

```javascript
// Login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});

// API token creation
const tokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 tokens per hour
  message: 'Too many tokens created'
});
```

### 5. Audit Logging

```javascript
// Log authentication events
function logAuthEvent(type, userId, details) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    type: type,
    userId: userId,
    details: details,
    ip: details.ip,
    userAgent: details.userAgent
  }));
}

// Usage
logAuthEvent('login_success', user.id, { ip: req.ip });
logAuthEvent('token_created', user.id, { tokenName: name });
logAuthEvent('token_revoked', user.id, { tokenId: id });
```

## Token Management

### Creating Tokens

```javascript
// Web UI endpoint
app.post('/api/auth/tokens', requireJWT, async (req, res) => {
  const { name } = req.body;
  
  // Generate token
  const token = generateApiToken();
  const hash = hashToken(token);
  
  // Store in database
  const result = await db.createToken({
    user_id: req.user.userId,
    name: name,
    token_hash: hash
  });
  
  // Return token ONCE
  res.json({
    token: token, // Only time plaintext is sent
    id: result.id,
    name: name,
    createdAt: new Date()
  });
});
```

### Revoking Tokens

```javascript
// Immediate revocation
app.delete('/api/auth/tokens/:id', requireJWT, async (req, res) => {
  const { id } = req.params;
  
  // Verify ownership
  const token = await db.getTokenById(id);
  if (token.user_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Revoke token
  await db.revokeToken(id);
  
  // Close any active connections
  machineManager.disconnectByTokenId(id);
  
  res.json({ message: 'Token revoked' });
});
```

## Troubleshooting

### Common Issues

1. **"Invalid token" errors**
   - Check token hasn't expired (JWT)
   - Verify token hasn't been revoked (API)
   - Ensure correct token type for endpoint

2. **"Authentication required" errors**
   - Verify token is being sent
   - Check cookie settings (JWT)
   - Validate query parameter (API)

3. **Token not working after server restart**
   - JWT: Check JWT_SECRET is consistent
   - API: Tokens should work (hash-based)

### Debug Mode

Enable authentication debugging:

```javascript
// Server startup
if (process.env.AUTH_DEBUG) {
  console.log('Auth debug mode enabled');
  // Log all auth attempts
}
```

### Token Validation Tools

```bash
# Decode JWT (without verification)
echo "jwt.token.here" | base64 -d

# Generate test API token
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Hash a token for database lookup
echo -n "token" | sha256sum
```

## Migration Guide

### From Single Auth to Dual Auth

1. **Keep existing JWT for web UI**
   - No changes needed for web users
   - Sessions continue working

2. **Add API token support**
   - Create api_tokens table
   - Update machine connection code
   - Generate tokens for each machine

3. **Update clients gradually**
   - Clients can migrate one at a time
   - No downtime required
   - Both auth methods work simultaneously