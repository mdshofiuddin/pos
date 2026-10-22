import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const returnsRouter = Router();

const returnItemSchema = z.object({
  saleItemId: z.string().min(1, 'Sale item ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  condition: z.enum(['resellable', 'damaged']).default('resellable'),
});

const processReturnSchema = z.object({
  saleId: z.string().min(1, 'Sale ID is required'),
  items: z.array(returnItemSchema).min(1, 'At least one return item is required'),
  reason: z.string().min(3, 'Return reason is required'),
  refundMethod: z.enum(['cash', 'credit', 'card', 'mfs']).default('cash'),
});

// POST /api/v1/returns - Process Return & Refund
returnsRouter.post('/', requireAuth, requirePermission('pos:return'), async (req, res, next) => {
  try {
    const parsed = processReturnSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { saleId, items, reason, refundMethod } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    const returnId = `ret-${Date.now()}`;
    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    let calculatedTotalRefund = 0;

    await db.transaction(async (tx) => {
      // 1. Fetch original sale
      const saleRows = await tx.query<any>(
        'SELECT * FROM sales WHERE id = ? AND branch_id = ?',
        [saleId, branchId]
      );

      if (saleRows.length === 0) {
        throw new AppError('Original sale invoice not found', 404, 'NOT_FOUND');
      }

      const sale = saleRows[0];
      if (sale.sale_status === 'voided') {
        throw new AppError('Cannot return items from a voided invoice', 400, 'SALE_VOIDED');
      }

      // Check active cash session if cash refund
      let activeSessionId: string | null = null;
      if (refundMethod === 'cash') {
        const cs = await tx.query<any>(
          "SELECT id, expected_cash FROM cash_sessions WHERE branch_id = ? AND user_id = ? AND status = 'open'",
          [branchId, userId]
        );
        if (cs.length > 0) activeSessionId = cs[0].id;
      }

      const processedReturnItems: any[] = [];

      // 2. Validate returnable quantities and amounts
      for (const retItem of items) {
        const itemRows = await tx.query<any>(
          'SELECT * FROM sale_items WHERE id = ? AND sale_id = ?',
          [retItem.saleItemId, saleId]
        );

        if (itemRows.length === 0) {
          throw new AppError(`Sale item [${retItem.saleItemId}] does not belong to this invoice.`, 404, 'INVALID_SALE_ITEM');
        }

        const saleItem = itemRows[0];
        const remainingReturnable = saleItem.quantity - saleItem.returned_qty;

        if (retItem.quantity > remainingReturnable) {
          throw new AppError(
            `Cannot return ${retItem.quantity} units of "${saleItem.product_name}". Only ${remainingReturnable} remaining returnable units.`,
            409,
            'RETURN_LIMIT_EXCEEDED'
          );
        }

        const effectiveUnitPrice = Math.round((saleItem.line_total / saleItem.quantity) * 100) / 100;
        const lineRefund = Math.round(effectiveUnitPrice * retItem.quantity * 100) / 100;
        calculatedTotalRefund += lineRefund;

        processedReturnItems.push({
          saleItemId: saleItem.id,
          productId: saleItem.product_id,
          productName: saleItem.product_name,
          costPrice: saleItem.cost_price,
          quantity: retItem.quantity,
          refundUnitPrice: effectiveUnitPrice,
          lineRefundTotal: lineRefund,
          condition: retItem.condition,
          isRestocked: retItem.condition === 'resellable' ? 1 : 0,
        });
      }

      calculatedTotalRefund = Math.round(calculatedTotalRefund * 100) / 100;

      // 3. Insert Sale Return Header
      await tx.execute(
        `INSERT INTO sale_returns (id, return_number, sale_id, branch_id, user_id, total_refund_amount, refund_method, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [returnId, returnNumber, saleId, branchId, userId, calculatedTotalRefund, refundMethod, reason]
      );

      // 4. Insert Return Items, Update Sale Items returned_qty, and Restock if Resellable
      for (let i = 0; i < processedReturnItems.length; i++) {
        const pi = processedReturnItems[i];
        const returnItemId = `sri-${returnId}-${i + 1}`;

        await tx.execute(
          `INSERT INTO sale_return_items (id, return_id, sale_item_id, product_id, quantity, refund_unit_price, line_refund_total, is_restocked, condition)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [returnItemId, returnId, pi.saleItemId, pi.productId, pi.quantity, pi.refundUnitPrice, pi.lineRefundTotal, pi.isRestocked, pi.condition]
        );

        // Update returned_qty in sale_items
        await tx.execute(
          `UPDATE sale_items SET returned_qty = returned_qty + ? WHERE id = ?`,
          [pi.quantity, pi.saleItemId]
        );

        // Restock condition rule: Only restock if resellable! Damaged items do not increment sellable stock
        if (pi.isRestocked === 1) {
          await tx.execute(
            `UPDATE stock_balances
             SET current_stock = current_stock + ?,
                 version = version + 1,
                 updated_at = datetime('now')
             WHERE product_id = ? AND branch_id = ?`,
            [pi.quantity, pi.productId, branchId]
          );

          await tx.execute(
            `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
             VALUES (?, ?, ?, ?, 'SALE_RETURN', 'sale_return', ?, ?, ?, ?)`,
            [
              `sm-ret-${Date.now()}-${i + 1}`,
              branchId,
              pi.productId,
              pi.quantity,
              returnId,
              pi.costPrice,
              `Returned from invoice ${sale.invoice_number} (Condition: ${pi.condition})`,
              userId,
            ]
          );
        } else {
          // Record damage write-off movement
          await tx.execute(
            `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
             VALUES (?, ?, ?, 0, 'DAMAGE_RETURN_NON_SELLABLE', 'sale_return', ?, ?, ?, ?)`,
            [
              `sm-ret-dmg-${Date.now()}-${i + 1}`,
              branchId,
              pi.productId,
              returnId,
              pi.costPrice,
              `Damaged return from invoice ${sale.invoice_number} - Non-sellable`,
              userId,
            ]
          );
        }
      }

      // Update sale status if fully returned
      await tx.execute(
        `UPDATE sales
         SET sale_status = 'returned',
             updated_at = datetime('now')
         WHERE id = ?`,
        [saleId]
      );

      // 5. Update Cash Session if cash refunded
      if (refundMethod === 'cash' && activeSessionId) {
        await tx.execute(
          `UPDATE cash_sessions
           SET total_cash_refunds = total_cash_refunds + ?,
               expected_cash = expected_cash - ?
           WHERE id = ?`,
          [calculatedTotalRefund, calculatedTotalRefund, activeSessionId]
        );
      }

      // 6. Audit Log
      await logAudit({
        actorId: userId,
        actorName: req.user!.fullName,
        action: 'SALE_RETURN_REFUND',
        entityType: 'sale_return',
        entityId: returnId,
        ipAddress: req.ip,
        changeSummary: `Processed return ${returnNumber} for invoice ${sale.invoice_number}. Refund: ৳${calculatedTotalRefund} (${refundMethod}). Reason: ${reason}`,
        details: { returnNumber, invoiceNumber: sale.invoice_number, totalRefund: calculatedTotalRefund, items: processedReturnItems },
        tx,
      });
    });

    res.status(201).json({
      data: {
        returnId,
        returnNumber,
        totalRefund: calculatedTotalRefund,
        refundMethod,
        message: 'Return processed and refund issued successfully',
      },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/returns - List returns
returnsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const returns = await db.query<any>(
      `SELECT sr.*, s.invoice_number as invoiceNumber, u.full_name as processedBy,
              COUNT(sri.id) as itemsCount
       FROM sale_returns sr
       JOIN sales s ON sr.sale_id = s.id
       JOIN users u ON sr.user_id = u.id
       LEFT JOIN sale_return_items sri ON sr.id = sri.return_id
       WHERE sr.branch_id = ?
       GROUP BY sr.id
       ORDER BY sr.created_at DESC LIMIT 50`,
      [branchId]
    );

    res.json({
      data: returns,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
