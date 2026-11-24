-- Cloudflare D1 SQLite Database Schema for Café Website & Loyalty Management System

-- 1. Café Settings (Dynamic Branding & System Config)
CREATE TABLE IF NOT EXISTS cafe_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cafe_name TEXT NOT NULL DEFAULT 'Kimmo’s Kitchen',
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
  gst_enabled INTEGER NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 5.0,
  gstin TEXT,
  packaging_charge REAL NOT NULL DEFAULT 0,
  last_backup_at TEXT
);

-- 2. Staff & Owner User Accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'waiter')),
  permissions_json TEXT NOT NULL DEFAULT '{}',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 2.1 Dynamic Café Dining Tables
CREATE TABLE IF NOT EXISTS cafe_tables (
  id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL UNIQUE,
  table_name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'Main Floor',
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied')),
  active_order_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 3. Menu Items
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

-- 4. Customer Directory & Loyalty Records
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

-- 5. NFC Cards Registry
CREATE TABLE IF NOT EXISTS nfc_cards (
  id TEXT PRIMARY KEY,
  card_uid TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'unassigned' CHECK (status IN ('unassigned', 'active', 'blocked')),
  blocked_reason TEXT,
  assigned_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 6. Billing Orders
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
  tax_amount REAL NOT NULL DEFAULT 0,
  packaging_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'Cash/UPI',
  split_details_json TEXT,
  waiter_id TEXT,
  waiter_name TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 7. Order Line Items
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

-- 8. Draft Orders (Open Tables / Held Carts)
CREATE TABLE IF NOT EXISTS draft_orders (
  id TEXT PRIMARY KEY,
  draft_number TEXT NOT NULL,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  dining_type TEXT NOT NULL DEFAULT 'Dine-In',
  table_id TEXT,
  table_number TEXT,
  waiter_id TEXT,
  waiter_name TEXT,
  items_json TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 9. Points Ledger & Audit Trail
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

-- 10. Inventory Audit Logs
CREATE TABLE IF NOT EXISTS inventory_logs (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('restock', 'wastage', 'adjustment', 'sale')),
  quantity_change INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  notes TEXT,
  performed_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- 11. KOT Queue (Kitchen Order Tickets for Auto-Print & Audit)
CREATE TABLE IF NOT EXISTS kot_queue (
  id TEXT PRIMARY KEY,
  kot_number TEXT NOT NULL,
  draft_id TEXT,
  table_id TEXT,
  table_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  waiter_id TEXT,
  waiter_name TEXT NOT NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('new_order', 'add_on', 'cancel_item')),
  items_json TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed')),
  created_at TEXT NOT NULL,
  printed_at TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_nfc_cards_uid ON nfc_cards(card_uid);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_customer ON points_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_draft_orders_created ON draft_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_item ON inventory_logs(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_number ON cafe_tables(table_number);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);
CREATE INDEX IF NOT EXISTS idx_kot_queue_status_created ON kot_queue(status, created_at ASC);
