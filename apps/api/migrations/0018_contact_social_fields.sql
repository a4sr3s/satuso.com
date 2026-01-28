-- Add social profile and location fields to contacts for enrichment data
ALTER TABLE contacts ADD COLUMN twitter_url TEXT;
ALTER TABLE contacts ADD COLUMN github_url TEXT;
ALTER TABLE contacts ADD COLUMN facebook_url TEXT;
ALTER TABLE contacts ADD COLUMN location TEXT;
ALTER TABLE contacts ADD COLUMN location_city TEXT;
ALTER TABLE contacts ADD COLUMN location_region TEXT;
ALTER TABLE contacts ADD COLUMN location_country TEXT;
