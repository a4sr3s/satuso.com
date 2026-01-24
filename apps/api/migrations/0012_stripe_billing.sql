ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE organizations ADD COLUMN subscription_status TEXT DEFAULT 'inactive'
  CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'canceled'));

-- Grant existing organizations active status
UPDATE organizations SET subscription_status = 'active';
