import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';

const billing = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
billing.use('*', clerkAuthMiddleware);

// Get subscription status with trial info
billing.get('/subscription', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const org = await c.env.DB.prepare(
    `SELECT subscription_status, trial_ends_at, stripe_customer_id, onboarding_completed
     FROM organizations
     WHERE id = ?`
  ).bind(user.organization_id).first<{
    subscription_status: string | null;
    trial_ends_at: string | null;
    stripe_customer_id: string | null;
    onboarding_completed: number | null;
  }>();

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  const now = new Date();
  const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;

  // Check if trial is active (trial_ends_at exists and is in the future)
  const isInTrial = trialEndsAt !== null && trialEndsAt > now;

  // Calculate days remaining in trial
  let trialDaysRemaining = 0;
  if (isInTrial && trialEndsAt) {
    trialDaysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // User has access if subscription is active OR trial is still active
  // If trial_ends_at is NULL (existing users), consider them grandfathered/paid
  const subscriptionStatus = org.subscription_status || 'inactive';
  const isSubscriptionActive = subscriptionStatus === 'active';
  const isActive = isSubscriptionActive || isInTrial || org.trial_ends_at === null;

  return c.json({
    success: true,
    data: {
      status: isSubscriptionActive ? 'active' : (isInTrial ? 'trialing' : subscriptionStatus),
      plan: 'standard',
      stripeCustomerId: org.stripe_customer_id,
      onboardingCompleted: Boolean(org.onboarding_completed),
      isInTrial,
      trialEndsAt: org.trial_ends_at,
      trialDaysRemaining,
      isActive,
    },
  });
});

// Create checkout session (placeholder - implement with Stripe)
billing.post('/checkout', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // TODO: Implement Stripe checkout session creation
  // For now, return a placeholder
  return c.json({
    success: true,
    data: {
      url: 'https://checkout.stripe.com/placeholder',
    },
  });
});

// Create portal session (placeholder - implement with Stripe)
billing.post('/portal', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // TODO: Implement Stripe billing portal session creation
  // For now, return a placeholder
  return c.json({
    success: true,
    data: {
      url: 'https://billing.stripe.com/placeholder',
    },
  });
});

export default billing;
