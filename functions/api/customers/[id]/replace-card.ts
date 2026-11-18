import { Env } from '../../../types';
import { authenticate } from '../../../utils/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing customer id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const customer = await env.DB.prepare('SELECT id, name FROM customers WHERE id = ? AND is_archived = 0')
      .bind(id)
      .first<{ id: string; name: string }>();

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      new_card_uid?: string;
      reason?: string;
    };

    const rawUid = body.new_card_uid?.trim();
    const cleanUid = rawUid ? rawUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    const reason = body.reason?.trim() || 'Lost or damaged card replacement';

    if (!cleanUid) {
      return new Response(JSON.stringify({ error: 'New Card UID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if new_card_uid is valid
    const targetCard = await env.DB.prepare(
      'SELECT id, card_uid, status, customer_id FROM nfc_cards WHERE card_uid = ?'
    ).bind(cleanUid).first<{ id: string; card_uid: string; status: string; customer_id: string | null }>();

    if (targetCard) {
      if (targetCard.status === 'blocked') {
        return new Response(
          JSON.stringify({ error: `Card ${cleanUid} is marked as BLOCKED and cannot be assigned.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (targetCard.status === 'active' && targetCard.customer_id !== id) {
        return new Response(
          JSON.stringify({ error: `Card ${cleanUid} is already actively assigned to another customer.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];

    // 1. Block customer's current active card(s)
    statements.push(
      env.DB.prepare(
        `UPDATE nfc_cards 
         SET status = 'blocked', blocked_reason = ? 
         WHERE customer_id = ? AND status = 'active' AND card_uid != ?`
      ).bind(reason, id, cleanUid)
    );

    // 2. Link the new card as active
    if (targetCard) {
      statements.push(
        env.DB.prepare(
          `UPDATE nfc_cards 
           SET status = 'active', customer_id = ?, assigned_at = ?, blocked_reason = NULL 
           WHERE card_uid = ?`
        ).bind(id, now, cleanUid)
      );
    } else {
      statements.push(
        env.DB.prepare(
          `INSERT INTO nfc_cards (id, card_uid, customer_id, status, assigned_at) 
           VALUES (?, ?, ?, 'active', ?)`
        ).bind(crypto.randomUUID(), cleanUid, id, now)
      );
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        message: `NFC Card successfully replaced with ${cleanUid}. Previous card has been blocked.`,
        card_uid: cleanUid,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to replace card' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
