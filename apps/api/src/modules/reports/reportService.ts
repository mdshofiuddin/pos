import { getDb } from '../../db/index.js';

export class ReportService {
  static async getDailySales(branchId: string, from: string, to: string) {
    const db = getDb();
    return db.query<any>(
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
  }

  static async getProductSales(branchId: string) {
    const db = getDb();
    return db.query<any>(
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
       ORDER BY totalRevenue DESC LIMIT 50`,
      [branchId, branchId]
    );
  }

  static async getInventoryValuation(branchId: string) {
    const db = getDb();
    return db.query<any>(
      `SELECT
         p.id as productId, p.sku, p.barcode, p.name as productName,
         c.name as categoryName,
         p.cost_price as costPrice,
         p.selling_price as sellingPrice,
         COALESCE(sb.current_stock, 0) as currentStock,
         (p.cost_price * COALESCE(sb.current_stock, 0)) as totalCostValue,
         (p.selling_price * COALESCE(sb.current_stock, 0)) as totalRetailValue
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = p.branch_id
       WHERE p.branch_id = ?
       ORDER BY totalCostValue DESC`,
      [branchId]
    );
  }
}
