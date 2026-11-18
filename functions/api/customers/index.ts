import { Env } from '../../types';
import { authenticate } from '../../utils/auth';

export interface CustomerSummaryRow {
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
  card_uid: string | null;
  card_status: string | null;
  last_visit_at: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

    let query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.dob,
        c.notes,
        c.sms_consent,
        c.points_balance,
        c.total_visits,
        c.total_spent,
        c.created_at,
        card.card_uid,
        card.status as card_status,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) as last_visit_at
      FROM customers c
      LEFT JOIN nfc_cards card ON card.customer_id = c.id AND card.status = 'active'
      WHERE c.is_archived = 0
    `;
    const bindings: any[] = [];

    if (search) {
      query += ` AND (
        LOWER(c.name) LIKE ? 
        OR c.phone LIKE ? 
        OR LOWER(COALESCE(card.card_uid, '')) LIKE ?
      )`;
      const term = `%${search}%`;
      bindings.push(term, term, term);
    }

    query += ` ORDER BY COALESCE(last_visit_at, c.created_at) DESC LIMIT 200`;

    const customersResult = await env.DB.prepare(query).bind(...bindings).all<CustomerSummaryRow>();

    return new Response(JSON.stringify(customersResult.results || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch customers' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await authenticate(request, env);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      dob?: string;
      notes?: string;
      sms_consent?: number;
      card_uid?: string;
    };

    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const dob = body.dob?.trim() || null;
    const notes = body.notes?.trim() || null;
    const smsConsent = body.sms_consent === 0 ? 0 : 1;
    const rawCardUid = body.card_uid?.trim();
    const cleanCardUid = rawCardUid ? rawCardUid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : null;

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Customer Name and Phone number are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Phone uniqueness check
    const existingPhone = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(phone).first();
    if (existingPhone) {
      return new Response(
        JSON.stringify({ error: `A customer with phone number ${phone} is already registered.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // NFC Card check if provided
    let existingCard: { id: string; status: string; customer_id: string | null } | null = null;
    if (cleanCardUid) {
      existingCard = await env.DB.prepare(
        'SELECT id, status, customer_id FROM nfc_cards WHERE card_uid = ?'
      ).bind(cleanCardUid).first<{ id: string; status: string; customer_id: string | null }>();

      if (existingCard) {
        if (existingCard.status === 'blocked') {
          return new Response(
            JSON.stringify({ error: `NFC Card ${cleanCardUid} is marked as BLOCKED and cannot be assigned.` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (existingCard.status === 'active' && existingCard.customer_id) {
          return new Response(
            JSON.stringify({ error: `NFC Card ${cleanCardUid} is already actively linked to another customer.` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const customerId = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];

    // 1. Insert customer
    statements.push(
      env.DB.prepare(
        `INSERT INTO customers (id, name, phone, dob, notes, sms_consent, points_balance, total_visits, total_spent, is_archived, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)`
      ).bind(customerId, name, phone, dob, notes, smsConsent, now)
    );

    // 2. Link NFC Card if provided
    if (cleanCardUid) {
      if (existingCard) {
        statements.push(
          env.DB.prepare(
            `UPDATE nfc_cards 
             SET status = 'active', customer_id = ?, assigned_at = ?, blocked_reason = NULL 
             WHERE card_uid = ?`
          ).bind(customerId, now, cleanCardUid)
        );
      } else {
        statements.push(
          env.DB.prepare(
            `INSERT INTO nfc_cards (id, card_uid, customer_id, status, assigned_at)
             VALUES (?, ?, ?, 'active', ?)`
          ).bind(crypto.randomUUID(), cleanCardUid, customerId, now)
        );
      }
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: customerId,
          name,
          phone,
          dob,
          notes,
          sms_consent: smsConsent,
          points_balance: 0,
          total_visits: 0,
          total_spent: 0,
          card_uid: cleanCardUid,
          card_status: cleanCardUid ? 'active' : null,
          created_at: now,
          last_visit_at: null,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create customer' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
