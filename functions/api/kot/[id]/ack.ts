import { Env } from '../../../types';
import { requirePermission } from '../../../utils/auth';
import { ensureSchema } from '../../../utils/ensureSchema';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requirePermission(request, env, 'can_settle_bills');
  if (auth instanceof Response) return auth;

  try {
    await ensureSchema(env.DB);
    const id = params.id as string;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing KOT ticket id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE kot_queue SET status = ?, printed_at = ? WHERE id = ?'
    ).bind('printed', now, id).run();

    return new Response(
      JSON.stringify({
        success: true,
        id,
        printed_at: now,
        changes: result.meta?.changes ?? 1,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error acknowledging KOT:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to acknowledge KOT' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
