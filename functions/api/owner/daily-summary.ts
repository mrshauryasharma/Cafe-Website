import { Env } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

export interface DailySummaryMetrics {
  total_bills: number;
  gross_sales: number;
  loyalty_discounts: number;
  extra_discounts: number;
  packaging_collected: number;
  cgst_collected: number;
  sgst_collected: number;
  tax_collected: number;
  net_revenue: number;
  avg_bill_value: number;
}

export interface DailyPaymentBreakdown {
  cash_total: number;
  upi_total: number;
  card_total: number;
  split_bills_count: number;
}

export interface DailyItemSale {
  item_name: string;
  quantity_sold: number;
  total_revenue: number;
}

export interface DailyWaiterSale {
  waiter_id: string;
  waiter_name: string;
  bills_count: number;
  net_revenue: number;
}

export interface DailyDiningBreakdown {
  dine_in: { count: number; revenue: number };
  takeaway: { count: number; revenue: number };
  delivery: { count: number; revenue: number };
}

export interface DailySummaryResponse {
  date: string;
  generated_at: string;
  generated_by: string;
  cafe_name: string;
  gstin: string | null;
  summary: DailySummaryMetrics;
  payment_breakdown: DailyPaymentBreakdown;
  item_wise_sales: DailyItemSale[];
  waiter_wise_sales: DailyWaiterSale[];
  dining_breakdown: DailyDiningBreakdown;
  kot_audit: {
    total_kots: number;
    cancel_kots: number;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_view_reports');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);

    const url = new URL(request.url);
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const defaultDate = istFormatter.format(new Date());
    const dateParam = url.searchParams.get('date')?.trim();
    const targetDate = dateParam || defaultDate;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Expected YYYY-MM-DD.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const startDateObj = new Date(`${targetDate}T00:00:00+05:30`);
    const endDateObj = new Date(`${targetDate}T23:59:59.999+05:30`);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid calendar date supplied.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const startUtc = startDateObj.toISOString();
    const endUtc = endDateObj.toISOString();

    const [settings, ordersRes, itemsRes, kotRes] = await Promise.all([
      env.DB.prepare('SELECT cafe_name, gstin FROM cafe_settings WHERE id = 1').first<{
        cafe_name: string;
        gstin: string | null;
      }>(),
      env.DB.prepare(
        `SELECT id, subtotal, discount_amount, extra_discount, packaging_amount, tax_amount,
                final_amount, dining_type, payment_method, split_details_json, waiter_id, waiter_name
         FROM orders
         WHERE created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`
      )
        .bind(startUtc, endUtc)
        .all<{
          id: string;
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
        }>(),
      env.DB.prepare(
        `SELECT MAX(oi.item_name) AS item_name,
                SUM(oi.quantity) AS quantity_sold,
                SUM(oi.total_price) AS total_revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.created_at >= ? AND o.created_at <= ?
         GROUP BY LOWER(TRIM(oi.item_name))
         ORDER BY quantity_sold DESC, total_revenue DESC`
      )
        .bind(startUtc, endUtc)
        .all<{
          item_name: string;
          quantity_sold: number;
          total_revenue: number;
        }>(),
      env.DB.prepare(
        `SELECT COUNT(*) AS total_kots,
                SUM(CASE WHEN ticket_type = 'cancel_item' THEN 1 ELSE 0 END) AS cancel_kots
         FROM kot_queue
         WHERE created_at >= ? AND created_at <= ?`
      )
        .bind(startUtc, endUtc)
        .first<{ total_kots: number; cancel_kots: number | null }>(),
    ]);

    const orders = ordersRes.results || [];

    let grossSales = 0;
    let totalDiscountCombined = 0;
    let extraDiscounts = 0;
    let packagingCollected = 0;
    let taxCollected = 0;
    let netRevenue = 0;

    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;
    let splitBillsCount = 0;

    const diningBreakdown: DailyDiningBreakdown = {
      dine_in: { count: 0, revenue: 0 },
      takeaway: { count: 0, revenue: 0 },
      delivery: { count: 0, revenue: 0 },
    };

    const waiterMap = new Map<
      string,
      { waiter_id: string; waiter_name: string; bills_count: number; net_revenue: number }
    >();

    for (const ord of orders) {
      const sub = Number(ord.subtotal) || 0;
      const combinedDisc = Number(ord.discount_amount) || 0;
      const extraDisc = Number(ord.extra_discount) || 0;
      const pkg = Number(ord.packaging_amount) || 0;
      const tax = Number(ord.tax_amount) || 0;
      const finalAmt = Number(ord.final_amount) || 0;

      grossSales += sub;
      totalDiscountCombined += combinedDisc;
      extraDiscounts += extraDisc;
      packagingCollected += pkg;
      taxCollected += tax;
      netRevenue += finalAmt;

      const method = (ord.payment_method || 'cash').toLowerCase();
      if (method === 'split') {
        splitBillsCount++;
        let splitObj: { cash?: number; upi?: number; card?: number } | null = null;
        if (ord.split_details_json) {
          try {
            splitObj = JSON.parse(ord.split_details_json);
          } catch {
            splitObj = null;
          }
        }
        if (splitObj) {
          cashTotal += Number(splitObj.cash) || 0;
          upiTotal += Number(splitObj.upi) || 0;
          cardTotal += Number(splitObj.card) || 0;
        } else {
          cashTotal += finalAmt;
        }
      } else if (method === 'upi') {
        upiTotal += finalAmt;
      } else if (method === 'card') {
        cardTotal += finalAmt;
      } else {
        cashTotal += finalAmt;
      }

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

      const wId = ord.waiter_id || 'counter';
      const wName = ord.waiter_name || 'Counter Staff';
      const wKey = `${wId}::${wName}`;
      const existingW = waiterMap.get(wKey) || {
        waiter_id: wId,
        waiter_name: wName,
        bills_count: 0,
        net_revenue: 0,
      };
      existingW.bills_count++;
      existingW.net_revenue += finalAmt;
      waiterMap.set(wKey, existingW);
    }

    // discount_amount in checkout stores (extraDiscount + pointsDiscount)
    const loyaltyDiscounts = Math.max(0, totalDiscountCombined - extraDiscounts);
    const cgstCollected = round2(taxCollected / 2);
    const sgstCollected = round2(taxCollected - cgstCollected);
    const totalBills = orders.length;
    const avgBillValue = totalBills > 0 ? round2(netRevenue / totalBills) : 0;

    diningBreakdown.dine_in.revenue = round2(diningBreakdown.dine_in.revenue);
    diningBreakdown.takeaway.revenue = round2(diningBreakdown.takeaway.revenue);
    diningBreakdown.delivery.revenue = round2(diningBreakdown.delivery.revenue);

    const itemWiseSales: DailyItemSale[] = (itemsRes.results || []).map((row) => ({
      item_name: row.item_name || 'Item',
      quantity_sold: Number(row.quantity_sold) || 0,
      total_revenue: round2(Number(row.total_revenue) || 0),
    }));

    const waiterWiseSales: DailyWaiterSale[] = Array.from(waiterMap.values())
      .map((w) => ({
        waiter_id: w.waiter_id,
        waiter_name: w.waiter_name,
        bills_count: w.bills_count,
        net_revenue: round2(w.net_revenue),
      }))
      .sort((a, b) => b.net_revenue - a.net_revenue);

    const responsePayload: DailySummaryResponse = {
      date: targetDate,
      generated_at: new Date().toISOString(),
      generated_by: auth.user.name || auth.user.username,
      cafe_name: settings?.cafe_name || 'Kimmo’s Kitchen',
      gstin: settings?.gstin || null,
      summary: {
        total_bills: totalBills,
        gross_sales: round2(grossSales),
        loyalty_discounts: round2(loyaltyDiscounts),
        extra_discounts: round2(extraDiscounts),
        packaging_collected: round2(packagingCollected),
        cgst_collected: cgstCollected,
        sgst_collected: sgstCollected,
        tax_collected: round2(taxCollected),
        net_revenue: round2(netRevenue),
        avg_bill_value: avgBillValue,
      },
      payment_breakdown: {
        cash_total: round2(cashTotal),
        upi_total: round2(upiTotal),
        card_total: round2(cardTotal),
        split_bills_count: splitBillsCount,
      },
      item_wise_sales: itemWiseSales,
      waiter_wise_sales: waiterWiseSales,
      dining_breakdown: diningBreakdown,
      kot_audit: {
        total_kots: Number(kotRes?.total_kots) || 0,
        cancel_kots: Number(kotRes?.cancel_kots) || 0,
      },
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
      JSON.stringify({ error: error.message || 'Failed to generate daily summary' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
