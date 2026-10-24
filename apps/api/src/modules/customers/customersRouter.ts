import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const customersRouter = Router();

// Apply requireAuth across all customer routes
customersRouter.use(requireAuth);

// GET /api/v1/customers - List customers
customersRouter.get('/', requireAuth, requirePermission('customers:read'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const search = ((req.query.search as string) || '').trim();

    // Add WHERE branch_id = req.user.branchId to all customer queries unless req.user.permissions.includes('customers:all_branches')
    const hasAllBranches = req.user!.permissions?.includes('customers:all_branches') || req.user!.roleName === 'admin';

    let sql = `
      SELECT c.*,
             COUNT(s.id) as totalInvoices,
             COALESCE(SUM(s.grand_total), 0) as totalPurchasedAmount
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.sale_status = 'completed'
      WHERE ${hasAllBranches ? '1=1' : 'c.branch_id = ?'}
    `;
    const params: any[] = hasAllBranches ? [] : [branchId];

    if (search) {
      sql += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` GROUP BY c.id ORDER BY c.current_due DESC, c.name ASC`;

    const customers = await db.query<any>(sql, params);

    res.json({
      data: customers,
      meta: { total: customers.length, requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional().default(''),
  creditLimit: z.number().min(0).default(0),
});

// POST /api/v1/customers - Create customer
customersRouter.post('/', requireAuth, requirePermission('customers:write'), async (req, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { name, phone, email, address, creditLimit } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;

    // Add WHERE branch_id = req.user.branchId to all customer queries unless req.user.permissions.includes('customers:all_branches')
    const hasAllBranches = req.user!.permissions?.includes('customers:all_branches') || req.user!.roleName === 'admin';
    const dup = await db.query<any>(
      `SELECT id FROM customers WHERE phone = ? ${hasAllBranches ? '' : 'AND branch_id = ?'}`,
      hasAllBranches ? [phone] : [phone, branchId]
    );
    if (dup.length > 0) {
      throw new AppError(`Customer with phone number "${phone}" already exists.`, 409, 'DUPLICATE_PHONE');
    }

    const customerId = `cust-${Date.now()}`;
    await db.execute(
      `INSERT INTO customers (id, branch_id, name, phone, email, address, credit_limit, current_due, loyalty_points, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1)`,
      [customerId, branchId, name, phone, email || null, address, creditLimit]
    );

    res.status(201).json({
      data: { id: customerId, message: 'Customer created successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers/:id/pay-due - Collect due payment
const payDueSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.enum(['cash', 'bkash', 'nagad', 'card', 'bank']).default('cash'),
  notes: z.string().optional().default(''),
});

customersRouter.post('/:id/pay-due', requireAuth, requirePermission('customers:write'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = payDueSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { amount, paymentMethod, notes } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;

    await db.transaction(async (tx) => {
      const custRows = await tx.query<any>('SELECT * FROM customers WHERE id = ? AND branch_id = ?', [id, branchId]);
      if (custRows.length === 0) throw new AppError('Customer not found in this branch or access denied', 404, 'NOT_FOUND');

      const cust = custRows[0];
      if (cust.current_due <= 0) {
        throw new AppError('This customer currently has no outstanding due balance.', 400, 'NO_DUE');
      }

      const payAmount = Math.min(amount, cust.current_due);
      const remainingDue = Math.round((cust.current_due - payAmount) * 100) / 100;

      // Update customer due balance scoped to branch
      await tx.execute(
        `UPDATE customers
         SET current_due = ?,
             updated_at = datetime('now')
         WHERE id = ? AND branch_id = ?`,
        [remainingDue, id, branchId]
      );

      // If paid via cash, update active cash session
      if (paymentMethod === 'cash') {
        const cs = await tx.query<any>(
          "SELECT id FROM cash_sessions WHERE branch_id = ? AND user_id = ? AND status = 'open'",
          [branchId, req.user!.id]
        );
        if (cs.length > 0) {
          await tx.execute(
            `UPDATE cash_sessions
             SET total_cash_in = total_cash_in + ?,
                 expected_cash = expected_cash + ?
             WHERE id = ?`,
            [payAmount, payAmount, cs[0].id]
          );

          await tx.execute(
            `INSERT INTO cash_movements (id, session_id, branch_id, user_id, movement_type, amount, reason)
             VALUES (?, ?, ?, ?, 'cash_in', ?, ?)`,
            [`cm-due-${Date.now()}`, cs[0].id, branchId, req.user!.id, payAmount, `Due collection from customer ${cust.name}`]
          );
        }
      }

      await logAudit({
        actorId: req.user!.id,
        actorName: req.user!.fullName,
        action: 'CUSTOMER_DUE_COLLECTION',
        entityType: 'customer',
        entityId: id,
        ipAddress: req.ip,
        changeSummary: `Collected due payment of ৳${payAmount} (${paymentMethod}) from ${cust.name}. Remaining due: ৳${remainingDue}`,
        details: { customerName: cust.name, amountPaid: payAmount, remainingDue, notes },
        tx,
      });
    });

    res.json({
      data: { message: 'Due payment collected successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
