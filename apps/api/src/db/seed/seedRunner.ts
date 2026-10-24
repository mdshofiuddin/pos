import bcrypt from 'bcryptjs';
import { runMigrations } from '../migrations/migrate.js';
import { getDb } from '../index.js';

export async function seedDatabase() {
  await runMigrations();
  console.log('[Seed] Seeding database with initial enterprise data...');

  const db = getDb();

  // Check if already seeded
  const existingUsers = await db.query<any>('SELECT COUNT(*) as count FROM users');
  if (existingUsers[0]?.count > 0) {
    console.log('[Seed] Database is already seeded. Skipping.');
    return;
  }

  // 1. Company & Branch
  const companyId = 'comp-01';
  const branchId = 'branch-01';

  await db.execute(
    `INSERT INTO companies (id, name, code, tax_number, address, phone, email, currency_code, currency_symbol)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      'Apex Mart Superstore',
      'APEX-01',
      'BIN-003847291-01',
      'Plot 42, Block C, Gulshan-1, Dhaka-1212',
      '+880 1712-998877',
      'sales@apexmart.com.bd',
      'BDT',
      '৳',
    ]
  );

  await db.execute(
    `INSERT INTO branches (id, company_id, name, code, address, phone, is_default, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      branchId,
      companyId,
      'Gulshan Flagship Store',
      'GLS-01',
      'Plot 42, Gulshan-1, Dhaka',
      '+880 1712-998877',
      1,
      'active',
    ]
  );

  // 2. Roles & Permissions
  const roles = [
    { id: 'role-admin', name: 'admin', description: 'Super Administrator with full access' },
    { id: 'role-manager', name: 'manager', description: 'Store Manager (discounts, voids, reports)' },
    { id: 'role-cashier', name: 'cashier', description: 'Cashier (POS checkout, sessions, reprint)' },
    { id: 'role-inventory', name: 'inventory', description: 'Inventory Officer (stock & receiving)' },
  ];

  for (const r of roles) {
    await db.execute('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)', [r.id, r.name, r.description]);
  }

  const permissions = [
    { id: 'p1', name: 'pos:checkout', category: 'POS', description: 'Can execute POS sale checkout' },
    { id: 'p2', name: 'pos:discount', category: 'POS', description: 'Can apply discounts at checkout' },
    { id: 'p3', name: 'pos:void', category: 'POS', description: 'Can void invoices' },
    { id: 'p4', name: 'pos:return', category: 'POS', description: 'Can process sale returns and refunds' },
    { id: 'p5', name: 'pos:session', category: 'POS', description: 'Can open and close cashier sessions' },
    { id: 'p6', name: 'catalog:read', category: 'Catalog', description: 'Can view products and prices' },
    { id: 'p7', name: 'catalog:write', category: 'Catalog', description: 'Can create and edit products' },
    { id: 'p8', name: 'inventory:read', category: 'Inventory', description: 'Can view stock balances and ledger' },
    { id: 'p9', name: 'inventory:adjust', category: 'Inventory', description: 'Can perform stock adjustments' },
    { id: 'p10', name: 'purchases:read', category: 'Purchasing', description: 'Can view purchase orders' },
    { id: 'p11', name: 'purchases:write', category: 'Purchasing', description: 'Can create purchases and goods receipts' },
    { id: 'p12', name: 'customers:read', category: 'Customers', description: 'Can view customers & dues' },
    { id: 'p13', name: 'customers:write', category: 'Customers', description: 'Can manage customers and credit payments' },
    { id: 'p14', name: 'reports:read', category: 'Reports', description: 'Can view financial and operational reports' },
    { id: 'p15', name: 'users:manage', category: 'Admin', description: 'Can manage user accounts and roles' },
    { id: 'p16', name: 'settings:manage', category: 'Admin', description: 'Can update store settings' },
    { id: 'p17', name: 'audit:read', category: 'Security', description: 'Can inspect security & system audit trails' },
    { id: 'p18', name: 'users.manage', category: 'Admin', description: 'Can manage user accounts and roles' },
    { id: 'p19', name: 'settings.manage', category: 'Admin', description: 'Can update store settings' },
    { id: 'p20', name: 'settings.view', category: 'Admin', description: 'Can view store settings' },
    { id: 'p21', name: 'catalog.manage', category: 'Catalog', description: 'Can create and edit products' },
    { id: 'p22', name: 'reports.view', category: 'Reports', description: 'Can view reports' },
    { id: 'p23', name: 'sessions.view_all', category: 'POS', description: 'Can view all cashier sessions' },
    { id: 'p24', name: 'sessions.manage', category: 'POS', description: 'Can manage and close cashier sessions' },
    { id: 'p25', name: 'returns.view_all', category: 'POS', description: 'Can view all return history' },
  ];

  for (const p of permissions) {
    await db.execute('INSERT INTO permissions (id, name, category, description) VALUES (?, ?, ?, ?)', [
      p.id,
      p.name,
      p.category,
      p.description,
    ]);
  }

  // Assign permissions:
  // Admin gets everything
  for (const p of permissions) {
    await db.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['role-admin', p.id]);
  }
  // Manager permissions
  const managerPerms = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p17', 'p20', 'p21', 'p22', 'p23', 'p24', 'p25'];
  for (const pid of managerPerms) {
    await db.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['role-manager', pid]);
  }
  // Cashier permissions
  const cashierPerms = ['p1', 'p4', 'p5', 'p6', 'p8', 'p12'];
  for (const pid of cashierPerms) {
    await db.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['role-cashier', pid]);
  }
  // Inventory permissions
  const invPerms = ['p6', 'p7', 'p8', 'p9', 'p10', 'p11'];
  for (const pid of invPerms) {
    await db.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', ['role-inventory', pid]);
  }

  // 3. Users (Hashed passwords with bcrypt 12 salt rounds)
  const passwordSalt = 12;
  const adminHash = await bcrypt.hash('AdminPassword@123', passwordSalt);
  const managerHash = await bcrypt.hash('ManagerPassword@123', passwordSalt);
  const cashierHash = await bcrypt.hash('CashierPassword@123', passwordSalt);
  const invHash = await bcrypt.hash('InventoryPassword@123', passwordSalt);

  await db.execute(
    `INSERT INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['usr-admin', branchId, 'admin', 'admin@apexmart.com', 'System Administrator', adminHash, 'role-admin', 'active']
  );

  await db.execute(
    `INSERT INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['usr-mgr', branchId, 'manager', 'manager@apexmart.com', 'Kazi Jahangir (Store Manager)', managerHash, 'role-manager', 'active']
  );

  await db.execute(
    `INSERT INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['usr-cashier', branchId, 'cashier', 'cashier@apexmart.com', 'Nazmul Hasan (Cashier)', cashierHash, 'role-cashier', 'active']
  );

  await db.execute(
    `INSERT INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['usr-inv', branchId, 'inventory', 'inventory@apexmart.com', 'Sohail Rana (Stock In-charge)', invHash, 'role-inventory', 'active']
  );

  // 4. Units
  const units = [
    { id: 'u-pcs', name: 'Piece', short: 'pcs' },
    { id: 'u-kg', name: 'Kilogram', short: 'kg' },
    { id: 'u-ltr', name: 'Litre', short: 'ltr' },
    { id: 'u-pkt', name: 'Packet', short: 'pkt' },
    { id: 'u-box', name: 'Box', short: 'box' },
  ];
  for (const u of units) {
    await db.execute('INSERT INTO units (id, name, short_name) VALUES (?, ?, ?)', [u.id, u.name, u.short]);
  }

  // 5. Categories
  const categories = [
    { id: 'cat-bev', name: 'Beverages', code: 'BEV', desc: 'Soft drinks, juices, bottled water' },
    { id: 'cat-gro', name: 'Groceries & Staples', code: 'GRO', desc: 'Rice, oil, spices, flour, sugar' },
    { id: 'cat-bak', name: 'Bakery & Snacks', code: 'BAK', desc: 'Biscuits, chips, chocolates, bread' },
    { id: 'cat-dai', name: 'Dairy & Breakfast', code: 'DAI', desc: 'Milk, cheese, butter, eggs' },
    { id: 'cat-per', name: 'Personal Care', code: 'PER', desc: 'Soap, shampoo, toothpaste, skincare' },
    { id: 'cat-ele', name: 'Electronics & Home', code: 'ELE', desc: 'Batteries, cables, flash drives, cleaners' },
  ];
  for (const c of categories) {
    await db.execute('INSERT INTO categories (id, name, code, description) VALUES (?, ?, ?, ?)', [
      c.id,
      c.name,
      c.code,
      c.desc,
    ]);
  }

  // 6. Products with realistic retail SKUs, barcodes, costs and prices
  const productData = [
    { id: 'prd-01', cat: 'cat-bev', unit: 'u-pcs', sku: 'BEV-CC500', bar: '89411001001', name: 'Coca Cola 500ml Bottle', cost: 32, sell: 40, min: 20, max: 200, tax: 5, stock: 95 },
    { id: 'prd-02', cat: 'cat-bev', unit: 'u-pcs', sku: 'BEV-PF250', bar: '89411001002', name: 'Pran Frooto Mango 250ml', cost: 20, sell: 25, min: 25, max: 150, tax: 5, stock: 72 },
    { id: 'prd-03', cat: 'cat-bak', unit: 'u-pcs', sku: 'BAK-KIT4F', bar: '89411001003', name: 'Nestlé KitKat 4-Finger 45g', cost: 75, sell: 95, min: 15, max: 100, tax: 5, stock: 48 },
    { id: 'prd-04', cat: 'cat-dai', unit: 'u-ltr', sku: 'DAI-ARNG1L', bar: '89411001004', name: 'Aarong Dairy Pure Milk 1L', cost: 72, sell: 90, min: 10, max: 80, tax: 0, stock: 35 },
    { id: 'prd-05', cat: 'cat-gro', unit: 'u-pkt', sku: 'GRO-MNK5KG', bar: '89411001005', name: 'Miniket Premium Rice 5kg', cost: 340, sell: 395, min: 10, max: 50, tax: 0, stock: 24 },
    { id: 'prd-06', cat: 'cat-gro', unit: 'u-pcs', sku: 'GRO-TEER2L', bar: '89411001006', name: 'Teer Fortified Soybean Oil 2L', cost: 290, sell: 335, min: 12, max: 60, tax: 5, stock: 28 },
    { id: 'prd-07', cat: 'cat-dai', unit: 'u-pkt', sku: 'DAI-DANO500', bar: '89411001007', name: 'Dano Daily Pushti Milk 500g', cost: 360, sell: 420, min: 10, max: 50, tax: 5, stock: 32 },
    { id: 'prd-08', cat: 'cat-gro', unit: 'u-pkt', sku: 'GRO-MAG8PK', bar: '89411001008', name: 'Maggi 2-Minute Noodles 8-Pack', cost: 140, sell: 165, min: 15, max: 80, tax: 5, stock: 45 },
    { id: 'prd-09', cat: 'cat-gro', unit: 'u-pkt', sku: 'GRO-RAD200', bar: '89411001009', name: 'Radhuni Pure Turmeric 200g', cost: 80, sell: 98, min: 10, max: 60, tax: 5, stock: 50 },
    { id: 'prd-10', cat: 'cat-bak', unit: 'u-pkt', sku: 'BAK-LAYS50', bar: '89411001010', name: 'Lays Potato Chips Spanish 50g', cost: 30, sell: 40, min: 20, max: 120, tax: 5, stock: 65 },
    { id: 'prd-11', cat: 'cat-per', unit: 'u-pcs', sku: 'PER-DOVE100', bar: '89411001011', name: 'Dove Beauty Cream Soap 100g', cost: 110, sell: 135, min: 15, max: 90, tax: 5, stock: 40 },
    { id: 'prd-12', cat: 'cat-per', unit: 'u-pcs', sku: 'PER-HS180', bar: '89411001012', name: 'Head & Shoulders Shampoo 180ml', cost: 240, sell: 285, min: 10, max: 60, tax: 5, stock: 22 },
    { id: 'prd-13', cat: 'cat-per', unit: 'u-pcs', sku: 'PER-DET200', bar: '89411001013', name: 'Dettol Original Handwash 200ml', cost: 95, sell: 115, min: 12, max: 70, tax: 5, stock: 38 },
    { id: 'prd-14', cat: 'cat-per', unit: 'u-pcs', sku: 'PER-PEP140', bar: '89411001014', name: 'Pepsodent Expert Protection 140g', cost: 125, sell: 150, min: 15, max: 80, tax: 5, stock: 44 },
    { id: 'prd-15', cat: 'cat-ele', unit: 'u-pkt', sku: 'ELE-DUR2AA', bar: '89411001015', name: 'Duracell AA Alkaline 2-Pack', cost: 130, sell: 170, min: 10, max: 60, tax: 5, stock: 30 },
    { id: 'prd-16', cat: 'cat-ele', unit: 'u-pcs', sku: 'ELE-SD64GB', bar: '89411001016', name: 'SanDisk 64GB USB 3.0 Drive', cost: 450, sell: 580, min: 5, max: 30, tax: 5, stock: 12 },
    { id: 'prd-17', cat: 'cat-bak', unit: 'u-pcs', sku: 'BAK-BRD400', bar: '89411001017', name: 'Fresh Premium White Bread 400g', cost: 45, sell: 60, min: 10, max: 40, tax: 0, stock: 4 }, // Low stock trigger
    { id: 'prd-18', cat: 'cat-dai', unit: 'u-box', sku: 'DAI-EGG12', bar: '89411001018', name: 'Farm Fresh Brown Eggs 12-Pack', cost: 125, sell: 155, min: 12, max: 50, tax: 0, stock: 2 }, // Low stock trigger
    { id: 'prd-19', cat: 'cat-ele', unit: 'u-pcs', sku: 'ELE-HAR750', bar: '89411001019', name: 'Harpic Power Plus 750ml', cost: 145, sell: 175, min: 10, max: 50, tax: 5, stock: 26 },
    { id: 'prd-20', cat: 'cat-bev', unit: 'u-pcs', sku: 'BEV-NES50G', bar: '89411001020', name: 'Nescafe Classic Instant Coffee 50g', cost: 230, sell: 275, min: 8, max: 40, tax: 5, stock: 18 },
  ];

  for (const p of productData) {
    await db.execute(
      `INSERT INTO products (id, branch_id, category_id, unit_id, sku, barcode, name, description, cost_price, selling_price, min_stock_threshold, max_stock_threshold, tax_rate, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        p.id,
        branchId,
        p.cat,
        p.unit,
        p.sku,
        p.bar,
        p.name,
        `${p.name} - Retail Pack`,
        p.cost,
        p.sell,
        p.min,
        p.max,
        p.tax,
      ]
    );

    // Initial stock balance
    await db.execute(
      `INSERT INTO stock_balances (id, branch_id, product_id, current_stock, last_reconciled_at, version)
       VALUES (?, ?, ?, ?, datetime('now'), 1)`,
      [`sb-${p.id}`, branchId, p.id, p.stock]
    );

    // Append-only stock movement ledger
    await db.execute(
      `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
       VALUES (?, ?, ?, ?, 'OPENING', 'system_init', 'init-batch-01', ?, 'Opening inventory stock initialization', 'usr-admin')`,
      [`sm-init-${p.id}`, branchId, p.id, p.stock, p.cost]
    );
  }

  // 7. Suppliers
  const suppliers = [
    { id: 'sup-01', name: 'Kazi Mahbub', comp: 'Meghna Distribution Network', phone: '+880 1711-223344', email: 'supply@meghna.com', addr: 'Tejgaon I/A, Dhaka' },
    { id: 'sup-02', name: 'Rafiqul Islam', comp: 'Pran Logistics & Food Supply', phone: '+880 1722-334455', email: 'orders@pranfoods.net', addr: 'Badda, Dhaka' },
    { id: 'sup-03', name: 'Anisur Rahman', comp: 'Unilever Bangladesh C&F', phone: '+880 1733-445566', email: 'dist@unilever.bd', addr: 'Tongi, Gazipur' },
    { id: 'sup-04', name: 'Shafiqul Alam', comp: 'Nestlé Bangladesh Distributor', phone: '+880 1744-556677', email: 'sales@nestledist.com', addr: 'Gulshan-2, Dhaka' },
  ];

  for (const s of suppliers) {
    await db.execute(
      `INSERT INTO suppliers (id, name, company_name, phone, email, address, total_purchased, total_paid, total_payable, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 1)`,
      [s.id, s.name, s.comp, s.phone, s.email, s.addr]
    );
  }

  // 8. Customers
  const customers = [
    { id: 'cust-walkin', name: 'Walk-in Customer', phone: '01000000000', email: 'walkin@store.local', addr: 'In-Store', limit: 0, due: 0 },
    { id: 'cust-01', name: 'Tanvir Ahmed', phone: '+880 1812-345678', email: 'tanvir@gmail.com', addr: 'House 14, Road 5, Gulshan-1', limit: 15000, due: 1250 },
    { id: 'cust-02', name: 'Farhana Rahman', phone: '+880 1912-345678', email: 'farhana.r@yahoo.com', addr: 'Apartment 4B, Banani', limit: 25000, due: 0 },
    { id: 'cust-03', name: 'Md. Kamrul Hasan', phone: '+880 1755-667788', email: 'kamrul.hasan@outlook.com', addr: 'Mohakhali DOHS, Dhaka', limit: 10000, due: 3400 },
  ];

  for (const c of customers) {
    await db.execute(
      `INSERT INTO customers (id, branch_id, name, phone, email, address, credit_limit, current_due, loyalty_points, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 120, 1)`,
      [c.id, branchId, c.name, c.phone, c.email, c.addr, c.limit, c.due]
    );
  }

  // 9. Initial Cash Session
  const sessionId = 'cs-today-01';
  await db.execute(
    `INSERT INTO cash_sessions (id, branch_id, user_id, opening_time, opening_cash, total_cash_sales, total_cash_refunds, total_cash_in, total_cash_out, expected_cash, status, notes)
     VALUES (?, ?, ?, datetime('now', '-5 hours'), 5000.0, 0, 0, 0, 0, 5000.0, 'open', 'Morning Shift Cash Session')`,
    [sessionId, branchId, 'usr-cashier']
  );

  // 10. Sample Sales to populate reports initially
  // Sale 1
  const sale1Id = 'sale-seed-01';
  await db.execute(
    `INSERT INTO sales (id, invoice_number, branch_id, user_id, customer_id, session_id, subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount, rounding_amount, grand_total, paid_amount, change_amount, payment_status, sale_status, notes, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'none', 0, 0, 5, ?, 0, ?, ?, 0, 'paid', 'completed', 'Counter Sale', 'seed-idem-1', datetime('now', '-3 hours'))`,
    [sale1Id, 'INV-2026-0001', branchId, 'usr-cashier', 'cust-01', sessionId, 530, 26.5, 556.5, 556.5]
  );
  await db.execute(
    `INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, unit_price, cost_price, quantity, discount_amount, tax_amount, line_total, returned_qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['si-1-1', sale1Id, 'prd-01', 'Coca Cola 500ml Bottle', 'BEV-CC500', 40, 32, 2, 0, 4, 84]
  );
  await db.execute(
    `INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, unit_price, cost_price, quantity, discount_amount, tax_amount, line_total, returned_qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['si-1-2', sale1Id, 'prd-05', 'Miniket Premium Rice 5kg', 'GRO-MNK5KG', 395, 340, 1, 0, 19.75, 414.75]
  );
  await db.execute(
    `INSERT INTO payments (id, sale_id, branch_id, method, amount, status, transaction_ref, notes)
     VALUES (?, ?, ?, 'cash', 556.5, 'completed', 'CSH-0001', 'Cash Payment')`,
    ['pay-1-1', sale1Id, branchId]
  );

  // Sale 2 (bKash)
  const sale2Id = 'sale-seed-02';
  await db.execute(
    `INSERT INTO sales (id, invoice_number, branch_id, user_id, customer_id, session_id, subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount, rounding_amount, grand_total, paid_amount, change_amount, payment_status, sale_status, notes, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'fixed', 50, 50, 5, ?, 0, ?, ?, 0, 'paid', 'completed', 'Mobile payment sale', 'seed-idem-2', datetime('now', '-1 hours'))`,
    [sale2Id, 'INV-2026-0002', branchId, 'usr-cashier', 'cust-02', sessionId, 1145, 54.75, 1149.75, 1149.75]
  );
  await db.execute(
    `INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, unit_price, cost_price, quantity, discount_amount, tax_amount, line_total, returned_qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['si-2-1', sale2Id, 'prd-16', 'SanDisk 64GB USB 3.0 Drive', 'ELE-SD64GB', 580, 450, 1, 25, 27.75, 582.75]
  );
  await db.execute(
    `INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, unit_price, cost_price, quantity, discount_amount, tax_amount, line_total, returned_qty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ['si-2-2', sale2Id, 'prd-07', 'Dano Daily Pushti Milk 500g', 'DAI-DANO500', 420, 360, 1, 25, 19.75, 414.75]
  );
  await db.execute(
    `INSERT INTO payments (id, sale_id, branch_id, method, amount, status, transaction_ref, notes)
     VALUES (?, ?, ?, 'bkash', 1149.75, 'completed', 'TRX984271829', 'bKash Merchant Pay')`,
    ['pay-2-1', sale2Id, branchId]
  );

  // 11. Store Settings
  const settings = [
    { key: 'shop_name', val: 'Apex Mart Superstore', desc: 'Display Name on Receipts and POS' },
    { key: 'shop_address', val: 'Plot 42, Block C, Gulshan-1, Dhaka-1212', desc: 'Shop Address' },
    { key: 'shop_phone', val: '+880 1712-998877', desc: 'Shop Contact Number' },
    { key: 'vat_registration_number', val: 'BIN-003847291-01', desc: 'Tax/VAT Registration No' },
    { key: 'currency_code', val: 'BDT', desc: 'Currency Code' },
    { key: 'currency_symbol', val: '৳', desc: 'Currency Symbol' },
    { key: 'default_tax_rate', val: '5.0', desc: 'Default VAT Rate (%)' },
    { key: 'thermal_printer_size', val: '58mm', desc: 'Thermal Receipt Width (58mm or 80mm)' },
    { key: 'receipt_footer_message', val: 'Thank you for shopping with us! No refund without receipt.', desc: 'Receipt bottom text' },
  ];

  for (const st of settings) {
    await db.execute('INSERT INTO settings (id, key, value, description) VALUES (?, ?, ?, ?)', [
      `set-${st.key}`,
      st.key,
      st.val,
      st.desc,
    ]);
  }

  // 12. Security Audit Log entry
  await db.execute(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, correlation_id, ip_address, change_summary, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'aud-init-01',
      'usr-admin',
      'System Administrator',
      'SYSTEM_INITIALIZATION',
      'system',
      'init',
      'corr-init-001',
      '127.0.0.1',
      'Database seeded and initialized with master retail catalog, roles, permissions and opening inventory',
      JSON.stringify({ productsCount: productData.length, initialSession: sessionId }),
    ]
  );

  console.log('[Seed] Database seeding completed successfully!');
}

import { fileURLToPath } from 'url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
