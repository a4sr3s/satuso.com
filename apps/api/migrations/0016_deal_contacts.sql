-- Migration: Add support for multiple contacts per deal
-- Creates a junction table to allow many-to-many relationship between deals and contacts

CREATE TABLE IF NOT EXISTS deal_contacts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal ON deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact ON deal_contacts(contact_id);

-- Migrate existing contact_id data to the new junction table
INSERT INTO deal_contacts (id, deal_id, contact_id, created_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  contact_id,
  datetime('now')
FROM deals
WHERE contact_id IS NOT NULL;
