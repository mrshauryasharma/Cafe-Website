let schemaEnsured = false;

export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaEnsured) return;

  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS cafe_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          cafe_name TEXT NOT NULL DEFAULT 'The Grove Cafe',
          earn_points_per_unit REAL NOT NULL DEFAULT 10,
          earn_spend_unit REAL NOT NULL DEFAULT 100,
          point_redeem_value REAL NOT NULL DEFAULT 1.0,
          min_bill_for_redeem REAL NOT NULL DEFAULT 0,
          max_redeem_percent REAL NOT NULL DEFAULT 100,
          staff_max_bonus_points INTEGER NOT NULL DEFAULT 50,
          sms_enabled INTEGER NOT NULL DEFAULT 0,
          sms_api_key TEXT,
          sms_sender_id TEXT,
          sms_template TEXT,
          last_backup_at TEXT
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price REAL NOT NULL,
          is_available INTEGER NOT NULL DEFAULT 1,
          image_url TEXT,
          stock_qty INTEGER NOT NULL DEFAULT 100,
          max_stock INTEGER NOT NULL DEFAULT 100,
          low_stock_alert INTEGER NOT NULL DEFAULT 10,
          created_at TEXT NOT NULL
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          dob TEXT,
          notes TEXT,
          sms_consent INTEGER NOT NULL DEFAULT 1,
          points_balance REAL NOT NULL DEFAULT 0,
          total_visits INTEGER NOT NULL DEFAULT 0,
          total_spent REAL NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS nfc_cards (
          id TEXT PRIMARY KEY,
          card_uid TEXT UNIQUE NOT NULL,
          customer_id TEXT,
          status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'active', 'blocked')),
          blocked_reason TEXT,
          assigned_at TEXT,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          order_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          staff_id TEXT NOT NULL,
          subtotal REAL NOT NULL,
          points_redeemed REAL NOT NULL DEFAULT 0,
          discount_amount REAL NOT NULL DEFAULT 0,
          final_amount REAL NOT NULL,
          points_earned REAL NOT NULL DEFAULT 0,
          idempotency_key TEXT UNIQUE NOT NULL,
          dining_type TEXT NOT NULL DEFAULT 'Dine-In',
          table_number TEXT,
          extra_discount REAL NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'Cash/UPI',
          created_at TEXT NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (staff_id) REFERENCES users(id)
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS order_items (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          menu_item_id TEXT,
          item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          notes TEXT,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS draft_orders (
          id TEXT PRIMARY KEY,
          draft_number TEXT NOT NULL,
          customer_id TEXT,
          dining_type TEXT NOT NULL DEFAULT 'Dine-In',
          table_number TEXT,
          items_json TEXT NOT NULL,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS points_ledger (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          order_id TEXT,
          change_type TEXT NOT NULL CHECK (change_type IN ('earn', 'redeem', 'manual_bonus', 'manual_deduct')),
          points_change REAL NOT NULL,
          balance_after REAL NOT NULL,
          reason TEXT,
          performed_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
      `),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_nfc_cards_uid ON nfc_cards(card_uid);`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_points_ledger_customer ON points_ledger(customer_id);`),
      db.prepare(`CREATE INDEX IF NOT EXISTS idx_draft_orders_created ON draft_orders(created_at);`),
    ]);

    // Safe non-destructive column additions for existing tables
    await Promise.all([
      safeAddColumn(db, 'menu_items', 'image_url', 'TEXT'),
      safeAddColumn(db, 'menu_items', 'stock_qty', 'INTEGER NOT NULL DEFAULT 100'),
      safeAddColumn(db, 'menu_items', 'max_stock', 'INTEGER NOT NULL DEFAULT 100'),
      safeAddColumn(db, 'menu_items', 'low_stock_alert', 'INTEGER NOT NULL DEFAULT 10'),
      safeAddColumn(db, 'orders', 'dining_type', "TEXT NOT NULL DEFAULT 'Dine-In'"),
      safeAddColumn(db, 'orders', 'table_number', 'TEXT'),
      safeAddColumn(db, 'orders', 'extra_discount', 'REAL NOT NULL DEFAULT 0'),
      safeAddColumn(db, 'orders', 'payment_method', "TEXT NOT NULL DEFAULT 'Cash/UPI'"),
      safeAddColumn(db, 'order_items', 'notes', 'TEXT'),
    ]);

    schemaEnsured = true;
  } catch (err) {
    console.error('ensureSchema execution error:', err);
  }
}

async function safeAddColumn(db: D1Database, table: string, column: string, typeDef: string): Promise<void> {
  try {
    const tableInfo = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    const hasColumn = tableInfo.results?.some((r) => r.name === column);
    if (!hasColumn) {
      await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`).run();
    }
  } catch (err) {
    // Ignore if column already exists or table not ready
  }
}
