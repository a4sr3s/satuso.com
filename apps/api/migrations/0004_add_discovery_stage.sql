-- Add 'discovery' stage to deals
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints directly,
-- so we need to recreate the table

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE deals_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value REAL DEFAULT 0,
  stage TEXT DEFAULT 'lead' CHECK (stage IN ('lead', 'qualified', 'discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  probability INTEGER,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  owner_id TEXT REFERENCES users(id),
  close_date TEXT,
  spin_situation TEXT,
  spin_problem TEXT,
  spin_implication TEXT,
  spin_need_payoff TEXT,
  spin_progress INTEGER DEFAULT 0,
  ai_score INTEGER,
  ai_score_reason TEXT,
  stage_changed_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Step 2: Copy data from old table
INSERT INTO deals_new SELECT * FROM deals;

-- Step 3: Drop old table
DROP TABLE deals;

-- Step 4: Rename new table
ALTER TABLE deals_new RENAME TO deals;

-- Step 5: Recreate indexes
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_stage ON deals(stage);
