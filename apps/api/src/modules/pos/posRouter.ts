import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const posRouter = Router();

const checkoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
});

const checkoutPaymentSchema = z.object({
  method: z.enum(['cash', 'card', 'bkash', 'nagad', 'rocket', 'due']),
  amount: z.number().min(0, 'Payment amount must be non-negative'),
  transactionRef: z.string().optional(),
});

const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8, 'Valid idempotency key is required'),
  customerId: z.string().optional().nullable(),
  discountType: z.enum(['none', 'percentage', 'fixed']).default('none'),
  discountValue: z.number().min(0).default(0),
  items: z.array(checkoutItemSchema).min(1, 'Cart cannot be empty'),
  payments: z.array(checkoutPaymentSchema).min(1, 'At least one payment method is required'),
  notes: z.string().optional().default(''),
});

// POST /api/v1/sales/checkout - Authoritative Atomic POS Checkout
posRouter.post('/checkout', requireAuth, requirePermission('pos:checkout'), async (req, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { idempotencyKey, customerId, discountType, discountValue, items, payments, notes } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // 1. Check Idempotency Key
    const existingIdem = await db.query<any>(
      'SELECT id, status, response_body FROM idempotency_records WHERE key = ?',
      [idempotencyKey]
    );

    if (existingIdem.length > 0) {
      if (existingIdem[0].status === 'completed' && existingIdem[0].response_body) {
        // Return previously confirmed response to prevent double billing!
        return res.json(JSON.parse(existingIdem[0].response_body));
      } else {
        throw new AppError('Duplicate checkout request in progress.', 409, 'DUPLICATE_IDEMPOTENCY');
      }
    }

    // Register idempotency record
    await db.execute(
      `INSERT INTO idempotency_records (id, scope, key, request_hash, status)
       VALUES (?, 'checkout', ?, ?, 'pending')`,
      [`idem-${Date.now()}`, idempotencyKey, crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex')]
    );

    // 2. Validate Active Cash Session
    const activeSession = await db.query<any>(
      `SELECT id, status FROM cash_sessions WHERE branch_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
      [branchId, userId]
    );

    if (activeSession.length === 0) {
      throw new AppError('No open cashier session found. Please open a cash session before making sales.', 400, 'NO_OPEN_SESSION');
    }
    const sessionId = activeSession[0].id;

    // 3. Begin Atomic Database Transaction
    const result = await db.transaction(async (tx) => {
      // 4. Load Trusted Product Data from Server (Never trust client prices or stock)
      let subtotal = 0;
      let totalTax = 0;
      let totalCostBasis = 0;

      const processedItems: Array<{
        product: any;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        lineTax: number;
        lineDiscount: number;
        lineTotal: number;
      }> = [];

      for (const item of items) {
        const prodRows = await tx.query<any>(
          `SELECT p.id, p.name, p.sku, p.barcode, p.cost_price as costPrice,
                  p.selling_price as sellingPrice, p.tax_rate as taxRate, p.is_active as isActive,
                  COALESCE(sb.current_stock, 0) as currentStock
           FROM products p
           LEFT JOIN stock_balances sb ON p.id = sb.product_id AND sb.branch_id = ?
           WHERE p.id = ? AND p.branch_id = ?`,
          [branchId, item.productId, branchId]
        );

        if (prodRows.length === 0 || !prodRows[0].isActive) {
          throw new AppError(`Product [${item.productId}] not found or inactive.`, 404, 'PRODUCT_NOT_AVAILABLE');
        }

        const product = prodRows[0];

        // Stock concurrency check
        if (product.currentStock < item.quantity) {
          throw new AppError(
            `Insufficient stock for "${product.name}". Available: ${product.currentStock}, Requested: ${item.quantity}`,
            409,
            'INSUFFICIENT_STOCK'
          );
        }

        const unitPrice = Math.round(product.sellingPrice * 100) / 100;
        const lineBase = Math.round(unitPrice * item.quantity * 100) / 100;
        const lineTax = Math.round(lineBase * (product.taxRate / 100) * 100) / 100;

        subtotal += lineBase;
        totalTax += lineTax;
        totalCostBasis += Math.round(product.costPrice * item.quantity * 100) / 100;

        processedItems.push({
          product,
          quantity: item.quantity,
          unitPrice,
          costPrice: product.costPrice,
          lineTax,
          lineDiscount: 0,
          lineTotal: lineBase,
        });
      }

      // 5. Server Recalculation: Discount & Totals
      subtotal = Math.round(subtotal * 100) / 100;
      let discountAmount = 0;

      if (discountType === 'percentage') {
        discountAmount = Math.round(subtotal * (discountValue / 100) * 100) / 100;
      } else if (discountType === 'fixed') {
        discountAmount = Math.min(discountValue, subtotal);
      }

      // Check discount permission if discount > 0
      if (discountAmount > 0 && !req.user!.permissions.includes('pos:discount') && req.user!.roleName !== 'admin') {
        throw new AppError('You do not have permission to apply discounts.', 403, 'DISCOUNT_NOT_PERMITTED');
      }

      const netSubtotal = subtotal - discountAmount;
      const grandTotal = Math.round((netSubtotal + totalTax) * 100) / 100;

      // 6. Validate Payments
      let totalPaid = 0;
      let cashPaid = 0;
      let dueAmount = 0;

      for (const p of payments) {
        totalPaid += p.amount;
        if (p.method === 'cash') cashPaid += p.amount;
        if (p.method === 'due') dueAmount += p.amount;
      }
      totalPaid = Math.round(totalPaid * 100) / 100;

      if (dueAmount > 0 && !customerId) {
        throw new AppError('Cannot allocate due payment to Walk-in customer. Please select a registered customer.', 422, 'CUSTOMER_REQUIRED_FOR_DUE');
      }

      if (totalPaid < grandTotal) {
        throw new AppError(
          `Payment amount (${totalPaid}) is less than grand total (${grandTotal}).`,
          422,
          'INSUFFICIENT_PAYMENT'
        );
      }

      const changeAmount = cashPaid > 0 && totalPaid > grandTotal ? Math.round((totalPaid - grandTotal) * 100) / 100 : 0;
      const actualPaid = totalPaid - changeAmount;

      // 7. Generate Sequential Unique Invoice Number
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countRows = await tx.query<any>(
        "SELECT COUNT(*) as cnt FROM sales WHERE branch_id = ? AND date(created_at) = date('now')",
        [branchId]
      );
      const invoiceNumber = `INV-${datePart}-${String((countRows[0]?.cnt || 0) + 1).padStart(4, '0')}`;
      const saleId = `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 8. Insert Sales Header
      await tx.execute(
        `INSERT INTO sales (id, invoice_number, branch_id, user_id, customer_id, session_id, subtotal, discount_type, discount_value, discount_amount, tax_rate, tax_amount, rounding_amount, grand_total, paid_amount, change_amount, payment_status, sale_status, notes, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'completed', ?, ?)`,
        [
          saleId,
          invoiceNumber,
          branchId,
          userId,
          customerId || null,
          sessionId,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          5.0, // effective default rate
          totalTax,
          grandTotal,
          actualPaid,
          changeAmount,
          dueAmount > 0 ? (actualPaid > dueAmount ? 'partial' : 'due') : 'paid',
          notes || '',
          idempotencyKey,
        ]
      );

      // 9. Insert Immutable Sale Line Snapshots & Deduct Stock in Ledger
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        const lineId = `si-${saleId}-${i + 1}`;

        // Proportionate discount per line
        const lineDiscount = subtotal > 0 ? Math.round((item.lineTotal / subtotal) * discountAmount * 100) / 100 : 0;
        const lineFinal = item.lineTotal - lineDiscount + item.lineTax;

        await tx.execute(
          `INSERT INTO sale_items (id, sale_id, product_id, product_name, product_sku, unit_price, cost_price, quantity, discount_amount, tax_amount, line_total, returned_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            lineId,
            saleId,
            item.product.id,
            item.product.name,
            item.product.sku,
            item.unitPrice,
            item.costPrice,
            item.quantity,
            lineDiscount,
            item.lineTax,
            lineFinal,
          ]
        );

        // Concurrency-Safe Stock Deduction
        await tx.execute(
          `UPDATE stock_balances
           SET current_stock = current_stock - ?,
               version = version + 1,
               updated_at = datetime('now')
           WHERE product_id = ? AND branch_id = ?`,
          [item.quantity, item.product.id, branchId]
        );

        // Append to immutable Stock Movements Ledger
        await tx.execute(
          `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
           VALUES (?, ?, ?, ?, 'SALE', 'sale', ?, ?, ?, ?)`,
          [
            `sm-sale-${saleId}-${i + 1}`,
            branchId,
            item.product.id,
            -item.quantity,
            saleId,
            item.costPrice,
            `POS checkout sale invoice ${invoiceNumber}`,
            userId,
          ]
        );
      }

      // 10. Record Payments
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        const payAmount = p.method === 'cash' ? p.amount - changeAmount : p.amount;
        if (payAmount > 0) {
          await tx.execute(
            `INSERT INTO payments (id, sale_id, branch_id, method, amount, status, transaction_ref, notes)
             VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
            [`pay-${saleId}-${i + 1}`, saleId, branchId, p.method, payAmount, p.transactionRef || null, `POS checkout: ${p.method}`]
          );
        }
      }

      // 11. Update Customer Due Balance if any due was applied
      if (dueAmount > 0 && customerId) {
        await tx.execute(
          `UPDATE customers
           SET current_due = current_due + ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [dueAmount, customerId]
        );
      }

      // 12. Update Cash Session cash sales & expected cash
      const netCashReceived = Math.max(0, cashPaid - changeAmount);
      if (netCashReceived > 0) {
        await tx.execute(
          `UPDATE cash_sessions
           SET total_cash_sales = total_cash_sales + ?,
               expected_cash = expected_cash + ?
           WHERE id = ?`,
          [netCashReceived, netCashReceived, sessionId]
        );
      }

      // 13. Audit Log Entry
      await logAudit({
        actorId: userId,
        actorName: req.user!.fullName,
        action: 'SALE_CHECKOUT',
        entityType: 'sale',
        entityId: saleId,
        ipAddress: req.ip,
        changeSummary: `Checkout completed: Invoice ${invoiceNumber}, Grand Total ৳${grandTotal}, Paid ৳${actualPaid}`,
        details: { invoiceNumber, grandTotal, itemsCount: items.length, payments },
        tx,
      });

      // Fetch customer name for receipt
      let customerName = 'Walk-in Customer';
      if (customerId) {
        const cRow = await tx.query<any>('SELECT name FROM customers WHERE id = ?', [customerId]);
        if (cRow.length > 0) customerName = cRow[0].name;
      }

      // 14. Prepare Receipt Payload
      const receiptData = {
        invoiceNumber,
        saleId,
        date: new Date().toISOString(),
        cashier: req.user!.fullName,
        customerName,
        items: processedItems.map((pi) => ({
          name: pi.product.name,
          sku: pi.product.sku,
          quantity: pi.quantity,
          unitPrice: pi.unitPrice,
          total: pi.lineTotal,
        })),
        subtotal,
        discountAmount,
        taxAmount: totalTax,
        grandTotal,
        paidAmount: actualPaid,
        changeAmount,
        payments,
      };

      return receiptData;
    });

    const responsePayload = {
      data: result,
      meta: {
        requestId: crypto.randomUUID(),
        message: 'Checkout completed successfully',
      },
    };

    // Update idempotency record to completed
    await db.execute(
      `UPDATE idempotency_records
       SET status = 'completed',
           response_body = ?
       WHERE key = ?`,
      [JSON.stringify(responsePayload), idempotencyKey]
    );

    res.status(201).json(responsePayload);
  } catch (err) {
    next(err);
  }
});
