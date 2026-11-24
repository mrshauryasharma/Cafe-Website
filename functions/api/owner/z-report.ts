import { Env } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

export interface ZReportPaymentReconciliation {
  cash_total: number;
  upi_total: number;
  card_total: number;
  split_orders_count: number;
  reconciled_total: number;
}

export interface ZReportFinancialSummary {
  total_orders: number;
  gross_sales: number;
  loyalty_discounts: number;
  extra_discounts: number;
  packaging_collected: number;
  tax_collected: number;
  cgst_collected: number;
  sgst_collected: number;
  net_revenue: number;
}

export interface ZReportDiningModeBreakdown {
  dine_in: { count: number; revenue: number };
  takeaway: { count: number; revenue: number };
  delivery: { count: number; revenue: number };
}

export interface ZReportWaiterBreakdown {
  waiter_id: string;
  waiter_name: string;
  orders_count: number;
  net_revenue: number;
}

export interface ZReportCancelledItem {
  id: string;
  kot_number: string;
  table_number: string;
  waiter_name: string;
  items: { item_name: string; quantity: number; notes?: string }[];
  reason: string | null;
  created_at: string;
}

export interface ZReportOpenTable {
  draft_id: string;
  draft_number: string;
  table_number: string | null;
  dining_type: string;
  customer_name?: string | null;
  items_count: number;
  subtotal: number;
  waiter_name?: string | null;
  created_at: string;
}

export interface ZReportResponse {
  date: string;
  generated_at: string;
  generated_by: string;
  cafe_name: string;
  gstin: string | null;
  financial_summary: ZReportFinancialSummary;
  payment_reconciliation: ZReportPaymentReconciliation;
  dining_breakdown: ZReportDiningModeBreakdown;
  waiter_breakdown: ZReportWaiterBreakdown[];
  cancelled_items: ZReportCancelledItem[];
  open_tables_count: number;
  open_tables_subtotal: number;
  open_tables: ZReportOpenTable[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_view_reports');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);

    const url = new URL(request.url);
    const now = new Date();

    // Default to today's date in IST (Asia/Kolkata)
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const defaultDate = istFormatter.format(now);
    const targetDate = url.searchParams.get('date')?.trim() || defaultDate;

    // Build IST day boundaries converted to ISO strings
    let startUtc = '';
    let endUtc = '';
    try {
      startUtc = new Date(`${targetDate}T00:00:00+05:30`).toISOString();
      endUtc = new Date(`${targetDate}T23:59:59.999+05:30`).toISOString();
    } catch {
      startUtc = `${targetDate}T00:00:00.000Z`;
      endUtc = `${targetDate}T23:59:59.999Z`;
    }

    // Load Cafe Settings for Branding & GSTIN
    const settings = await env.DB.prepare(
      `SELECT cafe_name, gstin FROM cafe_settings WHERE id = 1`
    ).first<{ cafe_name: string; gstin: string | null }>();

    // Query settled orders matching that day
    const ordersResult = await env.DB.prepare(
      `SELECT id, order_number, subtotal, discount_amount, extra_discount, packaging_amount, tax_amount,
              final_amount, dining_type, payment_method, split_details_json, waiter_id, waiter_name, created_at
       FROM orders
       WHERE (created_at >= ? AND created_at <= ?) OR substr(created_at, 1, 10) = ?
       ORDER BY created_at ASC`
    )
      .bind(startUtc, endUtc, targetDate)
      .all<{
        id: string;
        order_number: string;
        subtotal: number;
        discount_amount: number;
        extra_discount: number;
        packaging_amount: number;
        tax_amount: number;
        final_amount: number;
        dining_type: string;
        payment_method: string;
        split_details_json: string | null;
        waiter_id: string | null;
        waiter_name: string | null;
        created_at: string;
      }>();

    const orders = ordersResult.results || [];

    // Financial & Payment Accumulators
    let grossSales = 0;
    let loyaltyDiscounts = 0;
    let extraDiscounts = 0;
    let packagingCollected = 0;
    let taxCollected = 0;
    let netRevenue = 0;

    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let splitOrdersCount = 0;

    const diningBreakdown: ZReportDiningModeBreakdown = {
      dine_in: { count: 0, revenue: 0 },
      takeaway: { count: 0, revenue: 0 },
      delivery: { count: 0, revenue: 0 },
    };

    const waiterMap = new Map<string, { waiter_id: string; waiter_name: string; count: number; revenue: number }>();

    for (const ord of orders) {
      const sub = Number(ord.subtotal) || 0;
      const disc = Number(ord.discount_amount) || 0;
      const extra = Number(ord.extra_discount) || 0;
      const pkg = Number(ord.packaging_amount) || 0;
      const tax = Number(ord.tax_amount) || 0;
      const finalAmt = Number(ord.final_amount) || 0;

      grossSales += sub;
      loyaltyDiscounts += disc;
      extraDiscounts += extra;
      packagingCollected += pkg;
      taxCollected += tax;
      netRevenue += finalAmt;

      // Payment reconciliation
      if (ord.payment_method === 'split') {
        splitOrdersCount++;
        let splitObj: { cash?: number; upi?: number; card?: number } | null = null;
        if (ord.split_details_json) {
          try {
            splitObj = JSON.parse(ord.split_details_json);
          } catch {}
        }
        if (splitObj) {
          cashTotal += Number(splitObj.cash) || 0;
          upiTotal += Number(splitObj.upi) || 0;
          cardTotal += Number(splitObj.card) || 0;
        } else {
          cashTotal += finalAmt;
        }
      } else if (ord.payment_method === 'upi') {
        upiTotal += finalAmt;
      } else if (ord.payment_method === 'card') {
        cardTotal += finalAmt;
      } else {
        // 'cash' or default
        cashTotal += finalAmt;
      }

      // Dining mode
      const dtype = (ord.dining_type || 'dine_in').toLowerCase();
      if (dtype === 'takeaway') {
        diningBreakdown.takeaway.count++;
        diningBreakdown.takeaway.revenue += finalAmt;
      } else if (dtype === 'delivery') {
        diningBreakdown.delivery.count++;
        diningBreakdown.delivery.revenue += finalAmt;
      } else {
        diningBreakdown.dine_in.count++;
        diningBreakdown.dine_in.revenue += finalAmt;
      }

      // Waiter tracking
      const wId = ord.waiter_id || 'counter';
      const wName = ord.waiter_name || 'Counter Staff';
      const wKey = `${wId}_${wName}`;
      const existingW = waiterMap.get(wKey) || { waiter_id: wId, waiter_name: wName, count: 0, revenue: 0 };
      existingW.count++;
      existingW.revenue += finalAmt;
      waiterMap.set(wKey, existingW);
    }

    const cgstCollected = Math.round((taxCollected / 2) * 100) / 100;
    const sgstCollected = Math.round((taxCollected - cgstCollected) * 100) / 100;
    const reconciledTotal = Math.round((cashTotal + upiTotal + cardTotal) * 100) / 100;

    const financialSummary: ZReportFinancialSummary = {
      total_orders: orders.length,
      gross_sales: Math.round(grossSales * 100) / 100,
      loyalty_discounts: Math.round(loyaltyDiscounts * 100) / 100,
      extra_discounts: Math.round(extraDiscounts * 100) / 100,
      packaging_collected: Math.round(packagingCollected * 100) / 100,
      tax_collected: Math.round(taxCollected * 100) / 100,
      cgst_collected: cgstCollected,
      sgst_collected: sgstCollected,
      net_revenue: Math.round(netRevenue * 100) / 100,
    };

    const paymentReconciliation: ZReportPaymentReconciliation = {
      cash_total: Math.round(cashTotal * 100) / 100,
      upi_total: Math.round(upiTotal * 100) / 100,
      card_total: Math.round(cardTotal * 100) / 100,
      split_orders_count: splitOrdersCount,
      reconciled_total: reconciledTotal,
    };

    diningBreakdown.dine_in.revenue = Math.round(diningBreakdown.dine_in.revenue * 100) / 100;
    diningBreakdown.takeaway.revenue = Math.round(diningBreakdown.takeaway.revenue * 100) / 100;
    diningBreakdown.delivery.revenue = Math.round(diningBreakdown.delivery.revenue * 100) / 100;

    const waiterBreakdown: ZReportWaiterBreakdown[] = Array.from(waiterMap.values())
      .map((w) => ({
        waiter_id: w.waiter_id,
        waiter_name: w.waiter_name,
        orders_count: w.count,
        net_revenue: Math.round(w.revenue * 100) / 100,
      }))
      .sort((a, b) => b.net_revenue - a.net_revenue);

    // Cancelled Items Audit on that Date from kot_queue
    const cancelledRows = await env.DB.prepare(
      `SELECT id, kot_number, table_number, waiter_name, items_json, reason, created_at
       FROM kot_queue
       WHERE ticket_type = 'cancel_item'
         AND ((created_at >= ? AND created_at <= ?) OR substr(created_at, 1, 10) = ?)
       ORDER BY created_at ASC`
    )
      .bind(startUtc, endUtc, targetDate)
      .all<{
        id: string;
        kot_number: string;
        table_number: string;
        waiter_name: string;
        items_json: string;
        reason: string | null;
        created_at: string;
      }>();

    const cancelledItems: ZReportCancelledItem[] = (cancelledRows.results || []).map((c) => {
      let items: any[] = [];
      try {
        items = JSON.parse(c.items_json);
      } catch {}
      return {
        id: c.id,
        kot_number: c.kot_number,
        table_number: c.table_number,
        waiter_name: c.waiter_name,
        items,
        reason: c.reason,
        created_at: c.created_at,
      };
    });

    // Open / Unsettled Draft Tables currently active
    const openDrafts = await env.DB.prepare(
      `SELECT d.id, d.draft_number, d.table_number, d.dining_type, d.waiter_name, d.items_json, d.created_at,
              COALESCE(c.name, d.customer_name) AS customer_name
       FROM draft_orders d
       LEFT JOIN customers c ON d.customer_id = c.id
       ORDER BY d.created_at DESC`
    ).all<{
      id: string;
      draft_number: string;
      table_number: string | null;
      dining_type: string;
      waiter_name: string | null;
      items_json: string;
      created_at: string;
      customer_name?: string | null;
    }>();

    let openSubtotal = 0;
    const openTables: ZReportOpenTable[] = (openDrafts.results || []).map((d) => {
      let items: any[] = [];
      try {
        items = JSON.parse(d.items_json);
      } catch {}
      const dSubtotal = items.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
        0
      );
      openSubtotal += dSubtotal;
      return {
        draft_id: d.id,
        draft_number: d.draft_number,
        table_number: d.table_number,
        dining_type: d.dining_type,
        customer_name: d.customer_name,
        items_count: items.reduce((cnt: number, it: any) => cnt + (Number(it.quantity) || 1), 0),
        subtotal: Math.round(dSubtotal * 100) / 100,
        waiter_name: d.waiter_name,
        created_at: d.created_at,
      };
    });

    const responsePayload: ZReportResponse = {
      date: targetDate,
      generated_at: new Date().toISOString(),
      generated_by: auth.user.name || auth.user.username,
      cafe_name: settings?.cafe_name || 'Kimmo’s Kitchen',
      gstin: settings?.gstin || null,
      financial_summary: financialSummary,
      payment_reconciliation: paymentReconciliation,
      dining_breakdown: diningBreakdown,
      waiter_breakdown: waiterBreakdown,
      cancelled_items: cancelledItems,
      open_tables_count: openTables.length,
      open_tables_subtotal: Math.round(openSubtotal * 100) / 100,
      open_tables: openTables,
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate Z-Report' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
