import { Env } from '../../types';
import { ensureSchema } from '../../utils/ensureSchema';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;

    // Self-healing schema guard: ensure all tables exist
    await ensureSchema(env.DB);

    // Check if users table exists and has records
    let userCount = 0;
    try {
      const userResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
      userCount = userResult?.count || 0;
    } catch {
      // Table might not exist yet if schema was not run
      userCount = 0;
    }

    // Fetch cafe_name if available
    let cafeName = 'The Grove Cafe';
    try {
      const settings = await env.DB.prepare('SELECT cafe_name FROM cafe_settings WHERE id = 1').first<{ cafe_name: string }>();
      if (settings?.cafe_name) {
        cafeName = settings.cafe_name;
      }
    } catch {
      cafeName = 'The Grove Cafe';
    }

    return new Response(
      JSON.stringify({
        isInitialized: userCount > 0,
        cafe_name: cafeName,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        isInitialized: false,
        cafe_name: 'The Grove Cafe',
        error: error.message || 'Failed to check setup status',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
