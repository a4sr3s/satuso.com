import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../types';
import { hashPassword } from '../utils/password';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { strictRateLimiter } from '../middleware/rate-limit';

const organizations = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes except accept-invite
organizations.use('*', async (c, next) => {
  // Skip auth for accept-invite endpoint
  if (c.req.path.endsWith('/accept-invite') && c.req.method === 'POST') {
    return next();
  }
  return clerkAuthMiddleware(c, next);
});

// Schemas
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'rep']).default('rep'),
});

const acceptInviteSchema = z.object({
  token: z.string(),
  name: z.string().min(2),
  password: z.string().min(8),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).optional(),
});

// Get current organization
organizations.get('/', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const org = await c.env.DB.prepare(
    `SELECT o.*,
      (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
     FROM organizations o
     WHERE o.id = ?`
  ).bind(user.organization_id).first();

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  return c.json({ success: true, data: org });
});

// Update organization
organizations.patch('/', zValidator('json', updateOrgSchema), async (c) => {
  const user = c.get('user');
  const updates = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Check if user is admin or owner
  const org = await c.env.DB.prepare(
    'SELECT owner_id FROM organizations WHERE id = ?'
  ).bind(user.organization_id).first<{ owner_id: string }>();

  if (!org || (org.owner_id !== user.id && user.role !== 'admin')) {
    return c.json({ success: false, error: 'Not authorized to update organization' }, 403);
  }

  const now = new Date().toISOString();

  if (updates.name) {
    await c.env.DB.prepare(
      'UPDATE organizations SET name = ?, updated_at = ? WHERE id = ?'
    ).bind(updates.name, now, user.organization_id).run();
  }

  return c.json({ success: true });
});

// List organization members
organizations.get('/members', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const members = await c.env.DB.prepare(
    `SELECT id, email, name, role, avatar_url, created_at
     FROM users
     WHERE organization_id = ?
     ORDER BY created_at ASC`
  ).bind(user.organization_id).all();

  return c.json({ success: true, data: members.results });
});

// Invite a new member
organizations.post('/invite', zValidator('json', inviteSchema), async (c) => {
  const user = c.get('user');
  const { email, role } = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Check if user has permission to invite (admin or manager)
  if (user.role !== 'admin' && user.role !== 'manager') {
    return c.json({ success: false, error: 'Not authorized to invite members' }, 403);
  }

  // Get organization with user count
  const org = await c.env.DB.prepare(
    `SELECT o.*,
      (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
      (SELECT COUNT(*) FROM organization_invites WHERE organization_id = o.id AND accepted_at IS NULL AND expires_at > datetime('now')) as pending_invites
     FROM organizations o
     WHERE o.id = ?`
  ).bind(user.organization_id).first<{
    id: string;
    name: string;
    plan: string;
    user_limit: number;
    user_count: number;
    pending_invites: number;
  }>();

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  // Check user limit (including pending invites)
  const totalUsers = org.user_count + org.pending_invites;
  if (org.user_limit && totalUsers >= org.user_limit) {
    return c.json({
      success: false,
      error: `User limit reached (${org.user_limit} users). Upgrade to Enterprise for unlimited users.`,
      code: 'USER_LIMIT_REACHED'
    }, 403);
  }

  // Check if email is already a member
  const existingMember = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ? AND organization_id = ?'
  ).bind(email.toLowerCase(), user.organization_id).first();

  if (existingMember) {
    return c.json({ success: false, error: 'User is already a member of this organization' }, 400);
  }

  // Check if there's already a pending invite
  const existingInvite = await c.env.DB.prepare(
    `SELECT id FROM organization_invites
     WHERE email = ? AND organization_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')`
  ).bind(email.toLowerCase(), user.organization_id).first();

  if (existingInvite) {
    return c.json({ success: false, error: 'An invite is already pending for this email' }, 400);
  }

  // Create invite
  const inviteId = nanoid();
  const inviteToken = nanoid(32);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await c.env.DB.prepare(
    `INSERT INTO organization_invites (id, organization_id, email, role, invited_by, token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(inviteId, user.organization_id, email.toLowerCase(), role, user.id, inviteToken, expiresAt, now).run();

  // In a real app, you'd send an email here with the invite link
  // For now, return the token so it can be used/tested
  return c.json({
    success: true,
    data: {
      inviteId,
      inviteToken,
      expiresAt,
      // The invite URL would be something like: https://app.satuso.com/invite/{token}
    }
  });
});

// List pending invites
organizations.get('/invites', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const invites = await c.env.DB.prepare(
    `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, u.name as invited_by_name
     FROM organization_invites i
     LEFT JOIN users u ON i.invited_by = u.id
     WHERE i.organization_id = ? AND i.accepted_at IS NULL AND i.expires_at > datetime('now')
     ORDER BY i.created_at DESC`
  ).bind(user.organization_id).all();

  return c.json({ success: true, data: invites.results });
});

// Cancel/delete an invite
organizations.delete('/invites/:id', async (c) => {
  const user = c.get('user');
  const inviteId = c.req.param('id');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Check permission
  if (user.role !== 'admin' && user.role !== 'manager') {
    return c.json({ success: false, error: 'Not authorized' }, 403);
  }

  await c.env.DB.prepare(
    'DELETE FROM organization_invites WHERE id = ? AND organization_id = ?'
  ).bind(inviteId, user.organization_id).run();

  return c.json({ success: true });
});

// Accept invite (public endpoint - no auth required)
// Apply strict rate limiting to prevent brute-force attacks on invite tokens
organizations.post('/accept-invite', strictRateLimiter, zValidator('json', acceptInviteSchema), async (c) => {
  const { token, name, password } = c.req.valid('json');

  // Find the invite
  const invite = await c.env.DB.prepare(
    `SELECT i.*, o.name as org_name
     FROM organization_invites i
     JOIN organizations o ON i.organization_id = o.id
     WHERE i.token = ? AND i.accepted_at IS NULL AND i.expires_at > datetime('now')`
  ).bind(token).first<{
    id: string;
    organization_id: string;
    email: string;
    role: string;
    org_name: string;
  }>();

  if (!invite) {
    return c.json({ success: false, error: 'Invalid or expired invite' }, 400);
  }

  // Check if user already exists with this email
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(invite.email).first();

  if (existingUser) {
    return c.json({ success: false, error: 'An account with this email already exists' }, 400);
  }

  // Create the user
  const userId = nanoid();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, organization_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, invite.email, name, passwordHash, invite.role, invite.organization_id, now, now).run();

  // Mark invite as accepted
  await c.env.DB.prepare(
    'UPDATE organization_invites SET accepted_at = ? WHERE id = ?'
  ).bind(now, invite.id).run();

  return c.json({
    success: true,
    data: {
      message: 'Account created successfully. You can now log in.',
      email: invite.email
    }
  });
});

// Remove a member (admin only)
organizations.delete('/members/:id', async (c) => {
  const user = c.get('user');
  const memberId = c.req.param('id');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Only admins can remove members
  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can remove members' }, 403);
  }

  // Can't remove yourself
  if (memberId === user.id) {
    return c.json({ success: false, error: 'Cannot remove yourself' }, 400);
  }

  // Check if member belongs to this organization
  const member = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ? AND organization_id = ?'
  ).bind(memberId, user.organization_id).first();

  if (!member) {
    return c.json({ success: false, error: 'Member not found' }, 404);
  }

  // Check if trying to remove the owner
  const org = await c.env.DB.prepare(
    'SELECT owner_id FROM organizations WHERE id = ?'
  ).bind(user.organization_id).first<{ owner_id: string }>();

  if (org?.owner_id === memberId) {
    return c.json({ success: false, error: 'Cannot remove the organization owner' }, 400);
  }

  // Remove the member (set organization_id to null rather than deleting)
  await c.env.DB.prepare(
    'UPDATE users SET organization_id = NULL, updated_at = ? WHERE id = ?'
  ).bind(new Date().toISOString(), memberId).run();

  return c.json({ success: true });
});

export default organizations;
