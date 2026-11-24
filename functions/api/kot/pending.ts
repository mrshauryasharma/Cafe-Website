import { Env, KotTicket } from '../../types';
import { requirePermission } from '../../utils/auth';
import { ensureSchema } from '../../utils/ensureSchema';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requirePermission(request, env, 'can_settle_bills');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);

    const [pendingRes, recentRes] = await Promise.all([
      env.DB.prepare('SELECT * FROM kot_queue WHERE status = ? ORDER BY created_at ASC')
        .bind('pending')
        .all<KotTicket>(),
      env.DB.prepare('SELECT * FROM kot_queue WHERE status = ? ORDER BY created_at DESC LIMIT 20')
        .bind('printed')
        .all<KotTicket>(),
    ]);

    const parseTickets = (tickets: KotTicket[] = []) => {
      return tickets.map((t) => {
        let items = [];
        try {
          items = JSON.parse(t.items_json || '[]');
        } catch {
          items = [];
        }
        return {
          ...t,
          items,
        };
      });
    };

    return new Response(
      JSON.stringify({
        pending: parseTickets(pendingRes.results || []),
        recent: parseTickets(recentRes.results || []),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching KOT queue:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch KOT queue' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
