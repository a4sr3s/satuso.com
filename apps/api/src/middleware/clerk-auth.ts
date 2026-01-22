import { Context, Next } from 'hono';
import { verifyToken } from '@clerk/backend';
import type { Env, Variables } from '../types';

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
    const email = payload.email as string | undefined;
    const name = (payload.name as string) || (payload.first_name as string) || email?.split('@')[0] || 'User';

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
      ).bind(orgId, `${name}'s Organization`, 'standard', 5, userId, now, now).run();

      // Create user
      await c.env.DB.prepare(
        `INSERT INTO users (id, clerk_id, email, name, role, organization_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, clerkUserId, email.toLowerCase(), name, 'admin', orgId, now, now).run();

      user = {
        id: userId,
        email: email.toLowerCase(),
        name,
        role: 'admin',
        organization_id: orgId,
      };
    }

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 401);
    }

    // Extract Clerk organization ID from JWT (when user has selected an org)
    const clerkOrgId = payload.org_id as string | undefined;

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
