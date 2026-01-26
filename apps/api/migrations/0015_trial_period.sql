-- Add trial_ends_at column to organizations for 30-day free trial tracking
ALTER TABLE organizations ADD COLUMN trial_ends_at TEXT;

-- Index for efficient queries on trial expiration
CREATE INDEX idx_organizations_trial_ends_at ON organizations(trial_ends_at);
