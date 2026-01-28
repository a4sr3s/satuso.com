import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { standardRateLimiter } from '../_middleware/rate-limit';
import { createContactSchema, updateContactSchema } from '../_schemas';
import { parsePagination } from '../_utils/pagination';
import { getAccessFilter, assertCanAccess, AccessDeniedError } from '../_utils/access-control';

const contacts = new Hono<{ Bindings: Env; Variables: Variables }>();

contacts.use('*', clerkAuthMiddleware);
contacts.use('*', standardRateLimiter);

// List contacts
contacts.get('/', async (c) => {
  const { search, status, ownerId, ...paginationQuery } = c.req.query();
  const { page, limit, offset } = parsePagination(paginationQuery);
  const user = c.get('user');

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

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO contacts (id, name, email, phone, title, company_id, owner_id, status, source,
      linkedin_url, twitter_url, github_url, facebook_url,
      location, location_city, location_region, location_country,
      created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.email || null,
    body.phone || null,
    body.title || null,
    body.company_id || body.companyId || null,
    body.ownerId || userId,
    body.status || 'active',
    body.source || null,
    body.linkedin_url || body.linkedinUrl || null,
    body.twitter_url || body.twitterUrl || null,
    body.github_url || body.githubUrl || null,
    body.facebook_url || body.facebookUrl || null,
    body.location || null,
    body.location_city || body.locationCity || null,
    body.location_region || body.locationRegion || null,
    body.location_country || body.locationCountry || null,
    now,
    now
  ).run();

  const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(id).first();

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

  const allowedFields = [
    'name', 'email', 'phone', 'title', 'company_id', 'owner_id', 'status', 'source',
    'linkedin_url', 'twitter_url', 'github_url', 'facebook_url',
    'location', 'location_city', 'location_region', 'location_country',
    'last_contacted_at'
  ];
  const fieldMap: Record<string, string> = {
    companyId: 'company_id',
    ownerId: 'owner_id',
    linkedinUrl: 'linkedin_url',
    twitterUrl: 'twitter_url',
    githubUrl: 'github_url',
    facebookUrl: 'facebook_url',
    locationCity: 'location_city',
    locationRegion: 'location_region',
    locationCountry: 'location_country',
    lastContactedAt: 'last_contacted_at',
  };

  // Fields that should be null instead of empty string
  const nullableFields = [
    'company_id', 'owner_id', 'email', 'phone', 'title', 'source',
    'linkedin_url', 'twitter_url', 'github_url', 'facebook_url',
    'location', 'location_city', 'location_region', 'location_country'
  ];

  for (const [key, value] of Object.entries(body)) {
    const dbField = fieldMap[key] || key;
    if (allowedFields.includes(dbField)) {
      fields.push(`${dbField} = ?`);
      // Convert empty strings to null for nullable fields
      const finalValue = nullableFields.includes(dbField) && value === '' ? null : value;
      params.push(finalValue);
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
