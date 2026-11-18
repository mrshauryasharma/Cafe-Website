import { Env, UserSession } from '../../types';
import { parseCookies, verifyJwt, DEFAULT_JWT_SECRET } from '../../utils/crypto';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const cookies = parseCookies(request);
    const token = cookies['auth_token'];

    if (!token) {
      return new Response(
        JSON.stringify({ user: null, cafe_name: 'The Grove Cafe' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = await verifyJwt<UserSession>(token, env.JWT_SECRET || DEFAULT_JWT_SECRET);
    if (!session || !session.id) {
      return new Response(
        JSON.stringify({ user: null, cafe_name: 'The Grove Cafe' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is still active in database
    const user = await env.DB.prepare(
      'SELECT id, name, username, role, is_active FROM users WHERE id = ?'
    ).bind(session.id).first<{
      id: string;
      name: string;
      username: string;
      role: 'owner' | 'staff';
      is_active: number;
    }>();

    if (!user || user.is_active !== 1) {
      return new Response(
        JSON.stringify({ user: null, cafe_name: 'The Grove Cafe' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch cafe_name
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
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
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
      JSON.stringify({ user: null, cafe_name: 'The Grove Cafe', error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
