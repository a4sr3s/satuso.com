import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { createWorkboardSchema, updateWorkboardSchema } from '../schemas';
import {
  extractFormulasFromColumns,
  getFormulaSelectFragments,
  getLastActivitySubquery,
  postProcessFormulas,
  buildFilterClause,
  filterBySpinScore,
  type WorkboardFilter,
  type FormulaType,
} from '../utils/workboard-formulas';

const workboards = new Hono<{ Bindings: Env; Variables: Variables }>();

workboards.use('*', clerkAuthMiddleware);

// List workboards
workboards.get('/', async (c) => {
  const { entity_type } = c.req.query();
  const userId = c.get('userId');

  let query = `
    SELECT
      w.*,
      u.name as owner_name
    FROM workboards w
    LEFT JOIN users u ON w.owner_id = u.id
    WHERE (w.owner_id = ? OR w.is_default = 1 OR w.is_shared = 1)
  `;
  const params: any[] = [userId];

  if (entity_type) {
    query += ` AND w.entity_type = ?`;
    params.push(entity_type);
  }

  query += ` ORDER BY w.is_default DESC, w.name ASC`;

  const results = await c.env.DB.prepare(query).bind(...params).all();

  // Parse JSON columns
  const items = results.results.map((row: any) => ({
    ...row,
    columns: JSON.parse(row.columns || '[]'),
    filters: JSON.parse(row.filters || '[]'),
  }));

  return c.json({
    success: true,
    data: { items },
  });
});

// Get single workboard
workboards.get('/:id', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');

  const workboard = await c.env.DB.prepare(`
    SELECT
      w.*,
      u.name as owner_name
    FROM workboards w
    LEFT JOIN users u ON w.owner_id = u.id
    WHERE w.id = ? AND (w.owner_id = ? OR w.is_default = 1 OR w.is_shared = 1)
  `).bind(id, userId).first();

  if (!workboard) {
    return c.json({ success: false, error: 'Workboard not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      ...workboard,
      columns: JSON.parse((workboard as any).columns || '[]'),
      filters: JSON.parse((workboard as any).filters || '[]'),
    },
  });
});

// Get workboard data (execute query)
workboards.get('/:id/data', async (c) => {
  const { id } = c.req.param();
  const { page = '1', limit = '50', sort_column, sort_direction } = c.req.query();
  const userId = c.get('userId');
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Get workboard config
  const workboard = await c.env.DB.prepare(`
    SELECT * FROM workboards
    WHERE id = ? AND (owner_id = ? OR is_default = 1 OR is_shared = 1)
  `).bind(id, userId).first<any>();

  if (!workboard) {
    return c.json({ success: false, error: 'Workboard not found' }, 404);
  }

  const entityType = workboard.entity_type as 'deals' | 'contacts' | 'companies';
  const columns = JSON.parse(workboard.columns || '[]');
  const filters: WorkboardFilter[] = JSON.parse(workboard.filters || '[]');
  const sortCol = sort_column || workboard.sort_column;
  const sortDir = sort_direction || workboard.sort_direction || 'asc';

  // Build query based on entity type
  let query: string;
  let countQuery: string;
  const params: any[] = [];

  if (entityType === 'deals') {
    const formulas = extractFormulasFromColumns(columns);
    const formulaSelects = getFormulaSelectFragments(formulas, 'deals');

    // Add last_activity_days if needed
    const needsLastActivity = formulas.includes('last_activity_days');
    const lastActivitySelect = needsLastActivity
      ? `, ${getLastActivitySubquery('deals')} as last_activity_days`
      : '';

    query = `
      SELECT
        d.*,
        c.name as contact_name,
        co.name as company_name,
        u.name as owner_name
        ${formulaSelects.length > 0 ? ', ' + formulaSelects.join(', ') : ''}
        ${lastActivitySelect}
      FROM deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE 1=1
    `;

    countQuery = `SELECT COUNT(*) as total FROM deals d WHERE 1=1`;
  } else if (entityType === 'contacts') {
    const formulas = extractFormulasFromColumns(columns);
    const needsLastActivity = formulas.includes('last_activity_days');
    const lastActivitySelect = needsLastActivity
      ? `, ${getLastActivitySubquery('contacts')} as last_activity_days`
      : '';

    query = `
      SELECT
        c.*,
        co.name as company_name,
        u.name as owner_name
        ${lastActivitySelect}
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE 1=1
    `;

    countQuery = `SELECT COUNT(*) as total FROM contacts c WHERE 1=1`;
  } else {
    // companies
    const formulas = extractFormulasFromColumns(columns);
    const needsLastActivity = formulas.includes('last_activity_days');
    const lastActivitySelect = needsLastActivity
      ? `, ${getLastActivitySubquery('companies')} as last_activity_days`
      : '';

    query = `
      SELECT
        co.*,
        u.name as owner_name,
        (SELECT COUNT(*) FROM contacts WHERE company_id = co.id) as contact_count,
        (SELECT COUNT(*) FROM deals WHERE company_id = co.id) as deal_count,
        (SELECT COALESCE(SUM(value), 0) FROM deals WHERE company_id = co.id AND stage = 'closed_won') as total_revenue
        ${lastActivitySelect}
      FROM companies co
      LEFT JOIN users u ON co.owner_id = u.id
      WHERE 1=1
    `;

    countQuery = `SELECT COUNT(*) as total FROM companies co WHERE 1=1`;
  }

  // Apply filters
  const { clause: filterClause, params: filterParams } = buildFilterClause(filters, entityType);
  query += filterClause;
  countQuery += filterClause;
  params.push(...filterParams);

  // Get total count
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Add sorting - with SQL injection protection via allowlist
  if (sortCol) {
    // Define allowed sort columns for each entity type to prevent SQL injection
    const allowedColumns: Record<string, string[]> = {
      deals: ['id', 'name', 'value', 'stage', 'close_date', 'probability', 'spin_progress', 'created_at', 'updated_at', 'stage_changed_at', 'owner_id', 'contact_id', 'company_id'],
      contacts: ['id', 'name', 'email', 'phone', 'title', 'status', 'source', 'created_at', 'updated_at', 'last_contacted_at', 'owner_id', 'company_id'],
      companies: ['id', 'name', 'domain', 'industry', 'employee_count', 'created_at', 'updated_at', 'owner_id'],
    };

    // Formula columns that are computed in the SELECT
    const formulaColumns = ['days_in_stage', 'sla_breach', 'last_activity_days'];

    // Validate sort direction
    const validSortDir = sortDir === 'desc' ? 'DESC' : 'ASC';

    // Handle formula columns in sorting
    if (formulaColumns.includes(sortCol)) {
      // Already in SELECT, can sort directly
      query += ` ORDER BY ${sortCol} ${validSortDir}`;
    } else if (allowedColumns[entityType]?.includes(sortCol)) {
      // Validated column - safe to use
      const alias = entityType === 'deals' ? 'd' : entityType === 'contacts' ? 'c' : 'co';
      query += ` ORDER BY ${alias}.${sortCol} ${validSortDir}`;
    }
    // If sortCol is not in allowlist, we simply don't add ORDER BY (fail safely)
  }

  // Add pagination
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const results = await c.env.DB.prepare(query).bind(...params).all();
  let rows = results.results as Record<string, any>[];

  // Post-process formula fields (e.g., spin_score)
  const formulas = extractFormulasFromColumns(columns);
  rows = postProcessFormulas(rows, formulas, entityType);

  // Apply spin_score filter if present (post-process filter)
  rows = filterBySpinScore(rows, filters);

  // Add provenance metadata
  const rowsWithProvenance = rows.map((row) => ({
    ...row,
    _provenance: {
      source: entityType,
      fetchedAt: new Date().toISOString(),
    },
  }));

  return c.json({
    success: true,
    data: {
      items: rowsWithProvenance,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      hasMore: offset + rows.length < total,
    },
  });
});

// Create workboard
workboards.post('/', zValidator('json', createWorkboardSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO workboards (id, name, description, entity_type, owner_id, is_default, is_shared, columns, filters, sort_column, sort_direction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    body.name,
    body.description || null,
    body.entity_type,
    userId,
    0, // is_default
    body.is_shared ? 1 : 0,
    JSON.stringify(body.columns || []),
    JSON.stringify(body.filters || []),
    body.sort_column || null,
    body.sort_direction || 'asc',
    now,
    now
  ).run();

  const workboard = await c.env.DB.prepare('SELECT * FROM workboards WHERE id = ?').bind(id).first();

  return c.json({
    success: true,
    data: {
      ...workboard,
      columns: JSON.parse((workboard as any).columns || '[]'),
      filters: JSON.parse((workboard as any).filters || '[]'),
    },
  }, 201);
});

// Update workboard
workboards.patch('/:id', zValidator('json', updateWorkboardSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const now = new Date().toISOString();

  // Check ownership (can't edit default workboards unless duplicated)
  const existing = await c.env.DB.prepare(
    'SELECT * FROM workboards WHERE id = ?'
  ).bind(id).first<any>();

  if (!existing) {
    return c.json({ success: false, error: 'Workboard not found' }, 404);
  }

  if (existing.is_default && existing.owner_id !== userId) {
    return c.json({ success: false, error: 'Cannot edit default workboards' }, 403);
  }

  if (existing.owner_id !== userId && !existing.is_default) {
    return c.json({ success: false, error: 'Not authorized to edit this workboard' }, 403);
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) {
    fields.push('name = ?');
    params.push(body.name);
  }
  if (body.description !== undefined) {
    fields.push('description = ?');
    params.push(body.description);
  }
  if (body.entity_type !== undefined) {
    fields.push('entity_type = ?');
    params.push(body.entity_type);
  }
  if (body.is_shared !== undefined) {
    fields.push('is_shared = ?');
    params.push(body.is_shared ? 1 : 0);
  }
  if (body.columns !== undefined) {
    fields.push('columns = ?');
    params.push(JSON.stringify(body.columns));
  }
  if (body.filters !== undefined) {
    fields.push('filters = ?');
    params.push(JSON.stringify(body.filters));
  }
  if (body.sort_column !== undefined) {
    fields.push('sort_column = ?');
    params.push(body.sort_column);
  }
  if (body.sort_direction !== undefined) {
    fields.push('sort_direction = ?');
    params.push(body.sort_direction);
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: 'No valid fields to update' }, 400);
  }

  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await c.env.DB.prepare(`UPDATE workboards SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const workboard = await c.env.DB.prepare('SELECT * FROM workboards WHERE id = ?').bind(id).first();

  return c.json({
    success: true,
    data: {
      ...workboard,
      columns: JSON.parse((workboard as any).columns || '[]'),
      filters: JSON.parse((workboard as any).filters || '[]'),
    },
  });
});

// Delete workboard
workboards.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');

  // Check ownership
  const existing = await c.env.DB.prepare(
    'SELECT * FROM workboards WHERE id = ?'
  ).bind(id).first<any>();

  if (!existing) {
    return c.json({ success: false, error: 'Workboard not found' }, 404);
  }

  if (existing.is_default) {
    return c.json({ success: false, error: 'Cannot delete default workboards' }, 403);
  }

  if (existing.owner_id !== userId) {
    return c.json({ success: false, error: 'Not authorized to delete this workboard' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM workboards WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

// Duplicate workboard (create a copy with new owner)
workboards.post('/:id/duplicate', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId');

  const source = await c.env.DB.prepare(`
    SELECT * FROM workboards
    WHERE id = ? AND (owner_id = ? OR is_default = 1 OR is_shared = 1)
  `).bind(id, userId).first<any>();

  if (!source) {
    return c.json({ success: false, error: 'Workboard not found' }, 404);
  }

  const newId = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO workboards (id, name, description, entity_type, owner_id, is_default, is_shared, columns, filters, sort_column, sort_direction, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    newId,
    `${source.name} (Copy)`,
    source.description,
    source.entity_type,
    userId,
    0, // is_default
    0, // is_shared
    source.columns,
    source.filters,
    source.sort_column,
    source.sort_direction,
    now,
    now
  ).run();

  const workboard = await c.env.DB.prepare('SELECT * FROM workboards WHERE id = ?').bind(newId).first();

  return c.json({
    success: true,
    data: {
      ...workboard,
      columns: JSON.parse((workboard as any).columns || '[]'),
      filters: JSON.parse((workboard as any).filters || '[]'),
    },
  }, 201);
});

export default workboards;
