import { Hono } from 'hono';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

notifications.use('*', clerkAuthMiddleware);

// List notifications for current user
notifications.get('/', async (c) => {
  const userId = c.get('userId');
  const { limit = '20', unread_only = 'false' } = c.req.query();

  let query = `
    SELECT id, type, title, message, read, action_url, created_at
    FROM notifications
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (unread_only === 'true') {
    query += ` AND read = 0`;
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(parseInt(limit));

  const result = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    success: true,
    data: result.results,
  });
});

// Get unread count
notifications.get('/count', async (c) => {
  const userId = c.get('userId');

  const result = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
  ).bind(userId).first<{ count: number }>();

  return c.json({
    success: true,
    data: { unread: result?.count || 0 },
  });
});

// Mark notification as read
notifications.patch('/:id/read', async (c) => {
  const userId = c.get('userId');
  const notificationId = c.req.param('id');

  await c.env.DB.prepare(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?'
  ).bind(notificationId, userId).run();

  return c.json({ success: true });
});

// Mark all as read
notifications.post('/mark-all-read', async (c) => {
  const userId = c.get('userId');

  await c.env.DB.prepare(
    'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'
  ).bind(userId).run();

  return c.json({ success: true });
});

export default notifications;
