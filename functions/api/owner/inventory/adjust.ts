import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';
import { ensureSchema } from '../../../utils/ensureSchema';
import { MenuItem } from '../menu';

interface AdjustPayload {
  menu_item_id: string;
  change_type: 'restock' | 'wastage' | 'adjustment';
  quantity: number;
  max_stock?: number;
  low_stock_alert?: number;
  notes?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as AdjustPayload;
    const { menu_item_id, change_type, quantity, max_stock, low_stock_alert, notes } = body;

    if (!menu_item_id) {
      return new Response(JSON.stringify({ error: 'Missing menu_item_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!['restock', 'wastage', 'adjustment'].includes(change_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid change_type. Must be 'restock', 'wastage', or 'adjustment'." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      return new Response(JSON.stringify({ error: 'Quantity must be a non-negative number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ((change_type === 'restock' || change_type === 'wastage') && qty === 0) {
      return new Response(JSON.stringify({ error: `Quantity must be greater than 0 for ${change_type}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch current menu item
    const currentItem = await env.DB.prepare(
      'SELECT id, name, stock_qty, max_stock, low_stock_alert FROM menu_items WHERE id = ?'
    ).bind(menu_item_id).first<MenuItem>();

    if (!currentItem) {
      return new Response(JSON.stringify({ error: 'Menu item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const currentStock = currentItem.stock_qty ?? 100;
    const currentMax = currentItem.max_stock ?? 100;
    const currentLowAlert = currentItem.low_stock_alert ?? 10;

    let newStock = currentStock;
    let quantityChange = 0;
    let effectiveMax = max_stock !== undefined && !isNaN(Number(max_stock)) ? Number(max_stock) : currentMax;
    let effectiveLowAlert =
      low_stock_alert !== undefined && !isNaN(Number(low_stock_alert))
        ? Number(low_stock_alert)
        : currentLowAlert;

    if (change_type === 'restock') {
      newStock = currentStock + qty;
      quantityChange = qty;
      if (max_stock === undefined && newStock > effectiveMax) {
        effectiveMax = newStock;
      }
    } else if (change_type === 'wastage') {
      newStock = Math.max(0, currentStock - qty);
      quantityChange = -(currentStock - newStock);
    } else if (change_type === 'adjustment') {
      newStock = Math.max(0, Math.floor(qty));
      quantityChange = newStock - currentStock;
      if (max_stock === undefined && newStock > effectiveMax) {
        effectiveMax = newStock;
      }
    }

    const logId = crypto.randomUUID();
    const now = new Date().toISOString();
    const performer = `${auth.user.name} (${auth.user.role})`;

    // 2. Batch update menu_items and insert into inventory_logs
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE menu_items
        SET stock_qty = ?, max_stock = ?, low_stock_alert = ?
        WHERE id = ?
      `).bind(newStock, effectiveMax, effectiveLowAlert, menu_item_id),
      env.DB.prepare(`
        INSERT INTO inventory_logs (id, menu_item_id, item_name, change_type, quantity_change, stock_after, notes, performed_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logId,
        menu_item_id,
        currentItem.name,
        change_type,
        quantityChange,
        newStock,
        notes?.trim() || null,
        performer,
        now
      ),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        menu_item_id,
        item_name: currentItem.name,
        stock_qty: newStock,
        max_stock: effectiveMax,
        low_stock_alert: effectiveLowAlert,
        quantity_change: quantityChange,
        log: {
          id: logId,
          menu_item_id,
          item_name: currentItem.name,
          change_type,
          quantity_change: quantityChange,
          stock_after: newStock,
          notes: notes?.trim() || null,
          performed_by: performer,
          created_at: now,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Inventory adjustment failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
