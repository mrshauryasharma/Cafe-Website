# The Grove Cafe — Point of Sale (POS) & NFC Loyalty Platform

A high-performance, single-tenant, cloud-native Point of Sale (POS) and NFC Loyalty platform engineered specifically for **The Grove Cafe**. Built on **React 18 + TypeScript + Vite + Tailwind CSS + PWA**, running edge API endpoints on **Cloudflare Pages Functions** with serverless **Cloudflare D1 (SQLite)**, and secured via the Web Cryptography API (`crypto.subtle`).

Styled with classic **Times New Roman** serif typography (`font-serif`, `tabular-nums` on all financial figures) and a curated **White, Black & Soft Light Café** palette (`#FAF9F6` canvas, `#FFFFFF` cards, `#111111` primary ink, `#F3EFEA` warm cream, `#ECFDF5` sage mint, `#FFFBEB` soft amber, and `#FEF2F2` soft rose).

---

## 🌟 Key Architecture & Upgrades

### 1. Point of Sale (POS) & Kitchen Terminal
- **Split-Pane Touch Interface**: Real-time category filtering (Coffee, Tea, Bakery, All-Day Breakfast, etc.), instant search, and visual product grid displaying live stock counts and out-of-stock badges.
- **Dining Modes & Table Selection**: Toggle between **Dine-In** (Table 1–20 selector or custom table name) and **Takeaway**.
- **Active Draft Orders Drawer**: Save pending counter orders with dining mode, table numbers, item customizations, and order notes. Restore or delete drafts at any time with an active draft counter badge.
- **Itemized Customizations & Notes**: Attach special barista or kitchen instructions to individual items (e.g., *"Oat milk, extra hot"*, *"No onion"*) as well as order-level delivery notes.
- **80mm Thermal Receipt Printing**:
  - **Kitchen Order Ticket (KOT)**: Formatted for kitchen and barista prep with large Token #, Dining Mode, Table #, timestamp, items with modifiers/notes, excluding pricing.
  - **Customer Bill Receipt**: Formatted with Café Branding, Order #, Token #, GST/Tax breakdown, Payment method, and Loyalty Points earned/balance.

### 2. Cross-Platform NFC Architecture (iOS & Android)
- **Zero-PII On-Card Footprint**: Physical NFC tags store only a clean URL/UID (`https://the-grove-cafe.pages.dev/scan/:card_uid`).
- **Unauthenticated Lockout Screen**: When scanned by an unauthenticated customer phone, the app presents a secure **"Authorized Staff Access Only"** lockout gate with zero personal data leakage.
- **Android Chrome**: Automatic hardware tap-to-read via Web NFC (`NDEFReader`).
- **iPhone / iOS Safari**: Native background NDEF tag reading that opens Safari directly to the `/scan/:card_uid` route, plus manual card UID search and QR camera scanner fallback.
- **Instant Card Linking & Lost-Card Replacement**: Unassigned cards (`GROVE-001` through `GROVE-300`) can be instantly bound to a customer profile at counter checkout. Lost cards can be replaced in one tap with automatic point balance migration.

### 3. Inventory Management & Menu Stock Performance
- **Live Stock Deduction**: Inventory counts decrement automatically as orders are completed at the POS.
- **Real-Time Visual Indicators**: Header stock alert indicator and menu badges (**In Stock**, **Low Stock** below threshold, and **Sold Out**).
- **Capacity Progress Bars**: Visual capacity meters (`current_stock / max_capacity * 100`) with color coding (Mint > 25%, Amber 10-25%, Rose < 10%).
- **Audit Logging**: Dedicated `inventory_logs` table tracking every stock movement (`restock`, `wastage`, `sale`, `adjustment`) with item name, quantity change, staff reason, and timestamp.
- **Restock & Wastage Modal**: One-click restock to full capacity or logging of kitchen wastage directly from the menu manager.

### 4. Business Reports & Loyalty CRM Analytics
- **Range Selector**: Filter reports across `7d`, `30d`, `90d`, or `all` timeframes.
- **Sales KPIs**: Total Revenue, Total Orders, Average Order Value (AOV), and Loyalty Points Issued vs Redeemed, complete with percentage growth comparisons against the prior period.
- **Interactive SVG Data Visualizations**:
  - Grouped Revenue & Order Volume Bar Chart with interactive hover tooltips.
  - Customer Member Growth Area Chart showing new loyalty registrations over time.
  - Dining Mode Breakdown Donut Chart (Dine-In vs Takeaway).
  - Top 5 Best-Selling Items list ranked by sales volume and revenue contribution.
- **CSV Data Export**: One-click export for sales summaries, item rankings, and customer CRM cohorts.

### 5. Disaster Recovery & System Handover State
- **Monthly JSON Database Export**: Full snapshot export of all 10 SQLite database tables in a single `.json` bundle.
- **Atomic Database Restore**: Upload a backup `.json` file during initial setup to restore the complete cafe state, or perform disaster recovery while live.
- **Zero-Setup Handover State**: The production database contains 300 pre-loaded NFC cards (`GROVE-001` to `GROVE-300`) and 19 starter menu items. Zero user accounts exist, allowing the owner to complete first-boot onboarding at `https://the-grove-cafe.pages.dev`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **PWA & Offline** | `vite-plugin-pwa`, Service Workers, Web NFC API (`NDEFReader`) |
| **Edge Functions** | Cloudflare Pages Functions (`/functions/api/*`) on Workers V8 Runtime |
| **Database** | Cloudflare D1 (Distributed SQLite engine with zero egress fees) |
| **Security & Auth** | Web Cryptography API (`PBKDF2-HMAC-SHA256`, `HMAC-SHA256` signed JWTs in `HttpOnly; SameSite=Lax; Path=/` cookies) |
| **Typography** | Times New Roman serif typography (`font-serif`, `tabular-nums`) |

---

## 📁 Repository Structure

```text
Cafe_Website/
├── functions/                     # Cloudflare Pages Functions (Edge API)
│   ├── api/
│   │   ├── auth/                  # Login, Logout, Session check
│   │   ├── billing/               # POS checkout, Draft orders, Bill calculations
│   │   ├── cards/                 # NFC card lookup, assignment, replacement
│   │   ├── customers/             # Customer CRM, points lookup, registration
│   │   ├── menu/                  # Menu catalog, stock updates, restock/wastage
│   │   ├── owner/                 # Analytics, staff accounts, settings, backups
│   │   └── setup/                 # Initial system setup & backup restore gate
│   └── utils/
│       ├── auth.ts                # JWT authentication & role-based middleware
│       ├── crypto.ts              # PBKDF2 password hashing & token signing
│       └── ensureSchema.ts        # Dynamic runtime schema verification
├── nfc-cards/                     # Physical NFC Card Provisioning
│   ├── grove_300_cards_bulk_upload.csv     # 300 UIDs (GROVE-001 to GROVE-300)
│   └── grove_300_cards_encoding_sheet.csv  # 300 UIDs with encoding target URLs
├── src/                           # React 18 TypeScript Frontend
│   ├── components/                # UI components (Header, Modal, POS, Thermal print)
│   ├── pages/                     # POS Terminal, Scan lockout, Owner dashboard, Setup
│   ├── services/                  # API client modules
│   ├── utils/                     # NFC platform detection (iOS/Android), Formatting
│   ├── App.tsx                    # Route definitions & global layout
│   └── main.tsx                   # Application entry point
├── schema.sql                     # Full 10-table Cloudflare D1 SQL schema
├── seed.sql                       # 19 starter menu items for The Grove Cafe
└── wrangler.toml                  # Cloudflare Pages & D1 database binding config
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js `18.x` or `20.x`
- npm `9.x` or `10.x`
- Cloudflare Wrangler CLI (`npx wrangler`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Local Cloudflare D1 Database
Execute the 10-table database schema against the local D1 emulator:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./schema.sql
```

Seed the 19 starter menu items:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./seed.sql
```

### 4. Run Development Server
```bash
# Frontend development server (Vite)
npm run dev

# Or full Cloudflare Pages emulation with local D1 database binding
npm run build
npx wrangler pages dev dist --port=8788 --d1=DB=cafe_loyalty_db
```

Open `http://localhost:3000` or `http://localhost:8788` in your browser. On first launch, the **System Initialization Gate** will load.

---

## ☁️ Cloudflare Production Deployment Runbook

### 1. Production D1 Database Configuration
Verify your Cloudflare authentication:
```bash
npx wrangler whoami
```

Your `wrangler.toml` file is already bound to the live `cafe_loyalty_db` instance:
```toml
name = "the-grove-cafe"
compatibility_date = "2024-04-03"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "cafe_loyalty_db"
database_id = "824c419a-5f0a-4d46-9533-ad906ba4f014"
```

### 2. Apply Schema & Seed Production Database
To migrate or verify schema on remote production D1:
```bash
npx wrangler d1 execute cafe_loyalty_db --remote --file=./schema.sql
```

### 3. Build & Deploy to Cloudflare Pages
```bash
# Typecheck & build production bundle
npx tsc --noEmit
npm run build

# Deploy directly to Cloudflare Pages
npx wrangler pages deploy dist --project-name=the-grove-cafe
```

The application is deployed live at:
**`https://the-grove-cafe.pages.dev`**

---

## 📋 Owner First-Boot Onboarding Guide

1. Open `https://the-grove-cafe.pages.dev` on any desktop, tablet, or phone.
2. Because no users exist on fresh handover, the **System Initialization Gate** automatically appears.
3. Complete the Setup Form:
   - **Café Name**: `The Grove Cafe`
   - **Owner Full Name**: `Owner Name`
   - **Username**: `owner`
   - **Password**: Create a strong password (minimum 8 characters)
4. Click **Complete Setup & Launch POS**.
5. Log into the **Owner Dashboard** to:
   - Review or adjust loyalty rules (Points per currency unit, point values, welcome bonuses).
   - Create staff logins for counter baristas.
   - Inspect the 300 pre-loaded NFC cards (`GROVE-001` to `GROVE-300`).
   - Monitor real-time POS sales and inventory levels.

---

## 🔒 Security Architecture & Verification

1. **Zero-PII NFC Protection**:
   - Visit `https://the-grove-cafe.pages.dev/scan/GROVE-001` in an unauthenticated or private browser window.
   - The application serves an **"Authorized Staff Access Only"** lockout gate. No customer names, phone numbers, or balances are accessible.
2. **HttpOnly Cookie Sessions**:
   - All session tokens are delivered via cryptographically signed `HttpOnly; SameSite=Lax; Path=/` cookies, preventing XSS-based credential theft.
3. **Disaster Recovery Backup**:
   - From **Owner Dashboard** &rarr; **Backup & Restore**, click **Download Monthly Backup (.json)**.
   - The export captures all 10 tables (`cafe_settings`, `users`, `customers`, `nfc_cards`, `menu_items`, `orders`, `order_items`, `points_ledger`, `draft_orders`, and `inventory_logs`).
4. **Offline Resilience**:
   - The PWA Service Worker caches the complete application shell. If internet connectivity drops, the top **Offline Warning Banner** locks checkout mutations until network connectivity is restored.

---

## 🏷️ Physical NFC Card Encoding

The repository includes ready-to-use CSV files under `nfc-cards/`:
- `grove_300_cards_bulk_upload.csv`: 300 unique Card UIDs (`GROVE-001` to `GROVE-300`) for batch importing into other systems.
- `grove_300_cards_encoding_sheet.csv`: Card numbers, UIDs, and standard NDEF URI payloads (`https://the-grove-cafe.pages.dev/scan/GROVE-xxx`) for NFC desktop writers or mobile card encoding apps (e.g., NFC Tools).
