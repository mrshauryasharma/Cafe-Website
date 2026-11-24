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
  table_number: string | null;
  items_json: string;
  items?: CheckoutLineItem[];
  notes: string | null;
  created_by: string;
  created_at: string;
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
        items = JSON.parse(d.items_json);
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
      headers: { 'Content-Type': 'application/json' },
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
      dining_type?: string;
      table_number?: string | null;
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
    const notes = body.notes?.trim() || null;
    const itemsJson = JSON.stringify(body.items);
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
           SET customer_id = ?, dining_type = ?, table_number = ?, items_json = ?, notes = ?, created_by = ?
           WHERE id = ?`
        ).bind(
          body.customer_id || null,
          diningType,
          tableNumber,
          itemsJson,
          notes,
          staffAttribution,
          body.id
        ).run();

        if (tableNumber) {
          await env.DB.prepare(
            "UPDATE cafe_tables SET status = 'occupied', active_order_id = ? WHERE table_number = ? OR table_name = ?"
          ).bind(existing.id, tableNumber, tableNumber).run();
        }

        return new Response(
          JSON.stringify({
            success: true,
            draft: {
              id: existing.id,
              draft_number: existing.draft_number,
              customer_id: body.customer_id || null,
              dining_type: diningType,
              table_number: tableNumber,
              items: body.items,
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
      `INSERT INTO draft_orders (id, draft_number, customer_id, dining_type, table_number, items_json, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      draftNumber,
      body.customer_id || null,
      diningType,
      tableNumber,
      itemsJson,
      notes,
      staffAttribution,
      now
    ).run();

    if (tableNumber) {
      await env.DB.prepare(
        "UPDATE cafe_tables SET status = 'occupied', active_order_id = ? WHERE table_number = ? OR table_name = ?"
      ).bind(draftId, tableNumber, tableNumber).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        draft: {
          id: draftId,
          draft_number: draftNumber,
          customer_id: body.customer_id || null,
          dining_type: diningType,
          table_number: tableNumber,
          items: body.items,
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
