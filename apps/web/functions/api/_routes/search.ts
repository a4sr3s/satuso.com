import { Hono } from 'hono';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';
import { standardRateLimiter } from '../_middleware/rate-limit';

const search = new Hono<{ Bindings: Env; Variables: Variables }>();

search.use('*', clerkAuthMiddleware);
search.use('*', standardRateLimiter);

// Global search
search.get('/', async (c) => {
  const { q, limit = '10' } = c.req.query();
  const user = c.get('user');
  const orgParam = user.organization_id || user.id;

  if (!q || q.length < 2) {
    return c.json({ success: true, data: [] });
  }

  const searchTerm = `%${q.slice(0, 100)}%`; // Cap search term length
  const limitNum = Math.min(parseInt(limit), 50);
  const perTypeLimit = Math.ceil(limitNum / 4);

  const orgFilter = `AND owner_id IN (SELECT id FROM users WHERE organization_id = ?)`;

  // Search contacts
  const contacts = await c.env.DB.prepare(`
    SELECT id, name, email as subtitle, 'contact' as type
    FROM contacts
    WHERE (name LIKE ? OR email LIKE ?) ${orgFilter}
    LIMIT ?
  `).bind(searchTerm, searchTerm, orgParam, perTypeLimit).all();

  // Search companies
  const companies = await c.env.DB.prepare(`
    SELECT id, name, domain as subtitle, 'company' as type
    FROM companies
    WHERE (name LIKE ? OR domain LIKE ?) ${orgFilter}
    LIMIT ?
  `).bind(searchTerm, searchTerm, orgParam, perTypeLimit).all();

  // Search deals
  const deals = await c.env.DB.prepare(`
    SELECT d.id, d.name, co.name as subtitle, 'deal' as type
    FROM deals d
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE d.name LIKE ?
      AND d.owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    LIMIT ?
  `).bind(searchTerm, orgParam, perTypeLimit).all();

  // Search activities
  const activities = await c.env.DB.prepare(`
    SELECT id, subject as name, type as subtitle, 'activity' as type
    FROM activities
    WHERE (subject LIKE ? OR content LIKE ?) ${orgFilter}
    LIMIT ?
  `).bind(searchTerm, searchTerm, orgParam, perTypeLimit).all();

  // Combine and format results
  const results = [
    ...contacts.results.map((r: any) => ({
      type: 'contact',
      id: r.id,
      title: r.name,
      subtitle: r.subtitle,
      url: `/contacts/${r.id}`,
    })),
    ...companies.results.map((r: any) => ({
      type: 'company',
      id: r.id,
      title: r.name,
      subtitle: r.subtitle,
      url: `/companies/${r.id}`,
    })),
    ...deals.results.map((r: any) => ({
      type: 'deal',
      id: r.id,
      title: r.name,
      subtitle: r.subtitle,
      url: `/deals/${r.id}`,
    })),
    ...activities.results.map((r: any) => ({
      type: 'activity',
      id: r.id,
      title: r.name || 'Activity',
      subtitle: r.subtitle,
      url: `/activities/${r.id}`,
    })),
  ].slice(0, limitNum);

  return c.json({ success: true, data: results });
});

// Get recent items (for quick access)
search.get('/recent', async (c) => {
  const userId = c.get('userId');

  // Get recently viewed/modified items from KV cache
  const recentKey = `recent:${userId}`;
  const cached = await c.env.KV.get(recentKey);

  if (cached) {
    return c.json({ success: true, data: JSON.parse(cached) });
  }

  // Fallback: get recently created items within org
  const user = c.get('user');
  const orgParam = user.organization_id || user.id;

  const recentContacts = await c.env.DB.prepare(`
    SELECT id, name, 'contact' as type FROM contacts
    WHERE owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    ORDER BY updated_at DESC LIMIT 3
  `).bind(orgParam).all();

  const recentDeals = await c.env.DB.prepare(`
    SELECT id, name, 'deal' as type FROM deals
    WHERE owner_id IN (SELECT id FROM users WHERE organization_id = ?)
    ORDER BY updated_at DESC LIMIT 3
  `).bind(orgParam).all();

  const results = [
    ...recentContacts.results.map((r: any) => ({
      type: 'contact',
      id: r.id,
      title: r.name,
      url: `/contacts/${r.id}`,
    })),
    ...recentDeals.results.map((r: any) => ({
      type: 'deal',
      id: r.id,
      title: r.name,
      url: `/deals/${r.id}`,
    })),
  ];

  return c.json({ success: true, data: results });
});

// Track recent item view
search.post('/recent', async (c) => {
  const userId = c.get('userId');
  const { type, id, title, url } = await c.req.json();

  const recentKey = `recent:${userId}`;
  const cached = await c.env.KV.get(recentKey);

  let recent: any[] = cached ? JSON.parse(cached) : [];

  // Remove if already exists
  recent = recent.filter(r => !(r.type === type && r.id === id));

  // Add to front
  recent.unshift({ type, id, title, url, viewedAt: new Date().toISOString() });

  // Keep only last 10
  recent = recent.slice(0, 10);

  await c.env.KV.put(recentKey, JSON.stringify(recent), { expirationTtl: 86400 * 7 });

  return c.json({ success: true });
});

export default search;
