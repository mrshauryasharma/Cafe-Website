import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';
import { hashPassword } from '../../../utils/crypto';
import { UserSummary } from './index';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing user id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const targetUser = await env.DB.prepare(
      'SELECT id, name, username, role, is_active FROM users WHERE id = ?'
    ).bind(id).first<UserSummary>();

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      is_active?: number;
      new_password?: string;
      name?: string;
    };

    // If changing is_active to 0 on an owner, check that at least one other active owner remains
    if (body.is_active !== undefined && body.is_active === 0 && targetUser.role === 'owner') {
      const activeOwners = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1 AND id != ?'
      ).bind('owner', id).first<{ count: number }>();

      if (!activeOwners || activeOwners.count === 0) {
        return new Response(
          JSON.stringify({ error: 'Cannot deactivate the last active Owner account.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    let passwordHash: string | null = null;
    if (body.new_password) {
      if (body.new_password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'New password must be at least 6 characters' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      passwordHash = await hashPassword(body.new_password);
    }

    const name = body.name?.trim() || null;
    const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : null;

    await env.DB.prepare(
      `UPDATE users
       SET is_active = COALESCE(?, is_active),
           password_hash = COALESCE(?, password_hash),
           name = COALESCE(?, name)
       WHERE id = ?`
    ).bind(isActive, passwordHash, name, id).run();

    const updated = await env.DB.prepare(
      'SELECT id, name, username, role, is_active, created_at FROM users WHERE id = ?'
    ).bind(id).first<UserSummary>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update user' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
