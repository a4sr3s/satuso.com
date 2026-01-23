import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';
import { createDealSchema, updateDealSchema, moveDealSchema, addDealTeamMemberSchema, updateDealTeamMemberSchema } from '../schemas';
import { parsePagination } from '../utils/pagination';
import { getDealAccessFilter, assertCanAccess, AccessDeniedError } from '../utils/access-control';
import { createDealRecord } from '../services/entity-service';

const deals = new Hono<{ Bindings: Env; Variables: Variables }>();

deals.use('*', clerkAuthMiddleware);

// List deals
deals.get('/', async (c) => {
  const { search, stage, ownerId, minValue, maxValue, ...paginationQuery } = c.req.query();
  const { page, limit, offset } = parsePagination(paginationQuery);
  const user = c.get('user');
  const orgId = c.get('orgId');

  // Apply row-level access control
  const accessFilter = getDealAccessFilter(user);

  let query = `
    SELECT
      d.*,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name,
      CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE 1=1${accessFilter.sql}
  `;
  const params: any[] = [...accessFilter.params];

  // Filter by Clerk organization
  if (orgId) {
    query += ` AND d.org_id = ?`;
    params.push(orgId);
  }

  if (search) {
    query += ` AND (d.name LIKE ? OR co.name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (stage) {
    query += ` AND d.stage = ?`;
    params.push(stage);
  }

  if (ownerId) {
    query += ` AND d.owner_id = ?`;
    params.push(ownerId);
  }

  if (minValue) {
    query += ` AND d.value >= ?`;
    params.push(parseFloat(minValue));
  }

  if (maxValue) {
    query += ` AND d.value <= ?`;
    params.push(parseFloat(maxValue));
  }

  // Get total count
  const countQuery = query.replace(/SELECT[\s\S]*?FROM deals/, 'SELECT COUNT(*) as total FROM deals');
  const countResult = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated results
  query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
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

// Get deals by stage (for Kanban view)
deals.get('/pipeline', async (c) => {
  const { ownerId } = c.req.query();
  const user = c.get('user');
  const orgId = c.get('orgId');

  // Apply row-level access control
  const accessFilter = getDealAccessFilter(user);

  let baseQuery = `
    SELECT
      d.*,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name,
      CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')${accessFilter.sql}
  `;
  const params: any[] = [...accessFilter.params];

  // Filter by Clerk organization
  if (orgId) {
    baseQuery += ` AND d.org_id = ?`;
    params.push(orgId);
  }

  if (ownerId) {
    baseQuery += ` AND d.owner_id = ?`;
    params.push(ownerId);
  }

  baseQuery += ` ORDER BY d.created_at DESC`;

  const results = await c.env.DB.prepare(baseQuery).bind(...params).all();

  // Group by stage
  const pipeline: Record<string, any[]> = {
    lead: [],
    qualified: [],
    discovery: [],
    proposal: [],
    negotiation: [],
  };

  for (const deal of results.results) {
    const stage = deal.stage as string;
    if (pipeline[stage]) {
      pipeline[stage].push(deal);
    }
  }

  return c.json({ success: true, data: pipeline });
});

// Get single deal
deals.get('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before returning deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const deal = await c.env.DB.prepare(`
    SELECT
      d.*,
      c.name as contact_name,
      c.email as contact_email,
      co.name as company_name,
      u.name as owner_name,
      CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.id = ?
  `).bind(id).first();

  if (!deal) {
    return c.json({ success: false, error: 'Deal not found' }, 404);
  }

  // Get related activities
  const activities = await c.env.DB.prepare(`
    SELECT id, type, subject, content, spin_tags, created_at FROM activities WHERE deal_id = ? ORDER BY created_at DESC LIMIT 20
  `).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...deal,
      activities: activities.results,
    },
  });
});

// Create deal
deals.post('/', zValidator('json', createDealSchema), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const deal = await createDealRecord(c.env.DB, body, userId, orgId);

  return c.json({ success: true, data: deal }, 201);
});

// Update deal
deals.patch('/:id', zValidator('json', updateDealSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before updating
  try {
    await assertCanAccess(c.env.DB, user, 'deal', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  // Get current deal to check stage change
  const currentDeal = await c.env.DB.prepare('SELECT stage FROM deals WHERE id = ?').bind(id).first<{ stage: string }>();

  const fields: string[] = [];
  const params: any[] = [];

  const allowedFields = ['name', 'value', 'stage', 'probability', 'contact_id', 'company_id', 'owner_id', 'close_date', 'spin_situation', 'spin_problem', 'spin_implication', 'spin_need_payoff', 'ai_score', 'ai_score_reason'];
  const fieldMap: Record<string, string> = {
    contactId: 'contact_id',
    companyId: 'company_id',
    ownerId: 'owner_id',
    closeDate: 'close_date',
    spinSituation: 'spin_situation',
    spinProblem: 'spin_problem',
    spinImplication: 'spin_implication',
    spinNeedPayoff: 'spin_need_payoff',
    aiScore: 'ai_score',
    aiScoreReason: 'ai_score_reason',
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

  // Update stage_changed_at if stage changed
  if (body.stage && currentDeal && body.stage !== currentDeal.stage) {
    fields.push('stage_changed_at = ?');
    params.push(now);
  }

  // Recalculate SPIN progress if SPIN fields were updated
  const currentSpinData = await c.env.DB.prepare(
    'SELECT spin_situation, spin_problem, spin_implication, spin_need_payoff FROM deals WHERE id = ?'
  ).bind(id).first<{ spin_situation: string; spin_problem: string; spin_implication: string; spin_need_payoff: string }>();

  let spinProgress = 0;
  if (currentSpinData?.spin_situation) spinProgress++;
  if (currentSpinData?.spin_problem) spinProgress++;
  if (currentSpinData?.spin_implication) spinProgress++;
  if (currentSpinData?.spin_need_payoff) spinProgress++;

  fields.push('spin_progress = ?');
  params.push(spinProgress);

  fields.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await c.env.DB.prepare(`UPDATE deals SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const deal = await c.env.DB.prepare(`
    SELECT
      d.*,
      c.name as contact_name,
      co.name as company_name,
      u.name as owner_name,
      CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.id = ?
  `).bind(id).first();

  return c.json({ success: true, data: deal });
});

// Move deal stage (for Kanban drag & drop)
deals.post('/:id/move', zValidator('json', moveDealSchema), async (c) => {
  const { id } = c.req.param();
  const { stage } = c.req.valid('json');
  const now = new Date().toISOString();
  const user = c.get('user');

  // Check access before moving
  try {
    await assertCanAccess(c.env.DB, user, 'deal', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare(`
    UPDATE deals SET stage = ?, stage_changed_at = ?, updated_at = ? WHERE id = ?
  `).bind(stage, now, now, id).run();

  const deal = await c.env.DB.prepare('SELECT * FROM deals WHERE id = ?').bind(id).first();

  return c.json({ success: true, data: deal });
});

// Delete deal
deals.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access before deleting
  try {
    await assertCanAccess(c.env.DB, user, 'deal', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare('DELETE FROM deals WHERE id = ?').bind(id).run();

  return c.json({ success: true });
});

// ==========================================
// Deal Team Routes
// ==========================================

// Get deal team members
deals.get('/:id/team', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');

  // Check access to deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', id);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const team = await c.env.DB.prepare(`
    SELECT
      dt.*,
      u.name as user_name,
      u.email as user_email,
      u.job_function,
      ab.name as assigned_by_name
    FROM deal_team dt
    JOIN users u ON dt.user_id = u.id
    LEFT JOIN users ab ON dt.assigned_by = ab.id
    WHERE dt.deal_id = ?
    ORDER BY
      CASE dt.role
        WHEN 'owner' THEN 1
        WHEN 'technical' THEN 2
        WHEN 'executive_sponsor' THEN 3
        ELSE 4
      END
  `).bind(id).all();

  return c.json({ success: true, data: team.results });
});

// Add team member to deal
deals.post('/:id/team', zValidator('json', addDealTeamMemberSchema), async (c) => {
  const { id: dealId } = c.req.param();
  const body = c.req.valid('json');
  const assignedBy = c.get('userId');
  const user = c.get('user');

  // Check access to deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', dealId);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  // Check if deal exists
  const deal = await c.env.DB.prepare('SELECT id FROM deals WHERE id = ?').bind(dealId).first();
  if (!deal) {
    return c.json({ success: false, error: 'Deal not found' }, 404);
  }

  // Check if target user exists
  const targetUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.user_id).first();
  if (!targetUser) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Check for existing assignment with same role
  const existing = await c.env.DB.prepare(
    'SELECT id FROM deal_team WHERE deal_id = ? AND user_id = ? AND role = ?'
  ).bind(dealId, body.user_id, body.role).first();

  if (existing) {
    return c.json({ success: false, error: 'User already assigned with this role' }, 400);
  }

  const id = nanoid();
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO deal_team (id, deal_id, user_id, role, notes, assigned_at, assigned_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, dealId, body.user_id, body.role, body.notes || null, now, assignedBy).run();

  // Return the new team member with user details
  const member = await c.env.DB.prepare(`
    SELECT
      dt.*,
      u.name as user_name,
      u.email as user_email,
      u.job_function
    FROM deal_team dt
    JOIN users u ON dt.user_id = u.id
    WHERE dt.id = ?
  `).bind(id).first();

  return c.json({ success: true, data: member }, 201);
});

// Update team member role/notes
deals.patch('/:id/team/:memberId', zValidator('json', updateDealTeamMemberSchema), async (c) => {
  const { id: dealId, memberId } = c.req.param();
  const body = c.req.valid('json');
  const user = c.get('user');

  // Check access to deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', dealId);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  const fields: string[] = [];
  const params: any[] = [];

  if (body.role !== undefined) {
    fields.push('role = ?');
    params.push(body.role);
  }
  if (body.notes !== undefined) {
    fields.push('notes = ?');
    params.push(body.notes);
  }

  if (fields.length === 0) {
    return c.json({ success: false, error: 'No fields to update' }, 400);
  }

  params.push(memberId);
  await c.env.DB.prepare(`UPDATE deal_team SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();

  const member = await c.env.DB.prepare(`
    SELECT
      dt.*,
      u.name as user_name,
      u.email as user_email,
      u.job_function
    FROM deal_team dt
    JOIN users u ON dt.user_id = u.id
    WHERE dt.id = ?
  `).bind(memberId).first();

  return c.json({ success: true, data: member });
});

// Remove team member from deal
deals.delete('/:id/team/:memberId', async (c) => {
  const { id: dealId, memberId } = c.req.param();
  const user = c.get('user');

  // Check access to deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', dealId);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  await c.env.DB.prepare('DELETE FROM deal_team WHERE id = ?').bind(memberId).run();

  return c.json({ success: true });
});

// Get users available to assign (with optional role filter)
deals.get('/:id/team/available', async (c) => {
  const { id: dealId } = c.req.param();
  const { job_function, role } = c.req.query();
  const user = c.get('user');

  // Check access to deal
  try {
    await assertCanAccess(c.env.DB, user, 'deal', dealId);
  } catch (e) {
    if (e instanceof AccessDeniedError) {
      return c.json({ success: false, error: e.message }, 403);
    }
    throw e;
  }

  let query = `
    SELECT id, name, email, job_function
    FROM users
    WHERE id NOT IN (
      SELECT user_id FROM deal_team WHERE deal_id = ?${role ? ' AND role = ?' : ''}
    )
  `;
  const params: any[] = [dealId];
  if (role) params.push(role);

  if (job_function) {
    query += ` AND job_function = ?`;
    params.push(job_function);
  }

  query += ` ORDER BY name ASC`;

  const users = await c.env.DB.prepare(query).bind(...params).all();

  return c.json({ success: true, data: users.results });
});

export default deals;
