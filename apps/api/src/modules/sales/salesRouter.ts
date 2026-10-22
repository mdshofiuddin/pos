import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const salesRouter = Router();

// GET /api/v1/sales - List invoices
salesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const search = ((req.query.search as string) || '').trim();
    const status = req.query.status as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const limit = parseInt((req.query.limit as string) || '50', 10);

    let sql = `
      SELECT s.id, s.invoice_number as invoiceNumber, s.created_at as createdAt,
             s.subtotal, s.discount_amount as discountAmount, s.tax_amount as taxAmount,
             s.grand_total as grandTotal, s.paid_amount as paidAmount, s.change_amount as changeAmount,
             s.payment_status as paymentStatus, s.sale_status as saleStatus, s.notes,
             u.full_name as cashierName,
             COALESCE(c.name, 'Walk-in Customer') as customerName,
             (SELECT GROUP_CONCAT(DISTINCT method) FROM payments WHERE sale_id = s.id) as paymentMethods
      FROM sales s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.branch_id = ?
    `;

    const params: any[] = [branchId];

    if (search) {
      sql += ` AND (s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status) {
      sql += ` AND s.sale_status = ?`;
      params.push(status);
    }

    if (fromDate) {
      sql += ` AND date(s.created_at) >= date(?)`;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND date(s.created_at) <= date(?)`;
      params.push(toDate);
    }

    sql += ` ORDER BY s.created_at DESC LIMIT ?`;
    params.push(limit);

    const sales = await db.query<any>(sql, params);

    res.json({
      data: sales,
      meta: { total: sales.length, requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sales/:id - Invoice detail for view/reprint
salesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const branchId = req.user!.branchId;

    const saleRows = await db.query<any>(
      `SELECT s.*, u.full_name as cashierName,
              COALESCE(c.name, 'Walk-in Customer') as customerName,
              c.phone as customerPhone, c.address as customerAddress
       FROM sales s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE (s.id = ? OR s.invoice_number = ?) AND s.branch_id = ?`,
      [id, id, branchId]
    );

    if (saleRows.length === 0) {
      throw new AppError('Invoice not found', 404, 'NOT_FOUND');
    }

    const sale = saleRows[0];

    // Fetch line items
    const items = await db.query<any>(
      `SELECT si.*, p.barcode
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`,
      [sale.id]
    );

    // Fetch payments
    const payments = await db.query<any>(
      `SELECT * FROM payments WHERE sale_id = ?`,
      [sale.id]
    );

    res.json({
      data: {
        ...sale,
        items,
        payments,
      },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/sales/:id/void - Void an invoice with stock reversal
salesRouter.post('/:id/void', requireAuth, requirePermission('pos:void'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || reason.trim().length < 3) {
      throw new AppError('Reason is required to void an invoice', 422, 'VALIDATION_ERROR');
    }

    const db = getDb();
    const branchId = req.user!.branchId;

    await db.transaction(async (tx) => {
      const saleRows = await tx.query<any>(
        'SELECT * FROM sales WHERE id = ? AND branch_id = ?',
        [id, branchId]
      );

      if (saleRows.length === 0) {
        throw new AppError('Invoice not found', 404, 'NOT_FOUND');
      }

      const sale = saleRows[0];
      if (sale.sale_status === 'voided') {
        throw new AppError('Invoice is already voided', 409, 'ALREADY_VOIDED');
      }

      // Mark sale voided
      await tx.execute(
        `UPDATE sales
         SET sale_status = 'voided',
             notes = COALESCE(notes, '') || ' | VOIDED: ' || ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [reason, id]
      );

      // Revert items back into stock
      const items = await tx.query<any>('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
      for (const item of items) {
        const netSold = item.quantity - item.returned_qty;
        if (netSold > 0) {
          // Increment stock balance
          await tx.execute(
            `UPDATE stock_balances
             SET current_stock = current_stock + ?,
                 version = version + 1,
                 updated_at = datetime('now')
             WHERE product_id = ? AND branch_id = ?`,
            [netSold, item.product_id, branchId]
          );

          // Append to stock movement ledger as reversal
          await tx.execute(
            `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
             VALUES (?, ?, ?, ?, 'VOID_REVERSAL', 'sale_void', ?, ?, ?, ?)`,
            [
              `sm-void-${Date.now()}-${item.id}`,
              branchId,
              item.product_id,
              netSold,
              id,
              item.cost_price,
              `Reversal due to void of invoice ${sale.invoice_number}: ${reason}`,
              req.user!.id,
            ]
          );
        }
      }

      // Audit log
      await logAudit({
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        action: 'SALE_INVOICE_VOIDED',
        entityType: 'sale',
        entityId: id,
        ipAddress: req.ip,
        changeSummary: `Invoice ${sale.invoice_number} voided by ${req.user!.fullName}. Reason: ${reason}`,
        details: { invoiceNumber: sale.invoice_number, grandTotal: sale.grand_total, reason },
        tx,
      });
    });

    res.json({
      data: { message: 'Invoice voided and inventory reversed successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
