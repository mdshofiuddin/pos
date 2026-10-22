import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';

export const reportsRouter = Router();

// 1. Daily Sales Summary
reportsRouter.get('/daily-sales', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const from = req.query.from as string || '2026-01-01';
    const to = req.query.to as string || '2026-12-31';

    const dailyRows = await db.query<any>(
      `SELECT
         date(s.created_at) as saleDate,
         COUNT(s.id) as invoiceCount,
         COALESCE(SUM(s.subtotal), 0) as grossSales,
         COALESCE(SUM(s.discount_amount), 0) as totalDiscounts,
         COALESCE(SUM(s.tax_amount), 0) as totalTax,
         COALESCE(SUM(s.grand_total), 0) as netSales,
         COALESCE((
           SELECT SUM(sr.total_refund_amount)
           FROM sale_returns sr
           WHERE sr.branch_id = s.branch_id AND date(sr.created_at) = date(s.created_at)
         ), 0) as totalRefunds
       FROM sales s
       WHERE s.branch_id = ? AND date(s.created_at) BETWEEN date(?) AND date(?)
         AND s.sale_status != 'voided'
       GROUP BY date(s.created_at)
       ORDER BY saleDate DESC`,
      [branchId, from, to]
    );

    res.json({ data: dailyRows, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 2. Product Sales Performance
reportsRouter.get('/product-sales', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const products = await db.query<any>(
      `SELECT
         p.id as productId, p.sku, p.barcode, p.name as productName,
         c.name as categoryName,
         COALESCE(SUM(si.quantity), 0) as unitsSold,
         COALESCE(SUM(si.line_total), 0) as totalRevenue,
         COALESCE(SUM(si.quantity * si.cost_price), 0) as totalCost,
         COALESCE(SUM(si.line_total) - SUM(si.quantity * si.cost_price), 0) as grossProfit
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN sale_items si ON p.id = si.product_id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.sale_status != 'voided' AND s.branch_id = ?
       WHERE p.branch_id = ?
       GROUP BY p.id
       ORDER BY totalRevenue DESC`,
      [branchId, branchId]
    );

    res.json({ data: products, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 3. Category Sales Performance
reportsRouter.get('/category-sales', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const categories = await db.query<any>(
      `SELECT
         c.id as categoryId, c.name as categoryName, c.code as categoryCode,
         COUNT(DISTINCT p.id) as productCount,
         COALESCE(SUM(si.quantity), 0) as unitsSold,
         COALESCE(SUM(si.line_total), 0) as totalRevenue,
         COALESCE(SUM(si.line_total) - SUM(si.quantity * si.cost_price), 0) as categoryProfit
       FROM categories c
       JOIN products p ON c.id = p.category_id AND p.branch_id = ?
       LEFT JOIN sale_items si ON p.id = si.product_id
       LEFT JOIN sales s ON si.sale_id = s.id AND s.sale_status != 'voided'
       GROUP BY c.id
       ORDER BY totalRevenue DESC`,
      [branchId]
    );

    res.json({ data: categories, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 4. Cashier Shift & Variance Report
reportsRouter.get('/cashier-variance', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const sessions = await db.query<any>(
      `SELECT
         cs.id as sessionId, cs.opening_time as openingTime, cs.closing_time as closingTime,
         u.full_name as cashierName, u.username,
         cs.opening_cash as openingCash, cs.total_cash_sales as cashSales,
         cs.total_cash_in as cashIn, cs.total_cash_out as cashOut,
         cs.total_cash_refunds as cashRefunds,
         cs.expected_cash as expectedCash, cs.counted_cash as countedCash,
         cs.cash_variance as variance, cs.status
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.branch_id = ?
       ORDER BY cs.opening_time DESC`,
      [branchId]
    );

    res.json({ data: sessions, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 5. Payment Methods Summary
reportsRouter.get('/payment-methods', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const methods = await db.query<any>(
      `SELECT
         p.method as paymentMethod,
         p.status,
         COUNT(p.id) as transactionCount,
         COALESCE(SUM(p.amount), 0) as totalAmount
       FROM payments p
       JOIN sales s ON p.sale_id = s.id AND s.sale_status != 'voided'
       WHERE p.branch_id = ?
       GROUP BY p.method, p.status
       ORDER BY totalAmount DESC`,
      [branchId]
    );

    res.json({ data: methods, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 6. Gross Profit & Margins Report
reportsRouter.get('/gross-profit', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const profitData = await db.query<any>(
      `SELECT
         date(s.created_at) as reportDate,
         COUNT(s.id) as transactions,
         COALESCE(SUM(si.line_total), 0) as totalRevenue,
         COALESCE(SUM(si.quantity * si.cost_price), 0) as costOfGoodsSold,
         COALESCE(SUM(si.line_total) - SUM(si.quantity * si.cost_price), 0) as grossProfit,
         ROUND(CASE
           WHEN SUM(si.line_total) > 0
           THEN ((SUM(si.line_total) - SUM(si.quantity * si.cost_price)) * 100.0 / SUM(si.line_total))
           ELSE 0
         END, 2) as profitMarginPercent
       FROM sales s
       JOIN sale_items si ON s.id = si.sale_id
       WHERE s.branch_id = ? AND s.sale_status != 'voided'
       GROUP BY date(s.created_at)
       ORDER BY reportDate DESC`,
      [branchId]
    );

    res.json({ data: profitData, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 7. Real-Time Stock On-Hand & Inventory Status
reportsRouter.get('/stock-on-hand', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const stockRows = await db.query<any>(
      `SELECT
         p.id as productId, p.sku, p.barcode, p.name as productName,
         c.name as categoryName, u.short_name as unit,
         COALESCE(sb.current_stock, 0) as currentStock,
         p.min_stock_threshold as minThreshold,
         p.cost_price as costPrice, p.selling_price as sellingPrice,
         (COALESCE(sb.current_stock, 0) * p.cost_price) as costValuation,
         (COALESCE(sb.current_stock, 0) * p.selling_price) as retailValuation,
         CASE
           WHEN COALESCE(sb.current_stock, 0) <= 0 THEN 'OUT_OF_STOCK'
           WHEN COALESCE(sb.current_stock, 0) <= p.min_stock_threshold THEN 'LOW_STOCK'
           ELSE 'ADEQUATE'
         END as inventoryHealth
       FROM products p
       JOIN categories c ON p.category_id = c.id
       JOIN units u ON p.unit_id = u.id
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
       WHERE p.branch_id = ?
       ORDER BY currentStock ASC, p.name ASC`,
      [branchId, branchId]
    );

    res.json({ data: stockRows, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 8. Low Stock & Reorder Alert Report
reportsRouter.get('/low-stock-alert', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const alerts = await db.query<any>(
      `SELECT
         p.id as productId, p.sku, p.barcode, p.name as productName,
         c.name as categoryName,
         COALESCE(sb.current_stock, 0) as currentStock,
         p.min_stock_threshold as minThreshold,
         p.max_stock_threshold as maxThreshold,
         (p.max_stock_threshold - COALESCE(sb.current_stock, 0)) as suggestedReorderQuantity,
         p.cost_price as unitCost,
         ((p.max_stock_threshold - COALESCE(sb.current_stock, 0)) * p.cost_price) as estimatedReorderCost
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
       WHERE p.branch_id = ? AND COALESCE(sb.current_stock, 0) <= p.min_stock_threshold
       ORDER BY currentStock ASC`,
      [branchId, branchId]
    );

    res.json({ data: alerts, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 9. Stock Valuation Report
reportsRouter.get('/stock-valuation', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const valuation = await db.query<any>(
      `SELECT
         c.name as categoryName,
         COUNT(p.id) as productCount,
         COALESCE(SUM(sb.current_stock), 0) as totalUnitsInStock,
         COALESCE(SUM(sb.current_stock * p.cost_price), 0) as totalCostValuation,
         COALESCE(SUM(sb.current_stock * p.selling_price), 0) as totalRetailValuation,
         COALESCE(SUM(sb.current_stock * (p.selling_price - p.cost_price)), 0) as potentialGrossProfit
       FROM categories c
       JOIN products p ON c.id = p.category_id AND p.branch_id = ?
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = p.branch_id
       GROUP BY c.id
       ORDER BY totalCostValuation DESC`,
      [branchId]
    );

    res.json({ data: valuation, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 10. Stock Movement & Ledger Audit Report
reportsRouter.get('/stock-ledger', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const limit = parseInt((req.query.limit as string) || '100', 10);

    const movements = await db.query<any>(
      `SELECT
         sm.id as movementId, sm.created_at as timestamp,
         p.name as productName, p.sku, p.barcode,
         sm.movement_type as movementType, sm.signed_quantity as quantity,
         sm.cost_price as costBasis, sm.reference_type as referenceType,
         sm.reference_id as referenceId, sm.notes,
         u.full_name as initiatedBy
       FROM stock_movements sm
       JOIN products p ON sm.product_id = p.id
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.branch_id = ?
       ORDER BY sm.created_at DESC LIMIT ?`,
      [branchId, limit]
    );

    res.json({ data: movements, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 11. Sales Returns & Refund Analysis
reportsRouter.get('/returns-analysis', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const returns = await db.query<any>(
      `SELECT
         sr.id as returnId, sr.return_number as returnNumber, sr.created_at as returnDate,
         s.invoice_number as originalInvoice,
         sr.total_refund_amount as refundAmount, sr.refund_method as refundMethod,
         sr.reason, u.full_name as cashierName,
         p.name as productName, sri.quantity as returnedQty, sri.condition,
         sri.is_restocked as restocked
       FROM sale_returns sr
       JOIN sales s ON sr.sale_id = s.id
       JOIN users u ON sr.user_id = u.id
       JOIN sale_return_items sri ON sr.id = sri.return_id
       JOIN products p ON sri.product_id = p.id
       WHERE sr.branch_id = ?
       ORDER BY sr.created_at DESC`,
      [branchId]
    );

    res.json({ data: returns, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 12. Customer Due & Receivables Report
reportsRouter.get('/customer-due', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const dues = await db.query<any>(
      `SELECT
         c.id as customerId, c.name as customerName, c.phone, c.address,
         c.credit_limit as creditLimit, c.current_due as currentDueBalance,
         c.loyalty_points as loyaltyPoints,
         MAX(s.created_at) as lastPurchaseDate,
         COUNT(s.id) as totalPurchases
       FROM customers c
       LEFT JOIN sales s ON c.id = s.customer_id
       WHERE c.branch_id = ? AND c.current_due > 0
       GROUP BY c.id
       ORDER BY c.current_due DESC`,
      [branchId]
    );

    res.json({ data: dues, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 13. Supplier Payables & Purchasing Report
reportsRouter.get('/supplier-payables', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();

    const payables = await db.query<any>(
      `SELECT
         s.id as supplierId, s.company_name as companyName, s.name as contactPerson,
         s.phone, s.total_purchased as totalPurchased,
         s.total_paid as totalPaid, s.total_payable as currentPayableDue,
         COUNT(p.id) as totalPurchaseOrders
       FROM suppliers s
       LEFT JOIN purchases p ON s.id = p.supplier_id
       GROUP BY s.id
       ORDER BY s.total_payable DESC, s.total_purchased DESC`
    );

    res.json({ data: payables, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 14. Expenses & Operational Cashflow
reportsRouter.get('/expenses-cashflow', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const expenses = await db.query<any>(
      `SELECT
         e.id as expenseId, e.created_at as expenseDate,
         e.category, e.amount, e.payment_method as paymentMethod,
         e.description, u.full_name as recordedBy
       FROM expenses e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.branch_id = ?
       ORDER BY e.created_at DESC`,
      [branchId]
    );

    res.json({ data: expenses, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 15. Security & System Audit Trail Report
reportsRouter.get('/audit-trail', requireAuth, requirePermission('audit:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const action = req.query.action as string;

    let sql = `
      SELECT
        id, actor_id as actorId, actor_name as actorName, action,
        entity_type as entityType, entity_id as entityId,
        correlation_id as correlationId, ip_address as ipAddress,
        change_summary as changeSummary, details_json as detailsJson,
        created_at as timestamp
      FROM audit_logs
    `;
    const params: any[] = [];

    if (action) {
      sql += ` WHERE action LIKE ?`;
      params.push(`%${action}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const logs = await db.query<any>(sql, params);

    res.json({ data: logs, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 16. Daily Detailed Sales Report (Item-by-Item Invoices Register)
reportsRouter.get('/daily-sales-details', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const from = (req.query.from as string) || '2026-01-01';
    const to = (req.query.to as string) || '2026-12-31';

    const items = await db.query<any>(
      `SELECT
         date(s.created_at) as saleDate,
         time(s.created_at) as saleTime,
         s.invoice_number as invoiceNumber,
         COALESCE(c.name, 'Walk-in Customer') as customerName,
         u.full_name as cashierName,
         si.product_name as productName,
         si.product_sku as sku,
         si.quantity as qtySold,
         si.unit_price as unitPrice,
         si.cost_price as unitCost,
         si.discount_amount as itemDiscount,
         si.tax_amount as itemTax,
         si.line_total as lineTotal,
         ROUND(si.line_total - (si.quantity * si.cost_price), 2) as grossProfit,
         s.payment_status as paymentStatus,
         (SELECT GROUP_CONCAT(DISTINCT method) FROM payments WHERE sale_id = s.id) as paymentMethods
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN users u ON s.user_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.branch_id = ? AND date(s.created_at) BETWEEN date(?) AND date(?)
         AND s.sale_status != 'voided'
       ORDER BY s.created_at DESC, s.invoice_number DESC`,
      [branchId, from, to]
    );

    res.json({ data: items, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 17. Daily Detailed Purchase Report (Item-by-Item Goods Receipt Register)
reportsRouter.get('/daily-purchase-details', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const from = (req.query.from as string) || '2026-01-01';
    const to = (req.query.to as string) || '2026-12-31';

    const purchases = await db.query<any>(
      `SELECT
         p.purchase_date as purchaseDate,
         p.invoice_number as poInvoiceNumber,
         s.company_name as supplierCompany,
         s.name as supplierContact,
         pr.name as productName,
         pr.sku,
         c.name as categoryName,
         pi.quantity as qtyReceived,
         pi.unit_cost as unitCost,
         pi.total_cost as totalCost,
         p.paid_amount as orderPaidAmount,
         p.due_amount as orderDueAmount,
         p.payment_status as paymentStatus,
         u.full_name as receivedBy
       FROM purchase_items pi
       JOIN purchases p ON pi.purchase_id = p.id
       JOIN suppliers s ON p.supplier_id = s.id
       JOIN products pr ON pi.product_id = pr.id
       JOIN categories c ON pr.category_id = c.id
       JOIN users u ON p.created_by = u.id
       WHERE p.branch_id = ? AND date(p.purchase_date) BETWEEN date(?) AND date(?)
       ORDER BY p.purchase_date DESC, p.invoice_number DESC`,
      [branchId, from, to]
    );

    res.json({ data: purchases, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

// 18. Daily Combined Sales & Purchase Daybook (Reconciliation)
reportsRouter.get('/daily-daybook', requireAuth, requirePermission('reports:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const daybook = await db.query<any>(
      `WITH RECURSIVE dates(d) AS (
         SELECT date(min(d_val)) FROM (
           SELECT min(created_at) as d_val FROM sales WHERE branch_id = ?
           UNION
           SELECT min(purchase_date) as d_val FROM purchases WHERE branch_id = ?
         )
         UNION ALL
         SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
       )
       SELECT
         d as entryDate,
         -- Sales metrics
         COALESCE((
           SELECT COUNT(id) FROM sales WHERE branch_id = ? AND date(created_at) = d AND sale_status != 'voided'
         ), 0) as totalInvoices,
         COALESCE((
           SELECT SUM(grand_total) FROM sales WHERE branch_id = ? AND date(created_at) = d AND sale_status != 'voided'
         ), 0) as totalSalesAmount,
         COALESCE((
           SELECT SUM(paid_amount) FROM sales WHERE branch_id = ? AND date(created_at) = d AND sale_status != 'voided'
         ), 0) as salesCashReceived,
         -- Purchases metrics
         COALESCE((
           SELECT COUNT(id) FROM purchases WHERE branch_id = ? AND date(purchase_date) = d
         ), 0) as totalPurchaseOrders,
         COALESCE((
           SELECT SUM(grand_total) FROM purchases WHERE branch_id = ? AND date(purchase_date) = d
         ), 0) as totalPurchasedAmount,
         COALESCE((
           SELECT SUM(paid_amount) FROM purchases WHERE branch_id = ? AND date(purchase_date) = d
         ), 0) as purchasePaidAmount,
         -- Net difference
         ROUND(
           COALESCE((SELECT SUM(grand_total) FROM sales WHERE branch_id = ? AND date(created_at) = d AND sale_status != 'voided'), 0) -
           COALESCE((SELECT SUM(grand_total) FROM purchases WHERE branch_id = ? AND date(purchase_date) = d), 0),
           2
         ) as netSalesMinusPurchase
       FROM dates
       WHERE totalSalesAmount > 0 OR totalPurchasedAmount > 0
       ORDER BY entryDate DESC`,
      [branchId, branchId, branchId, branchId, branchId, branchId, branchId, branchId, branchId, branchId]
    );

    res.json({ data: daybook, meta: { requestId: crypto.randomUUID() } });
  } catch (err) {
    next(err);
  }
});

