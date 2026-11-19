import { Env } from '../../../types';
import { authenticate } from '../../../utils/auth';
import { MenuItem } from '../../owner/menu/index';
import { CafeSettingsRow } from '../../owner/settings';
import { OrderWithItems } from '../../customers/[id]';

export interface CardScanResult {
  cardStatus: 'active' | 'unassigned' | 'blocked';
  card_uid: string;
  blocked_reason?: string | null;
  customer?: {
    id: string;
    name: string;
    phone: string;
    dob: string | null;
    notes: string | null;
    sms_consent: number;
    points_balance: number;
    total_visits: number;
    total_spent: number;
    created_at: string;
  } | null;
  crm?: {
    average_bill: number;
    last_order: OrderWithItems | null;
    most_ordered_items: { item_name: string; total_quantity: number }[];
  };
  menu_items?: MenuItem[];
  settings?: CafeSettingsRow;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  const rawCardUid = params.card_uid as string;
  const cleanUid = rawCardUid ? rawCardUid.trim().replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() : '';

  if (!cleanUid) {
    return new Response(JSON.stringify({ error: 'Card UID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Look up card in nfc_cards
    const card = await env.DB.prepare(
      'SELECT id, card_uid, customer_id, status, blocked_reason, assigned_at FROM nfc_cards WHERE card_uid = ?'
    ).bind(cleanUid).first<{
      id: string;
      card_uid: string;
      customer_id: string | null;
      status: 'unassigned' | 'active' | 'blocked';
      blocked_reason: string | null;
      assigned_at: string | null;
    }>();

    // State 1: Card unassigned or not in DB
    if (!card || card.status === 'unassigned' || !card.customer_id) {
      return new Response(
        JSON.stringify({
          cardStatus: 'unassigned',
          card_uid: cleanUid,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // State 2: Card is blocked
    if (card.status === 'blocked') {
      let customerInfo = null;
      if (card.customer_id) {
        customerInfo = await env.DB.prepare(
          'SELECT id, name, phone FROM customers WHERE id = ?'
        ).bind(card.customer_id).first<{ id: string; name: string; phone: string }>();
      }

      return new Response(
        JSON.stringify({
          cardStatus: 'blocked',
          card_uid: cleanUid,
          blocked_reason: card.blocked_reason || 'Card reported lost or disabled',
          customer: customerInfo,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // State 3: Card is active -> Fetch full customer & CRM details
    const customer = await env.DB.prepare(
      `SELECT id, name, phone, dob, notes, sms_consent, points_balance, total_visits, total_spent, is_archived, created_at 
       FROM customers WHERE id = ? AND is_archived = 0`
    ).bind(card.customer_id).first<any>();

    if (!customer) {
      // Linked customer was archived or not found
      return new Response(
        JSON.stringify({
          cardStatus: 'unassigned',
          card_uid: cleanUid,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch orders, menu items, settings in parallel
    const [recentOrderRes, favsRes, menuRes, settingsRes] = await Promise.all([
      env.DB.prepare(
        `SELECT id, order_number, subtotal, points_redeemed, discount_amount, final_amount, points_earned, created_at 
         FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1`
      ).bind(customer.id).first<any>(),

      env.DB.prepare(
        `SELECT oi.item_name, SUM(oi.quantity) as total_quantity
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.customer_id = ?
         GROUP BY oi.item_name
         ORDER BY total_quantity DESC
         LIMIT 3`
      ).bind(customer.id).all<{ item_name: string; total_quantity: number }>(),

      env.DB.prepare(
        'SELECT * FROM menu_items WHERE is_available = 1 ORDER BY category ASC, name ASC'
      ).all<MenuItem>(),

      env.DB.prepare('SELECT * FROM cafe_settings WHERE id = 1').first<CafeSettingsRow>(),
    ]);

    let lastOrderWithItems: OrderWithItems | null = null;
    if (recentOrderRes) {
      const itemsRes = await env.DB.prepare(
        'SELECT id, item_name, quantity, unit_price, total_price FROM order_items WHERE order_id = ?'
      ).bind(recentOrderRes.id).all<any>();

      lastOrderWithItems = {
        id: recentOrderRes.id,
        order_number: recentOrderRes.order_number,
        subtotal: recentOrderRes.subtotal,
        points_redeemed: recentOrderRes.points_redeemed,
        discount_amount: recentOrderRes.discount_amount,
        final_amount: recentOrderRes.final_amount,
        points_earned: recentOrderRes.points_earned,
        created_at: recentOrderRes.created_at,
        items: itemsRes.results || [],
      };
    }

    const averageBill =
      customer.total_visits > 0
        ? Math.round((customer.total_spent / customer.total_visits) * 100) / 100
        : 0;

    const payload: CardScanResult = {
      cardStatus: 'active',
      card_uid: cleanUid,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        dob: customer.dob,
        notes: customer.notes,
        sms_consent: customer.sms_consent,
        points_balance: customer.points_balance,
        total_visits: customer.total_visits,
        total_spent: customer.total_spent,
        created_at: customer.created_at,
      },
      crm: {
        average_bill: averageBill,
        last_order: lastOrderWithItems,
        most_ordered_items: favsRes.results || [],
      },
      menu_items: menuRes.results || [],
      settings: settingsRes || undefined,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Error processing card scan' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
