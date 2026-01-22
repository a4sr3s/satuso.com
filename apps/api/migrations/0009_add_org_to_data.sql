-- Add org_id to all data tables for multi-tenancy with Clerk organizations

-- Contacts
ALTER TABLE contacts ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);

-- Companies
ALTER TABLE companies ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(org_id);

-- Deals
ALTER TABLE deals ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(org_id);

-- Tasks
ALTER TABLE tasks ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(org_id);

-- Activities
ALTER TABLE activities ADD COLUMN org_id TEXT;
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(org_id);
