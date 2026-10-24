import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { requireAuth, requirePermission } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';
import { passwordComplexitySchema, createUserSchema, updateUserSchema } from '../shared/validationSchemas.js';

export const usersRouter = Router();

// GET /api/v1/users - List users
usersRouter.get('/', requireAuth, requirePermission('users.manage'), async (req, res, next) => {
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

// GET /api/v1/users/:id - Single user details with ownership check
usersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    // Ownership check: user can only read their own profile unless they have 'users:read' permission or are admin
    if (
      req.user!.id !== id &&
      !req.user!.permissions.includes('users:read') &&
      !req.user!.permissions.includes('users.read') &&
      req.user!.roleName !== 'admin'
    ) {
      throw new AppError('Forbidden: You can only read your own user profile', 403, 'FORBIDDEN');
    }

    const db = getDb();
    const users = await db.query<any>(
      `SELECT u.id, u.branch_id as branchId, u.username, u.email, u.full_name as fullName,
              u.role_id as roleId, r.name as roleName, u.status, u.last_login_at as lastLoginAt,
              u.created_at as createdAt, b.name as branchName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [id]
    );

    if (users.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json({
      data: users[0],
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users - Create user
usersRouter.post('/', requireAuth, requirePermission('users.manage'), async (req, res, next) => {
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

// PUT /api/v1/users/:id - Update user
usersRouter.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.id;
    // Ownership check: user can only edit self unless admin or has 'users:write' permission
    if (
      req.user!.id !== userId &&
      !req.user!.permissions.includes('users:write') &&
      !req.user!.permissions.includes('users.write') &&
      !req.user!.permissions.includes('users.manage') &&
      req.user!.roleName !== 'admin'
    ) {
      throw new AppError('Forbidden: You can only edit your own profile', 403, 'FORBIDDEN');
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Validation failed', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const db = getDb();
    const existing = await db.query<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Role or status escalation check: restrict to admin only
    if ((parsed.data.roleId || parsed.data.status) && req.user!.roleName !== 'admin') {
      throw new AppError('Forbidden: Only administrators can modify roles or status', 403, 'FORBIDDEN');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (parsed.data.fullName) {
      updates.push('full_name = ?');
      params.push(parsed.data.fullName);
    }
    if (parsed.data.email) {
      updates.push('email = ?');
      params.push(parsed.data.email);
    }
    if (parsed.data.password) {
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(parsed.data.password, 12));
    }
    if (parsed.data.roleId && req.user!.roleName === 'admin') {
      updates.push('role_id = ?');
      params.push(parsed.data.roleId);
    }
    if (parsed.data.status && req.user!.roleName === 'admin') {
      updates.push('status = ?');
      params.push(parsed.data.status);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      params.push(userId);
      await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      changeSummary: `Updated user ${userId}`,
    });

    res.json({
      data: { message: 'User updated successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/:id - Delete user
usersRouter.delete('/:id', requireAuth, requirePermission('users.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      throw new AppError('You cannot delete your own account', 400, 'SELF_DELETION_PROHIBITED');
    }

    const db = getDb();
    const existing = await db.query<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    if (existing[0].role_id === 'role-admin' && req.user!.roleName !== 'admin') {
      throw new AppError('Unauthorized: Only administrators can delete admin accounts', 403, 'FORBIDDEN');
    }

    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    await logAudit({
      actorId: req.user!.id,
      actorName: req.user!.fullName,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: id,
      ipAddress: req.ip,
      changeSummary: `Deleted user ${id}`,
    });

    res.json({
      data: { message: 'User deleted successfully' },
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/:id/status - Activate / Deactivate user
usersRouter.patch('/:id/status', requireAuth, requirePermission('users.manage'), async (req, res, next) => {
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
