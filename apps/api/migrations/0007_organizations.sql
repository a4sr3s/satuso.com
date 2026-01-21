-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'standard' CHECK (plan IN ('standard', 'enterprise')),
  user_limit INTEGER DEFAULT 5,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

-- Add organization_id to users table
ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);

-- Organization invites table (for pending invitations)
CREATE TABLE IF NOT EXISTS organization_invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'rep' CHECK (role IN ('admin', 'manager', 'rep')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON organization_invites(token);
