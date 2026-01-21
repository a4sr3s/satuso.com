-- Workboards table for programmable table views
CREATE TABLE IF NOT EXISTS workboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('deals', 'contacts', 'companies')),
  owner_id TEXT REFERENCES users(id),
  is_default INTEGER DEFAULT 0,
  is_shared INTEGER DEFAULT 0,
  columns TEXT NOT NULL DEFAULT '[]', -- JSON array of column configs
  filters TEXT NOT NULL DEFAULT '[]', -- JSON array of filter conditions
  sort_column TEXT,
  sort_direction TEXT DEFAULT 'asc' CHECK (sort_direction IN ('asc', 'desc')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workboards_owner ON workboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_workboards_entity_type ON workboards(entity_type);
CREATE INDEX IF NOT EXISTS idx_workboards_is_default ON workboards(is_default);

-- Seed default workboards

-- 1. Pipeline Board - Active deals with SPIN score, days_in_stage, SLA breach
INSERT INTO workboards (id, name, description, entity_type, owner_id, is_default, is_shared, columns, filters, sort_column, sort_direction) VALUES
  ('wb_pipeline', 'Pipeline Board', 'Active deals with SPIN score, days in stage, and SLA tracking', 'deals', NULL, 1, 1,
   '[
     {"id": "name", "field": "name", "label": "Deal Name", "type": "raw", "width": 200},
     {"id": "company_name", "field": "company_name", "label": "Company", "type": "raw", "width": 150},
     {"id": "value", "field": "value", "label": "Value", "type": "raw", "format": "currency", "width": 100},
     {"id": "stage", "field": "stage", "label": "Stage", "type": "raw", "width": 120},
     {"id": "spin_score", "field": "spin_score", "label": "SPIN Score", "type": "formula", "formula": "spin_score", "width": 100},
     {"id": "days_in_stage", "field": "days_in_stage", "label": "Days in Stage", "type": "formula", "formula": "days_in_stage", "width": 110},
     {"id": "sla_breach", "field": "sla_breach", "label": "SLA Breach", "type": "formula", "formula": "sla_breach", "width": 100},
     {"id": "close_date", "field": "close_date", "label": "Close Date", "type": "raw", "format": "date", "width": 110}
   ]',
   '[{"field": "stage", "operator": "not_in", "value": ["closed_won", "closed_lost"]}]',
   'value', 'desc');

-- 2. Discovery Tracker - Incomplete SPIN deals sorted by value
INSERT INTO workboards (id, name, description, entity_type, owner_id, is_default, is_shared, columns, filters, sort_column, sort_direction) VALUES
  ('wb_discovery', 'Discovery Tracker', 'Deals with incomplete SPIN data, sorted by value', 'deals', NULL, 1, 1,
   '[
     {"id": "name", "field": "name", "label": "Deal Name", "type": "raw", "width": 200},
     {"id": "company_name", "field": "company_name", "label": "Company", "type": "raw", "width": 150},
     {"id": "value", "field": "value", "label": "Value", "type": "raw", "format": "currency", "width": 100},
     {"id": "stage", "field": "stage", "label": "Stage", "type": "raw", "width": 120},
     {"id": "spin_score", "field": "spin_score", "label": "SPIN Score", "type": "formula", "formula": "spin_score", "width": 100},
     {"id": "spin_situation", "field": "spin_situation", "label": "Situation", "type": "raw", "width": 150},
     {"id": "spin_problem", "field": "spin_problem", "label": "Problem", "type": "raw", "width": 150},
     {"id": "spin_implication", "field": "spin_implication", "label": "Implication", "type": "raw", "width": 150},
     {"id": "spin_need_payoff", "field": "spin_need_payoff", "label": "Need-Payoff", "type": "raw", "width": 150}
   ]',
   '[{"field": "spin_score", "operator": "lt", "value": 100}, {"field": "stage", "operator": "not_in", "value": ["closed_won", "closed_lost"]}]',
   'value', 'desc');

-- 3. Stale Deals - No activity in 14+ days
INSERT INTO workboards (id, name, description, entity_type, owner_id, is_default, is_shared, columns, filters, sort_column, sort_direction) VALUES
  ('wb_stale', 'Stale Deals', 'Deals with no activity in the last 14 days', 'deals', NULL, 1, 1,
   '[
     {"id": "name", "field": "name", "label": "Deal Name", "type": "raw", "width": 200},
     {"id": "company_name", "field": "company_name", "label": "Company", "type": "raw", "width": 150},
     {"id": "value", "field": "value", "label": "Value", "type": "raw", "format": "currency", "width": 100},
     {"id": "stage", "field": "stage", "label": "Stage", "type": "raw", "width": 120},
     {"id": "last_activity_days", "field": "last_activity_days", "label": "Days Since Activity", "type": "formula", "formula": "last_activity_days", "width": 140},
     {"id": "owner_name", "field": "owner_name", "label": "Owner", "type": "raw", "width": 120},
     {"id": "contact_name", "field": "contact_name", "label": "Contact", "type": "raw", "width": 120}
   ]',
   '[{"field": "last_activity_days", "operator": "gte", "value": 14}, {"field": "stage", "operator": "not_in", "value": ["closed_won", "closed_lost"]}]',
   'last_activity_days', 'desc');
