import { Context, Next } from 'hono';
import { verifyToken, createClerkClient } from '@clerk/backend';
import type { Env, Variables } from '../_types';

export async function clerkAuthMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.env.CLERK_SECRET_KEY) {
    console.error('CRITICAL: CLERK_SECRET_KEY environment variable is not set');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = await verifyToken(token, {
      secretKey: c.env.CLERK_SECRET_KEY,
    });

    if (!payload) {
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }

    // Get or create user from Clerk data
    const clerkUserId = payload.sub;

    // Try to get email from JWT first
    let email = (payload.email as string)
      || (payload.primary_email_address as string)
      || ((payload.email_addresses as any)?.[0]?.email_address as string)
      || undefined;

    let firstName = (payload.firstName as string) || (payload.first_name as string);
    let lastName = (payload.lastName as string) || (payload.last_name as string);

    // If email not in JWT, fetch from Clerk API (this is the common case)
    if (!email) {
      try {
        const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
        const clerkUser = await clerk.users.getUser(clerkUserId);
        email = clerkUser.emailAddresses?.[0]?.emailAddress;
        firstName = firstName || clerkUser.firstName || undefined;
        lastName = lastName || clerkUser.lastName || undefined;
        console.log('Fetched user from Clerk API:', { email, firstName, lastName, clerkUserId });
      } catch (clerkError) {
        console.error('Failed to fetch user from Clerk:', clerkError);
        // Don't silently continue - we need the email to create the user
        return c.json({ success: false, error: 'Failed to fetch user data from authentication provider' }, 500);
      }
    }

    // If we still don't have an email, we cannot proceed
    if (!email) {
      console.error('No email found for user:', clerkUserId);
      return c.json({ success: false, error: 'No email address associated with account' }, 400);
    }

    const name = firstName && lastName
      ? `${firstName} ${lastName}`.trim()
      : firstName
        ? firstName
        : (payload.name as string) || email?.split('@')[0] || 'User';

    // Check if user exists in our database
    let user = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.organization_id, o.subscription_status, o.trial_ends_at
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.clerk_id = ?`
    ).bind(clerkUserId).first<{
      id: string;
      email: string;
      name: string;
      role: string;
      organization_id: string | null;
      subscription_status: string | null;
      trial_ends_at: string | null;
    }>();

    // If user doesn't exist, create them with an organization
    if (!user) {
      console.log('Creating new user:', { email, clerkUserId, name });
      try {
        const { nanoid } = await import('nanoid');
        const userId = nanoid();
        const orgId = nanoid();
        const now = new Date().toISOString();
        // Set trial to expire in 30 days
        const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        // IMPORTANT: Create user FIRST (without organization_id) because organizations.owner_id
        // has a foreign key constraint to users.id
        const userResult = await c.env.DB.prepare(
          `INSERT INTO users (id, clerk_id, email, name, password_hash, role, organization_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`
        ).bind(userId, clerkUserId, email.toLowerCase(), name, 'clerk_managed', 'admin', now, now).run();

        if (!userResult.success) {
          console.error('Failed to create user:', userResult);
          return c.json({ success: false, error: 'Failed to create user' }, 500);
        }
        console.log('Created user:', { userId, email });

        // Now create organization with 30-day trial (owner_id can now reference the user)
        // Set onboarding_completed = 1 since we're auto-creating the org
        const orgResult = await c.env.DB.prepare(
          `INSERT INTO organizations (id, name, plan, user_limit, owner_id, trial_ends_at, onboarding_completed, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).bind(orgId, `${name}'s Organization`, 'standard', 5, userId, trialEndsAt, now, now).run();

        if (!orgResult.success) {
          console.error('Failed to create organization:', orgResult);
          // Rollback: delete the user we just created
          await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
          return c.json({ success: false, error: 'Failed to create organization' }, 500);
        }
        console.log('Created organization:', { orgId, trialEndsAt });

        // Update user with organization_id
        const updateResult = await c.env.DB.prepare(
          `UPDATE users SET organization_id = ? WHERE id = ?`
        ).bind(orgId, userId).run();

        if (!updateResult.success) {
          console.error('Failed to update user with organization:', updateResult);
          return c.json({ success: false, error: 'Failed to link user to organization' }, 500);
        }
        console.log('Linked user to organization');

        user = {
          id: userId,
          email: email.toLowerCase(),
          name,
          role: 'admin',
          organization_id: orgId,
          subscription_status: 'inactive',
          trial_ends_at: trialEndsAt,
        };
        console.log('Successfully created user and organization:', { userId, orgId, email, trialEndsAt });
      } catch (dbError) {
        console.error('Database error during user creation:', dbError);
        return c.json({ success: false, error: 'Database error' }, 500);
      }
    }

    if (!user) {
      // This should not happen - if we reach here, something unexpected occurred
      console.error('User creation failed unexpectedly. Email:', email, 'ClerkId:', clerkUserId);
      return c.json({ success: false, error: 'Failed to create user account' }, 500);
    }

    // Calculate if user has active access (subscription active OR in trial OR grandfathered)
    const isSubscriptionActive = user.subscription_status === 'active';
    const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    const isInTrial = trialEndsAt !== null && trialEndsAt > new Date();
    const isGrandfathered = user.trial_ends_at === null; // NULL means grandfathered/paid
    const hasAccess = isSubscriptionActive || isInTrial || isGrandfathered;

    // Create trial expiration notifications (only for users in trial, not subscribed)
    if (isInTrial && !isSubscriptionActive && trialEndsAt) {
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const today = now.toISOString().split('T')[0];

      // Only create notifications at 7, 3, and 1 days remaining
      if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
        try {
          // Check if we've already created a notification today for this threshold
          const existingNotification = await c.env.DB.prepare(
            `SELECT id FROM notifications
             WHERE user_id = ? AND title LIKE ? AND DATE(created_at) = ?`
          ).bind(user.id, `%trial%${daysRemaining}%`, today).first();

          if (!existingNotification) {
            const { nanoid } = await import('nanoid');
            const notificationId = nanoid();
            const title = daysRemaining === 1
              ? 'Your trial ends tomorrow!'
              : `${daysRemaining} days left in your trial`;
            const message = daysRemaining === 1
              ? 'Subscribe now to keep access to all your data and features.'
              : `Your free trial ends in ${daysRemaining} days. Subscribe to continue using Satuso.`;

            await c.env.DB.prepare(
              `INSERT INTO notifications (id, user_id, type, title, message, action_url, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              notificationId,
              user.id,
              daysRemaining === 1 ? 'error' : 'warning',
              title,
              message,
              '/subscribe',
              now.toISOString()
            ).run();
          }
        } catch (notifError) {
          // Don't fail auth if notification creation fails
          console.error('Failed to create trial notification:', notifError);
        }
      }
    }

    c.set('userId', user.id);
    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id || undefined,
      subscription_status: user.subscription_status || 'inactive',
    });

    // Subscription gate: reject users without access (except billing routes)
    const path = c.req.path;
    if (!path.includes('/billing') && !hasAccess) {
      return c.json({ success: false, error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' }, 402);
    }

    await next();
  } catch (error) {
    console.error('Clerk auth error:', error);
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

export async function optionalClerkAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ') && c.env.CLERK_SECRET_KEY) {
    const token = authHeader.replace('Bearer ', '');

    try {
      const payload = await verifyToken(token, {
        secretKey: c.env.CLERK_SECRET_KEY,
      });

      if (payload) {
        const clerkUserId = payload.sub;

        const user = await c.env.DB.prepare(
          'SELECT id, email, name, role, organization_id FROM users WHERE clerk_id = ?'
        ).bind(clerkUserId).first<{
          id: string;
          email: string;
          name: string;
          role: string;
          organization_id: string | null;
        }>();

        if (user) {
          c.set('userId', user.id);
          c.set('user', {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organization_id: user.organization_id || undefined,
          });
        }
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  await next();
}
