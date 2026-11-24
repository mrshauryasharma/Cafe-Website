import { Env } from '../../../types';
import { authenticate } from '../../../utils/auth';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  if (auth.user.role !== 'owner' && !auth.user.permissions.can_award_bonus_points) {
    return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to award or adjust bonus points' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing customer id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const customer = await env.DB.prepare('SELECT id, name, points_balance FROM customers WHERE id = ? AND is_archived = 0')
      .bind(id)
      .first<{ id: string; name: string; points_balance: number }>();

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as {
      action?: 'add' | 'deduct';
      points?: number;
      reason?: string;
    };

    const action = body.action;
    const points = Number(body.points);
    const reason = body.reason?.trim();

    if (!action || (action !== 'add' && action !== 'deduct')) {
      return new Response(JSON.stringify({ error: 'Action must be "add" or "deduct"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (isNaN(points) || points <= 0) {
      return new Response(JSON.stringify({ error: 'Points must be a positive number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!reason || reason.length === 0) {
      return new Response(JSON.stringify({ error: 'An audit reason is required for manual bonus/deduct points' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Role-based limits enforcement
    if (auth.user.role === 'staff') {
      if (action === 'deduct') {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Staff members cannot manually deduct points. Only the Café Owner can perform deductions.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const settings = await env.DB.prepare('SELECT staff_max_bonus_points FROM cafe_settings WHERE id = 1')
        .first<{ staff_max_bonus_points: number }>();
      const maxBonus = settings?.staff_max_bonus_points ?? 50;

      if (points > maxBonus) {
        return new Response(
          JSON.stringify({
            error: `Bonus points exceed staff allowance limit of ${maxBonus} pts per adjustment. Request the Café Owner for larger allocations.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Balance check for deductions
    let newBalance = customer.points_balance;
    if (action === 'add') {
      newBalance += points;
    } else {
      if (customer.points_balance - points < 0) {
        return new Response(
          JSON.stringify({
            error: `Cannot deduct ${points} points. Customer balance is only ${customer.points_balance} pts.`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      newBalance -= points;
    }

    const now = new Date().toISOString();
    const ledgerId = crypto.randomUUID();
    const changeType = action === 'add' ? 'manual_bonus' : 'manual_deduct';
    const pointsChange = action === 'add' ? points : -points;
    const performedBy = `${auth.user.name} (${auth.user.role})`;

    await env.DB.batch([
      env.DB.prepare('UPDATE customers SET points_balance = ? WHERE id = ?').bind(newBalance, id),
      env.DB.prepare(
        `INSERT INTO points_ledger (id, customer_id, order_id, change_type, points_change, balance_after, reason, performed_by, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
      ).bind(ledgerId, id, changeType, pointsChange, newBalance, reason, performedBy, now),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        points_balance: newBalance,
        message: `${action === 'add' ? 'Granted' : 'Deducted'} ${points} points successfully. New balance: ${newBalance} pts.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update bonus points' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
