-- Migration: Add missing indexes for performance
-- These indexes address slow queries identified in the production readiness review

-- Contacts: Index for sorting by created_at
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Activities: Index for deal activity feeds (sorted by creation)
CREATE INDEX IF NOT EXISTS idx_activities_deal_created ON activities(deal_id, created_at DESC);

-- Activities: Index for company lookups
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id);

-- Deals: Composite index for pipeline view (stage + owner)
CREATE INDEX IF NOT EXISTS idx_deals_stage_owner ON deals(stage, owner_id);

-- Tasks: Composite index for task list filtering
CREATE INDEX IF NOT EXISTS idx_tasks_owner_completed ON tasks(owner_id, completed);

-- Tasks: Index for due date filtering
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Workboards: Index for default workboard lookup
CREATE INDEX IF NOT EXISTS idx_workboards_entity_default ON workboards(entity_type, is_default);

-- Deal team: Index for finding team members by user
CREATE INDEX IF NOT EXISTS idx_deal_team_user ON deal_team(user_id);
