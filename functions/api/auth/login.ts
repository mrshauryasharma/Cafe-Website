import { Env, UserSession, UserRole } from '../../types';
import { verifyPassword, createJwt, createAuthCookie, DEFAULT_JWT_SECRET } from '../../utils/crypto';
import { resolveUserPermissions } from '../../utils/permissions';

interface LoginPayload {
  username?: string;
  password?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = (await request.json()) as LoginPayload;
    const username = body.username?.trim().toLowerCase();
    const password = body.password;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = await env.DB.prepare(
      'SELECT id, name, username, password_hash, role, permissions_json, is_active FROM users WHERE username = ?'
    ).bind(username).first<{
      id: string;
      name: string;
      username: string;
      password_hash: string;
      role: UserRole;
      permissions_json?: string;
      is_active: number;
    }>();

    if (!user || user.is_active !== 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid username or password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid username or password.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const permissions = resolveUserPermissions(user.role, user.permissions_json);

    // Fetch cafe name
    let cafeName = 'Kimmo’s Kitchen';
    try {
      const settings = await env.DB.prepare('SELECT cafe_name FROM cafe_settings WHERE id = 1').first<{ cafe_name: string }>();
      if (settings?.cafe_name) {
        cafeName = settings.cafe_name;
      }
    } catch {
      cafeName = 'Kimmo’s Kitchen';
    }

    const sessionPayload: UserSession = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      permissions,
      exp: 0,
    };

    const tokenExpirySeconds = user.role === 'owner' ? 86400 * 7 : 86400; // 7 days for owner, 1 day for counter staff
    const token = await createJwt(sessionPayload, env.JWT_SECRET || DEFAULT_JWT_SECRET, tokenExpirySeconds);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          permissions,
        },
        cafe_name: cafeName,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createAuthCookie(token, tokenExpirySeconds),
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Login failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
