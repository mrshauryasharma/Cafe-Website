import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';

interface BackupPayload {
  version?: string;
  exported_at?: string;
  data: {
    cafe_settings?: any[];
    users?: any[];
    menu_items?: any[];
    customers?: any[];
    nfc_cards?: any[];
    orders?: any[];
    order_items?: any[];
    points_ledger?: any[];
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const payload = (await request.json()) as BackupPayload;
    if (!payload || !payload.data) {
      return new Response(
        JSON.stringify({ error: 'Invalid backup format. Missing data payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data } = payload;
    const users = data.users || [];
    const hasOwner = users.some((u) => u.role === 'owner' && u.is_active === 1);
    if (!hasOwner) {
      return new Response(
        JSON.stringify({ error: 'Invalid backup: must contain at least one active owner account.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const statements: D1PreparedStatement[] = [];

    // 1. DELETE EXISTING DATA IN REVERSE FOREIGN KEY ORDER
    statements.push(env.DB.prepare('DELETE FROM points_ledger'));
    statements.push(env.DB.prepare('DELETE FROM order_items'));
    statements.push(env.DB.prepare('DELETE FROM orders'));
    statements.push(env.DB.prepare('DELETE FROM nfc_cards'));
    statements.push(env.DB.prepare('DELETE FROM customers'));
    statements.push(env.DB.prepare('DELETE FROM menu_items'));
    statements.push(env.DB.prepare('DELETE FROM users'));
    statements.push(env.DB.prepare('DELETE FROM cafe_settings'));

    // 2. RE-INSERT IN DEPENDENCY ORDER

    // 2.1 cafe_settings
    if (data.cafe_settings && data.cafe_settings.length > 0) {
      for (const row of data.cafe_settings) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO cafe_settings (id, cafe_name, earn_points_per_unit, earn_spend_unit, point_redeem_value, min_bill_for_redeem, max_redeem_percent, staff_max_bonus_points, sms_enabled, sms_api_key, sms_sender_id, sms_template, last_backup_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            row.id || 1,
            row.cafe_name || 'The Grove Cafe',
            row.earn_points_per_unit ?? 10,
            row.earn_spend_unit ?? 100,
            row.point_redeem_value ?? 1.0,
            row.min_bill_for_redeem ?? 0,
            row.max_redeem_percent ?? 100,
            row.staff_max_bonus_points ?? 50,
            row.sms_enabled ?? 0,
            row.sms_api_key ?? null,
            row.sms_sender_id ?? null,
            row.sms_template ?? null,
            row.last_backup_at ?? null
          )
        );
      }
    } else {
      statements.push(
        env.DB.prepare(
          `INSERT INTO cafe_settings (id, cafe_name, earn_points_per_unit, earn_spend_unit, point_redeem_value, min_bill_for_redeem, max_redeem_percent, staff_max_bonus_points, sms_enabled)
           VALUES (1, 'The Grove Cafe', 10, 100, 1.0, 0, 100, 50, 0)`
        )
      );
    }

    // 2.2 users
    for (const u of users) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          u.id || crypto.randomUUID(),
          u.name,
          u.username,
          u.password_hash,
          u.role,
          u.is_active ?? 1,
          u.created_at || new Date().toISOString()
        )
      );
    }

    // 2.3 menu_items
    if (data.menu_items) {
      for (const m of data.menu_items) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO menu_items (id, name, category, price, is_available, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            m.id || crypto.randomUUID(),
            m.name,
            m.category,
            m.price,
            m.is_available ?? 1,
            m.created_at || new Date().toISOString()
          )
        );
      }
    }

    // 2.4 customers
    if (data.customers) {
      for (const c of data.customers) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO customers (id, name, phone, dob, notes, sms_consent, points_balance, total_visits, total_spent, is_archived, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            c.id || crypto.randomUUID(),
            c.name,
            c.phone,
            c.dob ?? null,
            c.notes ?? null,
            c.sms_consent ?? 1,
            c.points_balance ?? 0,
            c.total_visits ?? 0,
            c.total_spent ?? 0,
            c.is_archived ?? 0,
            c.created_at || new Date().toISOString()
          )
        );
      }
    }

    // 2.5 nfc_cards
    if (data.nfc_cards) {
      for (const n of data.nfc_cards) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO nfc_cards (id, card_uid, customer_id, status, blocked_reason, assigned_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            n.id || crypto.randomUUID(),
            n.card_uid,
            n.customer_id ?? null,
            n.status || 'unassigned',
            n.blocked_reason ?? null,
            n.assigned_at ?? null
          )
        );
      }
    }

    // 2.6 orders
    if (data.orders) {
      for (const o of data.orders) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO orders (id, order_number, customer_id, staff_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned, idempotency_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            o.id || crypto.randomUUID(),
            o.order_number,
            o.customer_id,
            o.staff_id,
            o.subtotal,
            o.points_redeemed ?? 0,
            o.discount_amount ?? 0,
            o.final_amount,
            o.points_earned ?? 0,
            o.idempotency_key || crypto.randomUUID(),
            o.created_at || new Date().toISOString()
          )
        );
      }
    }

    // 2.7 order_items
    if (data.order_items) {
      for (const oi of data.order_items) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            oi.id || crypto.randomUUID(),
            oi.order_id,
            oi.menu_item_id ?? null,
            oi.item_name,
            oi.quantity,
            oi.unit_price,
            oi.total_price
          )
        );
      }
    }

    // 2.8 points_ledger
    if (data.points_ledger) {
      for (const pl of data.points_ledger) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO points_ledger (id, customer_id, order_id, change_type, points_change, balance_after, reason, performed_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            pl.id || crypto.randomUUID(),
            pl.customer_id,
            pl.order_id ?? null,
            pl.change_type,
            pl.points_change,
            pl.balance_after,
            pl.reason ?? null,
            pl.performed_by,
            pl.created_at || new Date().toISOString()
          )
        );
      }
    }

    // Execute in chunks
    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      await env.DB.batch(chunk);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database restored successfully from backup file.',
        statements_executed: statements.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Database restore failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
