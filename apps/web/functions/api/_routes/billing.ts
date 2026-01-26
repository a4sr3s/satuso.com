import { Hono } from 'hono';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { StripeClient, verifyWebhookSignature } from '../_utils/stripe';

const billing = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /subscription - requires auth
billing.get('/subscription', clerkAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user?.organization_id) {
    return c.json({ success: false, error: 'No organization' }, 400);
  }

  const org = await c.env.DB.prepare(
    'SELECT subscription_status, stripe_customer_id, onboarding_completed, trial_ends_at FROM organizations WHERE id = ?'
  ).bind(user.organization_id).first<{
    subscription_status: string | null;
    stripe_customer_id: string | null;
    onboarding_completed: number | null;
    trial_ends_at: string | null;
  }>();

  const now = new Date();
  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;

  // Check if trial is active (trial_ends_at exists and is in the future)
  const isInTrial = trialEndsAt !== null && trialEndsAt > now;

  // Calculate days remaining in trial
  let trialDaysRemaining = 0;
  if (isInTrial && trialEndsAt) {
    trialDaysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // User has access if subscription is active OR trial is still active
  // If trial_ends_at is NULL (existing users), consider them grandfathered/paid
  const subscriptionStatus = org?.subscription_status || 'inactive';
  const isSubscriptionActive = subscriptionStatus === 'active';
  const isActive = isSubscriptionActive || isInTrial || org?.trial_ends_at === null;

  return c.json({
    success: true,
    data: {
      status: isSubscriptionActive ? 'active' : (isInTrial ? 'trialing' : subscriptionStatus),
      plan: isSubscriptionActive || isInTrial || org?.trial_ends_at === null ? 'standard' : 'none',
      stripeCustomerId: org?.stripe_customer_id || null,
      onboardingCompleted: org?.onboarding_completed === 1,
      isInTrial,
      trialEndsAt: org?.trial_ends_at,
      trialDaysRemaining,
      isActive,
    },
  });
});

// POST /checkout - requires auth
billing.post('/checkout', clerkAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user?.organization_id) {
    return c.json({ success: false, error: 'No organization' }, 400);
  }

  const stripe = new StripeClient(c.env.STRIPE_SECRET_KEY);

  const org = await c.env.DB.prepare(
    'SELECT id, name, stripe_customer_id FROM organizations WHERE id = ?'
  ).bind(user.organization_id).first<{
    id: string;
    name: string;
    stripe_customer_id: string | null;
  }>();

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.createCustomer(user.email, org.name, {
      organization_id: org.id,
    });
    customerId = customer.id;

    await c.env.DB.prepare(
      'UPDATE organizations SET stripe_customer_id = ? WHERE id = ?'
    ).bind(customerId, org.id).run();
  }

  const origin = new URL(c.req.url).origin;
  const session = await stripe.createCheckoutSession({
    customer: customerId,
    priceId: c.env.STRIPE_PRICE_ID,
    successUrl: `${origin}/billing/success`,
    cancelUrl: `${origin}/subscribe`,
    metadata: { organization_id: org.id },
  });

  return c.json({ success: true, data: { url: session.url } });
});

// POST /portal - requires auth
billing.post('/portal', clerkAuthMiddleware, async (c) => {
  const user = c.get('user');
  if (!user?.organization_id) {
    return c.json({ success: false, error: 'No organization' }, 400);
  }

  const org = await c.env.DB.prepare(
    'SELECT stripe_customer_id FROM organizations WHERE id = ?'
  ).bind(user.organization_id).first<{
    stripe_customer_id: string | null;
  }>();

  if (!org?.stripe_customer_id) {
    return c.json({ success: false, error: 'No billing account found' }, 400);
  }

  const stripe = new StripeClient(c.env.STRIPE_SECRET_KEY);
  const origin = new URL(c.req.url).origin;
  const session = await stripe.createPortalSession(org.stripe_customer_id, `${origin}/settings`);

  return c.json({ success: true, data: { url: session.url } });
});

// POST /webhook - NO auth middleware
billing.post('/webhook', async (c) => {
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ success: false, error: 'Missing signature' }, 400);
  }

  const payload = await c.req.text();
  const isValid = await verifyWebhookSignature(payload, signature, c.env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid signature' }, 400);
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      await c.env.DB.prepare(
        `UPDATE organizations
         SET subscription_status = 'active', stripe_subscription_id = ?
         WHERE stripe_customer_id = ?`
      ).bind(subscriptionId, customerId).run();
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'canceled'
        : 'inactive';

      await c.env.DB.prepare(
        `UPDATE organizations SET subscription_status = ? WHERE stripe_customer_id = ?`
      ).bind(status, subscription.customer).run();
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      await c.env.DB.prepare(
        `UPDATE organizations SET subscription_status = 'canceled' WHERE stripe_customer_id = ?`
      ).bind(subscription.customer).run();
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      await c.env.DB.prepare(
        `UPDATE organizations SET subscription_status = 'past_due' WHERE stripe_customer_id = ?`
      ).bind(invoice.customer).run();
      break;
    }
  }

  return c.json({ received: true });
});

export default billing;
