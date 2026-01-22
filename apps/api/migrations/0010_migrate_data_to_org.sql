-- Migrate all existing demo data to the specified organization
-- Organization ID: org_38ad09zEjqpIxbpHKOnjTRDd4MM

UPDATE contacts SET org_id = 'org_38ad09zEjqpIxbpHKOnjTRDd4MM' WHERE org_id IS NULL;
UPDATE companies SET org_id = 'org_38ad09zEjqpIxbpHKOnjTRDd4MM' WHERE org_id IS NULL;
UPDATE deals SET org_id = 'org_38ad09zEjqpIxbpHKOnjTRDd4MM' WHERE org_id IS NULL;
UPDATE tasks SET org_id = 'org_38ad09zEjqpIxbpHKOnjTRDd4MM' WHERE org_id IS NULL;
UPDATE activities SET org_id = 'org_38ad09zEjqpIxbpHKOnjTRDd4MM' WHERE org_id IS NULL;
