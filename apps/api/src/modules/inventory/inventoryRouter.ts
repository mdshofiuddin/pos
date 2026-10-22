import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const inventoryRouter = Router();

// GET /api/v1/inventory/overview - At-a-glance inventory KPI summary
inventoryRouter.get('/overview', requireAuth, requirePermission('inventory:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const stats = await db.query<any>(
      `SELECT
         COUNT(p.id) as totalProducts,
         COALESCE(SUM(sb.current_stock), 0) as totalUnits,
         COALESCE(SUM(sb.current_stock * p.cost_price), 0) as totalCostValuation,
         COALESCE(SUM(sb.current_stock * p.selling_price), 0) as totalRetailValuation,
         COUNT(CASE WHEN sb.current_stock <= p.min_stock_threshold AND sb.current_stock > 0 THEN 1 END) as lowStockCount,
         COUNT(CASE WHEN sb.current_stock <= 0 THEN 1 END) as outOfStockCount
       FROM products p
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
       WHERE p.branch_id = ? AND p.is_active = 1`,
      [branchId, branchId]
    );

    // Top categories distribution
    const categoryStats = await db.query<any>(
      `SELECT c.name as categoryName,
              COUNT(p.id) as itemCount,
              COALESCE(SUM(sb.current_stock), 0) as totalUnits,
              COALESCE(SUM(sb.current_stock * p.cost_price), 0) as valuation
       FROM categories c
       JOIN products p ON c.id = p.category_id AND p.branch_id = ?
       LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = p.branch_id
       GROUP BY c.id
       ORDER BY valuation DESC`,
      [branchId]
    );

    res.json({
      data: {
        summary: stats[0] || {},
        categoryBreakdown: categoryStats,
      },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/balances - Detailed item stock balances
inventoryRouter.get('/balances', requireAuth, requirePermission('inventory:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const filter = (req.query.filter as string) || 'all'; // 'all', 'low', 'out'
    const search = ((req.query.search as string) || '').trim();

    let sql = `
      SELECT p.id as productId, p.sku, p.barcode, p.name as productName,
             c.name as categoryName, u.short_name as unit,
             p.cost_price as costPrice, p.selling_price as sellingPrice,
             p.min_stock_threshold as minStock, p.max_stock_threshold as maxStock,
             COALESCE(sb.current_stock, 0) as currentStock,
             (COALESCE(sb.current_stock, 0) * p.cost_price) as costValue,
             (COALESCE(sb.current_stock, 0) * p.selling_price) as retailValue,
             sb.last_reconciled_at as lastReconciledAt,
             CASE
               WHEN COALESCE(sb.current_stock, 0) <= 0 THEN 'OUT_OF_STOCK'
               WHEN COALESCE(sb.current_stock, 0) <= p.min_stock_threshold THEN 'LOW_STOCK'
               ELSE 'IN_STOCK'
             END as stockStatus
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN units u ON p.unit_id = u.id
      LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
      WHERE p.branch_id = ?
    `;

    const params: any[] = [branchId, branchId];

    if (search) {
      sql += ` AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (filter === 'low') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= p.min_stock_threshold AND COALESCE(sb.current_stock, 0) > 0`;
    } else if (filter === 'out') {
      sql += ` AND COALESCE(sb.current_stock, 0) <= 0`;
    }

    sql += ` ORDER BY currentStock ASC, p.name ASC`;

    const balances = await db.query<any>(sql, params);

    res.json({
      data: balances,
      meta: { total: balances.length, requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inventory/movements - Append-only stock movement ledger
inventoryRouter.get('/movements', requireAuth, requirePermission('inventory:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const productId = req.query.productId as string;
    const movementType = req.query.movementType as string;
    const limit = parseInt((req.query.limit as string) || '50', 10);

    let sql = `
      SELECT sm.id, sm.product_id as productId, p.name as productName, p.sku, p.barcode,
             sm.signed_quantity as signedQuantity, sm.movement_type as movementType,
             sm.reference_type as referenceType, sm.reference_id as referenceId,
             sm.cost_price as costPrice, sm.notes, sm.created_at as createdAt,
             u.full_name as createdBy
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.branch_id = ?
    `;
    const params: any[] = [branchId];

    if (productId) {
      sql += ` AND sm.product_id = ?`;
      params.push(productId);
    }
    if (movementType) {
      sql += ` AND sm.movement_type = ?`;
      params.push(movementType);
    }

    sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
    params.push(limit);

    const movements = await db.query<any>(sql, params);

    res.json({
      data: movements,
      meta: { total: movements.length, requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const adjustmentSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['ADJUSTMENT_DAMAGE', 'ADJUSTMENT_LOSS', 'ADJUSTMENT_FOUND', 'ADJUSTMENT_CORRECTION']),
  quantity: z.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(3, 'Detailed reason is required for audit trail'),
});

// POST /api/v1/inventory/adjustments - Atomic stock adjustment with ledger & audit trail
inventoryRouter.post('/adjustments', requireAuth, requirePermission('inventory:adjust'), async (req, res, next) => {
  try {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { productId, type, quantity, reason } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;

    // Determine signed quantity: damage/loss reduces stock; found increases; correction depends
    let signedQty = 0;
    if (type === 'ADJUSTMENT_DAMAGE' || type === 'ADJUSTMENT_LOSS') {
      signedQty = -Math.abs(quantity);
    } else {
      signedQty = Math.abs(quantity);
    }

    const movementId = `sm-adj-${Date.now()}`;

    await db.transaction(async (tx) => {
      // 1. Fetch current product and stock
      const prodRows = await tx.query<any>(
        `SELECT p.id, p.name, p.cost_price as costPrice, COALESCE(sb.current_stock, 0) as currentStock
         FROM products p
         LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
         WHERE p.id = ? AND p.branch_id = ?`,
        [branchId, productId, branchId]
      );

      if (prodRows.length === 0) {
        throw new AppError('Product not found in this branch or access denied', 404, 'NOT_FOUND');
      }

      const prod = prodRows[0];

      // Validate stock won't drop below 0 if reducing
      if (signedQty < 0 && prod.currentStock + signedQty < 0) {
        throw new AppError(
          `Cannot reduce stock by ${quantity}. Current stock is only ${prod.currentStock}.`,
          409,
          'INSUFFICIENT_STOCK'
        );
      }

      const newStock = prod.currentStock + signedQty;

      // 2. Update stock balance
      await tx.execute(
        `UPDATE stock_balances
         SET current_stock = ?,
             last_reconciled_at = datetime('now'),
             version = version + 1,
             updated_at = datetime('now')
         WHERE product_id = ? AND branch_id = ?`,
        [newStock, productId, branchId]
      );

      // 3. Append to immutable stock movement ledger
      await tx.execute(
        `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'manual_adjustment', ?, ?, ?, ?)`,
        [movementId, branchId, productId, signedQty, type, movementId, prod.costPrice, reason, req.user!.id]
      );

      // 4. Record audit log
      await logAudit({
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        action: 'INVENTORY_STOCK_ADJUSTMENT',
        entityType: 'inventory',
        entityId: productId,
        ipAddress: req.ip,
        changeSummary: `Stock adjustment for ${prod.name}: ${signedQty > 0 ? '+' : ''}${signedQty} units (${type}). Reason: ${reason}`,
        details: { productId, type, signedQty, oldStock: prod.currentStock, newStock, reason },
        tx,
      });
    });

    res.json({
      data: { message: 'Stock adjustment applied and ledger updated successfully', movementId },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
