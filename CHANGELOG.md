# Changelog

All notable changes to the **Enterprise Point of Sale (POS) & ERP Solution** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-22

### Added
- **Zero-Reload SPA Frontend:**
  - Modern Single Page Application built with React 19, TypeScript, and Vite.
  - POS Cashier Terminal with hardware laser/CCD barcode scanner auto-detection.
  - Ergonomic keyboard shortcuts (`F2` Search, `F4` Checkout, `F7` Hold, `F8` Retrieve, `F9` New Sale, `Esc` Cancel).
  - Multi-tender split payment modal supporting Cash, Card, bKash, Nagad, and Customer Due.
  - Compact thermal receipt printing component supporting standard 58mm and 80mm roll printers.
- **Enterprise Express.js REST API:**
  - OWASP defense-in-depth security suite using Helmet, express-rate-limit, and strict CORS.
  - JWT authentication with cryptographically hashed passwords (`bcrypt` cost factor 10).
  - Role-Based Access Control (RBAC) supporting `admin`, `manager`, `cashier`, and `inventory` roles.
  - Cryptographic idempotency keys on checkout endpoints to prevent double-charging and race conditions.
  - End-to-end `X-Request-Id` request tracing and tamper-evident immutable audit logging.
- **Database Architecture:**
  - Database-agnostic adapter architecture with default native SQLite adapter.
  - Automated schema migration and initial seed data bootstrapper (`database/schema.sql` and `database/seed.sql`).
  - Double-entry immutable stock movements ledger tracking every stock alteration.
  - Cashier shift sessions with expected cash vs. counted cash drawer variance auditing.
- **Business Intelligence & Reporting:**
  - 18 comprehensive real-time reports with 1-click instant CSV export.
  - Daily Sales Summary & Details, Daily Daybook, Purchases, Margins, Dues, and Taxes.
- **DevOps & Cloud Deployment:**
  - Native Render Blueprint (`render.yaml`) for 1-click cloud deployment.
  - Multi-stage production `Dockerfile` and `docker-compose.yml`.
  - Comprehensive deployment documentation (`HowToSetup.md`, `CLAUDE.md`, `appsettings.example.json`).
