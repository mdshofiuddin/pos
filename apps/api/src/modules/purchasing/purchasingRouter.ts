import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const purchasingRouter = Router();

// GET /api/v1/suppliers - List suppliers
purchasingRouter.get('/suppliers', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const suppliers = await db.query<any>(
      `SELECT s.*, COUNT(p.id) as totalPurchases
       FROM suppliers s
       LEFT JOIN purchases p ON s.id = p.supplier_id
       GROUP BY s.id
       ORDER BY s.company_name ASC`
    );

    res.json({
      data: suppliers,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const supplierSchema = z.object({
  name: z.string().min(2, 'Contact person name is required'),
  companyName: z.string().min(2, 'Company name is required'),
  phone: z.string().min(5, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional().default(''),
});

// POST /api/v1/suppliers - Create supplier
purchasingRouter.post('/suppliers', requireAuth, requirePermission('purchases:write'), async (req, res, next) => {
  try {
    const parsed = supplierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { name, companyName, phone, email, address } = parsed.data;
    const db = getDb();

    const dup = await db.query<any>('SELECT id FROM suppliers WHERE phone = ?', [phone]);
    if (dup.length > 0) {
      throw new AppError(`Supplier with phone "${phone}" already exists.`, 409, 'DUPLICATE_PHONE');
    }

    const supplierId = `sup-${Date.now()}`;
    await db.execute(
      `INSERT INTO suppliers (id, name, company_name, phone, email, address, total_purchased, total_paid, total_payable, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 1)`,
      [supplierId, name, companyName, phone, email || null, address]
    );

    res.status(201).json({
      data: { id: supplierId, message: 'Supplier created successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/purchases - List purchases
purchasingRouter.get('/purchases', requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;

    const purchases = await db.query<any>(
      `SELECT p.*, s.company_name as supplierName, u.full_name as createdByName,
              COUNT(pi.id) as itemsCount
       FROM purchases p
       JOIN suppliers s ON p.supplier_id = s.id
       JOIN users u ON p.created_by = u.id
       LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
       WHERE p.branch_id = ?
       GROUP BY p.id
       ORDER BY p.purchase_date DESC, p.created_at DESC`,
      [branchId]
    );

    res.json({
      data: purchases,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
});

const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  items: z.array(purchaseItemSchema).min(1, 'At least one purchase item is required'),
  paidAmount: z.number().min(0).default(0),
  notes: z.string().optional().default(''),
});

// POST /api/v1/purchases - Record Goods Receipt / Purchase
purchasingRouter.post('/purchases', requireAuth, requirePermission('purchases:write'), async (req, res, next) => {
  try {
    const parsed = createPurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { supplierId, items, paidAmount, notes } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    const purchaseId = `po-${Date.now()}`;
    const invoiceNumber = `PO-${Date.now().toString().slice(-6)}`;

    let subtotal = 0;
    for (const item of items) {
      subtotal += Math.round(item.unitCost * item.quantity * 100) / 100;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const grandTotal = subtotal; // tax if any can be calculated
    const dueAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);
    const paymentStatus = dueAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due';

    await db.transaction(async (tx) => {
      // 1. Create Purchase Header
      await tx.execute(
        `INSERT INTO purchases (id, branch_id, supplier_id, invoice_number, purchase_date, subtotal, tax_amount, grand_total, paid_amount, due_amount, payment_status, notes, created_by)
         VALUES (?, ?, ?, ?, date('now'), ?, 0, ?, ?, ?, ?, ?, ?)`,
        [purchaseId, branchId, supplierId, invoiceNumber, subtotal, grandTotal, paidAmount, dueAmount, paymentStatus, notes, userId]
      );

      // 2. Insert items, increment stock, append to movements ledger
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = Math.round(item.unitCost * item.quantity * 100) / 100;

        await tx.execute(
          `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost, total_cost)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [`poi-${purchaseId}-${i + 1}`, purchaseId, item.productId, item.quantity, item.unitCost, lineTotal]
        );

        // Update product cost price with latest acquisition cost
        await tx.execute(
          `UPDATE products
           SET cost_price = ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [item.unitCost, item.productId]
        );

        // Concurrency-safe Stock increment
        await tx.execute(
          `UPDATE stock_balances
           SET current_stock = current_stock + ?,
               version = version + 1,
               updated_at = datetime('now')
           WHERE product_id = ? AND branch_id = ?`,
          [item.quantity, item.productId, branchId]
        );

        // Append to immutable Stock Movements Ledger
        await tx.execute(
          `INSERT INTO stock_movements (id, branch_id, product_id, signed_quantity, movement_type, reference_type, reference_id, cost_price, notes, created_by)
           VALUES (?, ?, ?, ?, 'PURCHASE_RECEIPT', 'purchase', ?, ?, ?, ?)`,
          [
            `sm-po-${purchaseId}-${i + 1}`,
            branchId,
            item.productId,
            item.quantity,
            purchaseId,
            item.unitCost,
            `Goods receipt from purchase order ${invoiceNumber}`,
            userId,
          ]
        );
      }

      // 3. Update Supplier Balances
      await tx.execute(
        `UPDATE suppliers
         SET total_purchased = total_purchased + ?,
             total_paid = total_paid + ?,
             total_payable = total_payable + ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [grandTotal, paidAmount, dueAmount, supplierId]
      );

      // 4. Audit Log
      await logAudit({
        actorId: userId,
        actorName: req.user!.fullName,
        action: 'PURCHASE_GOODS_RECEIPT',
        entityType: 'purchase',
        entityId: purchaseId,
        ipAddress: req.ip,
        changeSummary: `Goods received: PO ${invoiceNumber}, Grand Total ৳${grandTotal}, Stock increased for ${items.length} items`,
        details: { invoiceNumber, supplierId, grandTotal, paidAmount, dueAmount },
        tx,
      });
    });

    res.status(201).json({
      data: { purchaseId, invoiceNumber, grandTotal, message: 'Goods receipt recorded and stock updated' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
