import { Context, Next } from 'hono';
import { verifyToken } from '@clerk/backend';
import type { Env, Variables } from '../types';
import { logger } from '../utils/logger';

export async function clerkAuthMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.env.CLERK_SECRET_KEY) {
    logger.error('CLERK_SECRET_KEY not configured', undefined, { action: 'config_error' });
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
    const email = payload.email as string | undefined;
    // Build full name from Clerk's first_name and last_name, or fall back to name field
    const firstName = payload.first_name as string | undefined;
    const lastName = payload.last_name as string | undefined;
    const clerkFullName = firstName && lastName
      ? `${firstName} ${lastName}`.trim()
      : (payload.name as string) || firstName || email?.split('@')[0] || 'User';

    // Check if user exists in our database
    let user = await c.env.DB.prepare(
      'SELECT id, email, name, role, organization_id FROM users WHERE clerk_id = ?'
    ).bind(clerkUserId).first<{
      id: string;
      email: string;
      name: string;
      role: string;
      organization_id: string | null;
    }>();

    // If user exists, sync name from Clerk if it has changed
    if (user && clerkFullName && user.name !== clerkFullName) {
      await c.env.DB.prepare(
        'UPDATE users SET name = ?, updated_at = ? WHERE id = ?'
      ).bind(clerkFullName, new Date().toISOString(), user.id).run();
      user.name = clerkFullName;
    }

    // If user doesn't exist, create them with an organization
    if (!user && email) {
      const { nanoid } = await import('nanoid');
      const userId = nanoid();
      const orgId = nanoid();
      const now = new Date().toISOString();

      // Create organization first
      await c.env.DB.prepare(
        `INSERT INTO organizations (id, name, plan, user_limit, owner_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(orgId, `${clerkFullName}'s Organization`, 'standard', 5, userId, now, now).run();

      // Create user (password_hash='clerk_managed' for Clerk-authenticated users)
      await c.env.DB.prepare(
        `INSERT INTO users (id, clerk_id, email, name, password_hash, role, organization_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, clerkUserId, email.toLowerCase(), clerkFullName, 'clerk_managed', 'admin', orgId, now, now).run();

      user = {
        id: userId,
        email: email.toLowerCase(),
        name: clerkFullName,
        role: 'admin',
        organization_id: orgId,
      };
    }

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 401);
    }

    // Extract Clerk organization ID from JWT (when user has selected an org)
    const clerkOrgId = payload.org_id as string | undefined;

    // Sync user's org_id if they're authenticated within a Clerk organization
    // This ensures sales rep filtering works correctly in AI chat
    if (clerkOrgId && user) {
      // Check if we need to update the user's org_id
      const currentOrgId = await c.env.DB.prepare(
        'SELECT org_id FROM users WHERE id = ?'
      ).bind(user.id).first<{ org_id: string | null }>();

      if (currentOrgId?.org_id !== clerkOrgId) {
        await c.env.DB.prepare(
          'UPDATE users SET org_id = ?, updated_at = ? WHERE id = ?'
        ).bind(clerkOrgId, new Date().toISOString(), user.id).run();
      }
    }

    c.set('userId', user.id);
    c.set('orgId', clerkOrgId);
    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id || undefined,
      org_id: clerkOrgId,
    });

    await next();
  } catch (error) {
    logger.warn('Clerk authentication failed', { action: 'auth_error' });
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
