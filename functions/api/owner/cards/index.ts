import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';

export interface CardRow {
  id: string;
  card_uid: string;
  customer_id: string | null;
  status: 'unassigned' | 'active' | 'blocked';
  blocked_reason: string | null;
  assigned_at: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';
    const statusFilter = url.searchParams.get('status')?.trim().toLowerCase() || 'all';

    // 1. KPI Counts
    const counts = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'unassigned' THEN 1 ELSE 0 END) as unassigned,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
      FROM nfc_cards
    `).first<{
      total: number;
      unassigned: number | null;
      active: number | null;
      blocked: number | null;
    }>();

    // 2. Fetch cards joined with customer
    let query = `
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
      WHERE 1=1
    `;
    const bindings: any[] = [];

    if (statusFilter !== 'all') {
      query += ' AND n.status = ?';
      bindings.push(statusFilter);
    }

    if (search) {
      query += ' AND (LOWER(n.card_uid) LIKE ? OR LOWER(COALESCE(c.name, "")) LIKE ? OR COALESCE(c.phone, "") LIKE ?)';
      const term = `%${search}%`;
      bindings.push(term, term, term);
    }

    query += ' ORDER BY n.card_uid ASC LIMIT 500';

    const cardsResult = await env.DB.prepare(query).bind(...bindings).all<CardRow>();

    return new Response(
      JSON.stringify({
        counts: {
          total: counts?.total || 0,
          unassigned: counts?.unassigned || 0,
          active: counts?.active || 0,
          blocked: counts?.blocked || 0,
        },
        cards: cardsResult.results || [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch NFC cards' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
