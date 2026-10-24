# Enterprise Point of Sale (POS) & ERP Software

[![GitHub Repository](https://img.shields.io/badge/GitHub-mdshofiuddin%2Fpos-blue?logo=github)](https://github.com/mdshofiuddin/pos)
[![Render Deploy](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

A high-speed, zero-reload single page application (SPA) Point of Sale and retail management system built with **React, TypeScript, Vite** and a security-hardened **Express.js API**, backed by a database-agnostic architecture.

---

## 🌟 Key Features & Facilities

### 1. Zero-Reload Single Page Application (SPA)
- **Zero Page Refresh:** Seamless navigation across POS Terminal, Sales History, Inventory, Customers, Purchases, and Reports without page flickering.
- **Modern Theme:** Ergonomic UI designed for fast-paced retail environments with customizable themes.

### 2. High-Speed POS Terminal & Cashier Billing
- **Instant Barcode Scanner Support:** Automatically captures hardware barcode scanners with automatic `Enter` key termination to add products to cart instantly.
- **Keyboard-Driven Shortcuts:**
  - `F2`: Instant product search & focus
  - `F4`: Open checkout & payment window
  - `F7`: Hold current cart/ticket (multi-customer queuing)
  - `F8`: Retrieve held tickets
  - `F9`: Clear current cart & start fresh ticket
  - `Esc`: Close modals and clear selection
- **Multi-Tender & Split Payments:** Accept mixed payment methods in a single transaction (Cash, Card, bKash, Nagad, and Customer Due/Credit).
- **Idempotent Atomic Transactions:** Cryptographic request keys guard against accidental double billing or network retry issues.

### 3. Compact Thermal Receipt Printing (58mm / 80mm)
- **Dedicated Print Styles:** Automatically optimizes print layout for standard 58mm and 80mm thermal receipt roll printers via browser print dialog (`Ctrl + P`).
- **Complete Receipt Matrix:** Displays store branding, invoice reference, date/time, cashier name, itemized quantity and rate, VAT/Tax breakdown, payment tender details, and barcode/QR verification.

### 4. Cashier Shift Management & Cash Drawer Reconciliation
- **Opening Float Tracking:** Enforces recording opening cash drawer floats before processing sales.
- **Physical vs. System Cash Reconciliation:** Real-time tracking of expected drawer cash vs. physical cash counted at shift end.
- **Variance Analysis:** Highlights Cash Over / Short differences with manager audit approval.

### 5. At-a-Glance Inventory & Stock Movement Ledger
- **Live Stock Alerts:** Real-time visual alerts for low-stock and out-of-stock items.
- **Immutable Stock Movement Ledger:** Double-entry tracking of every inventory alteration (Sales, Purchases, Returns, Damage, Adjustments) with timestamps and operator IDs.

### 6. Customer Due & Credit Management
- **Customer Profiles:** Comprehensive customer registry with phone numbers, loyalty points, and purchase history.
- **Credit Sales & Due Balances:** Allows trusted customers to buy on credit with due limits.
- **Payment Collection:** Record customer repayments with updated balance statements.

### 7. Purchasing & Supplier Management
- **Supplier Directory:** Manage vendor contacts, payment terms, and trade balances.
- **Purchase Orders & Stock Receiving:** Automatically updates inventory stock counts and weighted unit costs when new stock arrives.

### 8. Reports (Comprehensive Analytics with 1-Click CSV Export)
Includes 18 detailed operational, financial, and inventory reports:
1. **Daily Sales Summary:** High-level daily totals, discounts, taxes, and net revenue.
2. **Daily Sales Details:** Itemized sales breakdown with timestamps and cashier attribution.
3. **Daybook (Daily Cash & Sales Journal):** Complete financial record of the trading day.
4. **Daily Purchase Summary:** Aggregate procurement spending by day.
5. **Daily Purchase Details:** Detailed supplier invoice breakdown.
6. **Inventory Valuation & Stock Summary:** Real-time stock asset valuation (Cost vs. Retail value).
7. **Low Stock & Reorder Alert Report:** Proactive list of products nearing or below minimum thresholds.
8. **Stock Movement & Ledger Audit:** Chronological trail of all warehouse and shop inventory changes.
9. **Cashier Shift Reconciliation & Drawer Variance:** Shift-by-shift float, drawer cash, and cash variance analysis.
10. **Product Profit Margin Analysis:** Margin percentages and gross profit per SKU.
11. **Customer Due / Aging Balances:** Receivables tracking and customer debt aging.
12. **Supplier Outstanding Balances:** Accounts payable and vendor payment status.
13. **Tax / VAT Collection Report:** Detailed government VAT and tax liability summary.
14. **Sales Return & Refund Summary:** Returns analysis and refund reasons.
15. **Top Selling Products:** Best-performing products ranked by sales volume and revenue.
16. **Payment Method Breakdown:** Percentage and volume breakdown across Cash, Card, bKash, and Nagad.
17. **Hourly Sales Trend:** Peak-hour sales traffic to optimize cashier staffing.
18. **Security Audit Trail & Event Logs:** Tamper-evident ledger of user logins, price overrides, stock edits, and system changes.

---

## 🛡️ Enterprise Security & Data Integrity

- **SQL Injection Defense:** 100% Parameterized queries using prepared statements with adapter abstraction.
- **XSS & Content Security:** React JSX auto-escaping combined with Helmet HTTP security headers.
- **Password Security:** Salted hashes using `bcrypt` (10 rounds). Plain text passwords are never stored.
- **Authentication:** JWT tokens with role-based access control and configurable session expiry.
- **Brute-Force Protection:** Rate limiting on sensitive authentication endpoints.
- **Audit Logging:** Administrative operations, price overrides, and cash counts are immutably logged.

---

## 🚀 Local Development Setup

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/mdshofiuddin/pos.git
cd pos

# Install all dependencies (root, backend, and frontend)
npm install
```

### 2. Run Locally
```bash
# Start backend API (http://localhost:5000)
npm run dev:api

# Start frontend application (http://localhost:5173)
npm run dev:web
```

### 3. Demo Credentials
| Role | Username | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin` | `Admin@123456` | Unrestricted full system access |
| **Manager** | `manager` | `Manager@123456` | Shifts, inventory, discounts, all reports |
| **Cashier** | `cashier` | `Cashier@123456` | POS terminal, sales, shift open/close |
| **Inventory**| `inventory` | `Inventory@123456` | Stock receiving, suppliers, purchases |

---

## 🌐 Deploy to Live Server (Render.com)

This repository includes a native [render.yaml](file:///c:/Users/Shofiuddin-IT/OneDrive%20-%20Fakir%20Group/Desktop/pos/render.yaml) blueprint for 1-click cloud deployment.

### Method A: Deploy via Render Blueprint (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Select the repository: `https://github.com/mdshofiuddin/pos`.
4. Render automatically parses `render.yaml` and provisions:
   - **Service Type:** Web Service
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/v1/health`
5. Click **Apply**. Your app is live within 2 minutes!

### Method B: Manual Web Service on Render
1. On Render, click **New +** -> **Web Service**.
2. Connect `https://github.com/mdshofiuddin/pos`.
3. Set the following parameters:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check:** `/api/v1/health`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `JWT_SECRET`: *(Generate in Render dashboard)*
   - `SHOP_NAME`: `Fakir Fashion POS`
   - `SHOP_CURRENCY`: `BDT`
5. Click **Create Web Service**.

---

## 🌐 Deploy to Linux VPS

For self-hosted production deployment on any Linux VPS:

```bash
# 1. Clone repository
git clone https://github.com/mdshofiuddin/pos.git /var/www/pos
cd /var/www/pos

# 2. Install dependencies & build bundle
# Requires Node.js >= 22.0.0 (specified in .nvmrc and package.json)
npm install
npm run build

# 3. Initialize Database (Sequential order)
npm run db:migrate   # Stage 1: Schema & Indexes
npm run seed         # Stage 2: RBAC & Baseline Data

# 4. Manage with PM2
npm install -g pm2
pm2 start apps/api/dist/server.js --name "pos-enterprise" --env production

# 4. Save PM2 startup
pm2 save
pm2 startup
```
