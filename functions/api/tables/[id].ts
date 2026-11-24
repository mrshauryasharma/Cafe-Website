import { Env } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';
import { CafeTableRow } from './index';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, 'can_manage_tables');
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing table id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureSchema(env.DB);
    const existing = await env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(id)
      .first<CafeTableRow>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      table_name?: string;
      section?: string;
      capacity?: number;
      status?: 'vacant' | 'occupied';
      sort_order?: number;
    };

    const tableName = body.table_name?.trim() || existing.table_name;
    const section = body.section?.trim() || existing.section;
    const capacity = body.capacity !== undefined ? Math.max(1, Number(body.capacity)) : existing.capacity;
    const status = body.status && ['vacant', 'occupied'].includes(body.status) ? body.status : existing.status;
    const sortOrder = body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order;

    await env.DB.prepare(`
      UPDATE cafe_tables
      SET table_name = ?, section = ?, capacity = ?, status = ?, sort_order = ?
      WHERE id = ?
    `).bind(tableName, section, capacity, status, sortOrder, id).run();

    const updated = await env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(id)
      .first<CafeTableRow>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update table' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, 'can_manage_tables');
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing table id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureSchema(env.DB);
    const existing = await env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ?')
      .bind(id)
      .first<CafeTableRow>();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if table is occupied or has active draft order
    const activeDraft = await env.DB.prepare(
      'SELECT id, draft_number FROM draft_orders WHERE table_number = ? OR table_number = ? LIMIT 1'
    ).bind(existing.table_number, existing.table_name).first();

    if (existing.status === 'occupied' || activeDraft) {
      return new Response(
        JSON.stringify({
          error: `Cannot delete table "${existing.table_name}" while it is occupied with an active order. Please clear or settle the order first.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mark as inactive (soft delete) to preserve integrity of any completed past orders
    await env.DB.prepare('UPDATE cafe_tables SET is_active = 0 WHERE id = ?').bind(id).run();

    return new Response(
      JSON.stringify({ success: true, message: `Table "${existing.table_name}" deleted.` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete table' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
