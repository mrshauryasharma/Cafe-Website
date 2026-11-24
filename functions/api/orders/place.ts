import { Env, KotItem } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

interface PlaceOrderItem {
  menu_item_id?: string;
  name: string;
  unit_price: number;
  quantity: number;
  notes?: string;
}

interface PlaceOrderPayload {
  table_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: string;
  items: PlaceOrderItem[];
  order_notes?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_take_orders');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as PlaceOrderPayload;
    const { table_id, items, order_notes } = body;
    let { customer_name, customer_phone, customer_id } = body;

    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Order must contain at least 1 item' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate item values
    const validatedItems: KotItem[] = [];
    for (const item of items) {
      const q = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const p = Math.max(0, Number(item.unit_price) || 0);
      const name = (item.name || 'Unnamed Item').trim();
      const notes = item.notes ? item.notes.trim() : undefined;
      validatedItems.push({
        menu_item_id: item.menu_item_id || undefined,
        name,
        quantity: q,
        unit_price: p,
        notes,
      });
    }

    // Look up table
    const table = await env.DB.prepare(
      'SELECT id, table_number, table_name, section, status, active_order_id FROM cafe_tables WHERE id = ? AND is_active = 1'
    ).bind(table_id).first<{
      id: string;
      table_number: string;
      table_name: string;
      section: string;
      status: string;
      active_order_id: string | null;
    }>();

    if (!table) {
      return new Response(JSON.stringify({ error: 'Table not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Auto-match customer by phone if phone is provided
    if (customer_phone && customer_phone.trim()) {
      customer_phone = customer_phone.trim();
      const existingCustomer = await env.DB.prepare(
        'SELECT id, name, phone, points_balance FROM customers WHERE phone = ?'
      ).bind(customer_phone).first<{ id: string; name: string; phone: string; points_balance: number }>();

      if (existingCustomer) {
        customer_id = existingCustomer.id;
        if (!customer_name || !customer_name.trim()) {
          customer_name = existingCustomer.name;
        }
      }
    }

    const now = new Date().toISOString();
    const kotId = crypto.randomUUID();
    const kotNumber = `KOT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const waiterId = auth.user.id;
    const waiterName = auth.user.name;

    let draftId: string;
    let draftNumber: string;
    let ticketType: 'new_order' | 'add_on';

    // Check if table is occupied and has an existing draft
    let existingDraft: any = null;
    if (table.status === 'occupied' && table.active_order_id) {
      existingDraft = await env.DB.prepare('SELECT * FROM draft_orders WHERE id = ?')
        .bind(table.active_order_id)
        .first();
    }

    const statements: D1PreparedStatement[] = [];

    if (existingDraft) {
      ticketType = 'add_on';
      draftId = existingDraft.id;
      draftNumber = existingDraft.draft_number;

      let currentItems: any[] = [];
      try {
        currentItems = JSON.parse(existingDraft.items_json || '[]');
      } catch {
        currentItems = [];
      }

      // Append new items
      const combinedItems = [...currentItems, ...validatedItems];

      statements.push(
        env.DB.prepare(
          `UPDATE draft_orders
           SET items_json = ?,
               customer_id = COALESCE(?, customer_id),
               customer_name = COALESCE(?, customer_name),
               customer_phone = COALESCE(?, customer_phone),
               waiter_id = ?,
               waiter_name = ?,
               notes = COALESCE(?, notes),
               updated_at = ?
           WHERE id = ?`
        ).bind(
          JSON.stringify(combinedItems),
          customer_id ?? null,
          customer_name ?? null,
          customer_phone ?? null,
          waiterId,
          waiterName,
          order_notes ?? null,
          now,
          draftId
        )
      );
    } else {
      ticketType = 'new_order';
      draftId = crypto.randomUUID();
      draftNumber = `DRAFT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

      statements.push(
        env.DB.prepare(
          `INSERT INTO draft_orders (id, draft_number, customer_id, customer_name, customer_phone, dining_type, table_id, table_number, waiter_id, waiter_name, items_json, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'Dine-In', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          draftId,
          draftNumber,
          customer_id ?? null,
          customer_name ?? null,
          customer_phone ?? null,
          table.id,
          table.table_number,
          waiterId,
          waiterName,
          JSON.stringify(validatedItems),
          order_notes ?? null,
          waiterName,
          now,
          now
        )
      );

      statements.push(
        env.DB.prepare(
          `UPDATE cafe_tables
           SET status = 'occupied', active_order_id = ?
           WHERE id = ?`
        ).bind(draftId, table.id)
      );
    }

    // Insert into KOT Queue with ONLY the newly added items
    statements.push(
      env.DB.prepare(
        `INSERT INTO kot_queue (id, kot_number, draft_id, table_id, table_number, customer_name, customer_phone, waiter_id, waiter_name, ticket_type, items_json, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?)`
      ).bind(
        kotId,
        kotNumber,
        draftId,
        table.id,
        table.table_number,
        customer_name ?? null,
        customer_phone ?? null,
        waiterId,
        waiterName,
        ticketType,
        JSON.stringify(validatedItems),
        now
      )
    );

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        draft_id: draftId,
        draft_number: draftNumber,
        kot_id: kotId,
        kot_number: kotNumber,
        ticket_type: ticketType,
        items: validatedItems,
        table_id: table.id,
        table_number: table.table_number,
        table_name: table.table_name,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        waiter_name: waiterName,
        created_at: now,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error placing order:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to place order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
