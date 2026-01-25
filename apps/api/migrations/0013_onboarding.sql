ALTER TABLE organizations ADD COLUMN onboarding_completed INTEGER DEFAULT 0;

-- Mark existing organizations as onboarded
UPDATE organizations SET onboarding_completed = 1;
