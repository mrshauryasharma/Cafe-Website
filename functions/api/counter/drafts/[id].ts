import { Env } from '../../../types';
import { authenticate } from '../../../utils/auth';
import { ensureSchema } from '../../../utils/ensureSchema';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing draft id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureSchema(env.DB);
    await env.DB.prepare('DELETE FROM draft_orders WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, message: 'Draft deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete draft order' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
