import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { createTaskSchema, updateTaskSchema } from '../schemas';
import { getAccessFilter, assertCanAccess, AccessDeniedError } from '../utils/access-control';

const tasks = new Hono<{ Bindings: Env; Variables: Variables }>();

tasks.use('*', clerkAuthMiddleware);

// List tasks
tasks.get('/', async (c) => {
  const { page = '1', limit = '20', filter = 'all', ownerId } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = c.get('userId');
  const user = c.get('user');

  // Apply row-level access control
  const accessFilter = getAccessFilter(user, 't.owner_id');

  let query = `
    SELECT
      t.*,
      d.name as deal_name,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    LEFT JOIN companies co ON t.company_id = co.id
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE 1=1${accessFilter.sql}
  `;
  const params: any[] = [...accessFilter.params];

  // Filter by owner (default to current user for "my" tasks)
  if (ownerId) {
    query += ` AND t.owner_id = ?`;
    params.push(ownerId);
  } else if (filter === 'my') {
    query += ` AND t.owner_id = ?`;
    params.push(userId);
  }

  // Apply filters
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  switch (filter) {
    case 'overdue':
      query += ` AND t.completed = 0 AND t.due_date < ?`;
      params.push(today);
      break;
    case 'today':
      query += ` AND t.due_date = ?`;
      params.push(today);
      break;
    case 'week':
      query += ` AND t.due_date >= ? AND t.due_date <= ?`;
      params.push(today, weekFromNow);
      break;
    case 'completed':
      query += ` AND t.completed = 1`;
      break;
    case 'pending':
      query += ` AND t.completed = 0`;
      break;
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*?FROM tasks/, 'SELECT COUNT(*) as total FROM tasks');
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated results
  query += ` ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const results = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    success: true,
    data: {
      items: results.results,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      hasMore: offset + results.results.length < total,
    },
  });
});

// Get task counts for sidebar
tasks.get('/counts', async (c) => {
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const counts = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 AND due_date < ? THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN due_date = ? THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN due_date >= ? AND due_date <= ? THEN 1 ELSE 0 END) as this_week,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
    FROM tasks
    WHERE owner_id = ?
  `).bind(today, today, today, weekFromNow, userId).first();

  return c.json({ success: true, data: counts });
});

// Get single task
tasks.get('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before returning task
  try {
    await assertCanAccess(c.env.DB, user, 'task', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const task = await c.env.DB.prepare(`
    SELECT
      t.*,
      d.name as deal_name,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name
    FROM tasks t
    LEFT JOIN deals d ON t.deal_id = d.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    LEFT JOIN companies co ON t.company_id = co.id
    LEFT JOIN users u ON t.owner_id = u.id
    WHERE t.id = ?
  `).bind(id).first();

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  return c.json({ success: true, data: task });
});

// Create task
tasks.post('/', zValidator('json', createTaskSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO tasks (id, subject, content, deal_id, contact_id, owner_id, due_date, priority, completed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.subject,
    body.content || null,
    body.deal_id || null,
    body.contact_id || null,
    userId,
    body.due_date || null,
    body.priority || 'medium',
    0,
    now,
    now
  ).run();

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: task }, 201);
});

// Update task
tasks.patch('/:id', zValidator('json', updateTaskSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before updating
  try {
    await assertCanAccess(c.env.DB, user, 'task', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = ['subject', 'content', 'deal_id', 'contact_id', 'company_id', 'owner_id', 'due_date', 'priority', 'completed', 'completed_at'];
  const fieldMap: Record<string, string> = {
    dealId: 'deal_id',
    contactId: 'contact_id',
    companyId: 'company_id',
    ownerId: 'owner_id',
    dueDate: 'due_date',
    completedAt: 'completed_at',
  };

  for (const [key, value] of Object.entries(body)) {
    const dbField = fieldMap[key] || key;
    if (allowedFields.includes(dbField)) {
      if (dbField === 'completed') {
        fields.push(`${dbField} = ?`);
        params.push(value ? 1 : 0);
        if (value) {
          fields.push('completed_at = ?');
          params.push(now);
        } else {
          fields.push('completed_at = ?');
          params.push(null);
        }
      } else {
        fields.push(`${dbField} = ?`);
        params.push(value);
      }
    }
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: 'No valid fields to update' }, 400);
  }

  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await c.env.DB.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: task });
});

// Toggle task completion
tasks.post('/:id/toggle', async (c) => {
  const { id } = c.req.param();
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before toggling
  try {
    await assertCanAccess(c.env.DB, user, 'task', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const task = await c.env.DB.prepare('SELECT completed FROM tasks WHERE id = ?').bind(id).first<{ completed: number }>();

  if (!task) {
    return c.json({ success: false, error: 'Task not found' }, 404);
  }

  const newCompleted = task.completed ? 0 : 1;
  const completedAt = newCompleted ? now : null;

  await c.env.DB.prepare(`
    UPDATE tasks SET completed = ?, completed_at = ?, updated_at = ? WHERE id = ?
  `).bind(newCompleted, completedAt, now, id).run();

  const updatedTask = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: updatedTask });
});

// Delete task
tasks.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before deleting
  try {
    await assertCanAccess(c.env.DB, user, 'task', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

export default tasks;
