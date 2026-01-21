import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { createActivitySchema, updateActivitySchema } from '../_schemas';

const activities = new Hono<{ Bindings: Env; Variables: Variables }>();

activities.use('*', clerkAuthMiddleware);

// List activities
activities.get('/', async (c) => {
  const { page = '1', limit = '20', type, dealId, contactId, companyId, ownerId } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT
      a.*,
      d.name as deal_name,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN companies co ON a.company_id = co.id
    LEFT JOIN users u ON a.owner_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type) {
    query += ` AND a.type = ?`;
    params.push(type);
  }

  if (dealId) {
    query += ` AND a.deal_id = ?`;
    params.push(dealId);
  }

  if (contactId) {
    query += ` AND a.contact_id = ?`;
    params.push(contactId);
  }

  if (companyId) {
    query += ` AND a.company_id = ?`;
    params.push(companyId);
  }

  if (ownerId) {
    query += ` AND a.owner_id = ?`;
    params.push(ownerId);
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*?FROM activities/, 'SELECT COUNT(*) as total FROM activities');
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated results
  query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
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

// Get recent activity feed
activities.get('/feed', async (c) => {
  const { limit = '20' } = c.req.query();
  const userId = c.get('userId');

  const results = await c.env.DB.prepare(`
    SELECT
      a.*,
      d.name as deal_name,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN companies co ON a.company_id = co.id
    LEFT JOIN users u ON a.owner_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).bind(parseInt(limit)).all();

  return c.json({ success: true, data: results.results });
});

// Get single activity
activities.get('/:id', async (c) => {
  const { id } = c.req.param();

  const activity = await c.env.DB.prepare(`
    SELECT
      a.*,
      d.name as deal_name,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    LEFT JOIN companies co ON a.company_id = co.id
    LEFT JOIN users u ON a.owner_id = u.id
    WHERE a.id = ?
  `).bind(id).first();

  if (!activity) {
    return c.json({ success: false, error: 'Activity not found' }, 404);
  }

  return c.json({ success: true, data: activity });
});

// Create activity
activities.post('/', zValidator('json', createActivitySchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO activities (id, type, subject, content, deal_id, contact_id, company_id, owner_id, due_date, completed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.type,
    body.subject,
    body.content || '',
    body.deal_id || null,
    body.contact_id || null,
    body.company_id || null,
    userId,
    body.due_date || null,
    0,
    now,
    now
  ).run();

  // Update last_contacted_at for contact if applicable
  if (body.contact_id && ['call', 'email', 'meeting'].includes(body.type)) {
    await c.env.DB.prepare(`
      UPDATE contacts SET last_contacted_at = ?, updated_at = ? WHERE id = ?
    `).bind(now, now, body.contact_id).run();
  }

  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: activity }, 201);
});

// Update activity
activities.patch('/:id', zValidator('json', updateActivitySchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = ['type', 'subject', 'content', 'deal_id', 'contact_id', 'company_id', 'spin_tags', 'due_date', 'completed', 'completed_at'];
  const fieldMap: Record<string, string> = {
    dealId: 'deal_id',
    contactId: 'contact_id',
    companyId: 'company_id',
    spinTags: 'spin_tags',
    dueDate: 'due_date',
    completedAt: 'completed_at',
  };

  for (const [key, value] of Object.entries(body)) {
    const dbField = fieldMap[key] || key;
    if (allowedFields.includes(dbField)) {
      if (dbField === 'spin_tags' && Array.isArray(value)) {
        fields.push(`${dbField} = ?`);
        params.push(JSON.stringify(value));
      } else if (dbField === 'completed') {
        fields.push(`${dbField} = ?`);
        params.push(value ? 1 : 0);
        if (value) {
          fields.push('completed_at = ?');
          params.push(now);
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

  await c.env.DB.prepare(`UPDATE activities SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: activity });
});

// Complete activity/task
activities.post('/:id/complete', async (c) => {
  const { id } = c.req.param();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE activities SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?
  `).bind(now, now, id).run();

  const activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: activity });
});

// Delete activity
activities.delete('/:id', async (c) => {
  const { id } = c.req.param();

  await c.env.DB.prepare('DELETE FROM activities WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

export default activities;
