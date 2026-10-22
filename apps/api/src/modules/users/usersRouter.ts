import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export const usersRouter = Router();

// GET /api/v1/users - List users
usersRouter.get('/', requireAuth, requirePermission('users:manage'), async (req, res, next) => {
  try {
    const db = getDb();
    const users = await db.query<any>(
      `SELECT u.id, u.username, u.email, u.full_name as fullName, u.role_id as roleId,
              r.name as roleName, u.status, u.last_login_at as lastLoginAt,
              u.created_at as createdAt, b.name as branchName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN branches b ON u.branch_id = b.id
       ORDER BY u.created_at DESC`
    );

    const roles = await db.query<any>('SELECT * FROM roles ORDER BY name ASC');

    res.json({
      data: { users, roles },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Valid email is required'),
  fullName: z.string().min(2, 'Full name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleId: z.string().min(1, 'Role is required'),
});

// POST /api/v1/users - Create user
usersRouter.post('/', requireAuth, requirePermission('users:manage'), async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { username, email, fullName, password, roleId } = parsed.data;
    const db = getDb();
    const branchId = req.user!.branchId;

    const dup = await db.query<any>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (dup.length > 0) {
      throw new AppError('A user with this username or email already exists.', 409, 'DUPLICATE_USER');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = `usr-${Date.now()}`;

    await db.execute(
      `INSERT INTO users (id, branch_id, username, email, full_name, password_hash, role_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [userId, branchId, username, email, fullName, passwordHash, roleId]
    );

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      changeSummary: `Created user ${username} with role ${roleId}`,
    });

    res.status(201).json({
      data: { id: userId, message: 'User created successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/status - Activate / Deactivate user
usersRouter.patch('/:id/status', requireAuth, requirePermission('users:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (status !== 'active' && status !== 'inactive') {
      throw new AppError('Status must be "active" or "inactive"', 422, 'VALIDATION_ERROR');
    }

    const db = getDb();
    if (id === req.user!.id) {
      throw new AppError('You cannot deactivate your own account', 400, 'SELF_DEACTIVATION_PROHIBITED');
    }

    const targetUsers = await db.query<any>('SELECT id, branch_id as branchId FROM users WHERE id = ?', [id]);
    if (targetUsers.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    if (req.user!.roleName !== 'admin' && targetUsers[0].branchId !== req.user!.branchId) {
      throw new AppError('Unauthorized: You cannot modify user accounts outside your branch', 403, 'FORBIDDEN');
    }

    await db.execute("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'USER_STATUS_CHANGE',
      entityType: 'user',
      entityId: id,
      ipAddress: req.ip,
      changeSummary: `User ${id} status set to ${status}`,
    });

    res.json({
      data: { message: `User status updated to ${status}` },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
