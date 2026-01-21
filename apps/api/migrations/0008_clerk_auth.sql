-- Add Clerk user ID to users table (without UNIQUE constraint first)
ALTER TABLE users ADD COLUMN clerk_id TEXT;

-- Create unique index for Clerk ID lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);
