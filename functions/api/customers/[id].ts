import { Env } from '../../types';
import { authenticate } from '../../utils/auth';

export interface OrderWithItems {
  id: string;
  order_number: string;
  subtotal: number;
  points_redeemed: number;
  discount_amount: number;
  final_amount: number;
  points_earned: number;
  created_at: string;
  items: {
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

export interface CustomerDetailProfile {
  customer: {
    id: string;
    name: string;
    phone: string;
    dob: string | null;
    notes: string | null;
    sms_consent: number;
    points_balance: number;
    total_visits: number;
    total_spent: number;
    created_at: string;
  };
  card: {
    id: string;
    card_uid: string;
    status: string;
    assigned_at: string | null;
  } | null;
  metrics: {
    average_bill: number;
    last_order: OrderWithItems | null;
    most_ordered_items: { item_name: string; total_quantity: number }[];
  };
  orders: OrderWithItems[];
  points_ledger: {
    id: string;
    order_id: string | null;
    change_type: string;
    points_change: number;
    balance_after: number;
    reason: string | null;
    performed_by: string;
    created_at: string;
  }[];
  config: {
    point_redeem_value: number;
    staff_max_bonus_points: number;
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing customer id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Fetch customer
    const customer = await env.DB.prepare(
      `SELECT id, name, phone, dob, notes, sms_consent, points_balance, total_visits, total_spent, is_archived, created_at 
       FROM customers WHERE id = ? AND is_archived = 0`
    ).bind(id).first<any>();

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found or has been archived' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch active NFC card
    const card = await env.DB.prepare(
      `SELECT id, card_uid, status, assigned_at FROM nfc_cards WHERE customer_id = ? AND status = 'active'`
    ).bind(id).first<any>();

    // 3. Fetch orders
    const ordersResult = await env.DB.prepare(
      `SELECT id, order_number, subtotal, points_redeemed, discount_amount, final_amount, points_earned, created_at 
       FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(id).all<any>();

    const rawOrders = ordersResult.results || [];
    const orderIds = rawOrders.map((o) => o.id);

    // 4. Fetch order items for these orders
    let orderItemsMap: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      // Chunk query if orders count is high
      const placeholders = orderIds.map(() => '?').join(',');
      const itemsResult = await env.DB.prepare(
        `SELECT id, order_id, item_name, quantity, unit_price, total_price 
         FROM order_items WHERE order_id IN (${placeholders})`
      ).bind(...orderIds).all<any>();

      for (const item of itemsResult.results || []) {
        if (!orderItemsMap[item.order_id]) {
          orderItemsMap[item.order_id] = [];
        }
        orderItemsMap[item.order_id].push({
          id: item.id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        });
      }
    }

    const ordersWithItems: OrderWithItems[] = rawOrders.map((o) => ({
      id: o.id,
      order_number: o.order_number,
      subtotal: o.subtotal,
      points_redeemed: o.points_redeemed,
      discount_amount: o.discount_amount,
      final_amount: o.final_amount,
      points_earned: o.points_earned,
      created_at: o.created_at,
      items: orderItemsMap[o.id] || [],
    }));

    // 5. Most ordered items
    const mostOrderedResult = await env.DB.prepare(
      `SELECT oi.item_name, SUM(oi.quantity) as total_quantity
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.customer_id = ?
       GROUP BY oi.item_name
       ORDER BY total_quantity DESC
       LIMIT 3`
    ).bind(id).all<{ item_name: string; total_quantity: number }>();

    // 6. Points ledger
    const ledgerResult = await env.DB.prepare(
      `SELECT id, order_id, change_type, points_change, balance_after, reason, performed_by, created_at
       FROM points_ledger
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(id).all<any>();

    // 7. Settings config for UI limits
    const settings = await env.DB.prepare(
      'SELECT point_redeem_value, staff_max_bonus_points FROM cafe_settings WHERE id = 1'
    ).first<{ point_redeem_value: number; staff_max_bonus_points: number }>();

    const averageBill =
      customer.total_visits > 0
        ? Math.round((customer.total_spent / customer.total_visits) * 100) / 100
        : 0;

    const payload: CustomerDetailProfile = {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        dob: customer.dob,
        notes: customer.notes,
        sms_consent: customer.sms_consent,
        points_balance: customer.points_balance,
        total_visits: customer.total_visits,
        total_spent: customer.total_spent,
        created_at: customer.created_at,
      },
      card: card
        ? {
            id: card.id,
            card_uid: card.card_uid,
            status: card.status,
            assigned_at: card.assigned_at,
          }
        : null,
      metrics: {
        average_bill: averageBill,
        last_order: ordersWithItems.length > 0 ? ordersWithItems[0] : null,
        most_ordered_items: mostOrderedResult.results || [],
      },
      orders: ordersWithItems,
      points_ledger: ledgerResult.results || [],
      config: {
        point_redeem_value: settings?.point_redeem_value ?? 1.0,
        staff_max_bonus_points: settings?.staff_max_bonus_points ?? 50,
      },
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch customer profile' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing customer id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await env.DB.prepare('SELECT id, phone FROM customers WHERE id = ? AND is_archived = 0')
      .bind(id)
      .first<{ id: string; phone: string }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      dob?: string;
      notes?: string;
      sms_consent?: number;
    };

    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const dob = body.dob !== undefined ? (body.dob ? body.dob.trim() : null) : undefined;
    const notes = body.notes !== undefined ? (body.notes ? body.notes.trim() : null) : undefined;
    const smsConsent = body.sms_consent !== undefined ? (body.sms_consent ? 1 : 0) : undefined;

    if (name !== undefined && name.length === 0) {
      return new Response(JSON.stringify({ error: 'Customer name cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (phone !== undefined) {
      if (phone.length === 0) {
        return new Response(JSON.stringify({ error: 'Phone number cannot be empty' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (phone !== existing.phone) {
        const phoneTaken = await env.DB.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?')
          .bind(phone, id)
          .first();
        if (phoneTaken) {
          return new Response(
            JSON.stringify({ error: `Phone number ${phone} is already registered to another customer` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    await env.DB.prepare(
      `UPDATE customers
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           dob = COALESCE(?, dob),
           notes = COALESCE(?, notes),
           sms_consent = COALESCE(?, sms_consent)
       WHERE id = ?`
    ).bind(
      name ?? null,
      phone ?? null,
      dob !== undefined ? dob : null,
      notes !== undefined ? notes : null,
      smsConsent !== undefined ? smsConsent : null,
      id
    ).run();

    return new Response(JSON.stringify({ success: true, message: 'Customer details updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update customer' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  // STRICT RULE: Only owner can remove customers
  if (auth.user.role !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Only the Café Owner can remove customer records.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing customer id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await env.DB.prepare('SELECT id, name FROM customers WHERE id = ? AND is_archived = 0')
      .bind(id)
      .first<{ id: string; name: string }>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Customer not found or already archived' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Atomically archive customer and block their active card
    await env.DB.batch([
      env.DB.prepare('UPDATE customers SET is_archived = 1 WHERE id = ?').bind(id),
      env.DB.prepare(
        `UPDATE nfc_cards 
         SET status = 'blocked', blocked_reason = 'Customer removed by owner' 
         WHERE customer_id = ? AND status = 'active'`
      ).bind(id),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Customer "${existing.name}" has been removed and active membership card blocked.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to remove customer' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
