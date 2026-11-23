import { Env, UserSession } from '../../types';
import { hashPassword, createJwt, createAuthCookie, DEFAULT_JWT_SECRET } from '../../utils/crypto';
import { ensureSchema } from '../../utils/ensureSchema';

interface InitPayload {
  cafe_name?: string;
  name: string;
  username: string;
  password: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // Self-healing schema guard: ensure all tables exist
    await ensureSchema(env.DB);

    // Check if system is already initialized
    const userResult = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    if (userResult && userResult.count > 0) {
      return new Response(
        JSON.stringify({ error: 'System is already initialized. Please log in.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = (await request.json()) as InitPayload;
    const name = body.name?.trim();
    const username = body.username?.trim().toLowerCase();
    const password = body.password;
    const cafeName = body.cafe_name?.trim() || 'Kimmo’s Kitchen';

    if (!name || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Owner Name, Username, and Password are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    // Batch insert: cafe_settings and owner user
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO cafe_settings (id, cafe_name, earn_points_per_unit, earn_spend_unit, point_redeem_value, min_bill_for_redeem, max_redeem_percent, staff_max_bonus_points, sms_enabled)
         VALUES (1, ?, 10, 100, 1.0, 0, 100, 50, 0)
         ON CONFLICT(id) DO UPDATE SET cafe_name = excluded.cafe_name`
      ).bind(cafeName),
      env.DB.prepare(
        `INSERT INTO users (id, name, username, password_hash, role, is_active, created_at)
         VALUES (?, ?, ?, ?, 'owner', 1, ?)`
      ).bind(userId, name, username, passwordHash, now),
    ]);

    // Create session JWT
    const sessionPayload: UserSession = {
      id: userId,
      name,
      username,
      role: 'owner',
      exp: 0,
    };

    const token = await createJwt(sessionPayload, env.JWT_SECRET || DEFAULT_JWT_SECRET, 86400 * 7);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, name, username, role: 'owner' },
        cafe_name: cafeName,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createAuthCookie(token, 86400 * 7),
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Initialization failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
