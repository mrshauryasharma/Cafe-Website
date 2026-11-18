# Café Website & NFC Loyalty Management System

A high-performance, single-tenant, cloud-native Web App engineered for physical café locations. Built on **React + TypeScript + Vite + Tailwind CSS + PWA**, running backend APIs on **Cloudflare Pages Functions** with serverless **Cloudflare D1 (SQLite)**, and secured via Web Standard Cryptography (`crypto.subtle`).

---

## 🌟 Key Features

1. **Dynamic Café Branding**: Zero hardcoded café names. Configured in real-time from the Owner Dashboard with automatic fallback (`"My Café"`).
2. **NFC Membership Architecture**: Physical NFC cards hold only a URL/UID (`/scan/:card_uid`). Unauthenticated taps show an **"Authorized Staff Access Only"** lockout screen with zero PII exposure.
3. **10-Second Counter Billing Terminal**: Fast itemized menu ordering, instant customer lookup, live point redemptions, and automated CRM metrics (Last Order + Top Favorites).
4. **Owner Management Console**: Real-time loyalty engine configuration, digital menu management, counter staff accounts, and bulk import for 300–5,000+ NFC tags.
5. **Disaster Recovery Backup**: One-click monthly `.json` full database export and atomic restore (supporting empty-database bootstrap or active database disaster recovery).
6. **Global Offline Safety Lock**: PWA cached shell with a global offline banner that automatically blocks checkout mutations, points redemptions, and card changes when offline.
7. **SMS Notification Gateway**: Automated post-bill loyalty balance SMS dispatch with customizable templates and variable chips.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, `vite-plugin-pwa`, Lucide Icons
- **Backend API**: Cloudflare Pages Functions (`/functions/api/*`) on Workers runtime
- **Database Engine**: Cloudflare D1 (Serverless Distributed SQLite) via `env.DB`
- **Security & Cryptography**: Standard Web Crypto API (`PBKDF2-HMAC-SHA256` password hashing, `HMAC-SHA256` signed JWTs delivered in `HttpOnly; SameSite=Lax; Path=/` cookies)

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js `v18+` or `v20+`
- npm `v9+` or `v10+`

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Local D1 Database
Execute the 8-table database schema against the local D1 emulator:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./schema.sql
```

*(Optional)* Seed sample menu items:
```bash
npx wrangler d1 execute cafe_loyalty_db --local --file=./seed.sql
```
> **Note**: `seed.sql` only inserts menu items. The `users` table is left empty so the **Initial Setup / Disaster Recovery Gate** displays on first launch.

### 4. Run Development Server
```bash
# Frontend dev server (Vite)
npm run dev

# Or full Cloudflare Pages dev server with local D1 binding
npm run build
npx wrangler pages dev dist --d1=DB=cafe_loyalty_db
```
Open `http://localhost:3000` (or the wrangler port) in your browser. On first launch, you will see the **System Initialization Gate** to create your Master Owner account or restore from an existing backup `.json` file.

---

## ☁️ Cloudflare Production Deployment Runbook

### Step 1: Create Remote Cloudflare D1 Database
```bash
npx wrangler d1 create cafe_loyalty_db
```
Wrangler will output your database ID. Update `wrangler.toml` with the production database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "cafe_loyalty_db"
database_id = "<YOUR_PRODUCTION_D1_DATABASE_ID>"
```

### Step 2: Apply Database Schema to Remote D1
```bash
npx wrangler d1 execute cafe_loyalty_db --remote --file=./schema.sql

# Optional: seed sample menu items
npx wrangler d1 execute cafe_loyalty_db --remote --file=./seed.sql
```

### Step 3: Deploy to Cloudflare Pages
1. Push your repository to GitHub / GitLab.
2. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
3. Configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Set Environment Variables:
   - Under **Settings** &rarr; **Environment variables**, add:
     - `JWT_SECRET`: A cryptographically secure random string (64+ characters).
5. Bind the Cloudflare D1 Database:
   - Go to **Settings** &rarr; **Functions** &rarr; **D1 database bindings**.
   - Click **Add binding**:
     - **Variable name**: `DB`
     - **D1 database**: Select `cafe_loyalty_db`

### Step 4: First Launch & Master Account Creation
1. Open your assigned `*.pages.dev` domain.
2. The **System Initialization Gate** will load automatically.
3. Choose:
   - **Fresh Setup**: Enter your Café Name, Owner Name, Username, and Password.
   - **Restore Backup**: Upload a previous `.json` backup file to reconstruct all settings, customers, and points balances.

---

## 🔒 Security & Disaster Recovery Verification

1. **Unauthenticated NFC Scan Test**:
   - Visit `https://your-domain.com/scan/SAMPLE_CARD_123` in an Incognito window.
   - Verify that the **Authorized Staff Access Only** security lock screen appears and no customer data is leaked.
2. **Monthly Backup Verification**:
   - Log in as the Owner, navigate to **Owner Dashboard** &rarr; **Backup & Restore**, and click **Download Monthly Backup (.json)**.
   - Verify that the downloaded `.json` file contains all 8 tables.
3. **Offline Safety Verification**:
   - In browser DevTools (Network tab), toggle to **Offline**.
   - Verify that the top **Offline Mode Warning Banner** appears and that the **Confirm & Complete Bill** button is automatically disabled.
