import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboard.use('*', clerkAuthMiddleware);

// Get dashboard metrics
dashboard.get('/metrics', async (c) => {
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];

  // Get current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // Total revenue this month
  const revenueThisMonth = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND updated_at >= ?
  `).bind(monthStart).first<{ total: number }>();

  const revenueLastMonth = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND updated_at >= ? AND updated_at < ?
  `).bind(lastMonthStart, monthStart).first<{ total: number }>();

  // Active deals
  const activeDeals = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
  `).first<{ count: number }>();

  const lastMonthActiveDeals = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost') AND created_at < ?
  `).bind(monthStart).first<{ count: number }>();

  // Conversion rate (closed won / total closed)
  const closedWon = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage = 'closed_won' AND updated_at >= ?
  `).bind(monthStart).first<{ count: number }>();

  const totalClosed = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage IN ('closed_won', 'closed_lost') AND updated_at >= ?
  `).bind(monthStart).first<{ count: number }>();

  const lastMonthClosedWon = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage = 'closed_won' AND updated_at >= ? AND updated_at < ?
  `).bind(lastMonthStart, monthStart).first<{ count: number }>();

  const lastMonthTotalClosed = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage IN ('closed_won', 'closed_lost') AND updated_at >= ? AND updated_at < ?
  `).bind(lastMonthStart, monthStart).first<{ count: number }>();

  const conversionRate = totalClosed?.count ? ((closedWon?.count || 0) / totalClosed.count) * 100 : 0;
  const lastMonthConversionRate = lastMonthTotalClosed?.count ? ((lastMonthClosedWon?.count || 0) / lastMonthTotalClosed.count) * 100 : 0;

  // Tasks due today
  const tasksDueToday = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE due_date = ? AND completed = 0 AND owner_id = ?
  `).bind(today, userId).first<{ count: number }>();

  // Get sparkline data (last 7 days revenue) - single query instead of N+1
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sparklineResults = await c.env.DB.prepare(`
    SELECT DATE(updated_at) as day, COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND DATE(updated_at) >= ?
    GROUP BY DATE(updated_at)
  `).bind(sevenDaysAgo).all<{ day: string; total: number }>();

  // Map results to array for last 7 days
  const revenueByDay = new Map(sparklineResults.results.map(r => [r.day, r.total]));
  const sparklineData: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    sparklineData.push(revenueByDay.get(date) || 0);
  }

  // Calculate changes
  const revenueChange = revenueLastMonth?.total
    ? ((revenueThisMonth?.total || 0) - revenueLastMonth.total) / revenueLastMonth.total * 100
    : 0;
  const dealsChange = lastMonthActiveDeals?.count
    ? ((activeDeals?.count || 0) - lastMonthActiveDeals.count) / lastMonthActiveDeals.count * 100
    : 0;
  const conversionChange = conversionRate - lastMonthConversionRate;

  return c.json({
    success: true,
    data: {
      totalRevenue: {
        value: revenueThisMonth?.total || 0,
        previousValue: revenueLastMonth?.total || 0,
        change: Math.round(revenueChange * 100) / 100,
        changeDirection: revenueChange >= 0 ? 'up' : 'down',
        sparklineData,
      },
      activeDeals: {
        value: activeDeals?.count || 0,
        previousValue: lastMonthActiveDeals?.count || 0,
        change: Math.round(dealsChange * 100) / 100,
        changeDirection: dealsChange >= 0 ? 'up' : 'down',
        sparklineData: [],
      },
      conversionRate: {
        value: Math.round(conversionRate * 100) / 100,
        previousValue: Math.round(lastMonthConversionRate * 100) / 100,
        change: Math.round(conversionChange * 100) / 100,
        changeDirection: conversionChange >= 0 ? 'up' : 'down',
        sparklineData: [],
      },
      tasksDueToday: {
        value: tasksDueToday?.count || 0,
        previousValue: 0,
        change: 0,
        changeDirection: 'neutral',
        sparklineData: [],
      },
    },
  });
});

// Get recent activity
dashboard.get('/activity', async (c) => {
  const { limit = '10' } = c.req.query();

  const activities = await c.env.DB.prepare(`
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

  return c.json({ success: true, data: activities.results });
});

// Get pipeline summary
dashboard.get('/pipeline', async (c) => {
  const pipeline = await c.env.DB.prepare(`
    SELECT
      stage,
      COUNT(*) as count,
      COALESCE(SUM(value), 0) as total_value
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY stage
  `).all();

  const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation'];
  const result = stageOrder.map(stage => {
    const stageData = pipeline.results.find((p: any) => p.stage === stage);
    return {
      stage,
      count: stageData?.count || 0,
      totalValue: stageData?.total_value || 0,
    };
  });

  return c.json({ success: true, data: result });
});

// Get at-risk deals
dashboard.get('/at-risk', async (c) => {
  // Deals with no activity in 14+ days or low SPIN progress
  const atRiskDeals = await c.env.DB.prepare(`
    SELECT
      d.*,
      c.name as contact_name,
      co.name as company_name,
      (SELECT MAX(created_at) FROM activities WHERE deal_id = d.id) as last_activity,
      CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) as days_in_stage
    FROM deals d
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies co ON d.company_id = co.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    AND (
      (SELECT MAX(created_at) FROM activities WHERE deal_id = d.id) < datetime('now', '-14 days')
      OR d.spin_progress < 2
      OR CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) > 30
    )
    ORDER BY d.value DESC
    LIMIT 5
  `).all();

  return c.json({ success: true, data: atRiskDeals.results });
});

export default dashboard;
