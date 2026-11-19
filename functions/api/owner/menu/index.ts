import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: number;
  image_url?: string | null;
  stock_qty?: number;
  max_stock?: number;
  low_stock_alert?: number;
  created_at: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const items = await env.DB.prepare(
      'SELECT id, name, category, price, is_available, created_at FROM menu_items ORDER BY category ASC, name ASC'
    ).all<MenuItem>();

    return new Response(JSON.stringify(items.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch menu items' }),
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
      category?: string;
      price?: number;
      is_available?: number;
    };

    const name = body.name?.trim();
    const category = body.category?.trim();
    const price = Number(body.price);
    const isAvailable = body.is_available === 0 ? 0 : 1;

    if (!name || !category) {
      return new Response(
        JSON.stringify({ error: 'Item name and category are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (isNaN(price) || price < 0) {
      return new Response(
        JSON.stringify({ error: 'Price must be a non-negative number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO menu_items (id, name, category, price, is_available, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, name, category, price, isAvailable, now).run();

    const created = await env.DB.prepare(
      'SELECT id, name, category, price, is_available, created_at FROM menu_items WHERE id = ?'
    ).bind(id).first<MenuItem>();

    return new Response(JSON.stringify(created), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create menu item' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
