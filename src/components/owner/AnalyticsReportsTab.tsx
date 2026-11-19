import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Award,
  Download,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { AnalyticsResponse } from '../../../functions/api/owner/analytics';

export const AnalyticsReportsTab: React.FC = () => {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active hover states for charts
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [donutView, setDonutView] = useState<'segments' | 'age'>('segments');

  // Fetch Analytics
  const fetchAnalytics = async (selectedRange = range) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/owner/analytics?range=${selectedRange}`);
      if (!res.ok) throw new Error('Failed to load business reports');
      const json = (await res.json()) as AnalyticsResponse;
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
  }, [range]);

  // CSV Report Generator
  const downloadCsvReport = () => {
    if (!data) return;

    const lines: string[] = [];
    lines.push(`THE GROVE CAFE - BUSINESS & LOYALTY REPORT`);
    lines.push(`Generated At,${new Date().toLocaleString()}`);
    lines.push(`Date Range,${data.range.toUpperCase()}`);
    lines.push('');

    // Sales KPIs
    lines.push(`--- SALES & REVENUE SUMMARY ---`);
    lines.push(`Gross Sales (INR),${data.sales_kpis.gross_sales}`);
    lines.push(`Net Revenue (INR),${data.sales_kpis.net_revenue}`);
    lines.push(`Total Completed Orders,${data.sales_kpis.total_orders}`);
    lines.push(`Average Order Value (INR),${data.sales_kpis.average_order_value}`);
    lines.push('');

    // Loyalty KPIs
    lines.push(`--- LOYALTY & CRM SUMMARY ---`);
    lines.push(`Total Active Members,${data.loyalty_kpis.total_members}`);
    lines.push(`Active Points Pool,${data.loyalty_kpis.active_points}`);
    lines.push(`Rewards Redeemed (Points),${data.loyalty_kpis.rewards_redeemed_points}`);
    lines.push(`Rewards Redeemed (INR),${data.loyalty_kpis.rewards_redeemed_rupees}`);
    lines.push(`Repeat Customer Rate (%),${data.loyalty_kpis.repeat_rate}%`);
    lines.push('');

    // Daily Transactions
    lines.push(`--- DAILY TRANSACTION STATS ---`);
    lines.push(`Date,Total Orders,Unique Customers,Net Revenue (INR)`);
    data.transaction_stats.forEach((pt) => {
      lines.push(`${pt.date},${pt.orders_count},${pt.unique_customers},${pt.revenue}`);
    });
    lines.push('');

    // Top Selling Menu Items
    lines.push(`--- TOP SELLING MENU ITEMS ---`);
    lines.push(`Item Name,Category,Units Sold,Revenue Generated (INR),Stock Qty,Max Stock`);
    data.top_menu_items.forEach((it) => {
      lines.push(`"${it.name}","${it.category}",${it.units_sold},${it.revenue_generated},${it.stock_qty},${it.max_stock}`);
    });
    lines.push('');

    // Customer Demographics
    lines.push(`--- CUSTOMER SEGMENTATION ---`);
    lines.push(`First-Time Members (1 Visit),${data.demographics.visit_segments.first_time}`);
    lines.push(`Regular Members (2-4 Visits),${data.demographics.visit_segments.regular}`);
    lines.push(`VIP Loyal Members (5+ Visits),${data.demographics.visit_segments.vip_loyal}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `the-grove-cafe-report-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Transaction Stats Bar Chart Math
  const barChartData = useMemo(() => {
    if (!data || data.transaction_stats.length === 0) return null;
    const stats = data.transaction_stats;
    const maxVal = Math.max(
      ...stats.map((s) => Math.max(s.orders_count, s.unique_customers)),
      5
    );
    return { stats, maxVal };
  }, [data]);

  // 2. Member Growth SVG Math
  const lineChartData = useMemo(() => {
    if (!data || data.member_growth.length === 0) return null;
    const points = data.member_growth;
    const maxVal = Math.max(...points.map((p) => p.cumulative_members), 5);
    return { points, maxVal };
  }, [data]);

  // 3. Donut Segments Math
  const donutSegments = useMemo(() => {
    if (!data) return [];
    if (donutView === 'segments') {
      const segs = data.demographics.visit_segments;
      const total = segs.first_time + segs.regular + segs.vip_loyal || 1;
      return [
        { label: 'VIP Loyal (5+ Visits)', count: segs.vip_loyal, color: '#166534', pct: Math.round((segs.vip_loyal / total) * 100) },
        { label: 'Regular (2–4 Visits)', count: segs.regular, color: '#D97706', pct: Math.round((segs.regular / total) * 100) },
        { label: 'First-Time (1 Visit)', count: segs.first_time, color: '#71717A', pct: Math.round((segs.first_time / total) * 100) },
      ];
    } else {
      const agePalette = ['#166534', '#0284C7', '#D97706', '#9333EA', '#71717A'];
      return data.demographics.age_groups.map((ag, idx) => ({
        label: ag.group,
        count: ag.count,
        color: agePalette[idx % agePalette.length],
        pct: ag.percentage,
      }));
    }
  }, [data, donutView]);

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111111] font-serif">
            Executive Analytics &amp; Reports
          </h2>
          <p className="text-xs text-[#52525B] mt-0.5">
            Real-time business performance, customer loyalty metrics, and sales intelligence.
          </p>
        </div>

        {/* Date Range Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <div className="flex items-center p-1 bg-[#F3EFEA] border border-[#E6E2DA] rounded-xl text-xs font-semibold">
            {(['7d', '30d', '90d', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-serif ${
                  range === r
                    ? 'bg-[#111111] text-white shadow-xs'
                    : 'text-[#52525B] hover:text-[#111111]'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadCsvReport}
            disabled={!data || loading}
            title="Download complete business report as CSV"
            className="min-h-[38px] px-3.5 py-1.5 bg-[#FAF9F6] hover:bg-[#F3EFEA] text-[#111111] border border-[#E6E2DA] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={() => fetchAnalytics(range)}
            disabled={loading}
            className="min-h-[38px] p-2 bg-[#F3EFEA] hover:bg-[#E6E2DA] text-[#111111] border border-[#E6E2DA] rounded-xl text-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-[#991B1B] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#991B1B] hover:text-[#111111] p-1 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* 2. PRIMARY KPI STATS ROW (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Net Revenue (Dark Primary Highlight Card) */}
        <div className="bg-[#111111] text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#E6E2DA]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Net Revenue</span>
            <span className="text-xs font-mono font-bold text-[#A3E635] bg-white/10 px-2 py-0.5 rounded-md">
              PAID
            </span>
          </div>
          <div className="mt-4">
            <p className="text-3xl font-bold font-mono tracking-tight tabular-nums">
              ₹{data ? data.sales_kpis.net_revenue.toLocaleString('en-IN') : '0'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {data && data.sales_kpis.net_revenue_change_pct !== null ? (
                data.sales_kpis.net_revenue_change_pct >= 0 ? (
                  <span className="flex items-center text-[#4ADE80] font-semibold tabular-nums">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                    +{data.sales_kpis.net_revenue_change_pct}%
                  </span>
                ) : (
                  <span className="flex items-center text-[#F87171] font-semibold tabular-nums">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {data.sales_kpis.net_revenue_change_pct}%
                  </span>
                )
              ) : (
                <span className="text-[#A1A1AA]">Full period view</span>
              )}
              <span className="text-[#A1A1AA] text-[11px]">vs previous period</span>
            </div>
          </div>
        </div>

        {/* Gross Sales */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#52525B]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Gross Sales</span>
            <DollarSign className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#111111] tracking-tight tabular-nums">
              ₹{data ? data.sales_kpis.gross_sales.toLocaleString('en-IN') : '0'}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              {data && data.sales_kpis.gross_sales_change_pct !== null ? (
                data.sales_kpis.gross_sales_change_pct >= 0 ? (
                  <span className="flex items-center text-[#166534] font-semibold tabular-nums">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                    +{data.sales_kpis.gross_sales_change_pct}%
                  </span>
                ) : (
                  <span className="flex items-center text-[#991B1B] font-semibold tabular-nums">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {data.sales_kpis.gross_sales_change_pct}%
                  </span>
                )
              ) : (
                <span className="text-[#71717A]">Pre-discount subtotal</span>
              )}
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#52525B]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-[#111111]" />
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#111111] tracking-tight tabular-nums">
              {data ? data.sales_kpis.total_orders : 0}
            </p>
            <p className="text-xs text-[#52525B] mt-2 font-serif tabular-nums">
              Avg Order Value: <strong>₹{data ? data.sales_kpis.average_order_value : 0}</strong>
            </p>
          </div>
        </div>

        {/* Total Loyalty Members */}
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#52525B]">
            <span className="text-xs font-bold uppercase tracking-wider font-serif">Loyalty Members</span>
            <Users className="w-4 h-4 text-[#166534]" />
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#166534] tracking-tight tabular-nums">
              {data ? data.loyalty_kpis.total_members : 0}
            </p>
            <p className="text-xs text-[#166534] mt-2 font-semibold tabular-nums">
              {data ? data.loyalty_kpis.repeat_rate : 0}% repeat customer rate
            </p>
          </div>
        </div>
      </div>

      {/* 3. MIDDLE SECTION: TRANSACTION STATS BAR CHART & MENU PERFORMANCE (2 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: TRANSACTION STATS GROUPED BAR CHART (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E6E2DA]">
            <div>
              <h3 className="font-bold text-[#111111] text-base font-serif">
                Transaction Volume &amp; Footfall
              </h3>
              <p className="text-xs text-[#52525B]">
                Daily comparison of orders placed vs unique customers visited.
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#111111]"></span>
                <span className="font-semibold text-[#111111]">Orders</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#D97706]"></span>
                <span className="font-semibold text-[#D97706]">Customers</span>
              </div>
            </div>
          </div>

          {/* SVG Grouped Bar Chart */}
          {loading ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#71717A] font-serif">
              Loading transaction chart...
            </div>
          ) : !barChartData || barChartData.stats.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[#71717A] italic font-serif">
              No transactions recorded in this date range.
            </div>
          ) : (
            <div className="relative pt-2">
              <svg viewBox="0 0 500 220" className="w-full h-56 overflow-visible select-none">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const y = 175 - pct * 145;
                  const val = Math.round(barChartData.maxVal * pct);
                  return (
                    <g key={idx}>
                      <line x1="35" y1={y} x2="490" y2={y} stroke="#F3EFEA" strokeWidth="1" />
                      <text x="30" y={y + 3} textAnchor="end" fontSize="9" fill="#71717A" fontFamily="monospace">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {barChartData.stats.map((pt, idx) => {
                  const totalBars = barChartData.stats.length;
                  const slotWidth = (490 - 45) / Math.max(totalBars, 1);
                  const xCenter = 45 + idx * slotWidth + slotWidth / 2;
                  const barW = Math.min(Math.max(slotWidth * 0.35, 4), 14);

                  const orderH = (pt.orders_count / barChartData.maxVal) * 145;
                  const custH = (pt.unique_customers / barChartData.maxVal) * 145;

                  const orderY = 175 - orderH;
                  const custY = 175 - custH;

                  const isHovered = hoveredBarIndex === idx;

                  return (
                    <g
                      key={pt.date}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      className="cursor-pointer group"
                    >
                      {/* Hover highlight column */}
                      {isHovered && (
                        <rect
                          x={xCenter - slotWidth / 2}
                          y="20"
                          width={slotWidth}
                          height="160"
                          fill="#FAF9F6"
                          rx="4"
                        />
                      )}

                      {/* Orders Bar (Charcoal) */}
                      <rect
                        x={xCenter - barW - 1}
                        y={orderY}
                        width={barW}
                        height={Math.max(orderH, 1)}
                        fill="#111111"
                        rx="2"
                        className="transition-all"
                      />

                      {/* Customers Bar (Warm Amber) */}
                      <rect
                        x={xCenter + 1}
                        y={custY}
                        width={barW}
                        height={Math.max(custH, 1)}
                        fill="#D97706"
                        rx="2"
                        className="transition-all"
                      />

                      {/* X-axis date tick (Show only every Nth date if many) */}
                      {(totalBars <= 10 || idx % Math.ceil(totalBars / 7) === 0 || idx === totalBars - 1) && (
                        <text
                          x={xCenter}
                          y="195"
                          textAnchor="middle"
                          fontSize="9"
                          fill="#71717A"
                          fontFamily="monospace"
                        >
                          {pt.date.slice(5)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Floating Tooltip when hovering a bar */}
              {hoveredBarIndex !== null && barChartData.stats[hoveredBarIndex] && (
                <div className="absolute top-2 right-4 bg-white border border-[#E6E2DA] rounded-xl p-3 shadow-lg text-xs space-y-1 pointer-events-none font-serif z-20">
                  <p className="font-bold text-[#111111] border-b border-[#E6E2DA] pb-1 font-mono">
                    {barChartData.stats[hoveredBarIndex].date}
                  </p>
                  <div className="flex items-center justify-between gap-4 text-[#111111]">
                    <span>Orders:</span>
                    <strong className="font-mono tabular-nums">
                      {barChartData.stats[hoveredBarIndex].orders_count}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[#D97706]">
                    <span>Unique Guests:</span>
                    <strong className="font-mono tabular-nums">
                      {barChartData.stats[hoveredBarIndex].unique_customers}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[#166534] pt-1 border-t border-[#E6E2DA]">
                    <span>Revenue:</span>
                    <strong className="font-mono tabular-nums">
                      ₹{barChartData.stats[hoveredBarIndex].revenue}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: TOP SELLING MENU ITEMS (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E6E2DA]">
            <div>
              <h3 className="font-bold text-[#111111] text-base font-serif">
                Top Menu Performances
              </h3>
              <p className="text-xs text-[#52525B]">Fastest-moving items &amp; revenue drivers</p>
            </div>
            <Award className="w-4 h-4 text-[#D97706]" />
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[#71717A] font-serif">Loading menu items...</div>
          ) : !data || data.top_menu_items.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#71717A] italic font-serif">
              No sales data recorded yet.
            </div>
          ) : (
            <div className="space-y-3.5">
              {data.top_menu_items.map((item, idx) => {
                const stockQty = item.stock_qty ?? 0;
                const maxStock = item.max_stock ?? 100;
                const pct = maxStock > 0 ? Math.min(100, Math.round((stockQty / maxStock) * 100)) : 0;
                const isLow = stockQty <= (item.low_stock_alert ?? 10);

                return (
                  <div key={item.id} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="w-5 h-5 rounded-md bg-[#F3EFEA] border border-[#E6E2DA] flex items-center justify-center font-mono font-bold text-[10px] text-[#111111]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-[#111111] font-serif truncate">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-[#111111] tabular-nums whitespace-nowrap">
                        ₹{item.revenue_generated}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#52525B]">
                      <span>{item.units_sold} units ordered</span>
                      <span className={isLow ? 'text-[#92400E] font-semibold' : 'text-[#71717A]'}>
                        Stock: {stockQty} / {maxStock}
                      </span>
                    </div>

                    {/* Capacity Progress Bar */}
                    <div className="w-full h-1.5 bg-[#F3EFEA] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stockQty <= 0
                            ? 'bg-[#EF4444]'
                            : isLow
                            ? 'bg-[#F59E0B]'
                            : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. LOYALTY PROGRAM & CRM SECTION */}
      <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA]">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#111111] font-serif">
              Customer Loyalty &amp; Retention Analytics
            </h3>
            <p className="text-xs text-[#52525B]">
              Membership growth, customer visit segments, and points economy metrics.
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-[#166534]" />
        </div>

        {/* 4 Loyalty Summary Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
              Enrolled Members
            </span>
            <p className="text-xl font-bold font-mono text-[#111111] tabular-nums">
              {data ? data.loyalty_kpis.total_members : 0}
            </p>
          </div>

          <div className="p-3.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
              Active Points Pool
            </span>
            <p className="text-xl font-bold font-mono text-[#166534] tabular-nums">
              {data ? data.loyalty_kpis.active_points : 0} pts
            </p>
          </div>

          <div className="p-3.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
              Rewards Redeemed
            </span>
            <p className="text-xl font-bold font-mono text-[#92400E] tabular-nums">
              ₹{data ? data.loyalty_kpis.rewards_redeemed_rupees : 0}
            </p>
          </div>

          <div className="p-3.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-xl space-y-1">
            <span className="text-[11px] font-bold text-[#71717A] uppercase tracking-wider">
              Repeat Visit Rate
            </span>
            <p className="text-xl font-bold font-mono text-[#111111] tabular-nums">
              {data ? data.loyalty_kpis.repeat_rate : 0}%
            </p>
          </div>
        </div>

        {/* 2-Column Visual Charts: Member Growth Area Chart + Demographics Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Chart 1: Member Growth SVG Area Chart */}
          <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#111111] font-serif">
                Cumulative Membership Growth
              </span>
              <span className="text-xs text-[#166534] font-semibold bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md">
                Organic Signups
              </span>
            </div>

            {!lineChartData || lineChartData.points.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-[#71717A] italic font-serif">
                No member signups in this range.
              </div>
            ) : (
              <svg viewBox="0 0 500 180" className="w-full h-44 overflow-visible">
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#166534" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#166534" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0, 0.5, 1].map((pct, idx) => {
                  const y = 145 - pct * 115;
                  return (
                    <line key={idx} x1="30" y1={y} x2="490" y2={y} stroke="#E6E2DA" strokeWidth="1" />
                  );
                })}

                {/* Path calculation */}
                {(() => {
                  const pts = lineChartData.points;
                  const maxV = lineChartData.maxVal;
                  const total = pts.length;
                  const stepX = (490 - 40) / Math.max(total - 1, 1);

                  const coords = pts.map((p, i) => {
                    const x = 40 + i * stepX;
                    const y = 145 - (p.cumulative_members / maxV) * 115;
                    return { x, y, p };
                  });

                  const lineD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '');
                  const areaD = `${lineD} L ${coords[coords.length - 1].x} 145 L ${coords[0].x} 145 Z`;

                  return (
                    <g>
                      <path d={areaD} fill="url(#emeraldGrad)" />
                      <path d={lineD} fill="none" stroke="#166534" strokeWidth="2.5" />
                      {coords.map((c, i) => (
                        <g key={i}>
                          <circle cx={c.x} cy={c.y} r="3.5" fill="#166534" stroke="#ffffff" strokeWidth="1.5" />
                          {(i === 0 || i === coords.length - 1 || i % Math.ceil(total / 4) === 0) && (
                            <text
                              x={c.x}
                              y="165"
                              textAnchor="middle"
                              fontSize="9"
                              fill="#71717A"
                              fontFamily="monospace"
                            >
                              {c.p.date.slice(5)}
                            </text>
                          )}
                        </g>
                      ))}
                    </g>
                  );
                })()}
              </svg>
            )}
          </div>

          {/* Chart 2: Interactive Donut Chart for Customer Demographics / Tiers */}
          <div className="p-4 bg-[#FAF9F6] border border-[#E6E2DA] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#111111] font-serif">
                Audience Segmentation
              </span>

              {/* View Toggle */}
              <div className="flex items-center p-0.5 bg-white border border-[#E6E2DA] rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setDonutView('segments')}
                  className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                    donutView === 'segments' ? 'bg-[#111111] text-white' : 'text-[#71717A]'
                  }`}
                >
                  Loyalty Tiers
                </button>
                <button
                  type="button"
                  onClick={() => setDonutView('age')}
                  className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                    donutView === 'age' ? 'bg-[#111111] text-white' : 'text-[#71717A]'
                  }`}
                >
                  Age Groups
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 pt-1">
              {/* SVG Donut Ring */}
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                  {(() => {
                    const radius = 70;
                    const circumference = 2 * Math.PI * radius; // ~439.8
                    let accumulatedPct = 0;

                    return donutSegments.map((seg, idx) => {
                      const strokeDash = (seg.pct / 100) * circumference;
                      const strokeOffset = -((accumulatedPct / 100) * circumference);
                      accumulatedPct += seg.pct;

                      return (
                        <circle
                          key={idx}
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="28"
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeDashoffset={strokeOffset}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Donut Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-xl font-bold font-mono text-[#111111] tabular-nums">
                    {data ? data.loyalty_kpis.total_members : 0}
                  </span>
                  <span className="text-[10px] text-[#71717A] uppercase tracking-wider font-bold">
                    Members
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-1.5 text-xs w-full max-w-xs">
                {donutSegments.map((seg, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }}></span>
                      <span className="text-[#111111] font-serif truncate">{seg.label}</span>
                    </div>
                    <span className="font-mono font-bold text-[#111111] tabular-nums ml-2">
                      {seg.count} ({seg.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. RECENT LOYALTY ACTIVITY AUDIT TABLE */}
        <div className="pt-2 border-t border-[#E6E2DA] space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-[#111111] text-sm font-serif">
              Recent Member Ledger &amp; Points Activity
            </h4>
            <span className="text-xs text-[#71717A]">Latest 15 reward transactions</span>
          </div>

          {!data || data.recent_activity.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#71717A] italic font-serif">
              No recent points activity recorded.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#E6E2DA] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#E6E2DA] text-[#52525B] uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2 px-3">Date &amp; Time</th>
                    <th className="py-2 px-3">Member</th>
                    <th className="py-2 px-3">Event Type</th>
                    <th className="py-2 px-3 text-right">Points</th>
                    <th className="py-2 px-3 text-right">Balance After</th>
                    <th className="py-2 px-3">Reason / Context</th>
                    <th className="py-2 px-3">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E2DA]">
                  {data.recent_activity.map((act) => {
                    const isPositive = act.points_change > 0;
                    return (
                      <tr key={act.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[#52525B] text-[11px] tabular-nums whitespace-nowrap">
                          {new Date(act.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-2.5 px-3">
                          <p className="font-bold text-[#111111] font-serif">{act.customer_name}</p>
                          <p className="text-[10px] font-mono text-[#71717A] tabular-nums">{act.customer_phone}</p>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {act.change_type === 'earn' && (
                            <span className="text-[10px] font-bold text-[#166534] bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-md">
                              Points Earned
                            </span>
                          )}
                          {act.change_type === 'redeem' && (
                            <span className="text-[10px] font-bold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded-md">
                              Reward Redeemed
                            </span>
                          )}
                          {act.change_type === 'manual_bonus' && (
                            <span className="text-[10px] font-bold text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded-md">
                              Bonus Awarded
                            </span>
                          )}
                          {act.change_type === 'manual_deduct' && (
                            <span className="text-[10px] font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-md">
                              Points Deducted
                            </span>
                          )}
                        </td>

                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                            isPositive ? 'text-[#166534]' : 'text-[#991B1B]'
                          }`}
                        >
                          {isPositive ? `+${act.points_change}` : act.points_change} pts
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#111111] tabular-nums">
                          {act.balance_after} pts
                        </td>

                        <td className="py-2.5 px-3 text-[#52525B] italic max-w-xs truncate">
                          {act.reason || '—'}
                        </td>

                        <td className="py-2.5 px-3 text-[#71717A] text-[11px] font-serif whitespace-nowrap">
                          {act.performed_by}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
