import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const sessionRouter = Router();

// GET /api/v1/cash-sessions/current - Get active cashier session
sessionRouter.get('/current', requireAuth, requirePermission('pos:session'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    const sessions = await db.query<any>(
      `SELECT cs.*, u.full_name as cashierName, b.name as branchName
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN branches b ON cs.branch_id = b.id
       WHERE cs.branch_id = ? AND cs.user_id = ? AND cs.status = 'open'
       ORDER BY cs.opening_time DESC LIMIT 1`,
      [branchId, userId]
    );

    res.json({
      data: sessions[0] || null,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/cash-sessions/open - Open new session
const openSessionSchema = z.object({
  openingCash: z.number().min(0, 'Opening cash float must be 0 or greater'),
  notes: z.string().optional().default(''),
});

sessionRouter.post('/open', requireAuth, requirePermission('pos:session'), async (req, res, next) => {
  try {
    const parsed = openSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { openingCash, notes } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    // Check if an open session already exists
    const existing = await db.query<any>(
      `SELECT id FROM cash_sessions WHERE branch_id = ? AND user_id = ? AND status = 'open'`,
      [branchId, userId]
    );

    if (existing.length > 0) {
      throw new AppError('You already have an active open cash session. Please close it before opening a new one.', 409, 'SESSION_ALREADY_OPEN');
    }

    const sessionId = `cs-${Date.now()}`;

    await db.execute(
      `INSERT INTO cash_sessions (id, branch_id, user_id, opening_time, opening_cash, total_cash_sales, total_cash_refunds, total_cash_in, total_cash_out, expected_cash, status, notes)
       VALUES (?, ?, ?, datetime('now'), ?, 0, 0, 0, 0, ?, 'open', ?)`,
      [sessionId, branchId, userId, openingCash, openingCash, notes]
    );

    await logAudit({
      actorId: userId,
      actorName: req.user!.fullName,
      action: 'CASHIER_SESSION_OPEN',
      entityType: 'cash_session',
      entityId: sessionId,
      ipAddress: req.ip,
      changeSummary: `Cashier session opened with opening cash float of ৳${openingCash}`,
    });

    res.status(201).json({
      data: { id: sessionId, message: 'Cashier session opened successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/cash-sessions/movements - Record cash in/out or petty expense
const cashMovementSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  movementType: z.enum(['cash_in', 'cash_out', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().min(3, 'Reason is required for cash movement audit'),
});

sessionRouter.post('/movements', requireAuth, requirePermission('pos:session'), async (req, res, next) => {
  try {
    const parsed = cashMovementSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { sessionId, movementType, amount, reason } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;
    const userId = req.user!.id;

    await db.transaction(async (tx) => {
      const sessionRows = await tx.query<any>(
        "SELECT * FROM cash_sessions WHERE id = ? AND status = 'open'",
        [sessionId]
      );

      if (sessionRows.length === 0) {
        throw new AppError('Active session not found or already closed', 404, 'SESSION_NOT_FOUND');
      }

      const activeSession = sessionRows[0];
      if (activeSession.user_id !== userId && req.user!.roleName !== 'admin' && req.user!.roleName !== 'manager') {
        throw new AppError('Unauthorized: You can only record movements in your own active cash session', 403, 'FORBIDDEN');
      }

      const movementId = `cm-${Date.now()}`;
      await tx.execute(
        `INSERT INTO cash_movements (id, session_id, branch_id, user_id, movement_type, amount, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [movementId, sessionId, branchId, userId, movementType, amount, reason]
      );

      // Update cash session expected cash and totals
      if (movementType === 'cash_in') {
        await tx.execute(
          `UPDATE cash_sessions
           SET total_cash_in = total_cash_in + ?,
               expected_cash = expected_cash + ?
           WHERE id = ?`,
          [amount, amount, sessionId]
        );
      } else {
        await tx.execute(
          `UPDATE cash_sessions
           SET total_cash_out = total_cash_out + ?,
               expected_cash = expected_cash - ?
           WHERE id = ?`,
          [amount, amount, sessionId]
        );
      }

      // If it was an expense, also record in expenses table
      if (movementType === 'expense') {
        await tx.execute(
          `INSERT INTO expenses (id, branch_id, category, amount, payment_method, reference_no, description, created_by)
           VALUES (?, ?, 'Petty Cash / Store Expense', ?, 'cash', ?, ?, ?)`,
          [`exp-${Date.now()}`, branchId, amount, movementId, reason, userId]
        );
      }

      await logAudit({
        actorId: userId,
        actorName: req.user!.fullName,
        action: 'CASH_MOVEMENT',
        entityType: 'cash_movement',
        entityId: movementId,
        ipAddress: req.ip,
        changeSummary: `Cash movement [${movementType}]: ৳${amount} for session ${sessionId}. Reason: ${reason}`,
        tx,
      });
    });

    res.json({
      data: { message: 'Cash movement recorded successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/cash-sessions/:id/close - Close session and compute variance
const closeSessionSchema = z.object({
  countedCash: z.number().min(0, 'Counted physical cash is required'),
  notes: z.string().optional().default(''),
});

sessionRouter.post('/:id/close', requireAuth, requirePermission('pos:session'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = closeSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { countedCash, notes } = parsed.data;
    const db = getDb();

    const sessionRows = await db.query<any>(
      "SELECT * FROM cash_sessions WHERE id = ? AND status = 'open'",
      [id]
    );

    if (sessionRows.length === 0) {
      throw new AppError('Active session not found or already closed', 404, 'SESSION_NOT_FOUND');
    }

    const session = sessionRows[0];
    if (session.user_id !== req.user!.id && req.user!.roleName !== 'admin' && req.user!.roleName !== 'manager') {
      throw new AppError('Unauthorized: You can only close your own active cash session', 403, 'FORBIDDEN');
    }
    const expectedCash = session.expected_cash;
    // Variance = Counted - Expected (negative means shortage, positive means surplus)
    const variance = countedCash - expectedCash;

    await db.execute(
      `UPDATE cash_sessions
       SET closing_time = datetime('now'),
           counted_cash = ?,
           cash_variance = ?,
           status = 'closed',
           notes = ?
       WHERE id = ?`,
      [countedCash, variance, notes ? `${session.notes || ''} | ${notes}` : session.notes, id]
    );

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'CASHIER_SESSION_CLOSE',
      entityType: 'cash_session',
      entityId: id,
      ipAddress: req.ip,
      changeSummary: `Session closed. Counted: ৳${countedCash}, Expected: ৳${expectedCash}, Variance: ৳${variance}`,
      details: { countedCash, expectedCash, variance },
    });

    res.json({
      data: {
        message: 'Cashier session closed successfully',
        expectedCash,
        countedCash,
        variance,
      },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/cash-sessions - History list
sessionRouter.get('/', requireAuth, requirePermission('pos:session'), async (req, res, next) => {
  try {
    const db = getDb();
    const branchId = req.user!.branchId;
    const isManagerOrAdmin = req.user!.roleName === 'admin' || req.user!.roleName === 'manager';

    const sql = `
      SELECT cs.*, u.full_name as cashierName, b.name as branchName
       FROM cash_sessions cs
       JOIN users u ON cs.user_id = u.id
       JOIN branches b ON cs.branch_id = b.id
       WHERE cs.branch_id = ? ${isManagerOrAdmin ? '' : 'AND cs.user_id = ?'}
       ORDER BY cs.opening_time DESC LIMIT 50
    `;
    const params = isManagerOrAdmin ? [branchId] : [branchId, req.user!.id];

    const list = await db.query<any>(sql, params);

    res.json({
      data: list,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
