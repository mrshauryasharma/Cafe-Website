import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as { cards?: string[] };
    const rawCards = body.cards;

    if (!rawCards || !Array.isArray(rawCards) || rawCards.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Please provide an array of card UIDs' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Clean, normalize and deduplicate within incoming batch
    const uniqueUids = Array.from(
      new Set(
        rawCards
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c.length > 0)
      )
    );

    if (uniqueUids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid card UIDs found in payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Count before
    const beforeCountRes = await env.DB.prepare('SELECT COUNT(*) as count FROM nfc_cards').first<{ count: number }>();
    const countBefore = beforeCountRes?.count || 0;

    // Prepare batch statements
    const statements: D1PreparedStatement[] = uniqueUids.map((uid) =>
      env.DB.prepare(
        'INSERT OR IGNORE INTO nfc_cards (id, card_uid, status) VALUES (?, ?, ?)'
      ).bind(crypto.randomUUID(), uid, 'unassigned')
    );

    // Execute in chunks to respect Cloudflare D1 batch limits (e.g. 50-100 per chunk)
    const CHUNK_SIZE = 50;
    for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
      const chunk = statements.slice(i, i + CHUNK_SIZE);
      await env.DB.batch(chunk);
    }

    // Count after
    const afterCountRes = await env.DB.prepare('SELECT COUNT(*) as count FROM nfc_cards').first<{ count: number }>();
    const countAfter = afterCountRes?.count || 0;

    const insertedCount = countAfter - countBefore;
    const duplicateCount = uniqueUids.length - insertedCount;

    return new Response(
      JSON.stringify({
        success: true,
        totalSubmitted: rawCards.length,
        uniqueSubmitted: uniqueUids.length,
        insertedCount,
        duplicateCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Bulk card import failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
