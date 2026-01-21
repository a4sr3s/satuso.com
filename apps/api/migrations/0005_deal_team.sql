-- Deal Team table for assigning multiple team members to deals
-- Roles: owner (primary AE), technical (SE/SA), executive_sponsor, support
CREATE TABLE IF NOT EXISTS deal_team (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'technical', 'executive_sponsor', 'support')),
  assigned_at TEXT DEFAULT (datetime('now')),
  assigned_by TEXT REFERENCES users(id),
  notes TEXT,
  UNIQUE(deal_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_deal_team_deal ON deal_team(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_user ON deal_team(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_role ON deal_team(role);

-- Add job_function to users for filtering (ae, se, sa, csm, manager)
ALTER TABLE users ADD COLUMN job_function TEXT DEFAULT 'ae' CHECK (job_function IN ('ae', 'se', 'sa', 'csm', 'manager', 'executive'));
