-- Migration for Existing Deployments Only
-- ⚠️  WARNING: This will drop the old sessions table and recreate it with the new schema
-- ⚠️  All users will need to re-login after running this migration
--
-- Use this ONLY if you have an existing deployment with the old schema.
-- For new deployments, use schema.sql instead.
--
-- Run with: npx wrangler d1 execute iceberg_sessions --remote --file=migration-auth-types-clean.sql

-- Drop the old table
DROP TABLE IF EXISTS sessions;

-- Create new sessions table with updated schema
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    auth_type TEXT NOT NULL DEFAULT 'bearer',
    encrypted_credentials TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    warehouse TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT
);

-- Create index
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
