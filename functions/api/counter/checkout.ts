import { Env } from '../../types';
import { authenticate } from '../../utils/auth';
import { CafeSettingsRow } from '../owner/settings';
import { sendLoyaltySms, SmsResult } from '../../utils/sms';

export interface CheckoutLineItem {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface CheckoutPayload {
  customer_id: string;
  items: CheckoutLineItem[];
  redeem_points: boolean;
  custom_redeem_points?: number;
  idempotency_key: string;
}

export interface CheckoutReceipt {
  order_id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  points_redeemed: number;
  discount_amount: number;
  final_amount: number;
  points_earned: number;
  previous_balance: number;
  new_balance: number;
  items: CheckoutLineItem[];
  created_at: string;
  sms: SmsResult;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as CheckoutPayload;
    const { customer_id, items, redeem_points, custom_redeem_points, idempotency_key } = body;

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'Customer is required for checkout' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart is empty. Add at least one item.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanIdempotencyKey = idempotency_key?.trim();
    if (!cleanIdempotencyKey) {
      return new Response(JSON.stringify({ error: 'Idempotency key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Idempotency Check: Return existing order receipt if already processed
    const existingOrder = await env.DB.prepare(
      'SELECT id, order_number, customer_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned, created_at FROM orders WHERE idempotency_key = ?'
    ).bind(cleanIdempotencyKey).first<any>();

    if (existingOrder) {
      const existingItems = await env.DB.prepare(
        'SELECT menu_item_id, item_name, quantity, unit_price FROM order_items WHERE order_id = ?'
      ).bind(existingOrder.id).all<CheckoutLineItem>();

      const cust = await env.DB.prepare('SELECT name, phone, points_balance FROM customers WHERE id = ?')
        .bind(existingOrder.customer_id)
        .first<any>();

      return new Response(
        JSON.stringify({
          receipt: {
            order_id: existingOrder.id,
            order_number: existingOrder.order_number,
            customer_id: existingOrder.customer_id,
            customer_name: cust?.name || 'Customer',
            customer_phone: cust?.phone || '',
            subtotal: existingOrder.subtotal,
            points_redeemed: existingOrder.points_redeemed,
            discount_amount: existingOrder.discount_amount,
            final_amount: existingOrder.final_amount,
            points_earned: existingOrder.points_earned,
            previous_balance: cust?.points_balance ?? 0,
            new_balance: cust?.points_balance ?? 0,
            items: existingItems.results || [],
            created_at: existingOrder.created_at,
            sms: { status: 'preview_only', message: 'Duplicate transaction idempotent replay' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch customer & settings
    const [customer, settings] = await Promise.all([
      env.DB.prepare(
        'SELECT id, name, phone, sms_consent, points_balance, total_visits, total_spent FROM customers WHERE id = ? AND is_archived = 0'
      ).bind(customer_id).first<{
        id: string;
        name: string;
        phone: string;
        sms_consent: number;
        points_balance: number;
        total_visits: number;
        total_spent: number;
      }>(),
      env.DB.prepare('SELECT * FROM cafe_settings WHERE id = 1').first<CafeSettingsRow>(),
    ]);

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found or has been archived' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const safeSettings: CafeSettingsRow = settings || {
      id: 1,
      cafe_name: 'The Grove Cafe',
      earn_points_per_unit: 10,
      earn_spend_unit: 100,
      point_redeem_value: 1.0,
      min_bill_for_redeem: 0,
      max_redeem_percent: 100,
      staff_max_bonus_points: 50,
      sms_enabled: 0,
      sms_api_key: null,
      sms_sender_id: null,
      sms_template: null,
      last_backup_at: null,
    };

    // 3. Calculate subtotal
    let subtotal = 0;
    const validatedItems: CheckoutLineItem[] = [];

    for (const item of items) {
      const q = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const p = Math.max(0, Number(item.unit_price) || 0);
      const name = item.item_name?.trim() || 'Menu Item';
      subtotal += q * p;
      validatedItems.push({
        menu_item_id: item.menu_item_id || undefined,
        item_name: name,
        quantity: q,
        unit_price: p,
      });
    }

    if (subtotal <= 0) {
      return new Response(JSON.stringify({ error: 'Order total must be greater than zero' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Points Redemption Calculation
    let pointsRedeemed = 0;
    let discountAmount = 0;

    if (redeem_points && customer.points_balance > 0) {
      if (subtotal >= safeSettings.min_bill_for_redeem) {
        const maxDiscountRupees = subtotal * (safeSettings.max_redeem_percent / 100);
        const maxPointsByRupees = Math.floor(maxDiscountRupees / safeSettings.point_redeem_value);
        let maxAllowedPoints = Math.min(customer.points_balance, maxPointsByRupees);

        if (custom_redeem_points !== undefined && custom_redeem_points > 0) {
          maxAllowedPoints = Math.min(custom_redeem_points, maxAllowedPoints);
        }

        pointsRedeemed = Math.max(0, Math.floor(maxAllowedPoints));
        discountAmount = Math.round(pointsRedeemed * safeSettings.point_redeem_value * 100) / 100;
      }
    }

    // 5. Final billing & earning calculations
    const finalAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const pointsEarned =
      safeSettings.earn_spend_unit > 0
        ? Math.floor((finalAmount / safeSettings.earn_spend_unit) * safeSettings.earn_points_per_unit)
        : 0;

    const previousBalance = customer.points_balance;
    const newBalance = Math.round((previousBalance - pointsRedeemed + pointsEarned) * 100) / 100;

    // 6. Generate IDs
    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const now = new Date().toISOString();
    const staffAttribution = `${auth.user.name} (${auth.user.role})`;

    // 7. Atomic D1 Batch Execution
    const statements: D1PreparedStatement[] = [];

    // A. Insert Order
    statements.push(
      env.DB.prepare(
        `INSERT INTO orders (id, order_number, customer_id, staff_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        orderNumber,
        customer.id,
        auth.user.id,
        subtotal,
        pointsRedeemed,
        discountAmount,
        finalAmount,
        pointsEarned,
        cleanIdempotencyKey,
        now
      )
    );

    // B. Insert Line Items
    for (const item of validatedItems) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          orderId,
          item.menu_item_id || null,
          item.item_name,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price
        )
      );
    }

    // C. Update Customer totals & balance
    statements.push(
      env.DB.prepare(
        `UPDATE customers
         SET points_balance = ?,
             total_visits = total_visits + 1,
             total_spent = total_spent + ?
         WHERE id = ?`
      ).bind(newBalance, finalAmount, customer.id)
    );

    // D. Insert points_ledger entries
    let runningBalance = previousBalance;

    if (pointsRedeemed > 0) {
      runningBalance -= pointsRedeemed;
      statements.push(
        env.DB.prepare(
          `INSERT INTO points_ledger (id, customer_id, order_id, change_type, points_change, balance_after, reason, performed_by, created_at)
           VALUES (?, ?, ?, 'redeem', ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          customer.id,
          orderId,
          -pointsRedeemed,
          runningBalance,
          `Redeemed ₹${discountAmount} discount on Order #${orderNumber}`,
          staffAttribution,
          now
        )
      );
    }

    if (pointsEarned > 0) {
      runningBalance += pointsEarned;
      statements.push(
        env.DB.prepare(
          `INSERT INTO points_ledger (id, customer_id, order_id, change_type, points_change, balance_after, reason, performed_by, created_at)
           VALUES (?, ?, ?, 'earn', ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          customer.id,
          orderId,
          pointsEarned,
          runningBalance,
          `Earned from bill of ₹${finalAmount} on Order #${orderNumber}`,
          staffAttribution,
          now
        )
      );
    }

    await env.DB.batch(statements);

    // 8. Trigger SMS Notification
    const smsResult = await sendLoyaltySms(safeSettings, customer, {
      cafe_name: safeSettings.cafe_name || 'The Grove Cafe',
      customer_name: customer.name,
      bill_amount: finalAmount,
      points_redeemed: pointsRedeemed,
      points_earned: pointsEarned,
      points_balance: newBalance,
    });

    const receipt: CheckoutReceipt = {
      order_id: orderId,
      order_number: orderNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      subtotal,
      points_redeemed: pointsRedeemed,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      points_earned: pointsEarned,
      previous_balance: previousBalance,
      new_balance: newBalance,
      items: validatedItems,
      created_at: now,
      sms: smsResult,
    };

    return new Response(JSON.stringify({ success: true, receipt }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Checkout failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
