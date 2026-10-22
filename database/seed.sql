-- ==========================================================
-- Enterprise Point of Sale (POS) Database Seed Data
-- ==========================================================

-- 1. Company & Branch
INSERT OR IGNORE INTO companies (id, name, code, tax_number, address, phone, email, currency_code, currency_symbol)
VALUES ('comp-01', 'Apex Mart Superstore', 'APEX-01', 'BIN-003847291-01', 'Plot 42, Block C, Gulshan-1, Dhaka-1212', '+880 1712-998877', 'sales@apexmart.com.bd', 'BDT', '৳');

INSERT OR IGNORE INTO branches (id, company_id, name, code, address, phone, is_default, status)
VALUES ('branch-01', 'comp-01', 'Gulshan Flagship Store', 'GLS-01', 'Plot 42, Gulshan-1, Dhaka', '+880 1712-998877', 1, 'active');

-- 2. Roles
INSERT OR IGNORE INTO roles (id, name, description) VALUES
('role-admin', 'admin', 'Super Administrator with full access'),
('role-manager', 'manager', 'Store Manager (discounts, voids, reports)'),
('role-cashier', 'cashier', 'Cashier (POS checkout, sessions, reprint)'),
('role-inventory', 'inventory', 'Inventory Officer (stock & receiving)');

-- 3. Permissions
INSERT OR IGNORE INTO permissions (id, name, category, description) VALUES
('p1', 'pos:checkout', 'POS', 'Can execute POS sale checkout'),
('p2', 'pos:discount', 'POS', 'Can apply discounts at checkout'),
('p3', 'pos:void', 'POS', 'Can void invoices'),
('p4', 'pos:return', 'POS', 'Can process sale returns and refunds'),
('p5', 'pos:session', 'POS', 'Can open and close cashier sessions'),
('p6', 'catalog:read', 'Catalog', 'Can view products and prices'),
('p7', 'catalog:write', 'Catalog', 'Can create and edit products'),
('p8', 'inventory:read', 'Inventory', 'Can view stock balances and ledger'),
('p9', 'inventory:adjust', 'Inventory', 'Can perform stock adjustments'),
('p10', 'purchases:read', 'Purchasing', 'Can view purchase orders'),
('p11', 'purchases:write', 'Purchasing', 'Can create purchases and goods receipts'),
('p12', 'customers:read', 'Customers', 'Can view customers & dues'),
('p13', 'customers:write', 'Customers', 'Can manage customers and credit payments'),
('p14', 'reports:read', 'Reports', 'Can view financial and operational reports'),
('p15', 'users:manage', 'Admin', 'Can manage user accounts and roles'),
('p16', 'settings:manage', 'Admin', 'Can update store settings'),
('p17', 'audit:read', 'Security', 'Can inspect security & system audit trails');

-- Role Permissions Mapping
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-admin', 'p1'), ('role-admin', 'p2'), ('role-admin', 'p3'), ('role-admin', 'p4'),
('role-admin', 'p5'), ('role-admin', 'p6'), ('role-admin', 'p7'), ('role-admin', 'p8'),
('role-admin', 'p9'), ('role-admin', 'p10'), ('role-admin', 'p11'), ('role-admin', 'p12'),
('role-admin', 'p13'), ('role-admin', 'p14'), ('role-admin', 'p15'), ('role-admin', 'p16'), ('role-admin', 'p17'),
('role-manager', 'p1'), ('role-manager', 'p2'), ('role-manager', 'p3'), ('role-manager', 'p4'),
('role-manager', 'p5'), ('role-manager', 'p6'), ('role-manager', 'p7'), ('role-manager', 'p8'),
('role-manager', 'p9'), ('role-manager', 'p10'), ('role-manager', 'p11'), ('role-manager', 'p12'),
('role-manager', 'p13'), ('role-manager', 'p14'), ('role-manager', 'p17'),
('role-cashier', 'p1'), ('role-cashier', 'p4'), ('role-cashier', 'p5'), ('role-cashier', 'p6'),
('role-cashier', 'p8'), ('role-cashier', 'p12'),
('role-inventory', 'p6'), ('role-inventory', 'p7'), ('role-inventory', 'p8'), ('role-inventory', 'p9'),
('role-inventory', 'p10'), ('role-inventory', 'p11');

-- 4. Initial Users (passwords: Admin@123456, Manager@123456, Cashier@123456, Inventory@123456)
-- Bcrypt hashes generated with standard cost factor 10
INSERT OR IGNORE INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status) VALUES
('usr-admin', 'branch-01', 'admin', 'admin@apexmart.com', 'System Administrator', '$2a$10$wTf7hKq4Zf0m473rQeH9vO30y.mY7Qc6gJmQ.rS8sYyX0q8m6gq9a', 'role-admin', 'active'),
('usr-mgr', 'branch-01', 'manager', 'manager@apexmart.com', 'Kazi Jahangir (Store Manager)', '$2a$10$wTf7hKq4Zf0m473rQeH9vO30y.mY7Qc6gJmQ.rS8sYyX0q8m6gq9a', 'role-manager', 'active'),
('usr-cashier', 'branch-01', 'cashier', 'cashier@apexmart.com', 'Nazmul Hasan (Cashier)', '$2a$10$wTf7hKq4Zf0m473rQeH9vO30y.mY7Qc6gJmQ.rS8sYyX0q8m6gq9a', 'role-cashier', 'active'),
('usr-inv', 'branch-01', 'inventory', 'inventory@apexmart.com', 'Sohail Rana (Stock In-charge)', '$2a$10$wTf7hKq4Zf0m473rQeH9vO30y.mY7Qc6gJmQ.rS8sYyX0q8m6gq9a', 'role-inventory', 'active');

-- 5. Units
INSERT OR IGNORE INTO units (id, name, short_name) VALUES
('u-pcs', 'Piece', 'pcs'),
('u-kg', 'Kilogram', 'kg'),
('u-ltr', 'Litre', 'ltr'),
('u-pkt', 'Packet', 'pkt'),
('u-box', 'Box', 'box');

-- 6. Categories
INSERT OR IGNORE INTO categories (id, name, code, description) VALUES
('cat-bev', 'Beverages', 'BEV', 'Soft drinks, juices, bottled water'),
('cat-gro', 'Groceries & Staples', 'GRO', 'Rice, oil, spices, flour, sugar'),
('cat-bak', 'Bakery & Snacks', 'BAK', 'Biscuits, chips, chocolates, bread'),
('cat-dai', 'Dairy & Breakfast', 'DAI', 'Milk, cheese, butter, eggs'),
('cat-per', 'Personal Care', 'PER', 'Soap, shampoo, toothpaste, skincare'),
('cat-ele', 'Electronics & Home', 'ELE', 'Batteries, cables, flash drives, cleaners');

-- 7. Products (Retail Catalog with Barcodes)
INSERT OR IGNORE INTO products (id, branch_id, category_id, unit_id, sku, barcode, name, description, cost_price, selling_price, min_stock_threshold, max_stock_threshold, tax_rate, is_active) VALUES
('prd-01', 'branch-01', 'cat-bev', 'u-pcs', 'BEV-CC500', '89411001001', 'Coca Cola 500ml Bottle', 'Coca Cola 500ml Bottle - Retail Pack', 32, 40, 20, 200, 5, 1),
('prd-02', 'branch-01', 'cat-bev', 'u-pcs', 'BEV-PF250', '89411001002', 'Pran Frooto Mango 250ml', 'Pran Frooto Mango 250ml - Retail Pack', 20, 25, 25, 150, 5, 1),
('prd-03', 'branch-01', 'cat-bak', 'u-pcs', 'BAK-KIT4F', '89411001003', 'Nestlé KitKat 4-Finger 45g', 'Nestlé KitKat 4-Finger 45g - Retail Pack', 75, 95, 15, 100, 5, 1),
('prd-04', 'branch-01', 'cat-dai', 'u-ltr', 'DAI-ARNG1L', '89411001004', 'Aarong Dairy Pure Milk 1L', 'Aarong Dairy Pure Milk 1L - Retail Pack', 72, 90, 10, 80, 0, 1),
('prd-05', 'branch-01', 'cat-gro', 'u-pkt', 'GRO-MNK5KG', '89411001005', 'Miniket Premium Rice 5kg', 'Miniket Premium Rice 5kg - Retail Pack', 340, 395, 10, 50, 0, 1),
('prd-06', 'branch-01', 'cat-gro', 'u-pcs', 'GRO-TEER2L', '89411001006', 'Teer Fortified Soybean Oil 2L', 'Teer Fortified Soybean Oil 2L - Retail Pack', 290, 335, 12, 60, 5, 1),
('prd-07', 'branch-01', 'cat-dai', 'u-pkt', 'DAI-DANO500', '89411001007', 'Dano Daily Pushti Milk 500g', 'Dano Daily Pushti Milk 500g - Retail Pack', 360, 420, 10, 50, 5, 1),
('prd-08', 'branch-01', 'cat-gro', 'u-pkt', 'GRO-MAG8PK', '89411001008', 'Maggi 2-Minute Noodles 8-Pack', 'Maggi 2-Minute Noodles 8-Pack - Retail Pack', 140, 165, 15, 80, 5, 1),
('prd-09', 'branch-01', 'cat-gro', 'u-pkt', 'GRO-RAD200', '89411001009', 'Radhuni Pure Turmeric 200g', 'Radhuni Pure Turmeric 200g - Retail Pack', 80, 98, 10, 60, 5, 1),
('prd-10', 'branch-01', 'cat-bak', 'u-pkt', 'BAK-LAYS50', '89411001010', 'Lays Potato Chips Spanish 50g', 'Lays Potato Chips Spanish 50g - Retail Pack', 30, 40, 20, 120, 5, 1),
('prd-11', 'branch-01', 'cat-per', 'u-pcs', 'PER-DOVE100', '89411001011', 'Dove Beauty Cream Soap 100g', 'Dove Beauty Cream Soap 100g - Retail Pack', 110, 135, 15, 90, 5, 1),
('prd-12', 'branch-01', 'cat-per', 'u-pcs', 'PER-HS180', '89411001012', 'Head & Shoulders Shampoo 180ml', 'Head & Shoulders Shampoo 180ml - Retail Pack', 240, 285, 10, 60, 5, 1),
('prd-13', 'branch-01', 'cat-per', 'u-pcs', 'PER-DET200', '89411001013', 'Dettol Original Handwash 200ml', 'Dettol Original Handwash 200ml - Retail Pack', 95, 115, 12, 70, 5, 1),
('prd-14', 'branch-01', 'cat-per', 'u-pcs', 'PER-PEP140', '89411001014', 'Pepsodent Expert Protection 140g', 'Pepsodent Expert Protection 140g - Retail Pack', 125, 150, 15, 80, 5, 1),
('prd-15', 'branch-01', 'cat-ele', 'u-pkt', 'ELE-DUR2AA', '89411001015', 'Duracell AA Alkaline 2-Pack', 'Duracell AA Alkaline 2-Pack - Retail Pack', 130, 170, 10, 60, 5, 1),
('prd-16', 'branch-01', 'cat-ele', 'u-pcs', 'ELE-SD64GB', '89411001016', 'SanDisk 64GB USB 3.0 Drive', 'SanDisk 64GB USB 3.0 Drive - Retail Pack', 450, 580, 5, 30, 5, 1),
('prd-17', 'branch-01', 'cat-bak', 'u-pcs', 'BAK-BRD400', '89411001017', 'Fresh Premium White Bread 400g', 'Fresh Premium White Bread 400g - Retail Pack', 45, 60, 10, 40, 0, 1),
('prd-18', 'branch-01', 'cat-dai', 'u-box', 'DAI-EGG12', '89411001018', 'Farm Fresh Brown Eggs 12-Pack', 'Farm Fresh Brown Eggs 12-Pack - Retail Pack', 125, 155, 12, 50, 0, 1),
('prd-19', 'branch-01', 'cat-ele', 'u-pcs', 'ELE-HAR750', '89411001019', 'Harpic Power Plus 750ml', 'Harpic Power Plus 750ml - Retail Pack', 145, 175, 10, 50, 5, 1),
('prd-20', 'branch-01', 'cat-bev', 'u-pcs', 'BEV-NES50G', '89411001020', 'Nescafe Classic Instant Coffee 50g', 'Nescafe Classic Instant Coffee 50g - Retail Pack', 230, 275, 8, 40, 5, 1);

-- 8. Stock Balances
INSERT OR IGNORE INTO stock_balances (id, branch_id, product_id, current_stock, last_reconciled_at, version) VALUES
('sb-prd-01', 'branch-01', 'prd-01', 95, datetime('now'), 1),
('sb-prd-02', 'branch-01', 'prd-02', 72, datetime('now'), 1),
('sb-prd-03', 'branch-01', 'prd-03', 48, datetime('now'), 1),
('sb-prd-04', 'branch-01', 'prd-04', 35, datetime('now'), 1),
('sb-prd-05', 'branch-01', 'prd-05', 24, datetime('now'), 1),
('sb-prd-06', 'branch-01', 'prd-06', 28, datetime('now'), 1),
('sb-prd-07', 'branch-01', 'prd-07', 32, datetime('now'), 1),
('sb-prd-08', 'branch-01', 'prd-08', 45, datetime('now'), 1),
('sb-prd-09', 'branch-01', 'prd-09', 50, datetime('now'), 1),
('sb-prd-10', 'branch-01', 'prd-10', 65, datetime('now'), 1),
('sb-prd-11', 'branch-01', 'prd-11', 40, datetime('now'), 1),
('sb-prd-12', 'branch-01', 'prd-12', 22, datetime('now'), 1),
('sb-prd-13', 'branch-01', 'prd-13', 38, datetime('now'), 1),
('sb-prd-14', 'branch-01', 'prd-14', 44, datetime('now'), 1),
('sb-prd-15', 'branch-01', 'prd-15', 30, datetime('now'), 1),
('sb-prd-16', 'branch-01', 'prd-16', 12, datetime('now'), 1),
('sb-prd-17', 'branch-01', 'prd-17', 4, datetime('now'), 1),
('sb-prd-18', 'branch-01', 'prd-18', 2, datetime('now'), 1),
('sb-prd-19', 'branch-01', 'prd-19', 26, datetime('now'), 1),
('sb-prd-20', 'branch-01', 'prd-20', 18, datetime('now'), 1);

-- 9. Suppliers
INSERT OR IGNORE INTO suppliers (id, name, company_name, phone, email, address, total_purchased, total_paid, total_payable, is_active) VALUES
('sup-01', 'Kazi Mahbub', 'Meghna Distribution Network', '+880 1711-223344', 'supply@meghna.com', 'Tejgaon I/A, Dhaka', 145000, 120000, 25000, 1),
('sup-02', 'Rafiqul Islam', 'Pran Logistics & Food Supply', '+880 1722-334455', 'orders@pranfoods.net', 'Badda, Dhaka', 82000, 82000, 0, 1),
('sup-03', 'Anisur Rahman', 'Unilever Bangladesh C&F', '+880 1733-445566', 'dist@unilever.bd', 'Tongi, Gazipur', 210000, 195000, 15000, 1),
('sup-04', 'Shafiqul Alam', 'Nestlé Bangladesh Distributor', '+880 1744-556677', 'sales@nestledist.com', 'Gulshan-2, Dhaka', 94000, 94000, 0, 1);

-- 10. Customers
INSERT OR IGNORE INTO customers (id, branch_id, name, phone, email, address, credit_limit, current_due, loyalty_points, is_active) VALUES
('cust-walkin', 'branch-01', 'Walk-in Customer', '01000000000', 'walkin@store.local', 'In-Store', 0, 0, 0, 1),
('cust-01', 'branch-01', 'Tanvir Ahmed', '+880 1812-345678', 'tanvir@gmail.com', 'House 14, Road 5, Gulshan-1', 15000, 1250, 150, 1),
('cust-02', 'branch-01', 'Farhana Rahman', '+880 1912-345678', 'farhana.r@yahoo.com', 'Apartment 4B, Banani', 25000, 0, 280, 1),
('cust-03', 'branch-01', 'Md. Kamrul Hasan', '+880 1755-667788', 'kamrul.hasan@outlook.com', 'Mohakhali DOHS, Dhaka', 10000, 3400, 95, 1);

-- 11. Store Settings
INSERT OR IGNORE INTO settings (id, key, value, description) VALUES
('set-shop_name', 'shop_name', 'Apex Mart Superstore', 'Display Name on Receipts and POS'),
('set-shop_address', 'shop_address', 'Plot 42, Block C, Gulshan-1, Dhaka-1212', 'Shop Address'),
('set-shop_phone', 'shop_phone', '+880 1712-998877', 'Shop Contact Number'),
('set-vat_registration_number', 'vat_registration_number', 'BIN-003847291-01', 'Tax/VAT Registration No'),
('set-currency_code', 'currency_code', 'BDT', 'Currency Code'),
('set-currency_symbol', 'currency_symbol', '৳', 'Currency Symbol'),
('set-default_tax_rate', 'default_tax_rate', '5.0', 'Default VAT Rate (%)'),
('set-thermal_printer_size', 'thermal_printer_size', '58mm', 'Thermal Receipt Width (58mm or 80mm)'),
('set-receipt_footer_message', 'receipt_footer_message', 'Thank you for shopping with us! Please come again.', 'Receipt bottom text');
