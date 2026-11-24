import { Env } from '../../types';
import { authenticate } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';
import { CafeSettingsRow } from '../owner/settings';
import { sendLoyaltySms, SmsResult } from '../../utils/sms';

export interface CheckoutLineItem {
  menu_item_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface SplitDetails {
  cash?: number;
  upi?: number;
  card?: number;
}

export interface CheckoutPayload {
  customer_id: string;
  items: CheckoutLineItem[];
  redeem_points: boolean;
  custom_redeem_points?: number;
  idempotency_key: string;
  dining_type?: string;
  table_id?: string;
  table_number?: string;
  extra_discount?: number;
  packaging_amount?: number;
  tax_amount?: number;
  payment_method?: string;
  split_details?: SplitDetails;
  waiter_id?: string;
  waiter_name?: string;
  draft_id?: string;
}

export interface CheckoutReceipt {
  order_id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  extra_discount: number;
  points_redeemed: number;
  discount_amount: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  gst_rate: number;
  gstin: string | null;
  packaging_amount: number;
  final_amount: number;
  points_earned: number;
  previous_balance: number;
  new_balance: number;
  dining_type: string;
  table_number: string | null;
  payment_method: string;
  split_details?: SplitDetails | null;
  waiter_name?: string | null;
  items: CheckoutLineItem[];
  created_at: string;
  sms: SmsResult;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  if (auth.user.role !== 'owner' && !auth.user.permissions.can_settle_bills) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to settle bills' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as CheckoutPayload;
    const {
      customer_id,
      items,
      redeem_points,
      custom_redeem_points,
      idempotency_key,
      dining_type,
      table_id,
      table_number,
      extra_discount,
      packaging_amount,
      tax_amount,
      payment_method,
      split_details,
      draft_id,
    } = body;

    if (extra_discount && extra_discount > 0 && auth.user.role !== 'owner' && !auth.user.permissions.can_apply_discounts) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to apply custom discounts' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    const diningType = dining_type?.trim() || 'Dine-In';
    const tableNumber = table_number?.trim() || null;
    const extraDiscount = Math.max(0, Number(extra_discount) || 0);
    const paymentMethod = payment_method?.trim() || 'Cash/UPI';
    const draftId = draft_id?.trim() || null;

    // 1. Idempotency Check: Return existing order receipt if already processed
    const existingOrder = await env.DB.prepare(
      `SELECT id, order_number, customer_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned,
              dining_type, table_number, extra_discount, payment_method, created_at 
       FROM orders WHERE idempotency_key = ?`
    ).bind(cleanIdempotencyKey).first<any>();

    if (existingOrder) {
      const existingItems = await env.DB.prepare(
        'SELECT menu_item_id, item_name, quantity, unit_price, notes FROM order_items WHERE order_id = ?'
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
            extra_discount: existingOrder.extra_discount ?? 0,
            points_redeemed: existingOrder.points_redeemed,
            discount_amount: existingOrder.discount_amount,
            final_amount: existingOrder.final_amount,
            points_earned: existingOrder.points_earned,
            previous_balance: cust?.points_balance ?? 0,
            new_balance: cust?.points_balance ?? 0,
            dining_type: existingOrder.dining_type || 'Dine-In',
            table_number: existingOrder.table_number || null,
            payment_method: existingOrder.payment_method || 'Cash/UPI',
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
      cafe_name: 'Kimmo’s Kitchen',
      earn_points_per_unit: 10,
      earn_spend_unit: 100,
      point_redeem_value: 1.0,
      min_bill_for_redeem: 0,
      max_redeem_percent: 100,
      staff_max_bonus_points: 50,
      gst_enabled: 0,
      gst_rate: 5.0,
      gstin: null,
      packaging_charge: 0.0,
      sms_enabled: 0,
      sms_api_key: null,
      sms_sender_id: null,
      sms_template: null,
      last_backup_at: null,
    };

    // 3. Calculate subtotal & validate items
    let subtotal = 0;
    const validatedItems: CheckoutLineItem[] = [];

    for (const item of items) {
      const q = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const p = Math.max(0, Number(item.unit_price) || 0);
      const name = item.item_name?.trim() || 'Menu Item';
      const notes = item.notes?.trim() || undefined;
      subtotal += q * p;
      validatedItems.push({
        menu_item_id: item.menu_item_id || undefined,
        item_name: name,
        quantity: q,
        unit_price: p,
        notes,
      });
    }

    if (subtotal <= 0) {
      return new Response(JSON.stringify({ error: 'Order total must be greater than zero' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Points & Discount Calculation
    const subtotalAfterExtra = Math.max(0, subtotal - extraDiscount);
    let pointsRedeemed = 0;
    let pointsDiscount = 0;

    if (redeem_points && customer.points_balance > 0) {
      if (subtotalAfterExtra >= safeSettings.min_bill_for_redeem) {
        const maxDiscountRupees = subtotalAfterExtra * (safeSettings.max_redeem_percent / 100);
        const maxPointsByRupees = Math.floor(maxDiscountRupees / safeSettings.point_redeem_value);
        let maxAllowedPoints = Math.min(customer.points_balance, maxPointsByRupees);

        if (custom_redeem_points !== undefined && custom_redeem_points > 0) {
          maxAllowedPoints = Math.min(custom_redeem_points, maxAllowedPoints);
        }

        pointsRedeemed = Math.max(0, Math.floor(maxAllowedPoints));
        pointsDiscount = Math.round(pointsRedeemed * safeSettings.point_redeem_value * 100) / 100;
      }
    }

    const totalDiscount = Math.round((extraDiscount + pointsDiscount) * 100) / 100;
    const discountedSubtotal = Math.max(0, subtotalAfterExtra - pointsDiscount);

    // Packaging Charge
    const packagingAmount = Math.max(0, Number(packaging_amount ?? 0));

    // Optional GST Calculation
    let finalTaxAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;

    if (safeSettings.gst_enabled && safeSettings.gst_rate > 0) {
      finalTaxAmount = Math.round((discountedSubtotal * (safeSettings.gst_rate / 100)) * 100) / 100;
      cgstAmount = Math.round((finalTaxAmount / 2) * 100) / 100;
      sgstAmount = Math.round((finalTaxAmount - cgstAmount) * 100) / 100;
    } else if (tax_amount && tax_amount > 0) {
      finalTaxAmount = Math.round(Number(tax_amount) * 100) / 100;
      cgstAmount = Math.round((finalTaxAmount / 2) * 100) / 100;
      sgstAmount = Math.round((finalTaxAmount - cgstAmount) * 100) / 100;
    }

    const finalAmount = Math.max(0, Math.round((discountedSubtotal + packagingAmount + finalTaxAmount) * 100) / 100);
    const pointsEarned =
      safeSettings.earn_spend_unit > 0
        ? Math.floor((finalAmount / safeSettings.earn_spend_unit) * safeSettings.earn_points_per_unit)
        : 0;

    const previousBalance = customer.points_balance;
    const newBalance = Math.round((previousBalance - pointsRedeemed + pointsEarned) * 100) / 100;

    // Split Payment Validation
    let splitDetailsJson: string | null = null;
    if (paymentMethod && paymentMethod.toLowerCase() === 'split') {
      const cash = Number(split_details?.cash || 0);
      const upi = Number(split_details?.upi || 0);
      const card = Number(split_details?.card || 0);
      const splitSum = Math.round((cash + upi + card) * 100) / 100;

      if (Math.abs(splitSum - finalAmount) > 0.05) {
        return new Response(
          JSON.stringify({
            error: `Split payment total (₹${splitSum}) does not match final bill amount (₹${finalAmount})`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      splitDetailsJson = JSON.stringify({ cash, upi, card });
    }

    // 5. Generate IDs & Waiter attribution
    const orderId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const now = new Date().toISOString();
    const staffAttribution = `${auth.user.name} (${auth.user.role})`;

    let waiterId: string | null = body.waiter_id || null;
    let waiterName: string | null = body.waiter_name || null;
    if (draft_id && (!waiterId || !waiterName)) {
      const draftRecord = await env.DB.prepare('SELECT waiter_id, waiter_name FROM draft_orders WHERE id = ?').bind(draft_id).first<{ waiter_id?: string; waiter_name?: string }>();
      if (draftRecord) {
        waiterId = draftRecord.waiter_id || waiterId;
        waiterName = draftRecord.waiter_name || waiterName;
      }
    }

    // 6. Atomic D1 Batch Execution
    const statements: D1PreparedStatement[] = [];

    // A. Insert Order
    statements.push(
      env.DB.prepare(
        `INSERT INTO orders (id, order_number, customer_id, staff_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned, idempotency_key, dining_type, table_number, extra_discount, tax_amount, packaging_amount, payment_method, split_details_json, waiter_id, waiter_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        orderNumber,
        customer.id,
        auth.user.id,
        subtotal,
        pointsRedeemed,
        totalDiscount,
        finalAmount,
        pointsEarned,
        cleanIdempotencyKey,
        diningType,
        tableNumber,
        extraDiscount,
        finalTaxAmount,
        packagingAmount,
        paymentMethod,
        splitDetailsJson,
        waiterId,
        waiterName,
        now
      )
    );

    // B. Insert Line Items
    for (const item of validatedItems) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          orderId,
          item.menu_item_id || null,
          item.item_name,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
          item.notes || null
        )
      );

      // C. Stock decrement & inventory log when item is from menu_items
      if (item.menu_item_id) {
        statements.push(
          env.DB.prepare(
            `UPDATE menu_items
             SET stock_qty = MAX(0, stock_qty - ?)
             WHERE id = ?`
          ).bind(item.quantity, item.menu_item_id)
        );

        statements.push(
          env.DB.prepare(
            `INSERT INTO inventory_logs (id, menu_item_id, item_name, change_type, quantity_change, stock_after, notes, performed_by, created_at)
             SELECT ?, id, name, 'sale', ?, MAX(0, stock_qty - ?), ?, ?, ?
             FROM menu_items WHERE id = ?`
          ).bind(
            crypto.randomUUID(),
            -item.quantity,
            item.quantity,
            `Sale on Order #${orderNumber}`,
            staffAttribution,
            now,
            item.menu_item_id
          )
        );
      }
    }

    // D. Delete draft order if resuming draft
    if (draftId) {
      statements.push(
        env.DB.prepare('DELETE FROM draft_orders WHERE id = ?').bind(draftId)
      );
    }

    // E. Update Customer totals & balance
    statements.push(
      env.DB.prepare(
        `UPDATE customers
         SET points_balance = ?,
             total_visits = total_visits + 1,
             total_spent = total_spent + ?
         WHERE id = ?`
      ).bind(newBalance, finalAmount, customer.id)
    );

    // F. Insert points_ledger entries
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
          `Redeemed ₹${pointsDiscount} discount on Order #${orderNumber}`,
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

    // If checking out a table, mark table vacant
    if (table_id) {
      statements.push(
        env.DB.prepare(
          "UPDATE cafe_tables SET status = 'vacant', active_order_id = NULL WHERE id = ? OR active_order_id = ?"
        ).bind(table_id, draftId || table_id)
      );
    } else if (table_number) {
      statements.push(
        env.DB.prepare(
          "UPDATE cafe_tables SET status = 'vacant', active_order_id = NULL WHERE table_number = ? OR table_name = ?"
        ).bind(table_number, table_number)
      );
    }

    await env.DB.batch(statements);

    // 7. Trigger SMS Notification
    const smsResult = await sendLoyaltySms(safeSettings, customer, {
      cafe_name: safeSettings.cafe_name || 'Kimmo’s Kitchen',
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
      extra_discount: extraDiscount,
      points_redeemed: pointsRedeemed,
      discount_amount: totalDiscount,
      tax_amount: finalTaxAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      gst_rate: safeSettings.gst_enabled ? safeSettings.gst_rate : 0,
      gstin: safeSettings.gstin || null,
      packaging_amount: packagingAmount,
      final_amount: finalAmount,
      points_earned: pointsEarned,
      previous_balance: previousBalance,
      new_balance: newBalance,
      dining_type: diningType,
      table_number: tableNumber,
      payment_method: paymentMethod,
      split_details: split_details || (splitDetailsJson ? JSON.parse(splitDetailsJson) : null),
      waiter_name: waiterName,
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
