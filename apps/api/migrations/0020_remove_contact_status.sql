-- Remove status field from contacts table
-- Status doesn't make sense for contacts - it was more appropriate for deals

-- Drop the status index first
DROP INDEX IF EXISTS idx_contacts_status;

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- Create a new table without the status column
CREATE TABLE contacts_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  github_url TEXT,
  facebook_url TEXT,
  location TEXT,
  location_city TEXT,
  location_region TEXT,
  location_country TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy data from old table (excluding status column)
INSERT INTO contacts_new (id, name, email, phone, title, company_id, owner_id, org_id, source,
  linkedin_url, twitter_url, github_url, facebook_url, location, location_city, location_region,
  location_country, last_contacted_at, created_at, updated_at)
SELECT id, name, email, phone, title, company_id, owner_id, org_id, source,
  linkedin_url, twitter_url, github_url, facebook_url, location, location_city, location_region,
  location_country, last_contacted_at, created_at, updated_at
FROM contacts;

-- Drop old table
DROP TABLE contacts;

-- Rename new table to contacts
ALTER TABLE contacts_new RENAME TO contacts;

-- Recreate indexes (except the status index which we don't want)
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
