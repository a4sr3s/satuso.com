import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { createCompanySchema, updateCompanySchema } from '../schemas';
import { parsePagination } from '../utils/pagination';
import { getAccessFilter, assertCanAccess, AccessDeniedError } from '../utils/access-control';

const companies = new Hono<{ Bindings: Env; Variables: Variables }>();

companies.use('*', clerkAuthMiddleware);

// List companies
companies.get('/', async (c) => {
  const { search, industry, ownerId, ...paginationQuery } = c.req.query();
  const { page, limit, offset } = parsePagination(paginationQuery);
  const user = c.get('user');
  const orgId = c.get('orgId');

  // Apply row-level access control
  const accessFilter = getAccessFilter(user, 'c.owner_id');

  // Use LEFT JOINs with GROUP BY instead of correlated subqueries for better performance
  let query = `
    SELECT
      c.*,
      u.name as owner_name,
      COUNT(DISTINCT con.id) as contact_count,
      COUNT(DISTINCT d.id) as deal_count,
      COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.value ELSE 0 END), 0) as total_revenue
    FROM companies c
    LEFT JOIN users u ON c.owner_id = u.id
    LEFT JOIN contacts con ON con.company_id = c.id
    LEFT JOIN deals d ON d.company_id = c.id
    WHERE 1=1${accessFilter.sql}
  `;
  const params: any[] = [...accessFilter.params];

  // Filter by Clerk organization
  if (orgId) {
    query += ` AND c.org_id = ?`;
    params.push(orgId);
  }

  if (search) {
    query += ` AND (c.name LIKE ? OR c.domain LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (industry) {
    query += ` AND c.industry = ?`;
    params.push(industry);
  }

  if (ownerId) {
    query += ` AND c.owner_id = ?`;
    params.push(ownerId);
  }

  // Get total count (count distinct companies) - must include access filter
  const countParams = params.slice(0, params.length); // Copy params before adding pagination
  const countQuery = `
    SELECT COUNT(DISTINCT c.id) as total
    FROM companies c
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE 1=1${accessFilter.sql}
    ${search ? ` AND (c.name LIKE ? OR c.domain LIKE ?)` : ''}
    ${industry ? ` AND c.industry = ?` : ''}
    ${ownerId ? ` AND c.owner_id = ?` : ''}
  `;
  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated results with GROUP BY
  query += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
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

// Get single company
companies.get('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before returning company
  try {
    await assertCanAccess(c.env.DB, user, 'company', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const company = await c.env.DB.prepare(`
    SELECT
      c.*,
      u.name as owner_name
    FROM companies c
    LEFT JOIN users u ON c.owner_id = u.id
    WHERE c.id = ?
  `).bind(id).first();

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Get related contacts
  const contacts = await c.env.DB.prepare(`
    SELECT id, name, email, title, status FROM contacts WHERE company_id = ? ORDER BY created_at DESC
  `).bind(id).all();

  // Get related deals
  const deals = await c.env.DB.prepare(`
    SELECT id, name, value, stage, close_date, spin_progress FROM deals WHERE company_id = ? ORDER BY created_at DESC
  `).bind(id).all();

  // Get recent activities
  const activities = await c.env.DB.prepare(`
    SELECT id, type, subject, content, created_at FROM activities WHERE company_id = ? ORDER BY created_at DESC LIMIT 10
  `).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...company,
      contacts: contacts.results,
      deals: deals.results,
      activities: activities.results,
    },
  });
});

// Create company
companies.post('/', zValidator('json', createCompanySchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO companies (id, name, domain, industry, employee_count, annual_revenue, website, description, owner_id, org_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.domain || null,
    body.industry || null,
    body.employee_count || null,
    body.annual_revenue || null,
    body.website || null,
    body.description || null,
    userId,
    orgId || null,
    now,
    now
  ).run();

  const company = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: company }, 201);
});

// Update company
companies.patch('/:id', zValidator('json', updateCompanySchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before updating
  try {
    await assertCanAccess(c.env.DB, user, 'company', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = ['name', 'domain', 'industry', 'employee_count', 'annual_revenue', 'logo_url', 'website', 'description', 'owner_id'];
  const fieldMap: Record<string, string> = {
    employeeCount: 'employee_count',
    annualRevenue: 'annual_revenue',
    logoUrl: 'logo_url',
    ownerId: 'owner_id',
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

  await c.env.DB.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const company = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: company });
});

// Delete company
companies.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before deleting
  try {
    await assertCanAccess(c.env.DB, user, 'company', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

export default companies;
