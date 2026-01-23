import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { createContactSchema, updateContactSchema } from '../schemas';
import { parsePagination } from '../utils/pagination';
import { getAccessFilter, assertCanAccess, AccessDeniedError } from '../utils/access-control';
import { createContactRecord } from '../services/entity-service';

const contacts = new Hono<{ Bindings: Env; Variables: Variables }>();

contacts.use('*', clerkAuthMiddleware);

// List contacts
contacts.get('/', async (c) => {
  const { search, status, ownerId, ...paginationQuery } = c.req.query();
  const { page, limit, offset } = parsePagination(paginationQuery);
  const user = c.get('user');
  const orgId = c.get('orgId');

  // Apply row-level access control
  const accessFilter = getAccessFilter(user, 'c.owner_id');

  let query = `
    SELECT
      c.*,
      co.name as company_name,
      u.name as owner_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE 1=1${accessFilter.sql}
  `;
  const params: any[] = [...accessFilter.params];

  // Filter by Clerk organization
  if (orgId) {
    query += ` AND c.org_id = ?`;
    params.push(orgId);
  }

  if (search) {
    query += ` AND (c.name LIKE ? OR c.email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  if (ownerId) {
    query += ` AND c.owner_id = ?`;
    params.push(ownerId);
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated results
  query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const results = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({
    success: true,
    data: {
      items: results.results,
      page,
      limit,
      total,
      hasMore: offset + results.results.length < total,
    },
  });
});

// Get single contact
contacts.get('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before returning contact
  try {
    await assertCanAccess(c.env.DB, user, 'contact', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const contact = await c.env.DB.prepare(`
    SELECT
      c.*,
      co.name as company_name,
      co.domain as company_domain,
      u.name as owner_name
    FROM contacts c
    LEFT JOIN companies co ON c.company_id = co.id
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.id = ?
  `).bind(id).first();

  if (!contact) {
    return c.json({ success: false, error: 'Contact not found' }, 404);
  }

  // Get related deals
  const deals = await c.env.DB.prepare(`
    SELECT id, name, value, stage, close_date FROM deals WHERE contact_id = ? ORDER BY created_at DESC LIMIT 5
  `).bind(id).all();

  // Get recent activities
  const activities = await c.env.DB.prepare(`
    SELECT id, type, subject, content, created_at FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10
  `).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...contact,
      deals: deals.results,
      activities: activities.results,
    },
  });
});

// Create contact
contacts.post('/', zValidator('json', createContactSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const contact = await createContactRecord(c.env.DB, body, userId, orgId);

  return c.json({ success: true, data: contact }, 201);
});

// Update contact
contacts.patch('/:id', zValidator('json', updateContactSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before updating
  try {
    await assertCanAccess(c.env.DB, user, 'contact', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = ['name', 'email', 'phone', 'title', 'company_id', 'owner_id', 'status', 'source', 'linkedin_url', 'last_contacted_at'];
  const fieldMap: Record<string, string> = {
    companyId: 'company_id',
    ownerId: 'owner_id',
    linkedinUrl: 'linkedin_url',
    lastContactedAt: 'last_contacted_at',
  };

  for (const [key, value] of Object.entries(body)) {
    const dbField = fieldMap[key] || key;
    if (allowedFields.includes(dbField)) {
      fields.push(`${dbField} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: 'No valid fields to update' }, 400);
  }

  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await c.env.DB.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: contact });
});

// Delete contact
contacts.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before deleting
  try {
    await assertCanAccess(c.env.DB, user, 'contact', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

export default contacts;
