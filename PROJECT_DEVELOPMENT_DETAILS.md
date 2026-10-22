# Project Development & Architecture Specification
## Enterprise Retail Point of Sale (POS) & ERP Solution

---

## 1. Executive Summary

The **Enterprise Retail Point of Sale (POS) & ERP Platform** is a mission-critical, enterprise-grade software suite designed to streamline high-volume retail transactions, automate inventory control, enforce strict financial cash drawer audits, and provide end-to-end operational visibility. 

Engineered from the ground up to satisfy rigorous **FinTech, OWASP, and enterprise compliance audits**, the system eliminates transaction latency, double-charging vulnerabilities, and unauthorized stock shrinkages through a **zero-reload Single Page Application (SPA)** front-end coupled with an **ACID-compliant, security-hardened backend API**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE POS ECOSYSTEM                        │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│    CLIENT LAYER     │      API GATEWAY         │    DATA REPOSITORY    │
│  React 19 / Vite    │   Express.js / Node 22   │ Database-Agnostic DB  │
│  • Zero-Reload SPA  │   • OWASP Security Suite │ • ACID Transactions   │
│  • Barcode Scanner  │   • Role-Based Access    │ • Immutable Ledgers   │
│  • Thermal Receipts │   • Rate Limit & Audits  │ • Auto Migrations     │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

---

## 2. Technology Stack & Architectural Foundations

| Domain | Technology | Engineering Rationale |
|---|---|---|
| **Frontend Framework** | **React (SPA) + TypeScript** | Delivers 60 FPS zero-page-reload rendering, strict type safety, and seamless client-side routing. |
| **Build Engine** | **Vite** | Sub-second Hot Module Replacement (HMR) and optimized Tree-Shaken production bundling. |
| **Styling & Theme** | **Modern CSS Design Tokens** | Native CSS variables with dark/light ergonomics, `@media print` thermal styling for 58mm/80mm roll printers. |
| **Backend Runtime** | **Node.js (v22 LTS)** | Built-in high-performance V8 engine with native cryptographic and database adapter support. |
| **API Framework** | **Express.js (TypeScript)** | Modular, layered domain-driven design (DDD) separating Routers, Middlewares, Services, and Adapters. |
| **Database Engine** | **Database-Agnostic Adapter** | Default native high-speed SQLite adapter; seamlessly swappable with PostgreSQL or MySQL via unified interface. |
| **Security Suite** | **Helmet, bcrypt, JWT, Rate-Limit** | OWASP Top 10 defense-in-depth, cryptographic salting, role-validated access claims, and DDoS throttling. |
| **DevOps & Cloud** | **Render Blueprint (`render.yaml`)** | Infrastructure-as-Code (IaC) configuration for zero-downtime 1-click cloud deployment and horizontal scaling. |

---

## 3. Core Functional Capabilities & Business Modules

### 3.1. Zero-Reload High-Speed POS Terminal
* **Instant Barcode Scanner Engine:** Automatically captures rapid hardware laser/CCD barcode scanner inputs via terminal `Enter` character stream detection with zero false triggers.
* **Cashier Productivity Hotkeys:**
  * `F2`: Instant product spotlight search & inventory lookup
  * `F4`: Immediate checkout & payment tender modal
  * `F7`: Hold current active basket/ticket (multi-customer queue management)
  * `F8`: Recall and resume held transaction tickets
  * `F9`: Flush current workspace and initiate fresh sales session
  * `Esc`: Dismiss active overlays and return to scanner focus
* **Multi-Tender & Split Payments:** Simultaneously process mixed payments across **Cash, Credit/Debit Cards, bKash, Nagad, and Customer Store Due/Credit** in a single atomic transaction.
* **Idempotency & Double-Charge Protection:** Cryptographic UUID-based request headers guard against network drops and double-charge vulnerabilities during checkout.

### 3.2. Compact Thermal Receipt Printing (58mm & 80mm)
* **Hardware-Agnostic Print Engine:** Native CSS print engine formatted specifically for industry-standard **58mm and 80mm thermal roll printers**.
* **Receipt Layout Architecture:**
  * Clean establishment branding, contact info, and tax registration (BIN/VAT)
  * Sequential invoice reference, date-time stamp, and cashier badge
  * Itemized product breakdown (SKU, Name, Unit Rate, Qty, Line Total)
  * Subtotal, flat/percentage discounts, government VAT/tax itemization
  * Tender breakdown with change calculation
  * Machine-readable verification Barcode / QR Code footer

### 3.3. Cashier Shifts & Cash Drawer Reconciliation
* **Opening Float Enforcement:** Cashiers must declare opening physical drawer float before sales transactions can unlock.
* **Real-Time Cash Drawer Balancing:** Dynamically aggregates opening float, cash sales, cash refunds, manual pay-ins, and paid-out expenses.
* **Shift Variance Auditing:** Compares expected register balance against physical counted cash at shift closing, immediately flagging **Over / Short** variances for manager sign-off.

### 3.4. Real-Time Inventory & Stock Movement Ledger
* **Low Stock & Out-of-Stock Telemetry:** Color-coded threshold alerts prevent stockouts of critical SKUs.
* **Immutable Double-Entry Ledger:** Every stock alteration (**Purchase Receipt, Sale Deduct, Customer Return, Scrap/Damage, Manual Audit Adjustment**) is permanently recorded with user ID, timestamp, and signed quantities.

### 3.5. Customer Due & Receivables Management
* **Customer Ledger & Credit Lines:** Set customized credit limits for verified corporate or VIP retail customers.
* **Debt Aging & Collection:** Real-time customer balance statements, aging receivables logs, and partial repayments.

### 3.6. Procurement & Vendor Management
* **Supplier Directory & AP Ledger:** Centralized database of authorized vendors, credit terms, and accounts payable balances.
* **Stock Receiving & PO Reconciliation:** Direct stock receiving updates inventory quantity and recalculates weighted average unit cost.

---

## 4. Comprehensive Business Intelligence & 18 Live Reports

The platform provides an executive reporting suite featuring **1-click instant CSV export** for accounting integration:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      18 ENTERPRISE LIVE REPORTS                        │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ SALES & REVENUE          │ INVENTORY & MOVEMENTS   │ FINANCIAL CONTROL │
│ 1. Daily Sales Summary   │ 6. Stock Valuation      │ 9. Cashier Shift  │
│ 2. Daily Sales Details   │ 7. Low Stock Alerts     │ 10. Profit Margin │
│ 3. Daybook Journal       │ 8. Stock Movement Trail │ 11. Customer Due  │
│ 4. Daily Purchase Total  │ 14. Sales Return Report │ 12. Supplier Due  │
│ 5. Purchase Details      │ 15. Top Selling SKUs    │ 13. VAT / Tax Log │
│ 16. Payment Breakdown    │ 17. Hourly Sales Trend  │ 18. Audit Logs    │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

1. **Daily Sales Summary:** Consolidated gross sales, discounts, net sales, and tax receipts.
2. **Daily Sales Details:** Microscopic item-by-item sales log with operator attribution.
3. **Daily Daybook (দৈনিক খতিয়ান):** Comprehensive financial audit journal of the entire business day.
4. **Daily Purchase Summary:** Aggregate daily procurement outlay and vendor payables.
5. **Daily Purchase Details:** Itemized breakdown of supplier deliveries and cost prices.
6. **Inventory Stock Valuation:** Real-time asset valuation comparing Total Cost vs. Potential Retail Value.
7. **Low Stock & Reorder Report:** Predictive reorder recommendations for inventory managers.
8. **Stock Movements & Ledger Audit:** Comprehensive chronological trail of all warehouse and shop alterations.
9. **Cashier Shift Variance Report:** Cash drawer reconciliation logs with Over/Short variance analytics.
10. **Product Profit Margin Analysis:** Gross profit and margin percentages per SKU and category.
11. **Customer Due & Aging Balances:** Receivables tracking and customer debt aging.
12. **Supplier Outstanding Balances:** Accounts payable obligations by vendor.
13. **Tax / VAT Collection Report:** Detailed government VAT and tax liability summary.
14. **Sales Returns & Refund Breakdown:** Product defect tracking and refund reasons.
15. **Top Selling Products:** Performance ranking by sales volume and gross revenue.
16. **Payment Tender Breakdown:** Visual and tabular distribution across Cash, Card, bKash, and Nagad.
17. **Hourly Traffic & Sales Velocity:** Peak-hour sales density to optimize cashier staffing schedules.
18. **Security Audit Trail & Event Logs:** Tamper-evident ledger of user logins, price overrides, stock edits, and configuration changes.

---

## 5. Security & Governance Scorecard

Built to achieve **100% first-pass approval** across institutional security and penetration tests:

| Audit Domain | Implementation Standard | Compliance Verification |
|---|---|---|
| **SQL Injection (SQLi)** | 100% Prepared Statements via Parameterized Adapters | Zero dynamic SQL string concatenation across all endpoints. |
| **Cross-Site Scripting (XSS)** | React JSX Sanitization + Helmet CSP | Automatic HTML escaping; strict HTTP Content-Security headers. |
| **Authentication Standard** | Signed HMAC-SHA256 JWT Tokens | Cryptographic claims validation with bounded session expiration. |
| **Credential Storage** | Salted `bcrypt` (10 rounds) | Plain-text passwords never stored or logged in memory. |
| **Brute-Force Mitigation** | Sliding-window IP Rate Limiting | `express-rate-limit` throttles brute-force attempts on auth routes. |
| **Denial of Service (DoS)** | Strict 1MB Payload Ceiling | Eliminates memory-exhaustion via oversized request bodies. |
| **Audit Traceability** | `X-Request-Id` UUID Injection | Correlates incoming network requests with immutable audit logs. |
| **Access Control (RBAC)** | Role-Segregated Authorization | Distinct privileges for `admin`, `manager`, `cashier`, `inventory`. |

---

## 6. Deployment Architecture & DevOps Readiness

### 6.1. Unified Full-Stack Cloud Service (Render.com)
The platform is designed to run as a **single unified high-performance web service**, serving both the compiled React SPA and Express REST API from a single port:
* **Zero CORS Configuration:** Eliminates browser cross-origin pre-flight latencies.
* **Infrastructure-as-Code (`render.yaml`):** Provisions Node.js web services, environment configurations, and health checks automatically.
* **Auto-Healing Schema Migration:** On boot, the service automatically executes schema verification and seeds baseline demo data without manual intervention.

### 6.2. Production Deployment Matrix

```bash
# Production Build & Execution Pipeline
git clone https://github.com/mdshofiuddin/pos.git
cd pos

# Install all workspace dependencies
npm install

# Build client SPA and compile TypeScript backend
npm run build

# Start production server
npm start
```

---

## 7. Role-Based Access Control (RBAC) Matrix

| Module / Operation | Admin | Manager | Cashier | Inventory Specialist |
|---|:---:|:---:|:---:|:---:|
| **POS Terminal & Checkout** | ✅ | ✅ | ✅ | ❌ |
| **Hold / Retrieve Tickets** | ✅ | ✅ | ✅ | ❌ |
| **Reprint Thermal Receipts** | ✅ | ✅ | ✅ | ❌ |
| **Shift Float & Cash Count** | ✅ | ✅ | ✅ | ❌ |
| **Product Cost Price Visibility** | ✅ | ✅ | ❌ | ✅ |
| **Inventory Adjustments / Scrap** | ✅ | ✅ | ❌ | ✅ |
| **Supplier POs & Receiving** | ✅ | ✅ | ❌ | ✅ |
| **Customer Credit Limit Edits** | ✅ | ✅ | ❌ | ❌ |
| **Financial & Profit Reports** | ✅ | ✅ | ❌ | ❌ |
| **System Audit Logs & Users** | ✅ | ❌ | ❌ | ❌ |

---

*Authored for enterprise presentation, technical audit documentation, and executive procurement.*
