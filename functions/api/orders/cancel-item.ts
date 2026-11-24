import { Env, KotItem } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

interface CancelItemPayload {
  draft_id: string;
  item_index: number;
  cancel_qty?: number;
  reason: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_apply_discounts');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as CancelItemPayload;
    const { draft_id, item_index, cancel_qty, reason } = body;

    if (!draft_id) {
      return new Response(JSON.stringify({ error: 'draft_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (item_index === undefined || item_index === null || item_index < 0) {
      return new Response(JSON.stringify({ error: 'Valid item_index is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!reason || !reason.trim()) {
      return new Response(JSON.stringify({ error: 'Cancellation reason is mandatory for kitchen audit' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch draft
    const draft = await env.DB.prepare('SELECT * FROM draft_orders WHERE id = ?').bind(draft_id).first<{
      id: string;
      draft_number: string;
      table_id?: string | null;
      table_number?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      items_json: string;
    }>();

    if (!draft) {
      return new Response(JSON.stringify({ error: 'Draft order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let items: KotItem[] = [];
    try {
      items = JSON.parse(draft.items_json || '[]');
    } catch {
      items = [];
    }

    if (item_index >= items.length) {
      return new Response(JSON.stringify({ error: 'Item index out of bounds' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const targetItem = items[item_index];
    const qtyToCancel = Math.min(targetItem.quantity, Math.max(1, Number(cancel_qty) || targetItem.quantity));

    // Cancelled item representation for KOT
    const cancelledSlipItem: KotItem = {
      menu_item_id: targetItem.menu_item_id,
      name: targetItem.name,
      quantity: qtyToCancel,
      unit_price: targetItem.unit_price,
      notes: `CANCELLED: ${reason.trim()}${targetItem.notes ? ` (Was: ${targetItem.notes})` : ''}`,
    };

    if (qtyToCancel >= targetItem.quantity) {
      // Remove item completely
      items.splice(item_index, 1);
    } else {
      // Reduce item quantity
      targetItem.quantity -= qtyToCancel;
    }

    const now = new Date().toISOString();
    const kotId = crypto.randomUUID();
    const kotNumber = `KOT-CAN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const waiterId = auth.user.id;
    const waiterName = `${auth.user.name} (${auth.user.role})`;

    const statements: D1PreparedStatement[] = [];

    // 1. Insert Cancellation KOT
    statements.push(
      env.DB.prepare(
        `INSERT INTO kot_queue (id, kot_number, draft_id, table_id, table_number, customer_name, customer_phone, waiter_id, waiter_name, ticket_type, items_json, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cancel_item', ?, ?, 'pending', ?)`
      ).bind(
        kotId,
        kotNumber,
        draft.id,
        draft.table_id ?? null,
        draft.table_number || 'Takeaway',
        draft.customer_name ?? null,
        draft.customer_phone ?? null,
        waiterId,
        waiterName,
        JSON.stringify([cancelledSlipItem]),
        reason.trim(),
        now
      )
    );

    if (items.length === 0) {
      // No items remain -> delete draft and free table
      statements.push(env.DB.prepare('DELETE FROM draft_orders WHERE id = ?').bind(draft.id));
      if (draft.table_id) {
        statements.push(
          env.DB.prepare(
            `UPDATE cafe_tables
             SET status = 'vacant', active_order_id = NULL
             WHERE id = ?`
          ).bind(draft.table_id)
        );
      } else if (draft.table_number) {
        statements.push(
          env.DB.prepare(
            `UPDATE cafe_tables
             SET status = 'vacant', active_order_id = NULL
             WHERE table_number = ?`
          ).bind(draft.table_number)
        );
      }
    } else {
      // Update draft with remaining items
      statements.push(
        env.DB.prepare(
          `UPDATE draft_orders
           SET items_json = ?, updated_at = ?
           WHERE id = ?`
        ).bind(JSON.stringify(items), now, draft.id)
      );
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cancelled ${qtyToCancel}x ${targetItem.name}`,
        cancelled_item: cancelledSlipItem,
        remaining_items: items,
        remaining_count: items.length,
        kot_number: kotNumber,
        table_freed: items.length === 0,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error cancelling item:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to cancel item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
