# AI Coding Assistant Guidelines & Project Architecture (CLAUDE.md)

This document provides autonomous coding assistants and developers with architectural context, code conventions, directory hierarchy, and build/test workflows for the **Enterprise Retail Point of Sale (POS) & ERP Solution**.

---

## 1. Architectural Philosophy & Principles

- **Zero-Reload SPA:** The entire cashier and administrative interface runs on React Vite with zero full-page refreshes. All route navigation and data mutations occur asynchronously.
- **Layered Domain-Driven Backend:** The Express.js backend strictly separates responsibilities:
  - `src/modules/*`: Domain feature routers and business logic handlers
  - `src/middleware/*`: Authentication, RBAC, input sanitization, rate limiting, and request correlation
  - `src/db/contract/*`: Database interface contracts
  - `src/db/adapters/*`: Database implementation engines (SQLite, PostgreSQL, MySQL)
  - `src/db/migrations/*`: Auto-bootstrapping schema migration scripts
- **Security-First (OWASP Defense-in-Depth):**
  - All SQL queries MUST use parameterized inputs (`?` placeholders). Never concatenate strings into queries.
  - All input payloads MUST be validated via Zod schemas.
  - All mutating endpoints MUST be protected with JWT authentication and Role-Based Access Control (RBAC).
  - Every transaction and administrative action MUST record an immutable audit log entry.

---

## 2. Directory Hierarchy Map

```
pos/
├── apps/
│   ├── api/                           # Backend Express REST API
│   │   ├── src/
│   │   │   ├── config/                # Environment variables and shop settings
│   │   │   ├── db/
│   │   │   │   ├── adapters/          # Database adapters (e.g. SQLite adapter)
│   │   │   │   ├── contract/          # IDatabase interface definition
│   │   │   │   ├── migrations/        # schema.sql, schemaSql.ts, migrate.ts
│   │   │   │   └── seed/              # seedRunner.ts (initial catalog, users, demo data)
│   │   │   ├── middleware/            # authMiddleware, errorHandler, auditHelper
│   │   │   ├── modules/               # Domain feature modules:
│   │   │   │   ├── auth/              # Login, token refresh, logout, profile
│   │   │   │   ├── cash-sessions/     # Shift float, drawer variance reconciliation
│   │   │   │   ├── catalog/           # Products, categories, units, barcodes
│   │   │   │   ├── customers/         # Customer profiles, credit limits, dues
│   │   │   │   ├── inventory/         # Stock balances, stock adjustments, ledger
│   │   │   │   ├── pos/               # Fast checkout, idempotency key processing
│   │   │   │   ├── purchasing/        # Suppliers, purchase orders, goods receipt
│   │   │   │   ├── reports/           # 18 Real-time business reports & daybooks
│   │   │   │   ├── returns/           # Sales return, refunds, restocking
│   │   │   │   ├── sales/             # Invoice history, invoice reprinting, voids
│   │   │   │   ├── settings/          # Shop configuration, tax rates, printer width
│   │   │   │   └── users/             # User management, role permissions
│   │   │   ├── app.ts                 # Express application & SPA static file server
│   │   │   └── server.ts              # Server bootstrapper, auto-migrations, listener
│   │   └── tsconfig.json
│   └── web/                           # Frontend React Single Page Application (Vite)
│       ├── public/                    # Icons, manifest, logos
│       ├── src/
│       │   ├── api/                   # API client (apiRequest, auth interceptors)
│       │   ├── components/            # Reusable UI widgets (e.g. ThermalReceiptModal)
│       │   ├── features/              # UI screens corresponding to domain modules
│       │   ├── types/                 # TypeScript interfaces and entity models
│       │   ├── App.css                # Enterprise dark/light design system
│       │   ├── App.tsx                # Main SPA layout, keyboard hotkeys & nav tabs
│       │   ├── index.css              # Reset & print styles (@media print)
│       │   └── main.tsx               # Client entry point
│       └── vite.config.ts
├── database/
│   ├── schema.sql                     # Full DDL schema script
│   └── seed.sql                       # Full initial demo seed SQL script
├── Dockerfile                         # Production multi-stage Docker container
├── docker-compose.yml                 # 1-command container deployment orchestration
├── render.yaml                        # Render.com cloud deployment blueprint
├── appsettings.example.json           # Configuration template reference
├── HowToSetup.md                      # Comprehensive VPS and Docker setup guide
├── CHANGELOG.md                       # Semantic version release log
└── package.json                       # Monorepo root management scripts
```

---

## 3. Coding Conventions & Standards

- **TypeScript:** Strict mode enabled (`"strict": true`). Explicit type definitions for function signatures and API responses.
- **SQL Queries:** Always use parameterized SQL statements. In SQLite, use single quotes `'...'` for string literals, and double quotes `"..."` only for column/table identifiers.
- **Error Handling:** Standardized API error envelopes:
  ```json
  {
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "User-friendly explanation of the error."
    },
    "meta": {
      "requestId": "uuid",
      "timestamp": "ISO-8601"
    }
  }
  ```
- **Financial Numbers:** Store monetary values as decimals with 2 decimal places precision (`REAL` in SQLite / `NUMERIC(12,2)` in PostgreSQL). Always round tax and total calculations explicitly.
- **Idempotency:** POS checkout endpoints require a unique `X-Idempotency-Key` or request body key to guarantee transactions are processed exactly once.

---

## 4. Development & Build Commands

```bash
# Install all dependencies across both apps
npm install

# Start local development servers
npm run dev:api     # Backend API on http://localhost:5000
npm run dev:web     # Frontend UI on http://localhost:5173

# Re-run database migrations and seed data
npm run seed

# Build production bundle (client SPA + compiled API dist)
npm run build

# Start production server
npm start
```
