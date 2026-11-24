import { Env } from '../../../types';
import { requirePermission } from '../../../utils/auth';
import { ensureSchema } from '../../../utils/ensureSchema';
import { MenuItem } from '../menu';

export interface InventoryItem extends MenuItem {
  total_sold: number;
}

export interface InventoryLog {
  id: string;
  menu_item_id: string;
  item_name: string;
  change_type: 'restock' | 'wastage' | 'adjustment' | 'sale';
  quantity_change: number;
  stock_after: number;
  notes: string | null;
  performed_by: string;
  created_at: string;
}

export interface InventoryKpis {
  total_items: number;
  healthy_count: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_units_in_stock: number;
}

export interface InventoryResponse {
  items: InventoryItem[];
  kpis: InventoryKpis;
  logs: InventoryLog[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_manage_menu_stock');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);

    // 1. Fetch menu items with total sold units
    const itemsResult = await env.DB.prepare(`
      SELECT m.id, m.name, m.category, m.price, m.is_available, m.image_url,
             m.stock_qty, m.max_stock, m.low_stock_alert, m.created_at,
             COALESCE(SUM(oi.quantity), 0) AS total_sold
      FROM menu_items m
      LEFT JOIN order_items oi ON m.id = oi.menu_item_id
      GROUP BY m.id
      ORDER BY total_sold DESC, m.name ASC
    `).all<InventoryItem>();

    const items: InventoryItem[] = (itemsResult.results || []).map((i) => ({
      ...i,
      stock_qty: i.stock_qty ?? 100,
      max_stock: i.max_stock ?? 100,
      low_stock_alert: i.low_stock_alert ?? 10,
      total_sold: Number(i.total_sold) || 0,
    }));

    // 2. Compute summary KPIs
    let healthyCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalUnitsInStock = 0;

    for (const it of items) {
      const qty = it.stock_qty ?? 0;
      const threshold = it.low_stock_alert ?? 10;
      totalUnitsInStock += qty;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= threshold) {
        lowStockCount++;
      } else {
        healthyCount++;
      }
    }

    const kpis: InventoryKpis = {
      total_items: items.length,
      healthy_count: healthyCount,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      total_units_in_stock: totalUnitsInStock,
    };

    // 3. Fetch latest 50 inventory logs
    const logsResult = await env.DB.prepare(`
      SELECT id, menu_item_id, item_name, change_type, quantity_change, stock_after, notes, performed_by, created_at
      FROM inventory_logs
      ORDER BY created_at DESC
      LIMIT 50
    `).all<InventoryLog>();

    const responsePayload: InventoryResponse = {
      items,
      kpis,
      logs: logsResult.results || [],
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch inventory' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
