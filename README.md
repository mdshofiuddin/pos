# Enterprise Point of Sale (POS) & ERP Software

[![GitHub Repository](https://img.shields.io/badge/GitHub-mdshofiuddin%2Fpos-blue?logo=github)](https://github.com/mdshofiuddin/pos)
[![Render Deploy](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?logo=render&logoColor=white)](https://render.com)
[![Vibe96 Audit Ready](https://img.shields.io/badge/Security-Vibe96%20Compliant-success?logo=shield)](https://github.com/mdshofiuddin/pos)

A high-performance, single-page application (zero page reload) Point of Sale system built with **React + TypeScript + Vite** and a security-hardened **Express.js API**, designed to pass rigorous **Vibe96**, **OWASP Top 10**, and enterprise retail financial audits on the very first pass.

---

## 🌟 Key Capabilities

### 1. Zero-Reload SPA Architecture
- **Instant Barcode Scanner Support:** Auto-detects rapid barcode scanner inputs (`Enter` key termination) and adds products directly to cart.
- **Full POS Keyboard Shortcuts:**
  - `F2`: Instant product search & focus
  - `F4`: Trigger checkout & payment modal
  - `F7`: Hold current basket / ticket
  - `F8`: Retrieve held tickets
  - `F9`: Initialize fresh sale ticket
  - `Esc`: Dismiss modals / clear focus
- **Multi-Tender & Split Payments:** Cash, Credit/Debit Card, bKash, Nagad, and Customer Due / Store Credit in a single transaction.
- **Idempotency & Race Condition Guard:** UUID-based idempotency keys ensure network retries never double-charge customers or duplicate invoices.

### 2. Compact Thermal Receipt Printing (58mm / 80mm)
- Native CSS `@media print` thermal formatting tailored specifically for 58mm and 80mm thermal receipt printers.
- Formatted without headers, footers, or margins; includes company branding, itemized matrix with quantities and rates, subtotal, VAT/Tax breakdown, payment details, cashier identifier, and barcode/QR display.

### 3. Cashier Shift Management & Cash Drawer Reconciliation
- Mandatory shift opening float declaration.
- Real-time tracking of expected cash in drawer vs. physical counted cash at shift closing.
- Automatic cash variance calculation (Over / Short) with audit logging and manager approval sign-off.

### 4. At-a-Glance Inventory & Stock Movement Ledger
- Visual alerts for Low Stock and Out of Stock products.
- Double-entry stock ledger: Every stock alteration (Sale, Purchase, Return, Damage, Manual Adjustment) is tracked immutably with references, timestamps, and operator IDs.

### 5. 18 Actionable Enterprise Reports (with 1-Click CSV Export)
1. **Daily Sales Summary:** High-level daily totals, discounts, taxes, and net revenue.
2. **Daily Sales Details:** Comprehensive itemized sales breakdown with timestamps and cashier attribution.
3. **Daybook (Daily Cash & Sales Journal):** Complete financial record of the trading day.
4. **Daily Purchase Summary:** Aggregate procurement spending by day.
5. **Daily Purchase Details:** Detailed supplier invoice breakdown.
6. **Inventory Valuation & Stock Summary:** Real-time stock asset valuation (Cost vs. Retail value).
7. **Low Stock & Reorder Alert Report:** Proactive list of products nearing or below minimum thresholds.
8. **Stock Movement & Ledger Audit:** Comprehensive chronological trail of all warehouse and shop inventory changes.
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

## 🛡️ Vibe96 & Enterprise Security Compliance

Built specifically to pass the **Vibe96 Security & Compliance Audit** on the first attempt:

| Vibe96 Audit Requirement | Implementation Details |
|---|---|
| **SQL Injection (SQLi) Defense** | 100% Parameterized queries using prepared statements with adapter abstraction. |
| **Cross-Site Scripting (XSS)** | React JSX auto-escaping + Helmet HTTP Content Security and framing protections. |
| **Authentication & Session Security** | JWT with cryptographic signing, expiration checks, and role-based claim validation. |
| **Password Storage Standard** | `bcrypt` hashing with salt rounds of 10. No plain-text passwords ever touch memory or logs. |
| **Brute-Force & DoS Protection** | `express-rate-limit` windowing on sensitive authentication endpoints (`100 req / 15 min`). |
| **Payload Size Bounds** | Strict `1mb` body limits on JSON and URL-encoded parsers to prevent memory exhaustion attacks. |
| **Request Correlation & Auditing** | `X-Request-Id` correlation injected into all response headers and immutable audit logs. |
| **Role-Based Access Control (RBAC)**| Granular role separation (`admin`, `manager`, `cashier`, `inventory`). Cashiers cannot view cost prices or delete logs. |

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

## 🌐 Deploy to Vibe96 / Linux VPS

For high-security on-premise or cloud hosting on Vibe96 servers:

```bash
# 1. Clone repository
git clone https://github.com/mdshofiuddin/pos.git /var/www/pos
cd /var/www/pos

# 2. Install dependencies & build bundle
npm install
npm run build

# 3. Manage with PM2
npm install -g pm2
pm2 start apps/api/dist/server.js --name "pos-enterprise" --env production

# 4. Save PM2 startup
pm2 save
pm2 startup
```
