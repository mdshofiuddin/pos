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
    const isSuperAdmin = req.user!.roleName === 'admin';
    const sql = `
      SELECT u.id, u.branch_id as branchId, u.username, u.email, u.full_name as fullName, u.role_id as roleId,
              r.name as roleName, u.status, u.last_login_at as lastLoginAt,
              u.created_at as createdAt, b.name as branchName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN branches b ON u.branch_id = b.id
       ${isSuperAdmin ? '' : 'WHERE u.branch_id = ?'}
       ORDER BY u.created_at DESC
    `;
    const params = isSuperAdmin ? [] : [req.user!.branchId];
    const users = await db.query<any>(sql, params);

    const roles = await db.query<any>('SELECT * FROM roles ORDER BY name ASC');

    res.json({
      data: { users, roles },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

const passwordComplexitySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const createUserSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(50),
  email: z.string().trim().email('Valid email is required'),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  password: passwordComplexitySchema,
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
});

// POST /api/v1/users - Create user
usersRouter.post('/', requireAuth, requirePermission('users:manage'), async (req, res, next) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { username, email, fullName, password, roleId, branchId: requestedBranchId } = parsed.data;
    const db = getDb();

    // Prevent privilege escalation: Only superadmins can assign the admin role
    if (roleId === 'role-admin' && req.user!.roleName !== 'admin') {
      throw new AppError('Unauthorized: Only administrators can assign the admin role', 403, 'FORBIDDEN');
    }

    // Branch scoping: non-admins can only create users inside their assigned branch
    const branchId = req.user!.roleName === 'admin' && requestedBranchId
      ? requestedBranchId
      : req.user!.branchId;

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

    const targetUsers = await db.query<any>(
      `SELECT u.id, u.branch_id as branchId, r.name as roleName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [id]
    );
    if (targetUsers.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    const targetUser = targetUsers[0];

    // Protect superadmin account from alteration by non-admins
    if (targetUser.roleName === 'admin' && req.user!.roleName !== 'admin') {
      throw new AppError('Unauthorized: Only administrators can modify admin accounts', 403, 'FORBIDDEN');
    }

    if (req.user!.roleName !== 'admin' && targetUser.branchId !== req.user!.branchId) {
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
