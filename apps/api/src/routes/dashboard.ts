import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { clerkAuthMiddleware } from '../middleware/clerk-auth';

const dashboard = new Hono<{ Bindings: Env; Variables: Variables }>();

dashboard.use('*', clerkAuthMiddleware);

// Get dashboard metrics
dashboard.get('/metrics', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const today = new Date().toISOString().split('T')[0];

  // Get current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  // Build org filter
  const orgFilter = orgId ? ' AND org_id = ?' : '';
  const orgParams = orgId ? [orgId] : [];

  // Total revenue this month
  const revenueThisMonth = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND updated_at >= ?${orgFilter}
  `).bind(monthStart, ...orgParams).first<{ total: number }>();

  const revenueLastMonth = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND updated_at >= ? AND updated_at < ?${orgFilter}
  `).bind(lastMonthStart, monthStart, ...orgParams).first<{ total: number }>();

  // Active deals
  const activeDeals = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')${orgFilter}
  `).bind(...orgParams).first<{ count: number }>();

  const lastMonthActiveDeals = await c.env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost') AND created_at < ?${orgFilter}
  `).bind(monthStart, ...orgParams).first<{ count: number }>();

  // Conversion rate (closed won / total closed)
  const closedWon = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage = 'closed_won' AND updated_at >= ?${orgFilter}
  `).bind(monthStart, ...orgParams).first<{ count: number }>();

  const totalClosed = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage IN ('closed_won', 'closed_lost') AND updated_at >= ?${orgFilter}
  `).bind(monthStart, ...orgParams).first<{ count: number }>();

  const lastMonthClosedWon = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage = 'closed_won' AND updated_at >= ? AND updated_at < ?${orgFilter}
  `).bind(lastMonthStart, monthStart, ...orgParams).first<{ count: number }>();

  const lastMonthTotalClosed = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM deals WHERE stage IN ('closed_won', 'closed_lost') AND updated_at >= ? AND updated_at < ?${orgFilter}
  `).bind(lastMonthStart, monthStart, ...orgParams).first<{ count: number }>();

  const conversionRate = totalClosed?.count ? ((closedWon?.count || 0) / totalClosed.count) * 100 : 0;
  const lastMonthConversionRate = lastMonthTotalClosed?.count ? ((lastMonthClosedWon?.count || 0) / lastMonthTotalClosed.count) * 100 : 0;

  // Tasks due today
  const taskOrgFilter = orgId ? ' AND org_id = ?' : '';
  const tasksDueToday = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE due_date = ? AND completed = 0 AND owner_id = ?${taskOrgFilter}
  `).bind(today, userId, ...orgParams).first<{ count: number }>();

  // Get sparkline data (last 7 days revenue) - single query instead of N+1
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sparklineResults = await c.env.DB.prepare(`
    SELECT DATE(updated_at) as day, COALESCE(SUM(value), 0) as total
    FROM deals
    WHERE stage = 'closed_won' AND DATE(updated_at) >= ?${orgFilter}
    GROUP BY DATE(updated_at)
  `).bind(sevenDaysAgo, ...orgParams).all<{ day: string; total: number }>();

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
  const orgId = c.get('orgId');

  const orgFilter = orgId ? ' WHERE a.org_id = ?' : '';
  const orgParams = orgId ? [orgId] : [];

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
    ${orgFilter}
    ORDER BY a.created_at DESC
    LIMIT ?
  `).bind(...orgParams, parseInt(limit)).all();

  return c.json({ success: true, data: activities.results });
});

// Get pipeline summary
dashboard.get('/pipeline', async (c) => {
  const orgId = c.get('orgId');
  const orgFilter = orgId ? ' AND org_id = ?' : '';
  const orgParams = orgId ? [orgId] : [];

  const pipeline = await c.env.DB.prepare(`
    SELECT
      stage,
      COUNT(*) as count,
      COALESCE(SUM(value), 0) as total_value
    FROM deals
    WHERE stage NOT IN ('closed_won', 'closed_lost')${orgFilter}
    GROUP BY stage
  `).bind(...orgParams).all();

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

// Get forecast data
dashboard.get('/forecast', async (c) => {
  const orgId = c.get('orgId');
  const { quarter = 'this' } = c.req.query();

  const orgFilter = orgId ? ' AND d.org_id = ?' : '';
  const orgParams = orgId ? [orgId] : [];

  // Calculate quarter date ranges
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Determine quarter boundaries
  const currentQuarter = Math.floor(currentMonth / 3);
  let startMonth: number, endMonth: number, year: number;

  if (quarter === 'next') {
    // Next quarter
    const nextQuarter = (currentQuarter + 1) % 4;
    year = nextQuarter === 0 ? currentYear + 1 : currentYear;
    startMonth = nextQuarter * 3;
    endMonth = startMonth + 2;
  } else {
    // This quarter
    year = currentYear;
    startMonth = currentQuarter * 3;
    endMonth = startMonth + 2;
  }

  // Build date strings directly to avoid timezone issues
  const pad = (n: number) => n.toString().padStart(2, '0');
  const quarterStart = `${year}-${pad(startMonth + 1)}-01`;
  // Last day of endMonth: use day 0 of next month
  const lastDay = new Date(Date.UTC(year, endMonth + 1, 0)).getUTCDate();
  const quarterEnd = `${year}-${pad(endMonth + 1)}-${pad(lastDay)}`;

  // Get deals with close dates in this quarter
  const deals = await c.env.DB.prepare(`
    SELECT
      d.id,
      d.name,
      d.value,
      d.probability,
      d.close_date,
      d.owner_id,
      u.name as owner_name
    FROM deals d
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
      AND d.close_date >= ?
      AND d.close_date <= ?
      ${orgFilter}
    ORDER BY d.close_date ASC
  `).bind(quarterStart, quarterEnd, ...orgParams).all();

  // Group by owner and month
  const ownerMap = new Map<string, { id: string; name: string }>();
  const monthData = new Map<string, Map<string, number>>();

  // Initialize months for the quarter (build strings directly to avoid timezone issues)
  const months: string[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = startMonth; m <= endMonth; m++) {
    const monthKey = `${year}-${pad(m + 1)}`; // YYYY-MM format
    months.push(monthKey);
    monthData.set(monthKey, new Map());
  }

  let totalRawValue = 0;
  let totalWeightedValue = 0;
  let dealCount = 0;

  for (const deal of deals.results as any[]) {
    if (!deal.close_date || !deal.value) continue;

    const monthKey = deal.close_date.slice(0, 7);
    const ownerId = deal.owner_id || 'unassigned';
    const ownerName = deal.owner_name || 'Unassigned';
    const probability = deal.probability || 50;
    const weightedValue = (deal.value * probability) / 100;

    // Track owner
    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, { id: ownerId, name: ownerName });
    }

    // Add to month data
    if (monthData.has(monthKey)) {
      const monthOwners = monthData.get(monthKey)!;
      monthOwners.set(ownerId, (monthOwners.get(ownerId) || 0) + weightedValue);
    }

    totalRawValue += deal.value;
    totalWeightedValue += weightedValue;
    dealCount++;
  }

  // Build chart data
  const owners = Array.from(ownerMap.values());
  const chartData = months.map((monthKey) => {
    // Extract month index from YYYY-MM format and use monthNames array
    const monthIndex = parseInt(monthKey.slice(5, 7), 10) - 1;
    const monthLabel = monthNames[monthIndex];
    const monthOwners = monthData.get(monthKey) || new Map();

    const row: Record<string, number | string> = { monthLabel };
    for (const owner of owners) {
      row[`owner_${owner.id}`] = monthOwners.get(owner.id) || 0;
    }
    return row;
  });

  // Calculate summary for next month (first month of quarter if 'this', or first month of next quarter)
  const nextMonthKey = quarter === 'this'
    ? `${currentYear}-${pad(currentMonth + 2)}`
    : months[0];

  let nextMonthRaw = 0;
  let nextMonthWeighted = 0;
  let nextMonthCount = 0;

  for (const deal of deals.results as any[]) {
    if (!deal.close_date || !deal.value) continue;
    if (deal.close_date.slice(0, 7) === nextMonthKey) {
      const probability = deal.probability || 50;
      nextMonthRaw += deal.value;
      nextMonthWeighted += (deal.value * probability) / 100;
      nextMonthCount++;
    }
  }

  return c.json({
    success: true,
    data: {
      quarter: quarter === 'next' ? 'next' : 'this',
      summary: {
        nextMonth: {
          dealCount: nextMonthCount,
          rawValue: nextMonthRaw,
          weightedValue: Math.round(nextMonthWeighted),
        },
        thisQuarter: {
          dealCount,
          rawValue: totalRawValue,
          weightedValue: Math.round(totalWeightedValue),
        },
      },
      chart: {
        months,
        owners,
        data: chartData,
      },
    },
  });
});

// Get at-risk deals
dashboard.get('/at-risk', async (c) => {
  const orgId = c.get('orgId');
  const orgFilter = orgId ? ' AND d.org_id = ?' : '';
  const orgParams = orgId ? [orgId] : [];

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
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')${orgFilter}
    AND (
      (SELECT MAX(created_at) FROM activities WHERE deal_id = d.id) < datetime('now', '-14 days')
      OR d.spin_progress < 2
      OR CAST((julianday('now') - julianday(d.stage_changed_at)) AS INTEGER) > 30
    )
    ORDER BY d.value DESC
    LIMIT 5
  `).bind(...orgParams).all();

  return c.json({ success: true, data: atRiskDeals.results });
});

export default dashboard;
