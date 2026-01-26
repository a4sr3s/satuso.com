import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env, Variables } from '../_types';
import { hashPassword } from '../_utils/password';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { strictRateLimiter } from '../_middleware/rate-limit';

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

const onboardingSchema = z.object({
  organizationName: z.string().min(2),
});

const updateMemberRoleSchema = z.object({
  job_function: z.enum(['ae', 'se', 'sa', 'csm', 'manager', 'executive']),
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

// Complete onboarding
organizations.post('/onboarding', zValidator('json', onboardingSchema), async (c) => {
  const user = c.get('user');
  const { organizationName } = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    'UPDATE organizations SET name = ?, onboarding_completed = 1, updated_at = ? WHERE id = ?'
  ).bind(organizationName, now, user.organization_id).run();

  return c.json({ success: true });
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
    `SELECT id, email, name, role, avatar_url, job_function, created_at
     FROM users
     WHERE organization_id = ?
     ORDER BY created_at ASC`
  ).bind(user.organization_id).all();

  return c.json({ success: true, data: members.results });
});

// Update a member's job function (admin only)
organizations.patch('/members/:id/role', zValidator('json', updateMemberRoleSchema), async (c) => {
  const user = c.get('user');
  const memberId = c.req.param('id');
  const { job_function } = c.req.valid('json');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  if (user.role !== 'admin') {
    return c.json({ success: false, error: 'Only admins can update member roles' }, 403);
  }

  const member = await c.env.DB.prepare(
    'SELECT id FROM users WHERE id = ? AND organization_id = ?'
  ).bind(memberId, user.organization_id).first();

  if (!member) {
    return c.json({ success: false, error: 'Member not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE users SET job_function = ?, updated_at = ? WHERE id = ?'
  ).bind(job_function, new Date().toISOString(), memberId).run();

  return c.json({ success: true });
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

// Accept invite (public endpoint - no auth required, rate limited)
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

// Delete account (self-deletion)
organizations.delete('/account', async (c) => {
  const user = c.get('user');

  if (!user.organization_id) {
    return c.json({ success: false, error: 'No organization found' }, 404);
  }

  // Get organization info
  const org = await c.env.DB.prepare(
    `SELECT o.id, o.owner_id,
      (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
     FROM organizations o
     WHERE o.id = ?`
  ).bind(user.organization_id).first<{
    id: string;
    owner_id: string;
    user_count: number;
  }>();

  if (!org) {
    return c.json({ success: false, error: 'Organization not found' }, 404);
  }

  const isOwner = org.owner_id === user.id;
  const isOnlyUser = org.user_count === 1;
  const shouldDeleteOrg = isOwner && isOnlyUser;

  // Start deletion process
  try {
    if (shouldDeleteOrg) {
      // Delete all organization data
      // Order matters due to foreign keys - delete child records first

      // Delete activities (references contacts, companies, deals)
      await c.env.DB.prepare(
        'DELETE FROM activities WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete deal_team entries
      await c.env.DB.prepare(
        `DELETE FROM deal_team WHERE deal_id IN (SELECT id FROM deals WHERE organization_id = ?)`
      ).bind(org.id).run();

      // Delete deals
      await c.env.DB.prepare(
        'DELETE FROM deals WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete tasks
      await c.env.DB.prepare(
        'DELETE FROM tasks WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete contacts (after activities that might reference them)
      await c.env.DB.prepare(
        'DELETE FROM contacts WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete companies (after contacts and activities)
      await c.env.DB.prepare(
        'DELETE FROM companies WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete workboards
      await c.env.DB.prepare(
        'DELETE FROM workboards WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete notifications
      await c.env.DB.prepare(
        'DELETE FROM notifications WHERE user_id = ?'
      ).bind(user.id).run();

      // Delete organization invites
      await c.env.DB.prepare(
        'DELETE FROM organization_invites WHERE organization_id = ?'
      ).bind(org.id).run();

      // Delete the user
      await c.env.DB.prepare(
        'DELETE FROM users WHERE id = ?'
      ).bind(user.id).run();

      // Delete the organization
      await c.env.DB.prepare(
        'DELETE FROM organizations WHERE id = ?'
      ).bind(org.id).run();
    } else {
      // Just delete the user, reassign ownership if needed
      if (isOwner && !isOnlyUser) {
        // Find another admin to transfer ownership
        const newOwner = await c.env.DB.prepare(
          `SELECT id FROM users
           WHERE organization_id = ? AND id != ? AND role = 'admin'
           ORDER BY created_at ASC
           LIMIT 1`
        ).bind(org.id, user.id).first<{ id: string }>();

        if (newOwner) {
          await c.env.DB.prepare(
            'UPDATE organizations SET owner_id = ? WHERE id = ?'
          ).bind(newOwner.id, org.id).run();
        } else {
          // No other admin, find any other user
          const anyUser = await c.env.DB.prepare(
            `SELECT id FROM users
             WHERE organization_id = ? AND id != ?
             ORDER BY created_at ASC
             LIMIT 1`
          ).bind(org.id, user.id).first<{ id: string }>();

          if (anyUser) {
            // Promote them to admin and transfer ownership
            await c.env.DB.prepare(
              'UPDATE users SET role = ? WHERE id = ?'
            ).bind('admin', anyUser.id).run();
            await c.env.DB.prepare(
              'UPDATE organizations SET owner_id = ? WHERE id = ?'
            ).bind(anyUser.id, org.id).run();
          }
        }
      }

      // Delete user's notifications
      await c.env.DB.prepare(
        'DELETE FROM notifications WHERE user_id = ?'
      ).bind(user.id).run();

      // Delete the user
      await c.env.DB.prepare(
        'DELETE FROM users WHERE id = ?'
      ).bind(user.id).run();
    }

    // Delete user from Clerk
    if (c.env.CLERK_SECRET_KEY) {
      try {
        // Get the clerk_id for this user
        const userRecord = await c.env.DB.prepare(
          'SELECT clerk_id FROM users WHERE id = ?'
        ).bind(user.id).first<{ clerk_id: string }>();

        // User is already deleted, so we need to get clerk_id from context or JWT
        // The clerk_id should be from the auth middleware - we can get it from the payload
        // For now, we'll rely on Clerk's own deletion through the frontend signOut
        // The user account in Clerk will be deleted via Clerk's dashboard or the user can do it
        console.log('User deleted from database. Clerk account should be deleted separately.');
      } catch (clerkError) {
        console.error('Error with Clerk deletion:', clerkError);
        // Don't fail the request, user is already deleted from our DB
      }
    }

    return c.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return c.json({ success: false, error: 'Failed to delete account' }, 500);
  }
});

export default organizations;
