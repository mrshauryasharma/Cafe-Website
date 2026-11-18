import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';
import { hashPassword } from '../../../utils/crypto';

export interface UserSummary {
  id: string;
  name: string;
  username: string;
  role: 'owner' | 'staff';
  is_active: number;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const users = await env.DB.prepare(
      'SELECT id, name, username, role, is_active, created_at FROM users ORDER BY role ASC, created_at ASC'
    ).all<UserSummary>();

    return new Response(JSON.stringify(users.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch staff members' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as {
      name?: string;
      username?: string;
      password?: string;
    };

    const name = body.name?.trim();
    const username = body.username?.trim().toLowerCase();
    const password = body.password;

    if (!name || !username || !password) {
      return new Response(
        JSON.stringify({ error: 'Name, username, and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if username is already taken
    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Username is already in use' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO users (id, name, username, password_hash, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, name, username, passwordHash, 'staff', 1, now).run();

    const created = await env.DB.prepare(
      'SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?'
    ).bind(id).first<UserSummary>();

    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create staff member' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
