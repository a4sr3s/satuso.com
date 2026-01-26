-- Add org_id to users table for Clerk organization membership tracking
-- This allows filtering sales reps by their Clerk organization

ALTER TABLE users ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
