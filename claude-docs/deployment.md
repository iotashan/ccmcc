# Deployment Guide

## Overview

This guide covers deploying Claude Code UI in production environments, including server setup, client deployment, security hardening, and monitoring.

## Deployment Architecture

### Single Server Setup

```
Internet
    │
    ▼
┌──────────────┐
│ Load Balancer│
│  (Optional)  │
└──────┬───────┘
       │
┌──────▼───────┐     ┌─────────────┐
│   Server     │◄────┤  Client 1   │
│              │     └─────────────┘
│ • Web UI     │     ┌─────────────┐
│ • API        │◄────┤  Client 2   │
│ • WebSocket  │     └─────────────┘
└──────────────┘
```

### High Availability Setup

```
                  Internet
                      │
                      ▼
              ┌──────────────┐
              │Load Balancer │
              └──────┬───────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐         ┌───────▼──────┐
│  Server 1    │         │  Server 2    │
│              │◄───────►│              │
│              │ Redis   │              │
└──────────────┘ Session └──────────────┘
        │         Store          │
        └───────┬────────────────┘
                │
        ┌───────▼────────┐
        │   Database     │
        │  (PostgreSQL)  │
        └────────────────┘
```

## Server Deployment

### Prerequisites

- Node.js v20+ (LTS recommended)
- PM2 or systemd for process management
- Nginx or Caddy for reverse proxy
- SSL certificate (Let's Encrypt recommended)
- SQLite or PostgreSQL database

### 1. Environment Setup

Create production environment file:

```bash
# .env.production
NODE_ENV=production
PORT=3020
CLIENT_PORT=3021

# Database
DATABASE_PATH=./data/claude-ui.db

# Authentication
JWT_SECRET=your-very-long-random-string-at-least-32-chars
BCRYPT_ROUNDS=12

# CORS
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### 2. Database Setup

#### SQLite (Simple Setup)

```bash
# Create data directory
mkdir -p data

# Initialize database (automatic on first run)
NODE_ENV=production npm run server
```

#### PostgreSQL (Scalable Setup)

```sql
-- Create database
CREATE DATABASE claude_ui;

-- Create user
CREATE USER claude_ui_user WITH ENCRYPTED PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE claude_ui TO claude_ui_user;
```

Update environment:
```bash
DATABASE_URL=postgresql://claude_ui_user:password@localhost:5432/claude_ui
```

### 3. Build Process

```bash
# Install dependencies
npm ci --production

# Build frontend
npm run build

# Verify build
ls -la dist/
```

### 4. Process Management

#### Using PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'claude-ui-server',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3020
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Using systemd

```ini
# /etc/systemd/system/claude-ui.service
[Unit]
Description=Claude Code UI Server
After=network.target

[Service]
Type=simple
User=claude-ui
WorkingDirectory=/opt/claude-ui
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=claude-ui
Environment=NODE_ENV=production
Environment=PORT=3020

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable claude-ui
sudo systemctl start claude-ui
sudo systemctl status claude-ui
```

### 5. Reverse Proxy Setup

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/claude-ui
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:;" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static files (Web UI)
    location / {
        root /opt/claude-ui/dist;
        try_files $uri /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Machine WebSocket
    location /machine {
        proxy_pass http://localhost:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/claude-ui /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Caddy Configuration

```caddyfile
your-domain.com {
    # Automatic HTTPS
    tls {
        protocols tls1.2 tls1.3
    }

    # Security headers
    header {
        X-Frame-Options SAMEORIGIN
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:;"
    }

    # Static files
    handle /* {
        root * /opt/claude-ui/dist
        try_files {path} /index.html
        file_server
    }

    # API reverse proxy
    handle /api/* {
        reverse_proxy localhost:3020
    }

    # WebSocket
    handle /ws {
        reverse_proxy localhost:3020
    }

    handle /machine {
        reverse_proxy localhost:3020
    }
}
```

### 6. SSL Certificate

Using Let's Encrypt with Certbot:

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Client Deployment

### 1. System Service Setup

#### Linux (systemd)

```bash
# Create user
sudo useradd -r -s /bin/false claude-client

# Install client
sudo mkdir -p /opt/claude-client
sudo cp -r client/* /opt/claude-client/
sudo chown -R claude-client:claude-client /opt/claude-client

# Install dependencies
cd /opt/claude-client
sudo -u claude-client npm ci --production

# Create config
sudo -u claude-client cat > config.json << EOF
{
  "serverAddress": "https://your-server.com:443",
  "authToken": "your-api-token",
  "clientName": "Production Client 1",
  "capabilities": ["claude-cli", "git", "file-access"],
  "reconnectInterval": 5000,
  "heartbeatInterval": 30000,
  "logLevel": "info"
}
EOF

# Create service
sudo cat > /etc/systemd/system/claude-client.service << EOF
[Unit]
Description=Claude Code UI Client
After=network.target

[Service]
Type=simple
User=claude-client
WorkingDirectory=/opt/claude-client
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=claude-client

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable claude-client
sudo systemctl start claude-client
```

#### Windows Service

Using node-windows:

```javascript
// install-windows-service.js
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Claude Code UI Client',
  description: 'Claude Code UI Client Service',
  script: 'C:\\claude-client\\src\\index.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', function(){
  svc.start();
});

svc.install();
```

#### macOS (launchd)

```xml
<!-- ~/Library/LaunchAgents/com.claude-ui.client.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude-ui.client</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/Users/username/claude-client/src/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/username/claude-client</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/username/Library/Logs/claude-client.err</string>
    <key>StandardOutPath</key>
    <string>/Users/username/Library/Logs/claude-client.out</string>
</dict>
</plist>
```

Load service:
```bash
launchctl load ~/Library/LaunchAgents/com.claude-ui.client.plist
```

### 2. Docker Deployment

#### Server Dockerfile

```dockerfile
# Dockerfile.server
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

# Build frontend
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3020

# Start server
CMD ["node", "server/index.js"]
```

#### Client Dockerfile

```dockerfile
# Dockerfile.client
FROM node:20-alpine

WORKDIR /app

# Install Claude CLI dependencies
RUN apk add --no-cache git

# Copy client
COPY client/package*.json ./
RUN npm ci --production

COPY client/ .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Start client
CMD ["node", "src/index.js"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "3020:3020"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_PATH=/data/claude-ui.db
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    restart: unless-stopped

  client:
    build:
      context: .
      dockerfile: Dockerfile.client
    environment:
      - NODE_ENV=production
    volumes:
      - ./client-config.json:/app/config.json:ro
      - ~/.claude:/home/nodejs/.claude
    restart: unless-stopped
    depends_on:
      - server
```

## Security Hardening

### 1. Server Security

```bash
# Firewall rules (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for brute force protection
sudo apt-get install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
```

### 2. Application Security

```javascript
// Additional security middleware
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"]
    }
  }
}));

app.use(mongoSanitize());
```

### 3. Database Security

```sql
-- Regular backups
CREATE EVENT IF NOT EXISTS backup_tokens
ON SCHEDULE EVERY 1 DAY
DO
  BACKUP DATABASE claude_ui TO '/backup/claude_ui_backup.sql';

-- Audit logging
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Monitoring

### 1. Application Monitoring

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', requireAuth, (req, res) => {
  res.json({
    connections: {
      webClients: wsClients.size,
      machineClients: machineManager.getConnectedCount()
    },
    requests: {
      total: requestCounter,
      errors: errorCounter
    }
  });
});
```

### 2. System Monitoring

```bash
# Install monitoring tools
sudo apt-get install htop iotop nethogs

# Setup Prometheus node exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvf node_exporter-1.7.0.linux-amd64.tar.gz
sudo cp node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
```

### 3. Log Aggregation

```bash
# Logrotate configuration
cat > /etc/logrotate.d/claude-ui << EOF
/opt/claude-ui/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 claude-ui claude-ui
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## Backup Strategy

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backup/claude-ui"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup SQLite
sqlite3 /opt/claude-ui/data/claude-ui.db ".backup $BACKUP_DIR/claude-ui_$DATE.db"

# Backup config
cp /opt/claude-ui/.env.production $BACKUP_DIR/env_$DATE

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.db" -mtime +30 -delete

# Sync to remote (optional)
# rsync -av $BACKUP_DIR/ remote-backup-server:/backups/claude-ui/
```

### 2. Automated Backups

```bash
# Crontab entry
0 2 * * * /opt/claude-ui/scripts/backup.sh > /var/log/claude-ui-backup.log 2>&1
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find process using port
sudo lsof -i :3020
# Kill process
sudo kill -9 <PID>
```

2. **Permission Errors**
```bash
# Fix permissions
sudo chown -R claude-ui:claude-ui /opt/claude-ui
sudo chmod -R 755 /opt/claude-ui
```

3. **SSL Certificate Issues**
```bash
# Test SSL
openssl s_client -connect your-domain.com:443
# Renew certificate
sudo certbot renew --force-renewal
```

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=production DEBUG=* node server/index.js

# Check logs
tail -f /var/log/syslog | grep claude-ui
journalctl -u claude-ui -f
```

## Performance Tuning

### 1. Node.js Optimization

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Enable cluster mode (PM2)
pm2 start ecosystem.config.js -i max
```

### 2. Database Optimization

```sql
-- SQLite optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA temp_store = MEMORY;

-- Create indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_tokens_user_active ON api_tokens(user_id, is_active);
```

### 3. Nginx Optimization

```nginx
# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Enable compression
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use HAProxy or Nginx for load balancing
2. **Session Storage**: Move to Redis for shared sessions
3. **Database**: Migrate to PostgreSQL for better concurrency
4. **File Storage**: Use S3 or similar for shared file storage

### Vertical Scaling

1. **CPU**: Claude CLI operations are CPU-intensive
2. **Memory**: Each connection uses ~50MB
3. **Disk**: Fast SSD recommended for SQLite
4. **Network**: 1Gbps+ for many clients

## Maintenance

### Regular Tasks

- **Weekly**: Review logs for errors
- **Monthly**: Update dependencies
- **Quarterly**: Security audit
- **Yearly**: Major version upgrades

### Update Process

```bash
# Backup first
./scripts/backup.sh

# Update code
git pull origin main
npm ci
npm run build

# Restart services
pm2 reload all
# or
sudo systemctl restart claude-ui
```