import { Hono } from 'hono';
import type { Env, Variables } from '../_types';
import { clerkAuthMiddleware } from '../_middleware/clerk-auth';

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

// Get revenue forecast
dashboard.get('/forecast', async (c) => {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  // Next month boundaries
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString().split('T')[0];

  // This quarter boundaries
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const thisQuarterEnd = new Date(now.getFullYear(), quarterStartMonth + 3, 1).toISOString().split('T')[0];

  // Chart data: monthly revenue grouped by owner
  const chartResults = await c.env.DB.prepare(`
    SELECT
      strftime('%Y-%m', d.close_date) as month,
      u.id as owner_id,
      u.name as owner_name,
      COUNT(*) as deal_count,
      COALESCE(SUM(d.value), 0) as raw_value,
      COALESCE(SUM(d.value * COALESCE(d.probability, 50) / 100.0), 0) as weighted_value
    FROM deals d
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
      AND d.close_date IS NOT NULL
      AND d.close_date >= ?
      AND d.close_date < ?
    GROUP BY month, u.id, u.name
    ORDER BY month ASC, weighted_value DESC
  `).bind(currentMonthStart, thisQuarterEnd).all<{
    month: string;
    owner_id: string | null;
    owner_name: string | null;
    deal_count: number;
    raw_value: number;
    weighted_value: number;
  }>();

  // Summary: next month total
  const nextMonthResult = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as deal_count,
      COALESCE(SUM(d.value), 0) as raw_value,
      COALESCE(SUM(d.value * COALESCE(d.probability, 50) / 100.0), 0) as weighted_value
    FROM deals d
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
      AND d.close_date IS NOT NULL
      AND d.close_date >= ? AND d.close_date < ?
  `).bind(nextMonthStart, nextMonthEnd).first<{
    deal_count: number;
    raw_value: number;
    weighted_value: number;
  }>();

  // Summary: this quarter total (current month through end of quarter)
  const thisQuarterResult = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as deal_count,
      COALESCE(SUM(d.value), 0) as raw_value,
      COALESCE(SUM(d.value * COALESCE(d.probability, 50) / 100.0), 0) as weighted_value
    FROM deals d
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
      AND d.close_date IS NOT NULL
      AND d.close_date >= ? AND d.close_date < ?
  `).bind(currentMonthStart, thisQuarterEnd).first<{
    deal_count: number;
    raw_value: number;
    weighted_value: number;
  }>();

  const summary = {
    nextMonth: {
      dealCount: nextMonthResult?.deal_count || 0,
      rawValue: nextMonthResult?.raw_value || 0,
      weightedValue: nextMonthResult?.weighted_value || 0,
    },
    thisQuarter: {
      dealCount: thisQuarterResult?.deal_count || 0,
      rawValue: thisQuarterResult?.raw_value || 0,
      weightedValue: thisQuarterResult?.weighted_value || 0,
    },
  };

  // Build chart data
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = [...new Set(chartResults.results.map(r => r.month))].sort();
  const ownersMap = new Map<string, string>();
  for (const row of chartResults.results) {
    if (row.owner_id && row.owner_name) {
      ownersMap.set(row.owner_id, row.owner_name);
    }
  }
  const owners = Array.from(ownersMap.entries()).map(([id, name]) => ({ id, name }));

  const data = months.map(month => {
    const monthIndex = parseInt(month.split('-')[1]) - 1;
    const entry: Record<string, number | string> = {
      month,
      monthLabel: monthLabels[monthIndex],
      total: 0,
    };
    for (const row of chartResults.results) {
      if (row.month === month && row.owner_id) {
        const key = `owner_${row.owner_id}`;
        entry[key] = Math.round(row.weighted_value);
        (entry.total as number) += Math.round(row.weighted_value);
      }
    }
    return entry;
  });

  return c.json({
    success: true,
    data: {
      summary,
      chart: { months, owners, data },
    },
  });
});

export default dashboard;
