import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../../db/index.js';
import { generateToken } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logAudit } from '../../middleware/auditHelper.js';

export class AuthService {
  static async loginUser(username: string, password: string, ip?: string) {
    const db = getDb();

    // Query user by username or email
    const users = await db.query<any>(
      `SELECT u.id, u.branch_id as branchId, u.username, u.email, u.full_name as fullName,
              u.password_hash as passwordHash, u.status, u.role_id as roleId, r.name as roleName,
              b.name as branchName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN branches b ON u.branch_id = b.id
       WHERE u.username = ? OR u.email = ?`,
      [username, username]
    );

    if (users.length === 0) {
      // Timing-safe defense against enumeration
      await bcrypt.compare(password, '$2a$12$e8xL2k4l9Z1P3Q5W7E9R0u1I2O3P4A5S6D7F8G9H0J1K2L3M4N5O6');
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new AppError('This user account is currently deactivated.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      await logAudit({
        actorName: username,
        action: 'AUTH_FAILED_LOGIN',
        entityType: 'auth',
        ipAddress: ip,
        changeSummary: `Failed login attempt for user ${username}`,
      });
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login timestamp
    await db.execute("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);

    // Fetch user permissions
    const permRows = await db.query<any>(
      `SELECT p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.roleId]
    );
    const permissions = permRows.map((p) => p.name);

    // Check if there is an active cash session for this user/branch
    const activeSession = await db.query<any>(
      `SELECT id, opening_time as openingTime, opening_cash as openingCash, expected_cash as expectedCash
       FROM cash_sessions
       WHERE branch_id = ? AND user_id = ? AND status = 'open'
       ORDER BY opening_time DESC LIMIT 1`,
      [user.branchId, user.id]
    );

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.roleName,
      branchId: user.branchId,
    });

    await logAudit({
      actorId: user.id,
      actorName: user.fullName,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'auth',
      entityId: user.id,
      ipAddress: ip,
      changeSummary: `User ${user.username} logged in successfully`,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
        roleName: user.roleName,
        branchId: user.branchId,
        branchName: user.branchName,
        permissions,
      },
      activeSession: activeSession[0] || null,
    };
  }

  static async logoutUser(token?: string, user?: { id: string; fullName: string; username: string }, ip?: string) {
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const db = getDb();
      await db.execute(
        `INSERT INTO token_blacklist (token_hash, expires_at)
         VALUES (?, datetime('now', '+12 hours'))`,
        [tokenHash]
      );
    }

    if (user) {
      await logAudit({
        actorId: user.id,
        actorName: user.fullName,
        action: 'AUTH_LOGOUT',
        entityType: 'auth',
        entityId: user.id,
        ipAddress: ip,
        changeSummary: `User ${user.username} logged out safely`,
      });
    }

    return { message: 'Logged out successfully' };
  }
}
