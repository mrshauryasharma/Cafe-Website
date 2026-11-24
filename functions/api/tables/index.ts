import { Env } from '../../types';
import { authenticate, requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

export interface CafeTableRow {
  id: string;
  table_number: string;
  table_name: string;
  section: string;
  capacity: number;
  status: 'vacant' | 'occupied';
  active_order_id: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  // Extended fields for floor board
  active_draft_number?: string | null;
  active_draft_items_count?: number;
  active_draft_total?: number;
  active_draft_created_at?: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  // Check if user has permission to view tables or take orders (or owner)
  if (
    auth.user.role !== 'owner' &&
    !auth.user.permissions.can_view_tables &&
    !auth.user.permissions.can_take_orders
  ) {
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot view tables' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureSchema(env.DB);

    const tablesResult = await env.DB.prepare(`
      SELECT 
        t.id, t.table_number, t.table_name, t.section, t.capacity, 
        t.status, t.active_order_id, t.is_active, t.sort_order, t.created_at,
        d.draft_number AS active_draft_number,
        d.items_json AS active_draft_items_json,
        d.created_at AS active_draft_created_at
      FROM cafe_tables t
      LEFT JOIN draft_orders d ON (t.active_order_id = d.id OR t.table_number = d.table_number)
      WHERE t.is_active = 1
      ORDER BY t.sort_order ASC, t.table_number ASC
    `).all<{
      id: string;
      table_number: string;
      table_name: string;
      section: string;
      capacity: number;
      status: 'vacant' | 'occupied';
      active_order_id: string | null;
      is_active: number;
      sort_order: number;
      created_at: string;
      active_draft_number?: string | null;
      active_draft_items_json?: string | null;
      active_draft_created_at?: string | null;
    }>();

    // Map and deduplicate tables (in case multiple drafts somehow match)
    const tableMap = new Map<string, CafeTableRow>();

    for (const r of tablesResult.results || []) {
      if (!tableMap.has(r.id)) {
        let itemCount = 0;
        let totalAmount = 0;
        let isOccupied = r.status === 'occupied' || Boolean(r.active_draft_number);

        if (r.active_draft_items_json) {
          try {
            const items = JSON.parse(r.active_draft_items_json);
            if (Array.isArray(items)) {
              itemCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
              totalAmount = items.reduce((acc, it) => acc + (it.total_price || (it.price * (it.quantity || 1))), 0);
              isOccupied = true;
            }
          } catch {
            // ignore JSON parse error
          }
        }

        tableMap.set(r.id, {
          id: r.id,
          table_number: r.table_number,
          table_name: r.table_name,
          section: r.section,
          capacity: r.capacity,
          status: isOccupied ? 'occupied' : 'vacant',
          active_order_id: r.active_order_id,
          is_active: r.is_active,
          sort_order: r.sort_order,
          created_at: r.created_at,
          active_draft_number: r.active_draft_number || null,
          active_draft_items_count: itemCount,
          active_draft_total: totalAmount,
          active_draft_created_at: r.active_draft_created_at || null,
        });
      }
    }

    return new Response(JSON.stringify(Array.from(tableMap.values())), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch cafe tables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_manage_tables');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as {
      table_number?: string;
      table_name?: string;
      section?: string;
      capacity?: number;
      sort_order?: number;
    };

    const tableNumber = body.table_number?.trim().toUpperCase();
    const tableName = body.table_name?.trim() || tableNumber;
    const section = body.section?.trim() || 'Main Floor';
    const capacity = body.capacity !== undefined ? Math.max(1, Number(body.capacity)) : 4;
    const sortOrder = body.sort_order !== undefined ? Number(body.sort_order) : 50;

    if (!tableNumber) {
      return new Response(JSON.stringify({ error: 'Table Number is required (e.g., T-13)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if table_number already exists
    const existing = await env.DB.prepare(
      'SELECT id, is_active FROM cafe_tables WHERE table_number = ?'
    ).bind(tableNumber).first<{ id: string; is_active: number }>();

    if (existing) {
      if (existing.is_active === 0) {
        // Reactivate
        await env.DB.prepare(
          'UPDATE cafe_tables SET is_active = 1, table_name = ?, section = ?, capacity = ?, sort_order = ? WHERE id = ?'
        ).bind(tableName, section, capacity, sortOrder, existing.id).run();

        const reactivated = await env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ?')
          .bind(existing.id)
          .first<CafeTableRow>();

        return new Response(JSON.stringify(reactivated), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: `Table number "${tableNumber}" already exists.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO cafe_tables (id, table_number, table_name, section, capacity, status, is_active, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, 'vacant', 1, ?, ?)
    `).bind(id, tableNumber, tableName, section, capacity, sortOrder, now).run();

    const created = await env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(id)
      .first<CafeTableRow>();

    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create table' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
