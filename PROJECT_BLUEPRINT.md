# Project Blueprint & Architectural Invariants: Café Website & Loyalty Management System

## 1. Executive Summary & Core Architectural Vision

This blueprint establishes the non-negotiable architectural standards, security policies, data models, and implementation roadmap for the **Café Website & Loyalty Management System**.

The application is engineered as a high-performance, single-tenant, cloud-native Web App tailored specifically for a single physical café location. It couples a blazing-fast customer-facing presence, an offline-resilient PWA counter terminal for staff, and an owner dashboard for inventory, analytics, loyalty rules, and disaster recovery.

---

## 2. Deployment & Runtime Stack

### 2.1 Technology Matrix
- **Frontend**: React 18+ (SPA) + TypeScript + Vite + Tailwind CSS.
- **PWA Capabilities**: `vite-plugin-pwa` with Workbox caching strategy for instant shell loading and offline-ready asset delivery.
- **Backend API**: Cloudflare Pages Functions (`/functions/api/*`) executing on the V8-isolate Cloudflare Workers runtime.
- **Database Engine**: Cloudflare D1 (Serverless Distributed SQLite) accessed strictly via Worker environment binding (`env.DB`).
- **Icons & UI Primitives**: Lucide React + Tailwind CSS (clean, responsive, zero-bloat component design).

### 2.2 Strict Runtime Constraints & Web Standards Enforcement
To maintain compatibility with the Cloudflare Workers V8 Isolate runtime and eliminate serverless cold-start friction:
1. **Web Standard APIs Only**: Rely strictly on standard Web APIs (`fetch`, `Request`, `Response`, `Headers`, `crypto.subtle`, `TextEncoder`, `TextDecoder`, `Uint8Array`).
2. **Forbidden Node Modules**: **NEVER** import or require Node-only runtime modules:
   - ❌ `fs`, `path`, `os`, `stream`, `child_process`
   - ❌ `crypto` (Node built-in)
   - ❌ `bcrypt` or `bcryptjs`
   - ❌ `better-sqlite3`, `sqlite3`
   - ❌ `jsonwebtoken` (Node-dependent)
3. **Cryptographic Primitives**:
   - **Password Hashing**: Implemented via `crypto.subtle.deriveBits` using **PBKDF2-HMAC-SHA256** (100,000+ iterations, 16-byte cryptographically secure salt, output hex-encoded with salt).
   - **Session Authentication**: Lightweight JWT sessions signed and verified using `crypto.subtle.sign` / `verify` with **HMAC-SHA-256** (`HS256`).
   - **Session Delivery**: Secured in `HttpOnly`, `Secure`, `SameSite=Lax` cookies with bounded expiration (e.g., 8-hour staff counter session, 1-day owner session).

---

## 3. Dynamic Café Branding & Multi-Identity Prevention

### 3.1 Strict Branding Rules
- **Zero Hardcoded Café Identity**: The application source code, components, headers, footers, meta tags, invoices, and SMS templates must **never** hardcode a specific café name (e.g., "Starbucks", "Blue Tokai", "Café Mocha").
- **Database-Driven Branding**:
  - The café name, contact info, currency symbol, address, and logo URL must be dynamically queried from the `cafe_settings` table.
  - **Fallback Rule**: During initial scaffolding or first launch prior to onboarding, the system falls back to `"My Café"`.
  - The café owner retains real-time configuration control to modify branding and details at any time from the Owner Settings Dashboard.

---

## 4. Core System Scope & Boundaries (Single-Café Architecture)

### 4.1 Single-Tenant vs Multi-Tenant Boundary
- The codebase is purposely streamlined as a **Single-Café Architecture**.
- ❌ **Out of Scope**: Multi-tenant SaaS schemas, organization/tenant ID partitioning, customer SaaS subscription plans, or multi-branch routing.
- **In Scope**: High-reliability, single-database deployment designed for maximum simplicity, zero operational overhead, and instantaneous response times.

### 4.2 Role-Based Access Control (RBAC)
The system admits exactly two internal authenticated roles:
1. **`owner`**:
   - Full master privileges: Menu & pricing management, staff account creation/deactivation, loyalty rules & points-to-rupee valuation, staff bonus allocation limits, monthly database backup export, full disaster recovery restore, and analytics.
2. **`staff`**:
   - Fast-access counter privileges: NFC card scanning, customer lookup/registration, 10-second itemized order billing, points redemption at checkout, and restricted bonus points issuance (capped by owner-set daily/per-transaction limit with mandatory audit reason).
   - Forbidden from accessing financial settings, staff management, or backup/restore tools.

### 4.3 NFC Card Architecture & Threat Model
- **Data on Card**: Physical NFC tags store **ONLY** a unique UID or URL (e.g., `https://<domain>/scan/<card_uid>`). No customer PII, balance, or tokens are written to physical NFC cards.
- **Unauthenticated Scan Lockout**:
  - When an NFC card is scanned by an unauthenticated phone/device (e.g., a customer or bystander tapping their NFC device), the system immediately displays an **"Authorized Staff Access Only"** lock screen.
  - No customer names, phone numbers, loyalty points balances, or order histories are ever leaked to unauthorized devices.
  - Customer data is exclusively accessible after an authenticated `owner` or `staff` session validates the card UID against Cloudflare D1.

### 4.4 Billing, Loyalty Engine & CRM Insights
1. **Itemized Digital Billing**:
   - High-speed visual catalog categorized by beverages, food, bakery, and specials.
   - Quick search and single-tap cart additions designed for sub-10-second order completion.
2. **Loyalty Mechanics**:
   - **Earning Rules**: Configurable earn rate (e.g., 1 loyalty point per ₹10 spent).
   - **Redemption Rules**: Configurable point value (e.g., 1 point = ₹1 discount), with owner-defined maximum redemption thresholds per bill.
   - **Controlled Bonus Points**: Staff can issue courtesy or promotion bonus points only up to the owner-defined ceiling, requiring a mandatory reason tag (e.g., "Long Wait Apology", "Birthday Treat").
3. **Automated CRM Insights**:
   - As soon as a customer card/phone is scanned, the terminal surfaces:
     - **Last Order**: Items ordered, date, and bill amount.
     - **Top Favorites**: Most ordered 2–3 items for lightning-fast repeat ordering and personalized greetings.
     - **Lifetime Loyalty Tier & Visit Frequency**.

### 4.5 Offline Safety & Integrity Invariant
- **PWA Service Worker Shell**:
  - UI assets, fonts, icons, and static layouts are cached for instant offline rendering.
- **Offline Mutation Block**:
  - When `navigator.onLine === false` (or when health checks to Cloudflare Workers fail):
    - The UI immediately renders a persistent amber/red **"Offline Mode — Read Only"** banner.
    - All state-mutating actions (**Bill Generation**, **Points Redemption**, **Bonus Points Issue**, **Customer Creation**) are strictly **disabled**.
  - **Rationale**: Prevents race conditions, double-spend of loyalty points across offline split instances, and out-of-sync financial records.

### 4.6 Disaster Recovery & Data Portability
- **Owner-Exclusive Monthly Backup**:
  - Single-click export producing a timestamped, structured `.json` bundle containing all tables (`cafe_settings`, `users`, `menu_items`, `customers`, `nfc_cards`, `orders`, `order_items`, `loyalty_transactions`, `audit_logs`).
- **Disaster Recovery Restore Gate**:
  - If a fresh database has zero users/tables, the initial setup screen presents:
    1. "Create New Café Setup"
    2. "Restore from Backup File (.json)"
  - When an authorized owner restores from a valid `.json` payload, the system reconstructs the entire database transactionally via batch D1 statements.

---

## 5. Preliminary Database Schema Blueprint (Cloudflare D1 SQLite)

```sql
-- 1. Café Settings (Dynamic Branding & System Config)
CREATE TABLE IF NOT EXISTS cafe_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Staff and Owner Accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT CHECK(role IN ('owner', 'staff')) NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 3. Menu Categories and Items
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  is_available INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 4. Customer Directory & Loyalty
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  points_balance INTEGER DEFAULT 0 NOT NULL,
  total_spent REAL DEFAULT 0.0 NOT NULL,
  total_visits INTEGER DEFAULT 0 NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. NFC Card Bindings
CREATE TABLE IF NOT EXISTS nfc_cards (
  card_uid TEXT PRIMARY KEY,
  customer_id TEXT,
  status TEXT CHECK(status IN ('unassigned', 'active', 'blocked', 'lost')) DEFAULT 'unassigned' NOT NULL,
  issued_at INTEGER,
  last_scanned_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 6. Orders and Line Items
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  staff_id TEXT NOT NULL,
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0.0 NOT NULL,
  points_redeemed INTEGER DEFAULT 0 NOT NULL,
  points_value_redeemed REAL DEFAULT 0.0 NOT NULL,
  points_earned INTEGER DEFAULT 0 NOT NULL,
  final_amount REAL NOT NULL,
  payment_method TEXT CHECK(payment_method IN ('cash', 'upi', 'card', 'split')) NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (staff_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- 7. Loyalty Ledger & Audit Trail
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_id TEXT,
  staff_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('earned', 'redeemed', 'bonus', 'adjustment')) NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (staff_id) REFERENCES users(id)
);
```

---

## 6. Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASED EXECUTION PIPELINE                       │
└────────────────────────────────────────────────────────────────────────┘
  Phase 1: Foundation & Auth Gate
    ├─ Scaffolding: Vite + React + TS + Tailwind + vite-plugin-pwa + Wrangler
    ├─ Cloudflare D1 integration: schema.sql & seed logic
    ├─ Web Crypto Auth: PBKDF2 hash & HMAC-SHA256 JWT cookies
    └─ First-Launch Gate: Onboarding vs Restore Backup selector
  Phase 2: Owner Master Dashboard
    ├─ Dynamic Branding: cafe_settings CRUD
    ├─ Menu Management: Categories & item pricing
    ├─ Loyalty Rules: Earn/burn ratios & staff bonus limits
    └─ Staff Management & Bulk NFC pre-allocation
  Phase 3: Customer Directory & CRM
    ├─ Centralized Directory: Search by phone/name/UID
    ├─ 360° Profile: Lifetime spend, visit counts, favorite items
    ├─ NFC Card Management: Assign, unassign, mark lost, re-link
    └─ Controlled Bonus Points with required audit reasons
  Phase 4: Counter Terminal & Billing
    ├─ NFC Scanner (Web NFC API + manual fallback search)
    ├─ Sub-10-Second Itemized Menu Billing with quick add
    ├─ Real-time loyalty point redemption calculator
    └─ Post-checkout CRM insights & SMS Webhook notification dispatch
  Phase 5: Reliability, Offline Guard & Cloudflare Production
    ├─ PWA Service Worker caching policies
    ├─ Offline Lock Banner: Disable all mutating actions offline
    ├─ Disaster Recovery: Full JSON backup download & atomic restore
    └─ Production deployment runbook with Cloudflare Pages & D1
```

### Milestone Breakdown
- **Phase 1**: Project scaffolding (`package.json`, `wrangler.toml`, `schema.sql`), D1 setup, Initial Setup/Restore Gate, and Owner/Staff JWT Auth.
- **Phase 2**: Owner Dashboard (Menu Manager, Points & Staff Limits Settings, Staff Accounts, Bulk NFC Cards Upload).
- **Phase 3**: Centralized Customers Directory (`/customers`), 360° Customer Profile, Lost/Damaged Card Re-linking, and Controlled Bonus Points.
- **Phase 4**: Staff Counter Scan Screen (Web NFC + Search), 10-Second Itemized Menu Billing, Auto-CRM Insights, and SMS Webhook Integration.
- **Phase 5**: Owner Monthly Backup & Disaster Recovery System, Offline Lock Banner, and Cloudflare Production Deployment Guide.

---

## 7. Governance, Review, and Invariant Compliance

1. **Simplicity First (`ponytail` discipline)**: Keep frontend bundles lightweight and avoid unnecessary enterprise wrappers or redundant state machines.
2. **Evidence-Based Progress (`gravitas` discipline)**: Every phase must compile cleanly (`tsc --noEmit`, `vite build`) and be verified against runtime constraints before proceeding.
3. **Security by Design (`security-and-hardening`)**: Validate all inputs at function boundaries, enforce RBAC on every API route, and ensure no secrets or sensitive customer info are ever exposed.
