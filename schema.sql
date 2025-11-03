-- D1 Database Schema for iceberg.rest

-- Sessions table - stores encrypted credentials and session metadata
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    auth_type TEXT NOT NULL, -- 'bearer', 'oauth2', 'sigv4'
    encrypted_credentials TEXT NOT NULL, -- JSON string with auth credentials (encrypted)
    endpoint TEXT NOT NULL,
    warehouse TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT
);

-- Analytics table - non-sensitive usage metrics
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'page_view', 'login', 'catalog_browse', 'table_view', 'connect_view'
    timestamp INTEGER NOT NULL,
    session_id TEXT,
    country TEXT,
    city TEXT,
    user_agent TEXT,
    browser TEXT,
    os TEXT,
    metadata TEXT -- JSON string for additional event-specific data
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);

-- Catalog usage table - track which catalogs are being used (no credentials)
CREATE TABLE IF NOT EXISTS catalog_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    endpoint_domain TEXT NOT NULL, -- just the domain, not full URL
    timestamp INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'connect', 'list_namespaces', 'list_tables', 'load_table'
    success BOOLEAN NOT NULL,
    response_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_catalog_usage_timestamp ON catalog_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_catalog_usage_endpoint ON catalog_usage(endpoint_domain);
