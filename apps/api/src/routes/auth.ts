import { Hono } from 'hono';
import { sign } from '@tsndr/cloudflare-worker-jwt';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { registerSchema, loginSchema } from '../schemas';
import { hashPassword, verifyPassword, isLegacyHash } from '../utils/password';
import { strictRateLimiter } from '../middleware/rate-limit';
import { logger } from '../utils/logger';
import { logAudit } from '../utils/audit';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply strict rate limiting to auth routes
auth.use('*', strictRateLimiter);

// Register new user
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  // Check if user already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existing) {
    return c.json({ success: false, error: 'User already exists' }, 400);
  }

  // Hash password using PBKDF2
  const passwordHash = await hashPassword(password);

  const userId = nanoid();
  const orgId = nanoid();
  const now = new Date().toISOString();

  // Create organization first
  await c.env.DB.prepare(
    `INSERT INTO organizations (id, name, plan, user_limit, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(orgId, `${name}'s Organization`, 'standard', 5, userId, now, now).run();

  // Create user with organization
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, organization_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, email.toLowerCase(), name, passwordHash, 'admin', orgId, now, now).run();

  // Validate JWT_SECRET is configured
  if (!c.env.JWT_SECRET) {
    logger.error('JWT_SECRET not configured', undefined, { action: 'config_error' });
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  // Generate JWT
  const token = await sign(
    {
      sub: userId,
      email: email.toLowerCase(),
      name,
      role: 'admin',
      organizationId: orgId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    },
    c.env.JWT_SECRET
  );

  // Store session in KV
  await c.env.KV.put(`session:${token}`, JSON.stringify({ userId, email, organizationId: orgId }), {
    expirationTtl: 86400 * 7,
  });

  // Audit log: user created
  await logAudit(c.env.DB, {
    action: 'user.created',
    userId,
    orgId,
    targetId: userId,
    targetType: 'user',
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
  });

  // Audit log: org created
  await logAudit(c.env.DB, {
    action: 'org.created',
    userId,
    orgId,
    targetId: orgId,
    targetType: 'organization',
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
  });

  return c.json({
    success: true,
    data: {
      token,
      user: { id: userId, email: email.toLowerCase(), name, role: 'admin', organizationId: orgId },
    },
  });
});

// Login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, password_hash, organization_id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{
    id: string;
    email: string;
    name: string;
    role: string;
    password_hash: string;
    organization_id: string | null;
  }>();

  // Mitigate timing attacks: always perform password verification
  // even when user doesn't exist, to ensure consistent response times
  // This prevents username enumeration via timing side-channel
  const dummyHash = '100000$0000000000000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
  const hashToVerify = user?.password_hash ?? dummyHash;
  const isValid = await verifyPassword(password, hashToVerify);

  // Check both conditions together to avoid early return timing leak
  if (!user || !isValid) {
    // Audit log: failed login attempt
    await logAudit(c.env.DB, {
      action: 'user.login_failed',
      metadata: { attemptedEmail: email.toLowerCase() },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent'),
    });
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  // Auto-upgrade legacy SHA-256 hashes to PBKDF2 on successful login
  if (isLegacyHash(user.password_hash)) {
    const upgradedHash = await hashPassword(password);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(upgradedHash, new Date().toISOString(), user.id).run();
  }

  // Validate JWT_SECRET is configured
  if (!c.env.JWT_SECRET) {
    logger.error('JWT_SECRET not configured', undefined, { action: 'config_error' });
    return c.json({ success: false, error: 'Server configuration error' }, 500);
  }

  // Generate JWT
  const token = await sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7,
    },
    c.env.JWT_SECRET
  );

  // Store session in KV
  await c.env.KV.put(`session:${token}`, JSON.stringify({ userId: user.id, email: user.email, organizationId: user.organization_id }), {
    expirationTtl: 86400 * 7,
  });

  // Audit log: successful login
  await logAudit(c.env.DB, {
    action: 'user.login',
    userId: user.id,
    orgId: user.organization_id || undefined,
    targetId: user.id,
    targetType: 'user',
    ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
  });

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organization_id },
    },
  });
});

// Logout
auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  let userId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const sessionData = await c.env.KV.get(`session:${token}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      userId = session.userId;
    }
    await c.env.KV.delete(`session:${token}`);
  }

  // Audit log: logout
  if (userId) {
    await logAudit(c.env.DB, {
      action: 'user.logout',
      userId,
      targetId: userId,
      targetType: 'user',
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent'),
    });
  }

  return c.json({ success: true });
});

// Get current user
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  const session = await c.env.KV.get(`session:${token}`);

  if (!session) {
    return c.json({ success: false, error: 'Session expired' }, 401);
  }

  const { userId } = JSON.parse(session);

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, avatar_url, organization_id, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user });
});

export default auth;
