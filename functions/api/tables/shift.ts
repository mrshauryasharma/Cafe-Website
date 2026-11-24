import { Env } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

interface TableShiftPayload {
  source_table_id: string;
  target_table_id: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_take_orders');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const body = (await request.json()) as TableShiftPayload;
    const { source_table_id, target_table_id } = body;

    if (!source_table_id || !target_table_id) {
      return new Response(JSON.stringify({ error: 'Both source_table_id and target_table_id are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (source_table_id === target_table_id) {
      return new Response(JSON.stringify({ error: 'Source and target table cannot be the same' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch both tables
    const [sourceTable, targetTable] = await Promise.all([
      env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ? AND is_active = 1').bind(source_table_id).first<{
        id: string;
        table_number: string;
        table_name: string;
        status: string;
        active_order_id: string | null;
      }>(),
      env.DB.prepare('SELECT * FROM cafe_tables WHERE id = ? AND is_active = 1').bind(target_table_id).first<{
        id: string;
        table_number: string;
        table_name: string;
        status: string;
        active_order_id: string | null;
      }>(),
    ]);

    if (!sourceTable) {
      return new Response(JSON.stringify({ error: 'Source table not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!targetTable) {
      return new Response(JSON.stringify({ error: 'Target table not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (sourceTable.status !== 'occupied' || !sourceTable.active_order_id) {
      return new Response(JSON.stringify({ error: 'Source table has no active order to shift' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];

    if (targetTable.status === 'vacant') {
      // 1. Target table is vacant -> Straight Move
      statements.push(
        env.DB.prepare(
          `UPDATE draft_orders
           SET table_id = ?, table_number = ?, updated_at = ?
           WHERE id = ?`
        ).bind(targetTable.id, targetTable.table_number, now, sourceTable.active_order_id)
      );

      statements.push(
        env.DB.prepare(
          `UPDATE cafe_tables
           SET status = 'vacant', active_order_id = NULL
           WHERE id = ?`
        ).bind(sourceTable.id)
      );

      statements.push(
        env.DB.prepare(
          `UPDATE cafe_tables
           SET status = 'occupied', active_order_id = ?
           WHERE id = ?`
        ).bind(sourceTable.active_order_id, targetTable.id)
      );

      await env.DB.batch(statements);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'shift',
          message: `Shifted order from ${sourceTable.table_name} to ${targetTable.table_name}`,
          source_table_number: sourceTable.table_number,
          target_table_number: targetTable.table_number,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      // 2. Target table is occupied -> Merge
      if (!targetTable.active_order_id) {
        return new Response(JSON.stringify({ error: 'Target table is marked occupied but missing active draft' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const [sourceDraft, targetDraft] = await Promise.all([
        env.DB.prepare('SELECT * FROM draft_orders WHERE id = ?').bind(sourceTable.active_order_id).first<{
          id: string;
          items_json: string;
          notes?: string | null;
        }>(),
        env.DB.prepare('SELECT * FROM draft_orders WHERE id = ?').bind(targetTable.active_order_id).first<{
          id: string;
          items_json: string;
          notes?: string | null;
        }>(),
      ]);

      if (!sourceDraft || !targetDraft) {
        return new Response(JSON.stringify({ error: 'Could not load drafts for merge' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let sourceItems: any[] = [];
      let targetItems: any[] = [];
      try {
        sourceItems = JSON.parse(sourceDraft.items_json || '[]');
      } catch {
        sourceItems = [];
      }
      try {
        targetItems = JSON.parse(targetDraft.items_json || '[]');
      } catch {
        targetItems = [];
      }

      const mergedItems = [...targetItems, ...sourceItems];
      const mergedNotes = [targetDraft.notes, sourceDraft.notes ? `[Merged from ${sourceTable.table_name}]: ${sourceDraft.notes}` : null]
        .filter(Boolean)
        .join('; ');

      statements.push(
        env.DB.prepare(
          `UPDATE draft_orders
           SET items_json = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ).bind(JSON.stringify(mergedItems), mergedNotes || null, now, targetDraft.id)
      );

      statements.push(
        env.DB.prepare('DELETE FROM draft_orders WHERE id = ?').bind(sourceDraft.id)
      );

      statements.push(
        env.DB.prepare(
          `UPDATE cafe_tables
           SET status = 'vacant', active_order_id = NULL
           WHERE id = ?`
        ).bind(sourceTable.id)
      );

      await env.DB.batch(statements);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'merge',
          message: `Merged order from ${sourceTable.table_name} into ${targetTable.table_name}`,
          source_table_number: sourceTable.table_number,
          target_table_number: targetTable.table_number,
          total_items_count: mergedItems.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error shifting table:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to shift table' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
