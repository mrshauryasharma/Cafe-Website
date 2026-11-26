import { Env } from '../../../types';
import { authenticate } from '../../../utils/auth';
import { ensureSchema } from '../../../utils/ensureSchema';
import { CheckoutLineItem } from '../checkout';

export interface DraftOrderRow {
  id: string;
  draft_number: string;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  dining_type: string;
  table_id?: string | null;
  table_number: string | null;
  waiter_id?: string | null;
  waiter_name?: string | null;
  items_json: string;
  items?: CheckoutLineItem[];
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const drafts = await env.DB.prepare(
      `SELECT d.id, d.draft_number, d.customer_id, d.dining_type, d.table_id, d.table_number, d.waiter_id, d.waiter_name, d.items_json, d.notes, d.created_by, d.created_at, d.updated_at,
              COALESCE(c.name, d.customer_name) AS customer_name, COALESCE(c.phone, d.customer_phone) AS customer_phone
       FROM draft_orders d
       LEFT JOIN customers c ON d.customer_id = c.id
       ORDER BY d.created_at DESC`
    ).all<DraftOrderRow>();

    const parsed = (drafts.results || []).map((d) => {
      let items: CheckoutLineItem[] = [];
      try {
        const rawItems = JSON.parse(d.items_json);
        if (Array.isArray(rawItems)) {
          items = rawItems.map((it: any) => {
            const resolvedName = (it.item_name || it.name || 'Menu Item').trim();
            return {
              menu_item_id: it.menu_item_id || undefined,
              item_name: resolvedName,
              name: resolvedName,
              quantity: Math.max(1, Number(it.quantity) || 1),
              unit_price: Math.max(0, Number(it.unit_price ?? it.price) || 0),
              notes: it.notes || undefined,
            };
          });
        }
      } catch {
        items = [];
      }
      return {
        ...d,
        items,
      };
    });

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch draft orders' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as {
      id?: string;
      customer_id?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      dining_type?: string;
      table_id?: string | null;
      table_number?: string | null;
      waiter_id?: string | null;
      waiter_name?: string | null;
      items: CheckoutLineItem[];
      notes?: string | null;
    };

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one item is required to save a draft.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const diningType = body.dining_type?.trim() || 'Dine-In';
    const tableNumber = body.table_number?.trim() || null;
    const customerName = body.customer_name?.trim() || null;
    const customerPhone = body.customer_phone?.trim() || null;
    const notes = body.notes?.trim() || null;
    const normalizedItems = body.items.map((it: any) => {
      const resolvedName = (it.item_name || it.name || 'Menu Item').trim();
      return {
        menu_item_id: it.menu_item_id || undefined,
        item_name: resolvedName,
        name: resolvedName,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price: Math.max(0, Number(it.unit_price ?? it.price) || 0),
        notes: it.notes || undefined,
      };
    });
    const itemsJson = JSON.stringify(normalizedItems);
    const staffAttribution = `${auth.user.name} (${auth.user.role})`;
    const now = new Date().toISOString();

    if (body.id) {
      // Check if draft exists
      const existing = await env.DB.prepare('SELECT id, draft_number FROM draft_orders WHERE id = ?')
        .bind(body.id)
        .first<{ id: string; draft_number: string }>();

      if (existing) {
        await env.DB.prepare(
          `UPDATE draft_orders
           SET customer_id = COALESCE(?, customer_id),
               customer_name = COALESCE(?, customer_name),
               customer_phone = COALESCE(?, customer_phone),
               dining_type = ?,
               table_id = COALESCE(?, table_id),
               table_number = ?,
               waiter_id = COALESCE(?, waiter_id),
               waiter_name = COALESCE(?, waiter_name),
               items_json = ?,
               notes = ?,
               created_by = ?,
               updated_at = ?
           WHERE id = ?`
        ).bind(
          body.customer_id || null,
          customerName,
          customerPhone,
          diningType,
          body.table_id || null,
          tableNumber,
          body.waiter_id || null,
          body.waiter_name || null,
          itemsJson,
          notes,
          staffAttribution,
          now,
          body.id
        ).run();

        if (tableNumber && tableNumber !== 'Takeaway' && tableNumber !== 'Delivery') {
          await env.DB.prepare(
            "UPDATE cafe_tables SET status = 'occupied', active_order_id = ? WHERE id = ? OR table_number = ? OR table_name = ?"
          ).bind(existing.id, body.table_id || '', tableNumber, tableNumber).run();
        }

        return new Response(
          JSON.stringify({
            success: true,
            draft: {
              id: existing.id,
              draft_number: existing.draft_number,
              customer_id: body.customer_id || null,
              customer_name: customerName,
              customer_phone: customerPhone,
              dining_type: diningType,
              table_id: body.table_id || null,
              table_number: tableNumber,
              items: normalizedItems,
              notes,
              created_by: staffAttribution,
              created_at: now,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const draftId = crypto.randomUUID();
    const draftNumber = `DFT-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 900 + 100)}`;

    await env.DB.prepare(
      `INSERT INTO draft_orders (id, draft_number, customer_id, customer_name, customer_phone, dining_type, table_id, table_number, waiter_id, waiter_name, items_json, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      draftNumber,
      body.customer_id || null,
      customerName,
      customerPhone,
      diningType,
      body.table_id || null,
      tableNumber,
      body.waiter_id || auth.user.id,
      body.waiter_name || auth.user.name,
      itemsJson,
      notes,
      staffAttribution,
      now,
      now
    ).run();

    if (tableNumber && tableNumber !== 'Takeaway' && tableNumber !== 'Delivery') {
      await env.DB.prepare(
        "UPDATE cafe_tables SET status = 'occupied', active_order_id = ? WHERE id = ? OR table_number = ? OR table_name = ?"
      ).bind(draftId, body.table_id || '', tableNumber, tableNumber).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        draft: {
          id: draftId,
          draft_number: draftNumber,
          customer_id: body.customer_id || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          dining_type: diningType,
          table_id: body.table_id || null,
          table_number: tableNumber,
          items: normalizedItems,
          notes,
          created_by: staffAttribution,
          created_at: now,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to save draft order' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
