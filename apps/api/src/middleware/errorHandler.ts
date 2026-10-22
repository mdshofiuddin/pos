import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();

  // Log error internally with stack trace for debugging
  console.error(`[Error] RequestId: ${requestId} | Method: ${req.method} | URL: ${req.originalUrl}`);
  console.error(err);

  // If already known AppError or object with statusCode
  if (err instanceof AppError || (err && (typeof err.statusCode === 'number' || typeof err.status === 'number'))) {
    const statusCode = err.statusCode || err.status || 400;
    return res.status(statusCode).json({
      error: {
        code: err.code || (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST'),
        message: err.message,
        details: err.details || [],
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Zod validation error handling
  if (err.name === 'ZodError') {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data provided',
        details: err.issues || err.errors,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal error occurred. Please contact the administrator.',
      details: err.details || [],
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}
