import { Env } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

export interface SalesKpis {
  gross_sales: number;
  net_revenue: number;
  total_orders: number;
  average_order_value: number;
  gross_sales_change_pct: number | null;
  net_revenue_change_pct: number | null;
  total_orders_change_pct: number | null;
  aov_change_pct: number | null;
}

export interface TransactionStatPoint {
  date: string;
  orders_count: number;
  unique_customers: number;
  revenue: number;
}

export interface TopMenuItem {
  id: string;
  name: string;
  category: string;
  stock_qty: number;
  max_stock: number;
  low_stock_alert: number;
  units_sold: number;
  revenue_generated: number;
}

export interface LoyaltyKpis {
  total_members: number;
  active_points: number;
  rewards_redeemed_points: number;
  rewards_redeemed_rupees: number;
  repeat_rate: number;
}

export interface MemberGrowthPoint {
  date: string;
  new_members: number;
  cumulative_members: number;
}

export interface DemographicsData {
  visit_segments: {
    first_time: number;
    regular: number;
    vip_loyal: number;
  };
  age_groups: {
    group: string;
    count: number;
    percentage: number;
  }[];
}

export interface RecentLoyaltyActivity {
  id: string;
  customer_name: string;
  customer_phone: string;
  change_type: string;
  points_change: number;
  balance_after: number;
  reason: string | null;
  performed_by: string;
  created_at: string;
}

export interface AnalyticsResponse {
  range: '7d' | '30d' | '90d' | 'all';
  start_date: string;
  sales_kpis: SalesKpis;
  transaction_stats: TransactionStatPoint[];
  top_menu_items: TopMenuItem[];
  loyalty_kpis: LoyaltyKpis;
  member_growth: MemberGrowthPoint[];
  demographics: DemographicsData;
  recent_activity: RecentLoyaltyActivity[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_view_reports');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);

    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || '30d';
    const range: '7d' | '30d' | '90d' | 'all' = ['7d', '30d', '90d', 'all'].includes(rangeParam)
      ? (rangeParam as any)
      : '30d';

    const now = new Date();
    let startDate = new Date(0).toISOString();
    let prevStartDate: string | null = null;
    let prevEndDate: string | null = null;
    let daysCount = 30;

    if (range === '7d') {
      daysCount = 7;
      startDate = new Date(now.getTime() - 7 * 86400000).toISOString();
      prevStartDate = new Date(now.getTime() - 14 * 86400000).toISOString();
      prevEndDate = startDate;
    } else if (range === '30d') {
      daysCount = 30;
      startDate = new Date(now.getTime() - 30 * 86400000).toISOString();
      prevStartDate = new Date(now.getTime() - 60 * 86400000).toISOString();
      prevEndDate = startDate;
    } else if (range === '90d') {
      daysCount = 90;
      startDate = new Date(now.getTime() - 90 * 86400000).toISOString();
      prevStartDate = new Date(now.getTime() - 180 * 86400000).toISOString();
      prevEndDate = startDate;
    } else {
      // 'all'
      daysCount = 365;
      startDate = '1970-01-01T00:00:00.000Z';
      prevStartDate = null;
      prevEndDate = null;
    }

    // 1. Current Period Sales KPIs
    const currSales = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(subtotal), 0) AS gross_sales,
        COALESCE(SUM(final_amount), 0) AS net_revenue,
        COUNT(*) AS total_orders
      FROM orders
      WHERE created_at >= ?
    `).bind(startDate).first<{ gross_sales: number; net_revenue: number; total_orders: number }>();

    const grossSales = Math.round((currSales?.gross_sales || 0) * 100) / 100;
    const netRevenue = Math.round((currSales?.net_revenue || 0) * 100) / 100;
    const totalOrders = currSales?.total_orders || 0;
    const aov = totalOrders > 0 ? Math.round((netRevenue / totalOrders) * 100) / 100 : 0;

    // Previous Period Sales KPIs for Comparison
    let prevGrossSales = 0;
    let prevNetRevenue = 0;
    let prevTotalOrders = 0;
    let prevAov = 0;

    if (prevStartDate && prevEndDate) {
      const prevSales = await env.DB.prepare(`
        SELECT
          COALESCE(SUM(subtotal), 0) AS gross_sales,
          COALESCE(SUM(final_amount), 0) AS net_revenue,
          COUNT(*) AS total_orders
        FROM orders
        WHERE created_at >= ? AND created_at < ?
      `).bind(prevStartDate, prevEndDate).first<{ gross_sales: number; net_revenue: number; total_orders: number }>();

      prevGrossSales = Math.round((prevSales?.gross_sales || 0) * 100) / 100;
      prevNetRevenue = Math.round((prevSales?.net_revenue || 0) * 100) / 100;
      prevTotalOrders = prevSales?.total_orders || 0;
      prevAov = prevTotalOrders > 0 ? Math.round((prevNetRevenue / prevTotalOrders) * 100) / 100 : 0;
    }

    const calcPct = (curr: number, prev: number): number | null => {
      if (range === 'all' || !prevStartDate) return null;
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const salesKpis: SalesKpis = {
      gross_sales: grossSales,
      net_revenue: netRevenue,
      total_orders: totalOrders,
      average_order_value: aov,
      gross_sales_change_pct: calcPct(grossSales, prevGrossSales),
      net_revenue_change_pct: calcPct(netRevenue, prevNetRevenue),
      total_orders_change_pct: calcPct(totalOrders, prevTotalOrders),
      aov_change_pct: calcPct(aov, prevAov),
    };

    // 2. Transaction Stats Time-Series (Grouped by date)
    const statsResult = await env.DB.prepare(`
      SELECT
        substr(created_at, 1, 10) AS date,
        COUNT(*) AS orders_count,
        COUNT(DISTINCT customer_id) AS unique_customers,
        COALESCE(SUM(final_amount), 0) AS revenue
      FROM orders
      WHERE created_at >= ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).bind(startDate).all<TransactionStatPoint>();

    const rawStatsMap = new Map<string, TransactionStatPoint>();
    for (const r of statsResult.results || []) {
      rawStatsMap.set(r.date, {
        date: r.date,
        orders_count: Number(r.orders_count) || 0,
        unique_customers: Number(r.unique_customers) || 0,
        revenue: Math.round(Number(r.revenue) * 100) / 100,
      });
    }

    // Fill continuous dates if 7d or 30d
    const transactionStats: TransactionStatPoint[] = [];
    if (range === '7d' || range === '30d') {
      const nowMs = now.getTime();
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(nowMs - i * 86400000).toISOString().slice(0, 10);
        const existing = rawStatsMap.get(d);
        transactionStats.push(
          existing || {
            date: d,
            orders_count: 0,
            unique_customers: 0,
            revenue: 0,
          }
        );
      }
    } else {
      transactionStats.push(...Array.from(rawStatsMap.values()));
    }

    // 3. Top Menu Items
    const topMenuResult = await env.DB.prepare(`
      SELECT
        m.id,
        m.name,
        m.category,
        COALESCE(m.stock_qty, 100) AS stock_qty,
        COALESCE(m.max_stock, 100) AS max_stock,
        COALESCE(m.low_stock_alert, 10) AS low_stock_alert,
        COALESCE(SUM(oi.quantity), 0) AS units_sold,
        COALESCE(SUM(oi.total_price), 0) AS revenue_generated
      FROM menu_items m
      LEFT JOIN order_items oi ON m.id = oi.menu_item_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE (o.created_at >= ? OR o.created_at IS NULL)
      GROUP BY m.id
      ORDER BY units_sold DESC, revenue_generated DESC
      LIMIT 5
    `).bind(startDate).all<TopMenuItem>();

    const topMenuItems: TopMenuItem[] = (topMenuResult.results || []).map((it) => ({
      ...it,
      units_sold: Number(it.units_sold) || 0,
      revenue_generated: Math.round(Number(it.revenue_generated) * 100) / 100,
    }));

    // 4. Loyalty Program & CRM KPIs
    const membersRow = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM customers WHERE is_archived = 0) AS total_members,
        (SELECT COALESCE(SUM(points_balance), 0) FROM customers WHERE is_archived = 0) AS active_points,
        (SELECT COALESCE(SUM(points_redeemed), 0) FROM orders WHERE created_at >= ?) AS rewards_redeemed_points,
        (SELECT COALESCE(SUM(discount_amount), 0) FROM orders WHERE created_at >= ?) AS rewards_redeemed_rupees,
        (SELECT COUNT(*) FROM customers WHERE is_archived = 0 AND total_visits >= 2) AS repeat_members,
        (SELECT COUNT(*) FROM customers WHERE is_archived = 0 AND total_visits >= 1) AS visiting_members
    `).bind(startDate, startDate).first<{
      total_members: number;
      active_points: number;
      rewards_redeemed_points: number;
      rewards_redeemed_rupees: number;
      repeat_members: number;
      visiting_members: number;
    }>();

    const totalMembers = membersRow?.total_members || 0;
    const activePoints = Math.round((membersRow?.active_points || 0) * 10) / 10;
    const rewardsPoints = Math.round((membersRow?.rewards_redeemed_points || 0) * 10) / 10;
    const rewardsRupees = Math.round((membersRow?.rewards_redeemed_rupees || 0) * 100) / 100;
    const repeatMembers = membersRow?.repeat_members || 0;
    const visitingMembers = membersRow?.visiting_members || 0;
    const repeatRate = visitingMembers > 0 ? Math.round((repeatMembers / visitingMembers) * 1000) / 10 : 0;

    const loyaltyKpis: LoyaltyKpis = {
      total_members: totalMembers,
      active_points: activePoints,
      rewards_redeemed_points: rewardsPoints,
      rewards_redeemed_rupees: rewardsRupees,
      repeat_rate: repeatRate,
    };

    // 5. Member Growth Time-Series
    const growthResult = await env.DB.prepare(`
      SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS new_members
      FROM customers
      WHERE is_archived = 0
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).all<{ date: string; new_members: number }>();

    let cumulative = 0;
    const memberGrowth: MemberGrowthPoint[] = [];
    for (const g of growthResult.results || []) {
      cumulative += Number(g.new_members) || 0;
      memberGrowth.push({
        date: g.date,
        new_members: Number(g.new_members) || 0,
        cumulative_members: cumulative,
      });
    }

    // 6. Demographics & Segmentation
    const segmentResult = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN total_visits = 1 THEN 1 ELSE 0 END), 0) AS first_time,
        COALESCE(SUM(CASE WHEN total_visits >= 2 AND total_visits <= 4 THEN 1 ELSE 0 END), 0) AS regular,
        COALESCE(SUM(CASE WHEN total_visits >= 5 THEN 1 ELSE 0 END), 0) AS vip_loyal
      FROM customers
      WHERE is_archived = 0
    `).first<{ first_time: number; regular: number; vip_loyal: number }>();

    const visitSegments = {
      first_time: segmentResult?.first_time || 0,
      regular: segmentResult?.regular || 0,
      vip_loyal: segmentResult?.vip_loyal || 0,
    };

    // Age groups from customers.dob
    const dobResult = await env.DB.prepare(`
      SELECT dob FROM customers WHERE is_archived = 0
    `).all<{ dob: string | null }>();

    let age1824 = 0;
    let age2534 = 0;
    let age3544 = 0;
    let age45plus = 0;
    let ageUnspecified = 0;
    const currentYear = now.getFullYear();

    for (const row of dobResult.results || []) {
      if (!row.dob || row.dob.trim().length < 4) {
        ageUnspecified++;
        continue;
      }
      const birthYear = parseInt(row.dob.slice(0, 4), 10);
      if (isNaN(birthYear) || birthYear < 1920 || birthYear > currentYear) {
        ageUnspecified++;
        continue;
      }
      const age = currentYear - birthYear;
      if (age >= 18 && age <= 24) age1824++;
      else if (age >= 25 && age <= 34) age2534++;
      else if (age >= 35 && age <= 44) age3544++;
      else if (age >= 45) age45plus++;
      else ageUnspecified++;
    }

    const totalCustWithAge = totalMembers || 1;
    const ageGroups = [
      { group: '18–24 Yrs', count: age1824, percentage: Math.round((age1824 / totalCustWithAge) * 100) },
      { group: '25–34 Yrs', count: age2534, percentage: Math.round((age2534 / totalCustWithAge) * 100) },
      { group: '35–44 Yrs', count: age3544, percentage: Math.round((age3544 / totalCustWithAge) * 100) },
      { group: '45+ Yrs', count: age45plus, percentage: Math.round((age45plus / totalCustWithAge) * 100) },
      { group: 'Unspecified', count: ageUnspecified, percentage: Math.round((ageUnspecified / totalCustWithAge) * 100) },
    ];

    const demographics: DemographicsData = {
      visit_segments: visitSegments,
      age_groups: ageGroups,
    };

    // 7. Recent Loyalty Activity
    const activityResult = await env.DB.prepare(`
      SELECT
        pl.id,
        COALESCE(c.name, 'Unknown Member') AS customer_name,
        COALESCE(c.phone, '') AS customer_phone,
        pl.change_type,
        pl.points_change,
        pl.balance_after,
        pl.reason,
        pl.performed_by,
        pl.created_at
      FROM points_ledger pl
      LEFT JOIN customers c ON pl.customer_id = c.id
      ORDER BY pl.created_at DESC
      LIMIT 15
    `).all<RecentLoyaltyActivity>();

    const recentActivity = activityResult.results || [];

    const responseData: AnalyticsResponse = {
      range,
      start_date: startDate,
      sales_kpis: salesKpis,
      transaction_stats: transactionStats,
      top_menu_items: topMenuItems,
      loyalty_kpis: loyaltyKpis,
      member_growth: memberGrowth,
      demographics,
      recent_activity: recentActivity,
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Analytics query failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
