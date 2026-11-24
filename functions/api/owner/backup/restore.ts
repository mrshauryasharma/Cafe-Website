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
    draft_orders?: any[];
    inventory_logs?: any[];
    cafe_tables?: any[];
    kot_queue?: any[];
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
    statements.push(env.DB.prepare('DELETE FROM kot_queue'));
    statements.push(env.DB.prepare('DELETE FROM inventory_logs'));
    statements.push(env.DB.prepare('DELETE FROM points_ledger'));
    statements.push(env.DB.prepare('DELETE FROM draft_orders'));
    statements.push(env.DB.prepare('DELETE FROM order_items'));
    statements.push(env.DB.prepare('DELETE FROM orders'));
    statements.push(env.DB.prepare('DELETE FROM nfc_cards'));
    statements.push(env.DB.prepare('DELETE FROM customers'));
    statements.push(env.DB.prepare('DELETE FROM menu_items'));
    statements.push(env.DB.prepare('DELETE FROM cafe_tables'));
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
            row.cafe_name || 'Kimmo’s Kitchen',
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
           VALUES (1, 'Kimmo’s Kitchen', 10, 100, 1.0, 0, 100, 50, 0)`
        )
      );
    }

    // 2.2 users
    for (const u of users) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO users (id, name, username, password_hash, role, permissions_json, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          u.id || crypto.randomUUID(),
          u.name,
          u.username,
          u.password_hash,
          u.role,
          u.permissions_json || '{}',
          u.is_active ?? 1,
          u.created_at || new Date().toISOString()
        )
      );
    }

    // 2.2.1 cafe_tables
    if (data.cafe_tables && data.cafe_tables.length > 0) {
      for (const t of data.cafe_tables) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO cafe_tables (id, table_number, table_name, section, capacity, status, active_order_id, is_active, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            t.id || crypto.randomUUID(),
            t.table_number,
            t.table_name || t.table_number,
            t.section || 'Main Floor',
            t.capacity ?? 4,
            t.status || 'vacant',
            t.active_order_id ?? null,
            t.is_active ?? 1,
            t.sort_order ?? 0,
            t.created_at || new Date().toISOString()
          )
        );
      }
    }

    // 2.3 menu_items
    if (data.menu_items) {
      for (const m of data.menu_items) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO menu_items (id, name, category, price, is_available, image_url, stock_qty, max_stock, low_stock_alert, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            m.id || crypto.randomUUID(),
            m.name,
            m.category,
            m.price,
            m.is_available ?? 1,
            m.image_url ?? null,
            m.stock_qty ?? 100,
            m.max_stock ?? 100,
            m.low_stock_alert ?? 10,
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
            `INSERT INTO orders (id, order_number, customer_id, staff_id, subtotal, points_redeemed, discount_amount, final_amount, points_earned, idempotency_key, dining_type, table_number, extra_discount, payment_method, waiter_id, waiter_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            o.dining_type || 'Dine-In',
            o.table_number ?? null,
            o.extra_discount ?? 0,
            o.payment_method || 'Cash/UPI',
            o.waiter_id ?? null,
            o.waiter_name ?? null,
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
            `INSERT INTO order_items (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            oi.id || crypto.randomUUID(),
            oi.order_id,
            oi.menu_item_id ?? null,
            oi.item_name,
            oi.quantity,
            oi.unit_price,
            oi.total_price,
            oi.notes ?? null
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

    // 2.9 draft_orders
    if (data.draft_orders) {
      for (const d of data.draft_orders) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO draft_orders (id, draft_number, customer_id, customer_name, customer_phone, dining_type, table_id, table_number, waiter_id, waiter_name, items_json, notes, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            d.id || crypto.randomUUID(),
            d.draft_number,
            d.customer_id ?? null,
            d.customer_name ?? null,
            d.customer_phone ?? null,
            d.dining_type || 'Dine-In',
            d.table_id ?? null,
            d.table_number ?? null,
            d.waiter_id ?? null,
            d.waiter_name ?? null,
            d.items_json || '[]',
            d.notes ?? null,
            d.created_by,
            d.created_at || new Date().toISOString(),
            d.updated_at ?? null
          )
        );
      }
    }

    // 2.10 inventory_logs
    if (data.inventory_logs) {
      for (const log of data.inventory_logs) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO inventory_logs (id, menu_item_id, item_name, change_type, quantity_change, stock_after, notes, performed_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            log.id || crypto.randomUUID(),
            log.menu_item_id,
            log.item_name,
            log.change_type,
            log.quantity_change,
            log.stock_after,
            log.notes ?? null,
            log.performed_by,
            log.created_at || new Date().toISOString()
          )
        );
      }
    }

    // 2.11 kot_queue
    if (data.kot_queue) {
      for (const k of data.kot_queue) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO kot_queue (id, kot_number, draft_id, table_id, table_number, customer_name, customer_phone, waiter_id, waiter_name, ticket_type, items_json, reason, status, created_at, printed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            k.id || crypto.randomUUID(),
            k.kot_number,
            k.draft_id ?? null,
            k.table_id ?? null,
            k.table_number,
            k.customer_name ?? null,
            k.customer_phone ?? null,
            k.waiter_id ?? null,
            k.waiter_name || 'Staff',
            k.ticket_type || 'new_order',
            k.items_json || '[]',
            k.reason ?? null,
            k.status || 'pending',
            k.created_at || new Date().toISOString(),
            k.printed_at ?? null
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
