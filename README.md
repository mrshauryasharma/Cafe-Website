# Kimmo’s Kitchen — Point of Sale (POS) & NFC Loyalty Platform

A high-performance, single-tenant, cloud-native Point of Sale (POS), Table Management, and NFC Loyalty platform engineered specifically for **Kimmo’s Kitchen**. Built on **React 18 + TypeScript + Vite + Tailwind CSS + PWA**, running edge API endpoints on **Cloudflare Pages Functions** with serverless **Cloudflare D1 (SQLite)**, and secured via the Web Cryptography API (`crypto.subtle`).

Styled with classic **Times New Roman** serif typography (`font-serif`, `tabular-nums` on all financial figures) and a curated **White, Black & Soft Light Café** palette (`#FAF9F6` canvas, `#FFFFFF` cards, `#111111` primary ink, `#F3EFEA` warm cream, `#ECFDF5` sage mint, `#FFFBEB` soft amber, and `#FEF2F2` soft rose).

---

## 🌟 Key Architecture & Capabilities

### 1. Point of Sale (POS) & Table Settlement (`/pos` & `/pos/:table_id`)
- **Direct Table Settlement (`/pos/:table_id`)**: Navigate directly to any table to auto-load its active running draft order, customer details, and server attribution into the billing terminal.
- **Occupied Tables Quick Bar**: Real-time horizontal bar at the top of the counter terminal displaying all occupied tables with running item counts and totals for 1-tap bill retrieval.
- **Split-Pane Touch Interface**: Real-time category filtering (Coffee, Tea, Bakery, All-Day Breakfast, etc.), instant search, and visual product grid displaying live stock counts and out-of-stock badges.
- **Dining Modes**: Toggle between **Dine-In** (dynamic table selector), **Takeaway**, and **Delivery**.
- **Active Draft Orders Drawer**: Save pending counter orders with dining mode, table numbers, item customizations, and order notes. Restore or delete drafts at any time with an active draft counter badge.
- **Itemized Customizations & Notes**: Attach special barista or kitchen instructions to individual items (e.g., *"Oat milk, extra hot"*, *"No onion"*) as well as order-level delivery notes.
- **Split Payment Engine (Cash + UPI + Card)**: Settle bills using Cash, UPI / QR, Card, or Split payment. Includes numeric breakdown inputs, "Fill Remaining" single-click helpers, and strict mathematical balance validation.
- **Optional GST & Packaging Charges**: Configurable café GSTIN and tax rate (auto-split into CGST and SGST) and default takeaway/delivery packaging charges.
- **80mm Thermal Receipt Printing**:
  - **Kitchen Order Ticket (KOT)**: Formatted for kitchen and barista prep with large Token #, Dining Mode, Table #, timestamp, items with modifiers/notes, excluding pricing.
  - **Customer Bill Receipt**: Formatted with Café GSTIN, Order #, Server name, Packaging, GST breakdown (CGST/SGST), Split payment details, and Loyalty Points earned/balance.

### 2. Waiter Mobile Ordering & Table Management (`/order` & `/tables`)
- **Waiter Role & Granular Permissions**: Distinct user roles (`owner`, `manager`, `staff`, `waiter`) governed by a granular capability matrix (`can_settle_bills`, `can_apply_discounts`, `can_modify_inventory`, `can_view_reports`, `can_manage_tables`).
- **Mobile Waiter Interface (`/order`)**: Dedicated responsive tablet/mobile terminal for floor staff to take orders table-side, add item notes, hold orders as live drafts, and dispatch tickets directly to the kitchen.
- **Dynamic Floor & Table Management (`/tables`)**: Manage restaurant floor sections (Main Hall, Balcony, Patio, Bar) with configurable table numbers, seating capacities, and real-time occupancy status (`available`, `occupied`, `billed`).
- **Table Shift & Merge Operations**: Effortlessly shift a party to a new table or merge multiple tables into a single bill while preserving order items and server attribution.
- **Item Cancellation KOT**: Dedicated kitchen void ticket printing (`cancel_item`) with mandatory server reason logging for kitchen waste auditing.
- **Counter Dual KOT Auto-Print Queue**: Background polling queue that detects new kitchen tickets, add-on items, and cancellations, allowing automatic 80mm thermal receipt printing at the counter.

### 3. Cross-Platform NFC Architecture (iOS & Android)
- **Zero-PII On-Card Footprint**: Physical NFC tags store only a clean URL/UID (`https://kimmos-kitchen.pages.dev/scan/:card_uid`).
- **Unauthenticated Lockout Screen**: When scanned by an unauthenticated customer phone, the app presents a secure **"Authorized Staff Access Only"** lockout gate with zero personal data leakage.
- **Android Chrome**: Automatic hardware tap-to-read via Web NFC (`NDEFReader`).
- **iPhone / iOS Safari**: Native background NDEF tag reading that opens Safari directly to the `/scan/:card_uid` route, plus manual card UID search and QR camera scanner fallback.
- **Smart Running-Table Auto-Match**: When an authenticated cashier or waiter scans an NFC card belonging to a customer currently seated at an active table, the system auto-detects their table and displays a 1-tap *"Load Table & Settle Bill"* prompt.
- **Instant Card Linking & Lost-Card Replacement**: Unassigned cards (`KIMMO-001` through `KIMMO-300`) can be instantly bound to a customer profile at counter checkout. Lost cards can be replaced in one tap with automatic point balance migration.

### 4. Inventory Management & Menu Stock Performance
- **Live Stock Deduction**: Inventory counts decrement automatically as orders are completed at the POS.
- **Real-Time Visual Indicators**: Header stock alert indicator and menu badges (**In Stock**, **Low Stock** below threshold, and **Sold Out**).
- **Capacity Progress Bars**: Visual capacity meters (`current_stock / max_capacity * 100`) with color coding (Mint > 25%, Amber 10-25%, Rose < 10%).
- **Audit Logging**: Dedicated `inventory_logs` table tracking every stock movement (`restock`, `wastage`, `sale`, `adjustment`) with item name, quantity change, staff reason, and timestamp.
- **Restock & Wastage Modal**: One-click restock to full capacity or logging of kitchen wastage directly from the menu manager.

### 5. Waiter Leaderboard, Business Reports & Day-End Z-Report (`/owner/reports`)
- **Range Selector**: Filter reports across `Today`, `7 Days`, `30 Days`, `90 Days`, or `All Time`.
- **Waiter & Staff Sales Leaderboard**: Ranked performance table featuring Staff Name, Orders Served, Gross Sales, Net Revenue, Average Order Value (AOV), and visual Revenue Share percentage bars. Included in the one-click CSV export.
- **Day-End Closing Z-Report (`GET /api/owner/z-report`)**:
  - **Payment Drawer Reconciliation**: Complete mathematical breakdown of Cash in till, UPI / QR bank deposits, Card settlements, and Split bills.
  - **Sales & Tax Audit**: Gross Sales, Discounts, Packaging, CGST/SGST collected, and Net Revenue.
  - **Dining Channel Breakdown**: Dine-In vs Takeaway vs Delivery revenue and order counts.
  - **Cancelled Items Audit Log**: Complete voided item logs with server names, reasons, and timestamps.
  - **Open Tables Notice**: Warns of any unbilled active tables before day-end closing.
  - **80mm Thermal Register Printout**: One-click printable closing slip for physical cash-register record keeping.

### 6. Disaster Recovery & System Handover State
- **Monthly JSON Database Export**: Full snapshot export of all SQLite database tables in a single `.json` bundle.
- **Atomic Database Restore**: Upload a backup `.json` file during initial setup to restore the complete cafe state, or perform disaster recovery while live.
- **Zero-Setup Handover State**: The production database contains 300 pre-loaded NFC cards (`KIMMO-001` to `KIMMO-300`) and starter menu items. Zero user accounts exist, allowing the owner to complete first-boot onboarding at `https://kimmos-kitchen.pages.dev`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **PWA & Offline** | `vite-plugin-pwa`, Service Workers, Web NFC API (`NDEFReader`) |
| **Edge Functions** | Cloudflare Pages Functions (`/functions/api/*`) on Workers V8 Runtime |
| **Database** | Cloudflare D1 (Distributed SQLite engine with zero egress fees) |
| **Security & Auth** | Web Cryptography API (`PBKDF2-HMAC-SHA256`, `HMAC-SHA256` signed JWTs in `HttpOnly; SameSite=Lax; Path=/` cookies) |
| **Typography & Theme** | Times New Roman serif typography (`font-serif`, `tabular-nums`), Soft Light Café palette |

---

## 📁 Repository Structure

```text
Cafe_Website/
├── functions/                     # Cloudflare Pages Functions (Edge API)
│   ├── api/
│   │   ├── auth/                  # Login, Logout, Session check
│   │   ├── counter/               # POS checkout, Draft orders, Scan, Init
│   │   ├── customers/             # Customer CRM, Points lookup, Card replacement
│   │   ├── kot/                   # Kitchen order tickets queue, cancellations
│   │   ├── nfc/                   # Smart NFC card scanning & table matching
│   │   ├── owner/                 # Analytics, Z-Report, Menu, Staff, Settings, Backup
│   │   ├── setup/                 # Initial system onboarding & restore gate
│   │   └── tables/                # Floor tables CRUD, Occupancy, Shift & Merge
│   └── utils/
│       ├── auth.ts                # JWT authentication & granular permission matrix
│       ├── crypto.ts              # PBKDF2 password hashing & token signing
│       ├── ensureSchema.ts        # Dynamic runtime schema verification & migrations
│       └── sms.ts                 # Customer loyalty SMS notification dispatch
├── nfc-cards/                     # Physical NFC Card Provisioning
│   ├── kimmo_300_cards_bulk_upload.csv     # 300 UIDs (KIMMO-001 to KIMMO-300)
│   └── kimmo_300_cards_encoding_sheet.csv  # 300 UIDs with encoding target URLs
├── src/                           # React 18 TypeScript Frontend
│   ├── components/
│   │   ├── counter/               # POS Terminal, Custom item, KOT & Bill printer
│   │   ├── customers/             # Add customer modal, Profile view
│   │   ├── header/                # Global top navigation & role badges
│   │   ├── lockouts/              # Unauthorized NFC scan lockout gate
│   │   ├── owner/                 # Reports, Z-Report modal, Menu, Staff, Settings, Backup
│   │   ├── tables/                # Floor layout, Table management, Shift/Merge modal
│   │   └── waiter/                # Waiter mobile ordering terminal (/order)
│   ├── utils/                     # NFC platform detection (iOS/Android), Formatting
│   ├── App.tsx                    # Route definitions & clean URL navigation
│   └── main.tsx                   # Application entry point
├── schema.sql                     # Full 12-table Cloudflare D1 SQL schema
├── seed.sql                       # Starter menu items for Kimmo’s Kitchen
└── wrangler.toml                  # Cloudflare Pages & D1 database binding config
```

---

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Local Cloudflare D1 Database
Execute the database schema against the local D1 emulator:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./schema.sql
```

Seed the starter menu items:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./seed.sql
```

### 3. Run Development Server
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
Your `wrangler.toml` file is already bound to the live `cafe_loyalty_db` instance:
```toml
name = "kimmos-kitchen"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "cafe_loyalty_db"
database_id = "824c419a-5f0a-4d46-9533-ad906ba4f014"
```

### 2. Apply Schema to Production Database
```bash
npx wrangler d1 execute cafe_loyalty_db --remote --file=./schema.sql
```

### 3. Build & Deploy to Cloudflare Pages
```bash
# Typecheck & build production bundle
npx tsc --noEmit
npm run build

# Deploy directly to Cloudflare Pages
npx wrangler pages deploy dist --project-name=kimmos-kitchen
```

The application is deployed live at:
**`https://kimmos-kitchen.pages.dev`**

---

## 📋 Owner First-Boot Onboarding Guide

1. Open `https://kimmos-kitchen.pages.dev` on any desktop, tablet, or phone.
2. Because no users exist on fresh handover, the **System Initialization Gate** automatically appears.
3. Complete the Setup Form:
   - **Café Name**: `Kimmo’s Kitchen`
   - **Owner Full Name**: `Owner Name`
   - **Username**: `owner`
   - **Password**: Create a strong password (minimum 8 characters)
4. Click **Complete Setup & Launch POS**.
5. Log into the **Owner Dashboard** to:
   - Configure café GSTIN and Takeaway packaging charges.
   - Set up floor tables and seating sections under **Tables**.
   - Create staff accounts with distinct roles (`manager`, `staff`, `waiter`).
   - Inspect the 300 pre-loaded NFC cards (`KIMMO-001` to `KIMMO-300`).
   - Monitor real-time POS sales, waiter leaderboards, and run Day-End Z-Reports.

---

## 🔒 Security Architecture & Verification

1. **Zero-PII NFC Protection**:
   - Visit `https://kimmos-kitchen.pages.dev/scan/KIMMO-001` in an unauthenticated or private browser window.
   - The application serves an **"Authorized Staff Access Only"** lockout gate. No customer names, phone numbers, or balances are accessible.
2. **HttpOnly Cookie Sessions & Role Matrices**:
   - All session tokens are delivered via cryptographically signed `HttpOnly; SameSite=Lax; Path=/` cookies, preventing XSS-based credential theft.
   - Server-side permission guards strictly prevent unauthorized bill settlements, stock modifications, or report viewing.
3. **Disaster Recovery Backup**:
   - From **Owner Dashboard** &rarr; **Backup & Restore**, click **Download Monthly Backup (.json)**.
   - The export captures all tables in a single JSON payload for instant restoration.
4. **Offline Resilience**:
   - The PWA Service Worker caches the complete application shell. If internet connectivity drops, the top **Offline Warning Banner** locks checkout mutations until network connectivity is restored.
