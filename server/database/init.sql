-- Initialize authentication database
PRAGMA foreign_keys = ON;

-- Users table (single user system)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    encryption_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Machines table for multi-machine support
CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'connecting')),
    last_seen DATETIME,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    capabilities TEXT, -- JSON array of capabilities
    metadata TEXT, -- JSON object for custom data
    is_removed BOOLEAN DEFAULT 0,
    removed_at DATETIME,
    auth_token TEXT UNIQUE,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for machines table
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_last_seen ON machines(last_seen);
CREATE INDEX IF NOT EXISTS idx_machines_is_removed ON machines(is_removed);
CREATE INDEX IF NOT EXISTS idx_machines_user_id ON machines(user_id);

-- API tokens table for persistent machine authentication
CREATE TABLE IF NOT EXISTS api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for api_tokens table
CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_active ON api_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_api_tokens_expires_at ON api_tokens(expires_at);

-- Machine settings table for per-machine configuration
CREATE TABLE IF NOT EXISTS machine_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    settings_data TEXT NOT NULL, -- JSON blob containing settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(machine_id, user_id)
);

-- Indexes for machine_settings table
CREATE INDEX IF NOT EXISTS idx_machine_settings_machine_id ON machine_settings(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_settings_user_id ON machine_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_settings_updated_at ON machine_settings(updated_at);