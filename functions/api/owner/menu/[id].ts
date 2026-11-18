import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';
import { MenuItem } from './index';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing item id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const existing = await env.DB.prepare('SELECT id FROM menu_items WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Menu item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as Partial<MenuItem>;
    const name = body.name?.trim();
    const category = body.category?.trim();
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const isAvailable = body.is_available !== undefined ? (body.is_available ? 1 : 0) : undefined;

    if (name !== undefined && name.length === 0) {
      return new Response(JSON.stringify({ error: 'Item name cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (category !== undefined && category.length === 0) {
      return new Response(JSON.stringify({ error: 'Category cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (price !== undefined && (isNaN(price) || price < 0)) {
      return new Response(JSON.stringify({ error: 'Price must be a non-negative number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      `UPDATE menu_items
       SET name = COALESCE(?, name),
           category = COALESCE(?, category),
           price = COALESCE(?, price),
           is_available = COALESCE(?, is_available)
       WHERE id = ?`
    ).bind(
      name ?? null,
      category ?? null,
      price !== undefined ? price : null,
      isAvailable !== undefined ? isAvailable : null,
      id
    ).run();

    const updated = await env.DB.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first<MenuItem>();

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update menu item' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing item id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if the item exists
    const existing = await env.DB.prepare('SELECT id, name FROM menu_items WHERE id = ?').bind(id).first<{ id: string; name: string }>();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Menu item not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if item is already referenced in order_items
    const orderCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?'
    ).bind(id).first<{ count: number }>();

    if (orderCount && orderCount.count > 0) {
      return new Response(
        JSON.stringify({
          error: `Cannot delete "${existing.name}" because it appears in ${orderCount.count} past order(s). Please toggle it to "Out of Stock" (unavailable) instead to preserve historical billing accuracy.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();

    return new Response(
      JSON.stringify({ success: true, message: `"${existing.name}" has been deleted.` }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete menu item' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
