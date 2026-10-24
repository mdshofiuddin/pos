import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, extractToken } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuthService } from './authService.js';
import { loginSchema } from '../shared/validationSchemas.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('Invalid login credentials format', 422, 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { username, password } = parsed.data;
    const loginResult = await AuthService.loginUser(username, password, req.ip);

    res.json({
      data: loginResult,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization || '');
    const result = await AuthService.logoutUser(token || undefined, req.user, req.ip);

    res.json({
      data: result,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({
      data: req.user,
      meta: { requestId: crypto.randomUUID() },
    });
  } catch (err) {
    next(err);
  }
});
