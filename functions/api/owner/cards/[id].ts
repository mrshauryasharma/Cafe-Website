import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';
import { CardRow } from './index';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing card id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const card = await env.DB.prepare('SELECT id, customer_id, status FROM nfc_cards WHERE id = ?')
      .bind(id)
      .first<{ id: string; customer_id: string | null; status: string }>();

    if (!card) {
      return new Response(JSON.stringify({ error: 'Card not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      action: 'block' | 'unblock';
      blocked_reason?: string;
    };

    if (body.action === 'block') {
      const reason = body.blocked_reason?.trim() || 'Blocked by Owner';
      await env.DB.prepare(
        "UPDATE nfc_cards SET status = 'blocked', blocked_reason = ? WHERE id = ?"
      ).bind(reason, id).run();
    } else if (body.action === 'unblock') {
      // If customer is attached, status restores to 'active', otherwise 'unassigned'
      const nextStatus = card.customer_id ? 'active' : 'unassigned';
      await env.DB.prepare(
        'UPDATE nfc_cards SET status = ?, blocked_reason = NULL WHERE id = ?'
      ).bind(nextStatus, id).run();
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Must be "block" or "unblock"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updated = await env.DB.prepare(`
      SELECT 
        n.id,
        n.card_uid,
        n.customer_id,
        n.status,
        n.blocked_reason,
        n.assigned_at,
        c.name as customer_name,
        c.phone as customer_phone
      FROM nfc_cards n
      LEFT JOIN customers c ON n.customer_id = c.id
      WHERE n.id = ?
    `).bind(id).first<CardRow>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update card status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
