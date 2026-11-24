import { Env } from '../../../types';
import { requireOwner } from '../../../utils/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const auth = await requireOwner(request, env);
  if (auth instanceof Response) return auth;

  try {
    const now = new Date().toISOString();

    // 1. Update last_backup_at in cafe_settings
    await env.DB.prepare('UPDATE cafe_settings SET last_backup_at = ? WHERE id = 1').bind(now).run();

    // 2. Fetch all tables
    const [
      settingsResult,
      usersResult,
      tablesResult,
      menuResult,
      customersResult,
      cardsResult,
      ordersResult,
      orderItemsResult,
      ledgerResult,
      draftsResult,
      inventoryLogsResult,
      kotQueueResult,
    ] = await Promise.all([
      env.DB.prepare('SELECT * FROM cafe_settings').all(),
      env.DB.prepare('SELECT * FROM users').all(),
      env.DB.prepare('SELECT * FROM cafe_tables').all(),
      env.DB.prepare('SELECT * FROM menu_items').all(),
      env.DB.prepare('SELECT * FROM customers').all(),
      env.DB.prepare('SELECT * FROM nfc_cards').all(),
      env.DB.prepare('SELECT * FROM orders').all(),
      env.DB.prepare('SELECT * FROM order_items').all(),
      env.DB.prepare('SELECT * FROM points_ledger').all(),
      env.DB.prepare('SELECT * FROM draft_orders').all(),
      env.DB.prepare('SELECT * FROM inventory_logs').all(),
      env.DB.prepare('SELECT * FROM kot_queue').all(),
    ]);

    const backupPayload = {
      version: '1.0',
      exported_at: now,
      data: {
        cafe_settings: settingsResult.results || [],
        users: usersResult.results || [],
        cafe_tables: tablesResult.results || [],
        menu_items: menuResult.results || [],
        customers: customersResult.results || [],
        nfc_cards: cardsResult.results || [],
        orders: ordersResult.results || [],
        order_items: orderItemsResult.results || [],
        points_ledger: ledgerResult.results || [],
        draft_orders: draftsResult.results || [],
        inventory_logs: inventoryLogsResult.results || [],
        kot_queue: kotQueueResult.results || [],
      },
    };

    const dateStr = now.slice(0, 10);

    return new Response(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cafe-backup-${dateStr}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Backup export failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
