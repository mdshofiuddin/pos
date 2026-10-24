import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { AppError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  branchId: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

let ephemeralRuntimeSecret: string | null = null;

function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || config.jwtSecret || '').trim();
  if (secret.length >= 32) {
    return secret;
  }
  if (config.env === 'production') {
    throw new AppError(
      'CRITICAL: JWT_SECRET must be configured with at least 32 characters in production.',
      500,
      'INSECURE_CONFIGURATION'
    );
  }
  // Local development fallback
  if (!ephemeralRuntimeSecret) {
    ephemeralRuntimeSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[Security Notice] JWT_SECRET not set in environment. Generated 256-bit secure ephemeral key for local development only.');
  }
  return ephemeralRuntimeSecret;
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: '12h' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing or malformed token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const db = getDb();

    // Check token blacklist (revoked sessions)
    const blacklisted = await db.query<any>('SELECT 1 FROM token_blacklist WHERE token_hash = ?', [tokenHash]);
    if (blacklisted.length > 0) {
      throw new AppError('Session has expired or was revoked. Please log in again.', 401, 'TOKEN_REVOKED');
    }

    // Verify token with explicit HS256 algorithm restriction to prevent algorithm confusion attacks
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    } catch (err: any) {
      throw new AppError('Invalid or expired authentication token.', 401, 'INVALID_TOKEN');
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.userId) {
      throw new AppError('Malformed or invalid token payload.', 401, 'INVALID_TOKEN');
    }

    // Fetch user details from database
    const users = await db.query<any>(
      `SELECT u.id, u.username, u.email, u.full_name as fullName, u.role_id as roleId,
              u.branch_id as branchId, u.status, r.name as roleName
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (users.length === 0 || users[0].status !== 'active') {
      throw new AppError('User account not found or is deactivated.', 401, 'ACCOUNT_INACTIVE');
    }

    const user = users[0];

    // Fetch permissions
    const permRows = await db.query<any>(
      `SELECT p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [user.roleId]
    );

    const permissions = permRows.map((p) => p.name);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.roleName,
      branchId: user.branchId,
      permissions,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permissionName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    // Admin has superuser access
    if (req.user.roleName === 'admin') {
      return next();
    }

    if (!req.user.permissions.includes(permissionName)) {
      return next(
        new AppError(
          `Permission denied: Missing required permission [${permissionName}].`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}
