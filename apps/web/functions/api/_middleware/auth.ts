import { Context, Next } from 'hono';
import { verify, decode } from '@tsndr/cloudflare-worker-jwt';
import type { Env, Variables } from '../_types';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!c.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set');
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const isValid = await verify(token, c.env.JWT_SECRET);

    if (!isValid) {
      return c.json({ success: false, error: 'Invalid token' }, 401);
    }

    const decoded = decode(token);
    const payload = decoded.payload as { sub: string; email: string; name: string; role: string; organizationId?: string };

    c.set('userId', payload.sub);
    c.set('user', {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      organization_id: payload.organizationId,
    });

    await next();
  } catch (error) {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
}

export async function optionalAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');

    if (!c.env.JWT_SECRET) {
      await next();
      return;
    }

    try {
      const isValid = await verify(token, c.env.JWT_SECRET);

      if (isValid) {
        const decoded = decode(token);
        const payload = decoded.payload as { sub: string; email: string; name: string; role: string; organizationId?: string };

        c.set('userId', payload.sub);
        c.set('user', {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          organization_id: payload.organizationId,
        });
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  await next();
}
