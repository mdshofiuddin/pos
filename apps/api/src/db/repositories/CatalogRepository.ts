import { getDb } from '../index.js';

export interface ProductFilters {
  branchId: string;
  search?: string;
  categoryId?: string;
  stockStatus?: string;
}

export class CatalogRepository {
  static async getProducts(filters: ProductFilters) {
    const db = getDb();
    let sql = `
      SELECT p.id, p.branch_id as branchId, p.category_id as categoryId, c.name as categoryName,
             p.unit_id as unitId, u.short_name as unitName, p.sku, p.barcode, p.name,
             p.description, p.cost_price as costPrice, p.selling_price as sellingPrice,
             p.min_stock_threshold as minStockThreshold, p.max_stock_threshold as maxStockThreshold,
             p.tax_rate as taxRate, p.is_active as isActive,
             COALESCE(sb.current_stock, 0) as currentStock
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN units u ON p.unit_id = u.id
      LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
      WHERE p.branch_id = ?
    `;

    const params: any[] = [filters.branchId, filters.branchId];

    if (filters.search) {
      sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    if (filters.categoryId) {
      sql += ` AND p.category_id = ?`;
      params.push(filters.categoryId);
    }

    if (filters.stockStatus === 'low') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= p.min_stock_threshold AND COALESCE(sb.current_stock, 0) > 0`;
    } else if (filters.stockStatus === 'out') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= 0`;
    }

    sql += ` ORDER BY p.name ASC`;
    return db.query<any>(sql, params);
  }

  static async getProductById(id: string, branchId?: string, isSuperAdmin = false) {
    const db = getDb();
    const sql = `
      SELECT p.*, c.name as categoryName, u.short_name as unitName,
             COALESCE(sb.current_stock, 0) as currentStock
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN units u ON p.unit_id = u.id
      LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = p.branch_id
      WHERE p.id = ? ${isSuperAdmin || !branchId ? '' : 'AND p.branch_id = ?'}
    `;
    const params = isSuperAdmin || !branchId ? [id] : [id, branchId];
    const results = await db.query<any>(sql, params);
    return results[0] || null;
  }

  static async getCategories() {
    const db = getDb();
    return db.query<any>(
      `SELECT c.*, COUNT(p.id) as productCount
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
  }

  static async getUnits() {
    const db = getDb();
    return db.query<any>('SELECT * FROM units ORDER BY name ASC');
  }

  static async deleteProduct(id: string, branchId: string) {
    const db = getDb();
    return db.execute('DELETE FROM products WHERE id = ? AND branch_id = ?', [id, branchId]);
  }
}
