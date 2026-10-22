# Enterprise Point of Sale (POS) & ERP Software

A high-performance, single-page application (zero page reload) Point of Sale system built with **React + TypeScript + Vite** and a security-hardened **Express.js API**, designed to pass rigorous OWASP and enterprise retail audits.

---

## 🌟 Key Capabilities

1. **Zero-Reload SPA Architecture:**
   - Lightning-fast POS terminal with instant barcode scanner support (`Enter` key auto-detection).
   - Instant keyboard shortcuts (`F2` Search, `F4` Checkout, `F7` Hold Bill, `F8` Retrieve, `F9` New Sale, `Esc` Cancel).
   - Split & multi-tender payments (Cash, Card, bKash, Nagad, Customer Due/Credit).
   - Real-time stock reservation and atomic checkout with idempotency keys.

2. **Compact Thermal Receipt Printing (58mm / 80mm):**
   - Specially styled thermal receipt printable directly from standard browser print dialogs (`Ctrl+P`).
   - Clean shop branding, itemized matrix, VAT breakdown, payment method, cashier tag, and barcode/QR display.

3. **Cashier Sessions & Shift Reconciliation:**
   - Cash drawer opening float recording.
   - Real-time tracking of expected vs. counted drawer cash with variance reporting and manager close-shift audit.

4. **Inventory Management at a Glance:**
   - Real-time low-stock alerts and out-of-stock badges.
   - Comprehensive immutable Stock Movement Ledger tracking sales, purchases, adjustments, and returns.

5. **18 Actionable Enterprise Reports (with 1-Click CSV Export):**
   1. Daily Sales Summary
   2. Daily Sales Details
   3. Daybook (Comprehensive Daily Cash & Sales Log)
   4. Daily Purchase Summary
   5. Daily Purchase Details
   6. Inventory Valuation & Stock Summary
   7. Low Stock & Reorder Alert Report
   8. Stock Movement & Ledger Audit
   9. Cashier Shift Reconciliation & Drawer Variance
   10. Product Profit Margin Analysis
   11. Customer Due / Aging Balances
   12. Supplier Outstanding Balances
   13. Tax / VAT Collection Report
   14. Sales Return & Refund Summary
   15. Top Selling Products
   16. Payment Method Breakdown (Cash, Card, bKash, Nagad)
   17. Hourly Sales Trend
   18. Security Audit Trail & Event Logs

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js v22 or higher (Built-in SQLite adapter supported)
- npm v10+

### 2. Installation & Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd pos

# Install all dependencies (root, backend, and frontend)
npm install

# Start development servers (in separate terminals or simultaneously)
npm run dev:api    # Starts Express backend on http://localhost:5000
npm run dev:web    # Starts React frontend on http://localhost:5173
```

### 3. Demo Credentials
| Role | Username | Password | Permitted Features |
|---|---|---|---|
| **Admin** | `admin` | `Admin@123456` | Full system access, users, settings, all reports |
| **Manager** | `manager` | `Manager@123456` | Shift audits, price overrides, inventory, reports |
| **Cashier** | `cashier` | `Cashier@123456` | POS terminal, checkout, shift open/close |
| **Inventory**| `inventory` | `Inventory@123456` | Stock management, purchasing, supplier receiving |

---

## 🌐 Deploy to Render.com (Live Server)

This repository includes a `render.yaml` blueprint ready for 1-click cloud deployment as a unified Web Service on Render free tier.

### Option A: Deploy with Render Blueprint (Recommended)
1. Push your repository to **GitHub** (see instructions below).
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Select your connected GitHub repository.
5. Render will automatically detect `render.yaml` and configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check:** `/api/v1/health`
6. Click **Apply**. Your app will build and go live at `https://<your-service-name>.onrender.com`!

### Option B: Deploy as a Standard Web Service
1. On [Render Dashboard](https://dashboard.render.com), click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the following settings:
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/v1/health`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `JWT_SECRET`: *(Click 'Generate' or enter a strong secret)*
   - `SHOP_NAME`: `Fakir Fashion POS`
   - `SHOP_CURRENCY`: `BDT`
5. Click **Create Web Service**.

---

## 🛡️ Enterprise Security & Compliance
- **Defense in Depth:** Helmet HTTP security headers, CORS strict allowlists, and brute-force rate limiters.
- **Request Tracing:** Automatic `X-Request-Id` correlation across requests and audit logs.
- **Data Protection:** Passwords securely hashed with `bcrypt` (cost factor 10), JWT with role-based claim validation.
- **Audit Logging:** Tamper-evident immutable audit log records all administrative actions, cash counts, and price overrides.
