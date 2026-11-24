import { Env, UserSession, UserRole, UserPermissions } from '../types';
import { parseCookies, verifyJwt, DEFAULT_JWT_SECRET } from './crypto';
import { resolveUserPermissions } from './permissions';

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  permissions: UserPermissions;
}

/**
 * Authenticates the current user session from the JWT cookie and verifies active status in D1.
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<{ user: AuthenticatedUser } | Response> {
  const cookies = parseCookies(request);
  const token = cookies['auth_token'];

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Session missing' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = await verifyJwt<UserSession>(token, env.JWT_SECRET || DEFAULT_JWT_SECRET);
  if (!session || !session.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const user = await env.DB.prepare(
    'SELECT id, name, username, role, permissions_json, is_active FROM users WHERE id = ?'
  ).bind(session.id).first<{
    id: string;
    name: string;
    username: string;
    role: UserRole;
    permissions_json?: string;
    is_active: number;
  }>();

  if (!user || user.is_active !== 1) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: User account deactivated or not found' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const permissions = resolveUserPermissions(user.role, user.permissions_json);

  return {
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      permissions,
    },
  };
}

/**
 * Enforces that the request is made by an active user with the 'owner' role.
 */
export async function requireOwner(
  request: Request,
  env: Env
): Promise<{ user: AuthenticatedUser } | Response> {
  const authResult = await authenticate(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (authResult.user.role !== 'owner') {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Owner privileges required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return authResult;
}

/**
 * Enforces that the request is made by an active user with a specific permission (or owner).
 */
export async function requirePermission(
  request: Request,
  env: Env,
  permission: keyof UserPermissions
): Promise<{ user: AuthenticatedUser } | Response> {
  const authResult = await authenticate(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  if (authResult.user.role === 'owner' || authResult.user.permissions[permission] === true) {
    return authResult;
  }

  return new Response(
    JSON.stringify({ error: `Forbidden: Missing required permission '${permission}'` }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}
